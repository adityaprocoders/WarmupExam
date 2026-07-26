import Coupon from "../models/coupon.js";
import ExpressError from "../utils/ExpressError.js";

export const listCoupons = async (req, res) => {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
};

export const createCoupon = async (req, res) => {
    const {
        code, discountType, discountValue, maxDiscount,
        minPurchase, applicableListings, expiryDate,
        usageLimit, perUserLimit
    } = req.body;

    const exists = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (exists) {
        return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

    // Expiry date ko us din ke END (23:59:59.999) tak set karo, taaki poora din valid rahe
    let finalExpiryDate = null;
    if (expiryDate) {
        finalExpiryDate = new Date(expiryDate);
        finalExpiryDate.setHours(23, 59, 59, 999);
    }

    const coupon = await Coupon.create({
        code: code.toUpperCase().trim(),
        discountType,
        discountValue,
        maxDiscount: maxDiscount || null,
        minPurchase: minPurchase || 0,
        applicableListings: applicableListings || [],
        expiryDate: finalExpiryDate,
        usageLimit: usageLimit || null,
        perUserLimit: perUserLimit || 1
    });

    res.json({ success: true, coupon });
};

export const toggleCoupon = async (req, res) => {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new ExpressError(404, "Coupon not found");
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ success: true, coupon });
};

export const deleteCoupon = async (req, res) => {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true });
};