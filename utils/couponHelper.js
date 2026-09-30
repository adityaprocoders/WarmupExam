import Coupon from "../models/coupon.js";
import { getValidEnrollments } from "./cleanupHelpers.js";

export async function validateAndCalculateCoupon(code, userId, listingId, cartAmount) {
    if (!code) return { valid: false, message: "Coupon code required" };

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon || !coupon.isActive) {
        return { valid: false, message: "Invalid coupon code" };
    }

    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
        return { valid: false, message: "Coupon has expired" };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        return { valid: false, message: "Coupon usage limit reached" };
    }

    if (coupon.applicableListings.length > 0 &&
        !coupon.applicableListings.some(id => String(id) === String(listingId))) {
        return { valid: false, message: "Coupon not applicable on this test series" };
    }

    if (cartAmount < coupon.minPurchase) {
        return { valid: false, message: `Minimum purchase of ₹${coupon.minPurchase} required` };
    }

    const userUsage = coupon.usedBy.find(u => String(u.user) === String(userId));
    if (userUsage && userUsage.count >= coupon.perUserLimit) {
        return { valid: false, message: "You have already used this coupon" };
    }

    // Discount calculate karo
    let discount = 0;
    if (coupon.discountType === "flat") {
        discount = coupon.discountValue;
    } else {
        discount = Math.round((cartAmount * coupon.discountValue) / 100);
        if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
        }
    }

    // Discount cart amount se zyada na ho
    discount = Math.min(discount, cartAmount);

    return {
        valid: true,
        discount,
        couponId: coupon._id,
        message: "Coupon applied successfully"
    };
}


export async function validateCustomTestCoupon(code, user, cartAmount) {
    if (!code) return { valid: false, message: "Coupon code required" };

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon || !coupon.isActive) return { valid: false, message: "Invalid coupon code" };
    if (coupon.expiryDate && new Date() > coupon.expiryDate) return { valid: false, message: "Coupon has expired" };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { valid: false, message: "Coupon usage limit reached" };

    // Listing-specific coupon: user ki valid enrollment un listings me honi chahiye
    if (coupon.applicableListings.length > 0) {
        const { enrolledIds } = getValidEnrollments(user);
        const mine = new Set((enrolledIds || []).map(String));
        const ok = coupon.applicableListings.some((id) => mine.has(String(id)));
        if (!ok) return { valid: false, message: "This coupon is valid only for students enrolled in the linked test series" };
    }

    if (cartAmount < coupon.minPurchase) return { valid: false, message: `Minimum purchase of ₹${coupon.minPurchase} required` };

    const userUsage = coupon.usedBy.find((u) => String(u.user) === String(user._id));
    if (userUsage && userUsage.count >= coupon.perUserLimit) return { valid: false, message: "You have already used this coupon" };

    let discount = coupon.discountType === "flat"
        ? coupon.discountValue
        : Math.round((cartAmount * coupon.discountValue) / 100);
    if (coupon.discountType !== "flat" && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.min(discount, cartAmount);

    return { valid: true, discount, couponId: coupon._id, code: coupon.code, message: "Coupon applied successfully" };
}