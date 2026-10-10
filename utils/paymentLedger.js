import PaymentRecord from "../models/PaymentRecord.js";
import User from "../models/usersShema.js";
import razorpayInstance from "./razorpay.js";
import { cleanupExpiredBatchData } from "./cleanupHelpers.js";

// ---------- chhota invoice number: WE + 10 digits ----------
export function generateInvoiceNo() {
    const t = String(Date.now()).slice(-7);
    const r = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `WE${t}${r}`;
}

// ---------- Razorpay se payment method nikalo (UPI / Card / Netbanking / Wallet) ----------
export async function fetchPaymentMethod(paymentId) {
    if (!paymentId) return { type: "", detail: "" };
    try {
        let p;
        try {
            p = await razorpayInstance.payments.fetch(paymentId, { "expand[]": "card" });
        } catch (_) {
            p = await razorpayInstance.payments.fetch(paymentId);
        }
        switch (p.method) {
            case "upi":
                return { type: "UPI", detail: p.vpa || "" };
            case "card": {
                const net = p.card?.network || "";
                const last4 = p.card?.last4 ? `•••• ${p.card.last4}` : "";
                return { type: "Card", detail: [net, last4].filter(Boolean).join(" ") };
            }
            case "netbanking":
                return { type: "Netbanking", detail: p.bank || "" };
            case "wallet":
                return { type: "Wallet", detail: p.wallet || "" };
            default:
                return { type: p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : "", detail: "" };
        }
    } catch (err) {
        console.error("[PaymentRecord] payment method fetch failed:", paymentId, err?.error?.description || err.message);
        return { type: "", detail: "" };
    }
}

// ---------- ASLI payment ko permanent ledger me likho (idempotent: orderId unique) ----------
// Kabhi throw nahi karta: record fail ho to bhi user ka enrollment/activation nahi rukna chahiye.
export async function recordPayment({ user, ...fields }) {
    try {
        const method = await fetchPaymentMethod(fields.paymentId);

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await PaymentRecord.updateOne(
                    { orderId: fields.orderId },
                    {
                        $setOnInsert: {
                            ...fields,
                            user: user._id,
                            userName: user.name,
                            userEmail: user.email,
                            methodType: method.type,
                            methodDetail: method.detail,
                            invoiceNo: generateInvoiceNo(),
                            status: "success",
                            source: "razorpay",
                            paidAt: new Date()
                        }
                    },
                    { upsert: true }
                );
                return;
            } catch (err) {
                // duplicate key: ya to record pehle se hai (theek), ya invoiceNo collide hua (naya bana ke retry)
                if (err?.code === 11000 && attempt < 2) {
                    if (await PaymentRecord.exists({ orderId: fields.orderId })) return;
                    continue;
                }
                throw err;
            }
        }
    } catch (err) {
        console.error("[PaymentRecord] save FAILED:", fields.orderId, err);
    }
}

// ---------- Full refund par access hatao (expire jaisa) ----------
async function revokeAccess(rec) {
    if (rec.kind === "testseries" && rec.itemId) {
        const user = await User.findById(rec.user).select("enrolledListings");
        if (!user) return;
        // Sirf tab hatao jab enrollment isi payment ki ho (user ne baad me dobara kharida ho to wo na chhue)
        const enr = user.enrolledListings.find(
            e => String(e.listing) === String(rec.itemId) && e.orderId === rec.orderId
        );
         if (enr) await cleanupExpiredBatchData(rec.user, rec.itemId, { force: true });
        return;
    }

    if (rec.kind === "customtest") {
        const user = await User.findById(rec.user);
        if (!user) return;
        // Agar user ka tier ab kisi aur plan pe hai, to ye payment pehle hi replace ho chuka hai
        if (user.customTestTier !== rec.plan || !user.customTestExpiresAt) return;

        const newExpiry = new Date(user.customTestExpiresAt);
        newExpiry.setDate(newExpiry.getDate() - (rec.months || 0) * 30);

        if (newExpiry <= new Date()) {
            user.customTestTier = "free";
            user.customTestExpiresAt = null;
        } else {
            user.customTestExpiresAt = newExpiry;
        }
        await user.save();
    }
}

// ---------- Refund ka asar record pe lagao (webhook + panel dono yahi call karte hain, idempotent) ----------
// refund: { id, amount (paise), status }  // status: "failed" ho to count nahi hoga
export async function applyRefund({ paymentId, refund }) {
    if (!paymentId || !refund?.id) return { found: false };

    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const rec = await PaymentRecord.findOne({ paymentId });
            if (!rec) return { found: false };

            const entryStatus = refund.status === "failed" ? "failed" : (refund.status === "processed" ? "processed" : "created");
            const entry = rec.refunds.find(r => r.refundId === refund.id);
                        if (entry) {
                if (entry.status !== "processed") entry.status = entryStatus;   // processed wapas created na ho
                entry.amount = (Number(refund.amount) || 0) / 100;
            } else {
                rec.refunds.push({ refundId: refund.id, amount: (Number(refund.amount) || 0) / 100, status: entryStatus });
            }

            const refunded = rec.refunds
                .filter(r => r.status !== "failed")
                .reduce((s, r) => s + r.amount, 0);

            rec.refundedAmount = refunded;
            rec.status = Math.round(refunded * 100) >= Math.round(rec.amount * 100)
                ? "refunded"
                : (refunded > 0 ? "partially_refunded" : "success");
            rec.refundedAt = refunded > 0 ? (rec.refundedAt || new Date()) : null;
            await rec.save();

                        const processedTotal = rec.refunds
                .filter(r => r.status === "processed")
                .reduce((s, r) => s + r.amount, 0);

            if (rec.status === "refunded" && Math.round(processedTotal * 100) >= Math.round(rec.amount * 100)) {
                const claimed = await PaymentRecord.findOneAndUpdate(
                    { _id: rec._id, accessRevoked: { $ne: true } },
                    { $set: { accessRevoked: true } }
                );
                if (claimed) {
                    try {
                        await revokeAccess(rec);
                    } catch (e) {
                        await PaymentRecord.updateOne({ _id: rec._id }, { $set: { accessRevoked: false } });
                        throw e;
                    }
                }
            }
            return { found: true, status: rec.status, refundedAmount: rec.refundedAmount };
        } catch (err) {
            if (err?.name === "VersionError" && attempt < 2) continue;   // concurrent webhook, dobara try
            throw err;
        }
    }
}