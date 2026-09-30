import crypto from "crypto";
import razorpayInstance from "../utils/razorpay.js";
import User from "../models/usersShema.js";
import CustomTestPricing from "../models/customTestPricing.js";
import CustomTestPayment from "../models/customTestPayment.js";
import Coupon from "../models/coupon.js";
import { validateCustomTestCoupon } from "../utils/couponHelper.js";



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

async function activateSubscription({ userId, plan, months, razorpayOrderId, razorpayPaymentId, source }) {
    const paymentRecord = await CustomTestPayment.findOne({ razorpayOrderId });
    if (!paymentRecord) throw new Error("Payment record not found");
    if (paymentRecord.status === "paid") return { alreadyProcessed: true, tier: plan };

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const now = new Date();
    const isSameTierActive = user.customTestTier === plan && user.customTestExpiresAt && user.customTestExpiresAt > now;
    const base = isSameTierActive ? user.customTestExpiresAt : now;
    const newExpiresAt = new Date(base);
    newExpiresAt.setDate(newExpiresAt.getDate() + Number(months) * 30);

    user.customTestTier = plan;
    user.customTestExpiresAt = newExpiresAt;
    await user.save();

    paymentRecord.status = "paid";
    paymentRecord.razorpayPaymentId = razorpayPaymentId;
    paymentRecord.source = source;
    await paymentRecord.save();

        if (paymentRecord.couponId) {
        await Coupon.updateOne({ _id: paymentRecord.couponId }, { $inc: { usedCount: 1 } });
        const upd = await Coupon.updateOne(
            { _id: paymentRecord.couponId, "usedBy.user": userId },
            { $inc: { "usedBy.$.count": 1 } }
        );
        if (!upd.modifiedCount) {
            await Coupon.updateOne({ _id: paymentRecord.couponId }, { $push: { usedBy: { user: userId, count: 1 } } });
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
        if (expectedSignature !== razorpay_signature) {
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

        const pricingDoc = await CustomTestPricing.findOne({ key: "default" });
        const matchedRow = (pricingDoc?.[plan] || []).find((r) => r.months === Number(months));
        const expected = matchedRow
    ? Math.max(1, matchedRow.price - Number(order.notes.couponDiscount || 0) + Number(order.notes.donation || 0))
    : 0;
if (!matchedRow || Math.round(expected * 100) !== order.amount) {
            return res.status(400).json({ success: false, message: "Payment amount mismatch. The pricing has changed. Please start the payment again." });
        }

        const result = await activateSubscription({
            userId: req.user._id, plan, months,
            razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id,
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
        if (signature !== expected) return res.status(400).json({ success: false });

        const event = req.body;
        if (event.event !== "payment.captured") return res.json({ success: true });

        const payment = event.payload.payment.entity;
        const order = await razorpayInstance.orders.fetch(payment.order_id);
        const { userId, plan, months, kind } = order.notes;
        if (kind !== "custom_test_subscription") return res.json({ success: true });

        await activateSubscription({
            userId, plan, months,
            razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id,
            source: "webhook",
        });
        res.json({ success: true });
    } catch (err) {
        console.error("razorpayWebhook error:", err);
        res.status(500).json({ success: false });
    }
};