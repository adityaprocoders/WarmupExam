import mongoose from "mongoose";

const liveTestUsageLogSchema = new mongoose.Schema({
    exam: { type: String, required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
    lastUsedAt: { type: Date, required: true },
    // 👇 NAYA — is exam ke live tests me yeh question ab tak total kitni baar use ho chuka hai
    usageCount: { type: Number, default: 0 }
}, { timestamps: true });

liveTestUsageLogSchema.index({ exam: 1, question: 1 }, { unique: true });

export default mongoose.model("LiveTestUsageLog", liveTestUsageLogSchema);