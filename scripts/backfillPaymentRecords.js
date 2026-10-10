 
import "dotenv/config";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import mongoose from "mongoose";

import User from "../models/usersShema.js";
import Listing from "../models/listing.js";
import CustomTestPayment from "../models/customTestPayment.js";
import PaymentRecord from "../models/PaymentRecord.js";
import { generateInvoiceNo } from "../utils/paymentLedger.js";

const DRY = process.argv.includes("--dry-run");
const PURGE = process.argv.includes("--purge-owner-grants");
const DAY = 1000 * 60 * 60 * 24;

async function upsert(doc) {
    if (DRY) return !(await PaymentRecord.exists({ orderId: doc.orderId }));
    const r = await PaymentRecord.updateOne(
        { orderId: doc.orderId },
        { $setOnInsert: { ...doc, invoiceNo: generateInvoiceNo(), status: "success", source: "razorpay" } },
        { upsert: true }
    );
    return r.upsertedCount > 0;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected. ${DRY ? "[DRY RUN] " : ""}Starting backfill...`);

    let tsNew = 0, tsSkip = 0, ctNew = 0, ctSkip = 0;

    // ---------- 1) Test series (enrolledListings me amountPaid > 0) ----------
    const users = await User.find({ "enrolledListings.amountPaid": { $gt: 0 } })
        .select("name email enrolledListings").lean();

    const listingIds = [...new Set(users.flatMap(u => u.enrolledListings.filter(e => e.amountPaid > 0).map(e => String(e.listing))))];
    const listings = await Listing.find({ _id: { $in: listingIds } }).select("title").lean();
    const titleById = new Map(listings.map(l => [String(l._id), l.title]));

    for (const u of users) {
        for (const e of u.enrolledListings) {
            if (!(e.amountPaid > 0) || !e.orderId) { if (e.amountPaid > 0) tsSkip++; continue; }

            const created = await upsert({
                user: u._id, userName: u.name, userEmail: u.email,
                kind: "testseries",
                itemId: e.listing,
                itemTitle: titleById.get(String(e.listing)) || "Deleted Listing",
                validityDays: e.expiresAt ? Math.max(1, Math.round((new Date(e.expiresAt) - new Date(e.enrolledAt)) / DAY)) : null,
                baseAmount: null, couponCode: "", couponDiscount: 0, donation: 0,
                amount: e.amountPaid,
                orderId: e.orderId,
                paymentId: e.paymentId || null,
                paidAt: e.enrolledAt,
                expiresAt: e.expiresAt || null
            });
            created ? tsNew++ : tsSkip++;
        }
    }

    // ---------- 2) Custom Test (sirf asli paid, owner grant nahi) ----------
    const cts = await CustomTestPayment.find({
        status: "paid",
        amount: { $gt: 0 },
        source: { $ne: "owner" },
        razorpayOrderId: { $not: /^owner_grant_/ }
    }).lean();

    const ctUsers = await User.find({ _id: { $in: cts.map(c => c.user) } }).select("name email").lean();
    const userById = new Map(ctUsers.map(u => [String(u._id), u]));

    for (const c of cts) {
        const u = userById.get(String(c.user));
        const planLabel = c.plan === "promax" ? "Pro Max" : "Pro";
        const created = await upsert({
            user: c.user,
            userName: u?.name || "Deleted user",
            userEmail: u?.email || "",
            kind: "customtest",
            itemId: null,
            itemTitle: `Custom Test ${planLabel} (${c.months} month${c.months > 1 ? "s" : ""})`,
            plan: c.plan,
            months: c.months,
            validityDays: c.months * 30,
            baseAmount: c.baseAmount ?? c.amount,
            couponCode: c.couponCode || "",
            couponDiscount: c.couponDiscount || 0,
            donation: c.donation || 0,
            amount: c.amount,
            orderId: c.razorpayOrderId,
            paymentId: c.razorpayPaymentId || null,
            paidAt: c.createdAt,
            expiresAt: null
        });
        created ? ctNew++ : ctSkip++;
    }

    // ---------- 3) (optional) purane owner-grant docs saaf karo ----------
    if (PURGE) {
        const filter = { $or: [{ source: "owner" }, { razorpayOrderId: /^owner_grant_/ }] };
        const n = await CustomTestPayment.countDocuments(filter);
        if (!DRY) await CustomTestPayment.deleteMany(filter);
        console.log(`Owner-grant CustomTestPayment docs ${DRY ? "found" : "deleted"}: ${n}`);
    }

    console.log(`Test series : ${tsNew} new, ${tsSkip} skipped (already exists / no orderId)`);
    console.log(`Custom test : ${ctNew} new, ${ctSkip} skipped (already exists)`);
    console.log(DRY ? "Dry run done. Kuch save nahi hua." : "Backfill complete.");
    await mongoose.disconnect();
}

main().catch(err => { console.error("Backfill failed:", err); process.exit(1); });