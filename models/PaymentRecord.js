import mongoose from "mongoose";

const refundSchema = new mongoose.Schema({
    refundId: { type: String, required: true },
    amount:   { type: Number, required: true },               // rupees
    status:   { type: String, enum: ["created", "processed", "failed"], default: "created" },
    at:       { type: Date, default: Date.now }
}, { _id: false });

const paymentRecordSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

        // Snapshot: user delete ho jaye tab bhi owner ko pata rahe ki kisne pay kiya tha
        userName:  { type: String, default: "" },
        userEmail: { type: String, default: "" },

        // "ebook" abhi use nahi ho raha. Ebook purchase flow aaye to yahi kaam aayega.
        kind: { type: String, enum: ["testseries", "customtest", "ebook"], required: true },

        itemId:    { type: mongoose.Schema.Types.ObjectId, default: null },   // Listing _id (customtest me null)
        itemTitle: { type: String, required: true },                           // snapshot

        plan:   { type: String, enum: ["pro", "promax", null], default: null },
        months: { type: Number, default: null },
        validityDays: { type: Number, default: null },

        baseAmount:     { type: Number, default: null },
        couponCode:     { type: String, default: "" },
        couponDiscount: { type: Number, default: 0 },
        donation:       { type: Number, default: 0 },
        amount:         { type: Number, required: true },                      // final charged amount

        // Chhota invoice number jo table me dikhta hai (jaise WE6287451230)
        invoiceNo: { type: String, unique: true, sparse: true },

        orderId:   { type: String, required: true, unique: true },             // Razorpay order id (idempotency key)
        paymentId: { type: String, default: null },

        // Payment method (Razorpay se fetch hota hai)
        methodType:   { type: String, default: "" },                           // UPI / Card / Netbanking / Wallet ...
        methodDetail: { type: String, default: "" },                           // vpa / "visa •••• 4216" / bank / wallet

        // Refund
        status: { type: String, enum: ["success", "partially_refunded", "refunded"], default: "success" },
        refundedAmount: { type: Number, default: 0 },
        refundedAt: { type: Date, default: null },
        refunds: { type: [refundSchema], default: [] },
        accessRevoked: { type: Boolean, default: false },                      // full refund par access ek hi baar hatana

        source: { type: String, default: "razorpay" },
        paidAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null }
    },
    { timestamps: true }
);

paymentRecordSchema.index({ user: 1, paidAt: -1 });
paymentRecordSchema.index({ paidAt: -1 });
paymentRecordSchema.index({ paymentId: 1 });

export default mongoose.models.PaymentRecord || mongoose.model("PaymentRecord", paymentRecordSchema);