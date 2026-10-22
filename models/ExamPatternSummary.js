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
    ],

    // 👇 NAYA — multi-part exam (Tier 1 / Tier 2, Prelims / Mains, Part 1 / Part 2 ...)
    // Upar ke rows / timeStrategy / totalDuration / sectionTime = PEHLE part ke (purana behaviour, Custom Test waisa hi chalta hai).
    firstPart: {
        key: { type: String, trim: true },
        name: { type: String, trim: true }
    },
    // Baaki parts (2nd, 3rd ...)
    parts: [
        {
            key: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true },
            rows: [
                {
                    subject: { type: String, required: true, trim: true },
                    questions: { type: Number, required: true, default: 0 },
                    positiveMarks: { type: Number, required: true, default: 0 },
                    negativeMarks: { type: Number, required: true, default: 0 }
                }
            ],
            timeStrategy: { type: String, enum: ["total", "sectional"], default: "total" },
            totalDuration: { type: Number, default: 60 },
            sectionTime: [
                {
                    subjects: [{ type: String, trim: true }],
                    duration: { type: Number, required: true }
                }
            ]
        }
    ]
}, { timestamps: true });

examPatternSummarySchema.index({ category: 1, exam: 1 }, { unique: true });

export default mongoose.model("ExamPatternSummary", examPatternSummarySchema);