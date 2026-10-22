import crypto from "crypto";
import razorpayInstance from "../utils/razorpay.js";
import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import Coupon from "../models/coupon.js";
import { recordPayment } from "../utils/paymentLedger.js";
import ExpressError from "../utils/ExpressError.js";
import { validateAndCalculateCoupon } from "../utils/couponHelper.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";
import { isSafeRedirectPath } from "../utils/safeRedirect.js";


// Signature compare timing-safe tareeke se
const safeEqual = (a, b) => {
    const A = Buffer.from(String(a));
    const B = Buffer.from(String(b));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
};

export const showOrderSummary = async (req, res) => {
    const { listingId } = req.params;
    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    if (listing.type === "Free") {
        req.flash("error", "This test series is free — you can enroll directly.");
        return res.redirect(`/test/${listing._id}`);
    }

    const baseUrl = process.env.BASE_URL || "https://warmupexam.com";
    let backUrl = req.query.from;
    if (!backUrl) {
        const referer = req.get("referer");
        if (referer && referer.startsWith(baseUrl)) backUrl = referer.replace(baseUrl, "");
    }
    // sirf apna internal path allow karo (open redirect se bachav), aur order page khud na ho
    if (!isSafeRedirectPath(backUrl) || backUrl.startsWith("/order-summary")) {
        backUrl = "/alltests";
    }

    res.render("order/summary", { listing, backUrl, robots: "noindex, nofollow" });
};

// Coupon apply/validate (sirf calculate karta hai, order nahi banata)
export const applyCoupon = async (req, res) => {
    const { code, listingId } = req.body;
    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    const result = await validateAndCalculateCoupon(
        code,
        req.user._id,
        listingId,
        listing.price
    );

    if (!result.valid) {
        return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
        success: true,
        discount: result.discount,
        message: result.message
    });
};

// Coupon usage atomic tareeke se (lost-update nahi hoga)
export async function consumeCoupon(couponId, userId) {
    await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: 1 } });
    const upd = await Coupon.updateOne(
        { _id: couponId, "usedBy.user": userId },
        { $inc: { "usedBy.$.count": 1 } }
    );
    if (!upd.modifiedCount) {
        const pushed = await Coupon.updateOne(
            { _id: couponId, "usedBy.user": { $ne: userId } },
            { $push: { usedBy: { user: userId, count: 1 } } }
        );
        if (!pushed.modifiedCount) {
            // parallel request ne entry bana di, to count badha do
            await Coupon.updateOne(
                { _id: couponId, "usedBy.user": userId },
                { $inc: { "usedBy.$.count": 1 } }
            );
        }
    }
}

/**
 * Payment ke baad enrollment ka ek hi shared logic.
 * verifyPayment (browser) aur webhook (Step 2) dono isi ko call karenge.
 * Idempotent hai: 2 baar chale to bhi enrollment/coupon/ledger ek hi baar bante hain.
 */
export async function activateEnrollment({ userId, listingId, order, paymentId }) {
    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    const user = await User.findById(userId);
    if (!user) throw new ExpressError(404, "User not found");

    const now = new Date();
    const validityDays = listing.validityDays || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // 1) Is listing ki purani EXPIRED entry ho to hata do (valid ya suspended ko haath nahi lagta)
    await User.updateOne(
        { _id: userId },
        {
            $pull: {
                enrolledListings: {
                    listing: listing._id,
                    suspendedByOwner: { $ne: true },
                    expiresAt: { $lte: now }
                }
            }
        }
    );

    // 2) Atomic push: tabhi hoga jab is listing ki koi entry hai hi nahi (double-click/webhook race safe)
    const result = await User.updateOne(
        { _id: userId, "enrolledListings.listing": { $ne: listing._id } },
        {
            $push: {
                enrolledListings: {
                    listing: listing._id,
                    enrolledAt: now,
                    expiresAt,
                    paymentId,
                    orderId: order.id,
                    amountPaid: order.amount / 100
                }
            }
        }
    );
    const newlyEnrolled = result.modifiedCount === 1;

    // 3) Coupon sirf order notes se (server ne validate kiya tha), aur sirf naye enrollment par
    if (newlyEnrolled && order.notes?.couponId) {
        await consumeCoupon(order.notes.couponId, userId);
    }

    // 4) Permanent ledger (orderId unique: 2 baar chale to bhi ek hi record)
    //    Agar user pehle se enrolled tha (double payment), record phir bhi banta hai taaki refund kar sako.
    await recordPayment({
        user,
        kind: "testseries",
        itemId: listing._id,
        itemTitle: listing.title,
        validityDays,
        baseAmount: Number(order.notes?.baseAmount) || listing.price,
        couponCode: order.notes?.couponCode || "",
        couponDiscount: Number(order.notes?.couponDiscount) || 0,
        donation: Number(order.notes?.donationAmount) || 0,
        amount: order.amount / 100,
        orderId: order.id,
        paymentId,
        expiresAt: newlyEnrolled ? expiresAt : null
    });

    return { listing, newlyEnrolled };
}

