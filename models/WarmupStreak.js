import mongoose from "mongoose";

const warmupStreakSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    exam: { type: String, required: true },
    currentStreak: { type: Number, default: 0 },
    lastAttemptDate: { type: String, default: null }
}, { timestamps: true });

warmupStreakSchema.index({ user: 1, exam: 1 }, { unique: true });

export default mongoose.model("WarmupStreak", warmupStreakSchema);