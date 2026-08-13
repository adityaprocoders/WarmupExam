import mongoose from "mongoose";

const warmupUsageLogSchema = new mongoose.Schema({
    exam: { type: String, required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    lastUsedAt: { type: Date, required: true }
}, { timestamps: true });

warmupUsageLogSchema.index({ exam: 1, question: 1 }, { unique: true });

export default mongoose.model("WarmupUsageLog", warmupUsageLogSchema);