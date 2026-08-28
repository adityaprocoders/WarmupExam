import mongoose from "mongoose";

const questionReportSchema = new mongoose.Schema({
    question: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true, unique: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: ["Wrong Question", "Wrong Answer", "Wrong Solution", "Other"], required: true },
    description: { type: String, default: "", trim: true },
    alsoReportedBy: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] }
}, { timestamps: true });

export default mongoose.model("QuestionReport", questionReportSchema);