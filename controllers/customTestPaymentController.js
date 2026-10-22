import crypto from "crypto";
import razorpayInstance from "../utils/razorpay.js";
import User from "../models/usersShema.js";
import CustomTestPricing from "../models/customTestPricing.js";
import CustomTestPayment from "../models/customTestPayment.js";
import Coupon from "../models/coupon.js";
import { recordPayment, applyRefund } from "../utils/paymentLedger.js";
import { validateCustomTestCoupon } from "../utils/couponHelper.js";
import { activateEnrollment, consumeCoupon } from "./paymentController.js";

const safeEqual = (a, b) => {
    const A = Buffer.from(String(a));
    const B = Buffer.from(String(b));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
};


export const applyCustomTestCoupon = async (req, res) => {
    try {
        const { code, plan, months } = req.body || {};
        if (!["pro", "promax"].includes(plan)) return res.status(400).json({ success: false, message: "Invalid plan." });

        const pricingDoc = await CustomTestPricing.findOne({ key: "default" });
        const row = (pricingDoc?.[plan] || []).find((r) => r.months === Number(months));
        if (!row) return res.status(400).json({ success: false, message: "Duration unavailable." });

        const user = await User.findById(req.user._id);
        const result = await validateCustomTestCoupon(code, user, row.price);
        if (!result.valid) return res.status(400).json({ success: false, message: result.message });

        res.json({ success: true, discount: result.discount, code: result.code, message: result.message });
    } catch (err) {
        console.error("applyCustomTestCoupon error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

 
export const createCustomTestOrder = async (req, res) => {
    try {
        const { plan, months, couponCode, donationAmount } = req.body || {};;
        if (!["pro", "promax"].includes(plan)) {
            return res.status(400).json({ success: false, message: "Invalid plan selected." });
        }

        const pricingDoc = await CustomTestPricing.findOne({ key: "default" });
        const matchedRow = (pricingDoc?.[plan] || []).find((r) => r.months === Number(months));
        if (!matchedRow) {
            return res.status(400).json({ success: false, message: "This subscription duration is currently unavailable." });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(401).json({ success: false, message: "Session expired." });

                const RANK = { free: 0, pro: 1, promax: 2 };
        const activeTier = user.customTestExpiresAt && user.customTestExpiresAt > new Date() ? user.customTestTier : "free";
        if (RANK[plan] < RANK[activeTier]) {
            return res.status(400).json({ success: false, message: "Your current plan is higher and still active. You can buy this plan after it expires." });
        }
        
                const safeDonation = Math.max(0, Math.min(10000, Math.floor(Number(donationAmount) || 0)));
        let couponDiscount = 0, appliedCouponId = null, appliedCode = "";
        if (couponCode) {
            const r = await validateCustomTestCoupon(couponCode, user, matchedRow.price);
            if (r.valid) { couponDiscount = r.discount; appliedCouponId = r.couponId; appliedCode = r.code; }
        }
        const finalAmount = Math.max(1, matchedRow.price - couponDiscount + safeDonation);
        const options = {
            amount: Math.round(finalAmount * 100),
            currency: "INR",
            receipt: `ct_${Date.now()}`,
                       notes: {
                userId: req.user._id.toString(), plan, months: String(months), kind: "custom_test_subscription",
                couponDiscount: String(couponDiscount), donation: String(safeDonation),
            },
        };
        const order = await razorpayInstance.orders.create(options);

        await CustomTestPayment.create({
            user: req.user._id, plan, months: Number(months), amount: finalAmount,             baseAmount: matchedRow.price, couponCode: appliedCode, couponId: appliedCouponId,
            couponDiscount, donation: safeDonation,
            razorpayOrderId: order.id, status: "created",
        });

        res.json({
            success: true, orderId: order.id, amount: order.amount, currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
            name: `WarmupExam ${plan === "promax" ? "Pro Max" : "Pro"} — ${months} month${Number(months) > 1 ? "s" : ""}`,
            userName: user.name, userEmail: user.email, userContact: user.mobile || "9999999999",
            plan, months: Number(months),
        });
    } catch (err) {
        console.error("createCustomTestOrder error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

async function activateSubscription({ razorpayOrderId, razorpayPaymentId, source }) {
    // ATOMIC CLAIM: verify aur webhook ek saath aaye to sirf ek aage badhega
    const claimed = await CustomTestPayment.findOneAndUpdate(
        { razorpayOrderId, status: { $ne: "paid" } },
        { $set: { status: "paid", razorpayPaymentId, source } },
        { new: true }
    );
    if (!claimed) {
        const existing = await CustomTestPayment.findOne({ razorpayOrderId });
        if (!existing) throw new Error("Payment record not found");
        if (existing.status === "paid") {
            const u = await User.findById(existing.user);
            if (u) {
                await recordPayment({
                    user: u, kind: "customtest", itemId: null,
                    itemTitle: `Custom Test ${existing.plan === "promax" ? "Pro Max" : "Pro"} (${existing.months} month${existing.months > 1 ? "s" : ""})`,
                    plan: existing.plan, months: existing.months, validityDays: existing.months * 30,
                    baseAmount: existing.baseAmount ?? existing.amount,
                    couponCode: existing.couponCode || "", couponDiscount: existing.couponDiscount || 0,
                    donation: existing.donation || 0, amount: existing.amount,
                    orderId: razorpayOrderId, paymentId: razorpayPaymentId, expiresAt: u.customTestExpiresAt
                });
            }
        }
        return { alreadyProcessed: true };
    }

    // plan / months / user DB record se (order notes ya request pe bharosa nahi)
    const { plan, months } = claimed;

    let user;
    try {
        user = await User.findById(claimed.user);
        if (!user) throw new Error("User not found");

        const now = new Date();
        const isSameTierActive = user.customTestTier === plan && user.customTestExpiresAt && user.customTestExpiresAt > now;
        const base = isSameTierActive ? user.customTestExpiresAt : now;
        const newExpiresAt = new Date(base);
        newExpiresAt.setDate(newExpiresAt.getDate() + Number(months) * 30);

        user.customTestTier = plan;
        user.customTestExpiresAt = newExpiresAt;
        await user.save();
    } catch (err) {
        // activation fail: claim wapas kholo taaki webhook retry / verify dobara chal sake
        await CustomTestPayment.updateOne({ _id: claimed._id }, { $set: { status: "created" } });
        throw err;
    }

    // Ledger + coupon: try ke bahar
    const planLabel = plan === "promax" ? "Pro Max" : "Pro";
    await recordPayment({
        user,
        kind: "customtest",
        itemId: null,
        itemTitle: `Custom Test ${planLabel} (${Number(months)} month${Number(months) > 1 ? "s" : ""})`,
        plan,
        months: Number(months),
        validityDays: Number(months) * 30,
        baseAmount: claimed.baseAmount ?? claimed.amount,
        couponCode: claimed.couponCode || "",
        couponDiscount: claimed.couponDiscount || 0,
        donation: claimed.donation || 0,
        amount: claimed.amount,
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        expiresAt: user.customTestExpiresAt
    });

        if (claimed.couponId) {
        try {
            await consumeCoupon(claimed.couponId, user._id);
        } catch (e) {
            console.error("coupon consume failed:", claimed.couponId, e);
        }
    }

    return { alreadyProcessed: false, tier: user.customTestTier, expiresAt: user.customTestExpiresAt };
}

export const verifyCustomTestPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, months } = req.body || {};
        if (!["pro", "promax"].includes(plan)) {
            return res.status(400).json({ success: false, message: "Invalid order data." });
        }
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing payment details." });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString()).digest("hex");
                if (!safeEqual(expectedSignature, razorpay_signature)) {
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        const order = await razorpayInstance.orders.fetch(razorpay_order_id);
        if (
            order.notes.userId !== String(req.user._id) ||
            order.notes.plan !== plan ||
            order.notes.months !== String(months) ||
            order.notes.kind !== "custom_test_subscription"
        ) {
            return res.status(400).json({ success: false, message: "Order details mismatch" });
        }

                const stored = await CustomTestPayment.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
        if (!stored || stored.plan !== plan || stored.months !== Number(months) ||
            Math.round(stored.amount * 100) !== order.amount) {
            return res.status(400).json({ success: false, message: "Order details mismatch" });
        }

                const result = await activateSubscription({
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            source: "client_verify",
        });
        req.flash("success", `🎉 Payment successful! Custom Test ${plan === "promax" ? "Pro Max" : "Pro"} activated.`);
        res.json({ success: true, tier: result.tier, expiresAt: result.expiresAt });
    } catch (err) {
        console.error("verifyCustomTestPayment error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const razorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(req.rawBody).digest("hex");
         if (!safeEqual(signature, expected)) return res.status(400).json({ success: false });

        const event = req.body;

        // ---------- REFUND EVENTS (panel se ho ya Razorpay Dashboard se, dono yahi aate hain) ----------
        if (typeof event.event === "string" && event.event.startsWith("refund.")) {
            const refund = event.payload?.refund?.entity;
            if (refund?.payment_id) {
                const status = event.event === "refund.failed" ? "failed"
                    : event.event === "refund.processed" ? "processed" : "created";
                await applyRefund({
                    paymentId: refund.payment_id,
                    refund: { id: refund.id, amount: refund.amount, status }
                });
            }
            return res.json({ success: true });
        }

                if (event.event === "payment.failed") {
            const failed = event.payload?.payment?.entity;
            if (failed?.order_id) {
                await CustomTestPayment.updateOne(
                    { razorpayOrderId: failed.order_id, status: "created" },
                    { $set: { status: "failed" } }
                );
            }
            return res.json({ success: true });
        }

        if (event.event !== "payment.captured") return res.json({ success: true });

        const payment = event.payload.payment.entity;
        const order = await razorpayInstance.orders.fetch(payment.order_id);
              // Test series order (createOrder ke notes me listingId hota hai)
        if (order.notes?.listingId && order.notes?.userId) {
            try {
                await activateEnrollment({
                    userId: order.notes.userId,
                    listingId: order.notes.listingId,
                    order,
                    paymentId: payment.id
                });
            } catch (e) {
                if (e?.statusCode === 404) {
                    console.error("webhook: listing/user missing", e.message);
                    return res.json({ success: true });
                }
                throw e;
            }
            return res.json({ success: true });
        }

        if (order.notes?.kind !== "custom_test_subscription") return res.json({ success: true });

        await activateSubscription({
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
            source: "webhook",
        });
        res.json({ success: true });
    } catch (err) {
        console.error("razorpayWebhook error:", err);
        res.status(500).json({ success: false });
    }
};