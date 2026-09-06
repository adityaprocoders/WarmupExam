import mongoose from "mongoose";

const criteriaRowSchema = new mongoose.Schema({
    subject: { type: String, required: true, trim: true },
    section: { type: [String], default: [] },   // TestQuestion.section (qsection) values
    topic: { type: [String], default: [] },
    subTopic: { type: [String], default: [] },
    difficulty: { type: [String], enum: ["Easy", "Medium", "Hard"], default: [] },
countMode: { type: String, enum: ["subject", "topic"], default: "topic" },
minCount: { type: Number, min: 0, default: 1 },
maxCount: { type: Number, min: 0, default: 1 }
}, { _id: false });

const subjectQuestionCountSchema = new mongoose.Schema({
    subject: { type: String, required: true, trim: true },
    count: { type: Number, required: true, min: 1 }
}, { _id: false });

const liveTestConfigSchema = new mongoose.Schema({
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    exam: { type: String, required: true, unique: true, trim: true },
    includedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true }],

    languageMode: { type: String, enum: ["single", "both"], default: "single" },
    languages: { type: [String], default: ["English"] },

    // 👇 NAYA — purana "subjects" checkbox field ab REMOVE, criteria rows hi subject define karte hain
    criteria: {
        type: [criteriaRowSchema],
        required: true,
        validate: {
            validator: arr => Array.isArray(arr) && arr.length > 0,
            message: "Kam se kam ek criteria row zaroori hai."
        }
    },

    // 👇 NAYA — "All (Combined)" ya "Subject Wise"
    totalQuestionsStrategy: { type: String, enum: ["all", "subject"], default: "all" },

    // "all" strategy me questionCount hi total hai (existing field reuse)
    questionCount: { type: Number, required: true, min: 5, max: 200 },

    // "subject" strategy me yeh list use hogi
    subjectQuestionCounts: { type: [subjectQuestionCountSchema], default: [] },

    // 👇 NAYA — overall history me ek question max kitni baar dobara aa sakta hai
    maxRepeat: { type: Number, default: 2, min: 1 },

    timeStrategy: { type: String, enum: ["total", "subject"], default: "total" },
    subjectTimes: { type: [{ subject: String, minutes: Number }], default: [] },

    duration: { type: Number, required: true, min: 1, max: 180, default: 10 },

    // Overall paper ka difficulty pattern (har row pe proportionally apply hota hai)
    difficultyDistribution: {
        easy: { type: Number, default: 30 },
        medium: { type: Number, default: 50 },
        hard: { type: Number, default: 20 }
    },

    startTime: { type: String, required: true },

lastGeneratedDate: { type: String, default: null },

    scheduledDays: {
        type: [String],
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        default: []
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("LiveTestConfig", liveTestConfigSchema);