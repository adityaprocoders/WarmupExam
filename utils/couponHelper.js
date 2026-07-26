import Coupon from "../models/coupon.js";

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