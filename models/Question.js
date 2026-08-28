import mongoose from "mongoose";
import crypto from "crypto";

const optionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });

const solutionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });

const languageContentSchema = new mongoose.Schema({
    lang: { type: String, required: true },
    question: { type: String, default: "" },
    questionImage: { type: String, default: null },
    options: { type: [optionSchema], default: [] },
    solution: { type: solutionSchema, default: () => ({}) }
}, { _id: false });

const questionSchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },

    // 👇 CHANGED: required hataya — ab sirf "originally kis naam se bana" info hai.
    // Asli/authoritative subject-topic ab TestQuestion mapping me store hoga.
    subject: { type: String, default: "" },
    topic: { type: String, default: "", trim: true },
    subTopic: { type: String, default: "", trim: true },

    type: { type: String, enum: ["mcq", "multiple", "integer"], default: "mcq" },
    section: { type: String, default: "", trim: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },

    languageMode: { type: String, enum: ["single", "multiple"], default: "single" },

    question: { type: String, default: "" },
    questionImage: { type: String, default: null },
    options: { type: [optionSchema], default: [] },
    solution: { type: solutionSchema, default: () => ({}) },

    translations: { type: [languageContentSchema], default: [] },

    correctAnswers: { type: [Number], default: [] },
    numericAnswer: { type: Number, default: null },

    // 👇 NAYA: dedup ke liye. UNIQUE INDEX NAHI — duplicate check hum
    // manually findOne() se karte hain code me, isliye crash kabhi nahi hoga.
    contentHash: { type: String, default: null },
     status: { type: String, enum: ["Active", "Reported", "Disabled"], default: "Active" }

}, { timestamps: true });

questionSchema.index({ contentHash: 1 }); // fast lookup, unique NAHI

questionSchema.pre("validate", function () {
    if (this.languageMode === "multiple") {
        if (!this.translations || this.translations.length === 0) {
            throw new Error("Multiple language mode me kam se kam ek language ka content dena zaroori hai.");
        }
        this.translations.forEach((t) => {
            if (!t.question?.trim() && !t.questionImage) {
                throw new Error(`${t.lang} language me question ya image me se kam se kam ek dena zaroori hai.`);
            }
            if (t.options && t.options.length > 0) {
                const invalidOption = t.options.find(
                    (opt) => !opt.text?.trim() && !opt.image
                );
                if (invalidOption) {
                    throw new Error(`${t.lang} language ke har option me text ya image me se kam se kam ek dena zaroori hai.`);
                }
            }
        });
    } else {
        if (this.options && this.options.length > 0) {
            const invalidOption = this.options.find(
                (opt) => !opt.text?.trim() && !opt.image
            );
            if (invalidOption) {
                throw new Error("Har option me text ya image me se kam se kam ek dena zaroori hai.");
            }
        }
    }
});

// 👇 NAYA: sirf content-fields se hash. Subject/topic/section JAAN-BOOJH KAR
// shaamil NAHI — warna alag-subject wala same question kabhi match nahi karega.
export function computeContentHash(payload) {
    const normalized = {
        type: payload.type || "mcq",
        languageMode: payload.languageMode || "single",
        question: (payload.question || "").trim(),
        questionImage: payload.questionImage || null,
        options: (payload.options || []).map(o => ({
            text: (o.text || "").trim(),
            image: o.image || null
        })),
        solution: {
            text: (payload.solution?.text || "").trim(),
            image: payload.solution?.image || null
        },
        translations: (payload.translations || []).map(t => ({
            lang: t.lang,
            question: (t.question || "").trim(),
            questionImage: t.questionImage || null,
            options: (t.options || []).map(o => ({
                text: (o.text || "").trim(),
                image: o.image || null
            })),
            solution: {
                text: (t.solution?.text || "").trim(),
                image: t.solution?.image || null
            }
        })),
        correctAnswers: [...(payload.correctAnswers || [])].sort(),
        numericAnswer: payload.numericAnswer ?? null
    };

    return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export default mongoose.model("Question", questionSchema);