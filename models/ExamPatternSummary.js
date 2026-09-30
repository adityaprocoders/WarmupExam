import mongoose from "mongoose";

const examPatternSummarySchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    exam: {
        type: String,
        required: true,
        trim: true
    },
    rows: [
        {
            subject: { type: String, required: true, trim: true },
            questions: { type: Number, required: true, default: 0 },
            positiveMarks: { type: Number, required: true, default: 0 },
            negativeMarks: { type: Number, required: true, default: 0 }
        }
    ],
    timeStrategy: {
        type: String,
        enum: ["total", "sectional"],
        default: "total"
    },
    totalDuration: {
        type: Number,
        default: 60
    },
    sectionTime: [
        {
            subjects: [{ type: String, trim: true }],
            duration: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

examPatternSummarySchema.index({ category: 1, exam: 1 }, { unique: true });

export default mongoose.model("ExamPatternSummary", examPatternSummarySchema);