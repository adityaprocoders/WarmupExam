import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
    index: { type: Number, default: 0 },
    questionId: { type: String, default: "" },
    subject: { type: String, default: "" },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "" },
    type: { type: String, default: "mcq" },
    selected: { type: mongoose.Schema.Types.Mixed, default: null },
    numericValue: { type: Number, default: null },
    correctAnswers: { type: [Number], default: [] },
    numericAnswer: { type: Number, default: null },
    answered: { type: Boolean, default: false },
    isCorrect: { type: Boolean, default: false },
    marks: { type: Number, default: 0 },
    negativeMarks: { type: Number, default: 0 },
    questionText: { type: String, default: "" },
    questionImage: { type: String, default: null },
    options: { type: mongoose.Schema.Types.Mixed, default: [] },
    solutionText: { type: String, default: "" },
    solutionImage: { type: String, default: null },
}, { _id: false });

const customPaperAttemptSchema = new mongoose.Schema({
    paperId: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    language: { type: String, default: "English" },
        timeLimitSeconds: { type: Number, default: 0 },
    title: { type: String, default: "" },
    source: { type: String, enum: ["ai", "manual"], default: "manual" },
    subjects: { type: [String], default: [] },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    bySubject: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});

// ek user ka ek paper — sirf ek hi attempt document (unique compound index,
// reattempt hamesha delete+create se overwrite hoga, upsert-race se bachne ke liye)
customPaperAttemptSchema.index({ user: 1, paperId: 1 }, { unique: true });
customPaperAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("CustomPaperAttempt", customPaperAttemptSchema);