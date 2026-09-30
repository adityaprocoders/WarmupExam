import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    _id: { type: String },
    index: { type: Number, default: 0 },
    question: { type: String, default: "" },
    questionImage: { type: String, default: null },
    options: { type: mongoose.Schema.Types.Mixed, default: [] },
    correctAnswers: { type: [Number], default: [] },
    numericAnswer: { type: Number, default: null },
    solution: {
        text: { type: String, default: "" },
        image: { type: String, default: null },
    },
    languageMode: { type: String, default: "single" },
    translations: { type: mongoose.Schema.Types.Mixed, default: [] },
    type: { type: String, default: "mcq" },
    subject: { type: String, default: "General" },
    topic: { type: String, default: "" },
    difficulty: { type: String, default: "Medium" },
    marks: { type: Number, default: 1 },
    negativeMarks: { type: Number, default: 1 },
}, { _id: false });

const customAIPaperSchema = new mongoose.Schema({
    paperId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    paperName: { type: String, default: "AI Generated Paper" },
    timeLimit: { type: Number, default: 10 },
    questions: { type: [questionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});
 
customAIPaperSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("CustomAIPaper", customAIPaperSchema);