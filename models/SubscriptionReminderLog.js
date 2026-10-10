import mongoose from "mongoose";

// "Is user ko, is expiry ke liye, X din wala reminder bhej diya" ka record.
// Notification 24hr me delete ho jaati hai, isliye dedupe ke liye alag record chahiye.
const subscriptionReminderLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    enrollmentExpiresAt: { type: Date, required: true },
    daysLeft: { type: Number, required: true }
}, { timestamps: true });

subscriptionReminderLogSchema.index(
    { user: 1, listing: 1, enrollmentExpiresAt: 1, daysLeft: 1 },
    { unique: true }
);

// Subscription expire hone ke 30 din baad record khud saaf
subscriptionReminderLogSchema.index({ enrollmentExpiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("SubscriptionReminderLog", subscriptionReminderLogSchema);