import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true, maxlength: 60 },
    message: { type: String, required: true, maxlength: 500 },

    audienceType: {
        type: String,
        enum: ["all", "paid", "free", "custom"],
        required: true
    },
    customUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    clearedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],   // 👈 NAYA

    status: {
        type: String,
        enum: ["scheduled", "sent", "expired"],
        default: "scheduled"
    },

    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },

    estimatedReach: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["manual", "auto"], default: "manual" },
notifType: { type: String, default: null },
meta: {
    exam: { type: String },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" }
}
}, { timestamps: true });

notificationSchema.index({ status: 1, expiresAt: 1 });
notificationSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.model("Notification", notificationSchema);