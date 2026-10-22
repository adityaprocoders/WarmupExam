import mongoose from "mongoose";

const rowSchema = new mongoose.Schema({
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    topics: { type: String, default: "", trim: true, maxlength: 1500 }
}, { _id: false });

const partSchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true },
    name: { type: String, default: "", trim: true },   // single exam me khali
    order: { type: Number, default: 0 },
    rows: [rowSchema]
}, { _id: false });

const examSyllabusSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    exam: { type: String, required: true, trim: true },
    examStructure: { type: String, enum: ["single", "multi"], default: "single" },
    structureType: { type: String, default: "" },
    parts: [partSchema]
}, { timestamps: true });

// ek exam ka ek hi syllabus (category + exam)
examSyllabusSchema.index({ category: 1, exam: 1 }, { unique: true });

export default mongoose.models.ExamSyllabus || mongoose.model("ExamSyllabus", examSyllabusSchema);