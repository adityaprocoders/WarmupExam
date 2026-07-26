import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ["flat", "percentage"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    // Percentage coupon pe max discount cap (optional)
    maxDiscount: {
        type: Number,
        default: null
    },
    // Minimum cart amount jispe coupon apply ho sake
    minPurchase: {
        type: Number,
        default: 0
    },
    // Kis-kis listing pe applicable hai (khaali = sab pe applicable)
    applicableListings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing"
    }],
    expiryDate: {
        type: Date,
        default: null
    },
    usageLimit: {
        type: Number,
        default: null // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    // Ek user kitni baar use kar sakta hai
    perUserLimit: {
        type: Number,
        default: 1
    },
    usedBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 1 }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);