export const createOrder = async (req, res) => {
    const { listingId, donationAmount, couponCode } = req.body;

    if (typeof listingId !== "string" || !listingId) {
        return res.status(400).json({ error: "Invalid request." });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    if (listing.type === "Free") {
        throw new ExpressError(400, "This test series is free. No payment is required to enroll.");
    }

    // Private (hidden) series direct ID se nahi bik sakti.
    // Agar aap private series ko direct link se bechte ho to ye 3 lines hata dena.
    if (listing.visibility && listing.visibility !== "public") {
        throw new ExpressError(404, "Test Series Not Found");
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: "Session expired. Please login again." });

    const existing = user.enrolledListings.find(
        e => String(e.listing) === String(listingId)
    );

    if (existing) {
        const isExpired =
            existing.expiresAt &&
            new Date(existing.expiresAt) <= new Date() &&
            !existing.suspendedByOwner;

        if (!isExpired) {
            return res.status(400).json({ error: "You are already enrolled in this test series." });
        }

        // Expired entry: purana data saaf karo (enrollController jaisa rule), phir dobara kharidne do
        await cleanupExpiredBatchData(user._id, listingId);
    }

    // Donation: 0 se 10000 ke beech
    const safeDonation = Math.max(0, Math.min(10000, Math.floor(Number(donationAmount) || 0)));

    let couponDiscount = 0;
    let appliedCouponId = null;
    let appliedCouponCode = "";

    // Coupon dobara server-side validate karo (client value pe bharosa mat karo)
    if (couponCode) {
        const result = await validateAndCalculateCoupon(
            couponCode, req.user._id, listingId, listing.price
        );
        if (result.valid) {
            couponDiscount = result.discount;
            appliedCouponId = result.couponId;
            appliedCouponCode = result.code || "";
        }
    }

    const finalAmount = Math.max(1, listing.price - couponDiscount + safeDonation);

    const options = {
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: {
            listingId: listing._id.toString(),
            userId: req.user._id.toString(),
            donationAmount: safeDonation.toString(),
            // client ka raw code nahi, server ne jo validate kiya wahi store hota hai
            couponCode: appliedCouponCode,
            couponId: appliedCouponId ? String(appliedCouponId) : "",
            couponDiscount: couponDiscount.toString(),
            baseAmount: String(listing.price)
        }
    };

    const order = await razorpayInstance.orders.create(options);

    res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        name: listing.title,
        userName: req.user.name,
        userEmail: req.user.email,
        userContact: req.user.mobile || "9999999999",
        couponId: appliedCouponId
    });
};

export const verifyPayment = async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        listingId
    } = req.body;

    // couponId ab client se nahi liya jata: sirf order notes se (activateEnrollment me)
    const fields = [razorpay_order_id, razorpay_payment_id, razorpay_signature, listingId];
    if (fields.some(v => typeof v !== "string" || !v)) {
        return res.status(400).json({ success: false, message: "Missing payment details." });
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

    if (!safeEqual(expectedSignature, razorpay_signature)) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const order = await razorpayInstance.orders.fetch(razorpay_order_id);

    if (
        order.notes.listingId !== listingId ||
        order.notes.userId !== String(req.user._id)
    ) {
        return res.status(400).json({ success: false, message: "Order details mismatch" });
    }

    const { listing } = await activateEnrollment({
        userId: req.user._id,
        listingId,
        order,
        paymentId: razorpay_payment_id
    });

    req.flash("success", `🎉 Payment successful! Enrolled in "${listing.title}".`);
    res.json({ success: true, slug: listing.slug });
};