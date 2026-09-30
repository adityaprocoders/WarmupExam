import mongoose from "mongoose";

const customTestPaymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        plan: {
            type: String,
            enum: ["pro", "promax"],
            required: true,
        },
        months: {
            type: Number,
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
        },
        razorpayPaymentId: {
            type: String,
        },
        status: {
            type: String,
            enum: ["created", "paid", "failed"],
            default: "created",
        },
        source: {
            type: String,
        },

        baseAmount:     { type: Number, default: null },
        couponCode:     { type: String, default: "" },
        couponId:       { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
        couponDiscount: { type: Number, default: 0 },
        donation:       { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default mongoose.model("CustomTestPayment", customTestPaymentSchema);