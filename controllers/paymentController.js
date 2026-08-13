import crypto from "crypto";
import razorpayInstance from "../utils/razorpay.js";
import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import Coupon from "../models/coupon.js";
import ExpressError from "../utils/ExpressError.js";
import { validateAndCalculateCoupon } from "../utils/couponHelper.js";

export const showOrderSummary = async (req, res) => {
    const { listingId } = req.params;
    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    if (listing.type === "Free") {
        req.flash("error", "Ye test series free hai, seedha enroll kar sakte ho.");
        return res.redirect(`/test/${listing._id}`);
    }

    res.render("order/summary", { listing });
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

export const createOrder = async (req, res) => {
    const { listingId, donationAmount, couponCode } = req.body;
    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    const user = await User.findById(req.user._id);
    const alreadyEnrolled = user.enrolledListings.some(
        e => String(e.listing) === String(listingId)
    );
    if (alreadyEnrolled) {
        return res.status(400).json({ error: "Aap already enrolled ho is test series me" });
    }

    const safeDonation = Math.max(0, Math.floor(Number(donationAmount) || 0));

    let couponDiscount = 0;
    let appliedCouponId = null;

    // Coupon dobara server-side validate karo (client value pe bharosa mat karo)
    if (couponCode) {
        const result = await validateAndCalculateCoupon(
            couponCode, req.user._id, listingId, listing.price
        );
        if (result.valid) {
            couponDiscount = result.discount;
            appliedCouponId = result.couponId;
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
            couponCode: couponCode || "",
            couponDiscount: couponDiscount.toString()
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
        listingId,
        couponId
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const order = await razorpayInstance.orders.fetch(razorpay_order_id);

    if (
        order.notes.listingId !== listingId ||
        order.notes.userId !== String(req.user._id)
    ) {
        return res.status(400).json({ success: false, message: "Order details mismatch" });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found")

    const user = await User.findById(req.user._id);

    const alreadyEnrolled = user.enrolledListings.some(
        e => String(e.listing) === String(listingId)
    );

    if (!alreadyEnrolled) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (listing.validityDays || 365));

        user.enrolledListings.push({
            listing: listingId,
            expiresAt,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            amountPaid: order.amount / 100 
        });
        await user.save();

        // Coupon usage update karo
        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (coupon) {
                coupon.usedCount += 1;
                const existingUser = coupon.usedBy.find(u => String(u.user) === String(req.user._id));
                if (existingUser) {
                    existingUser.count += 1;
                } else {
                    coupon.usedBy.push({ user: req.user._id, count: 1 });
                }
                await coupon.save();
            }
        }
    }

    req.flash("success", `🎉 Payment successful! Enrolled in "${listing.title}".`);
    res.json({ success: true, slug: listing.slug });
};