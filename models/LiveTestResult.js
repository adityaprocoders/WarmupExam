import mongoose from "mongoose";

const liveTestResultSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exam: { type: String, required: true, index: true },
    test: { type: mongoose.Schema.Types.ObjectId, required: true },
    testTitle: { type: String, default: "Live Test" },
    attemptId: { type: mongoose.Schema.Types.ObjectId },

    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },

    rank: { type: Number, default: null },
    totalParticipants: { type: Number, default: null },

    attemptedAt: { type: Date, required: true },
    analysisExpiresAt: { type: Date, required: true }
}, { timestamps: true });

liveTestResultSchema.index({ user: 1, test: 1 }, { unique: true });

export default mongoose.model("LiveTestResult", liveTestResultSchema);