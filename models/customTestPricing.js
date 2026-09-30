import mongoose from "mongoose";

const durationPriceSchema = new mongoose.Schema({
    months: { type: Number, required: true, min: 1, max: 36 },   // 👈 CHANGED: enum hata diya, ab koi bhi 1-36
    originalPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
}, { _id: false });

const customTestPricingSchema = new mongoose.Schema({
    key: { type: String, default: "default", unique: true },
    pro: { type: [durationPriceSchema], default: [] },
    promax: { type: [durationPriceSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

export default mongoose.model("CustomTestPricing", customTestPricingSchema);