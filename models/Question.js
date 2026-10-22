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

    // Dedup ke liye: same question = same text + same correct answer (hash computeContentHash me).
    // Niche unique partial index hai, aur code me findOne() se bhi pehle check hota hai.
    contentHash: { type: String, default: null },
     status: { type: String, enum: ["Active", "Reported", "Disabled"], default: "Active" }

}, { timestamps: true });

questionSchema.index(
    { contentHash: 1 },
    { unique: true, partialFilterExpression: { contentHash: { $type: "string" } } }
);

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

// Hash sirf: question text/image + correct option(s) ke text/image (+ numericAnswer, type, languageMode).
// Wrong options, solution, subject/topic/listing hash me NAHI.
 
const norm = (s) => String(s ?? "")
    .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "^$1")
    .replace(/<sub[^>]*>([\s\S]*?)<\/sub>/gi, "_$1")
    .replace(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, u) => ` [img:${imgKey(u)}] `)
    .replace(/<\/?(?:p|br|div|li|ul|ol|tr|td|th|table|h[1-6]|blockquote|pre|figure)\b[^>]*>/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'").replace(/&amp;/gi, "&")
    .normalize("NFC").replace(/\s+/g, " ").trim();

    
const imgKey = (u) => {
    if (!u) return "";
    const s = String(u).split("?")[0];
    const after = s.split("/upload/")[1];
    if (!after) return s;
    return after.replace(/^(?:[a-z]+_[^/]*\/)*/i, "").replace(/^v\d+\//, "").replace(/\.[a-z0-9]+$/i, "");
};

const correctKeys = (options, correctAnswers) =>
    (correctAnswers || [])
        .map((i) => {
            const o = options?.[i];
            return o ? `${norm(o.text)}|${imgKey(o.image)}` : `#${i}`;
        })
        .sort();

export function computeContentHash(payload) {
    const mode = payload.languageMode === "multiple" ? "multiple" : "single";
    const data = {
        v: 3,
        type: payload.type || "mcq",
        mode,
        q: norm(payload.question),
        qi: imgKey(payload.questionImage),
        c: mode === "single" ? correctKeys(payload.options, payload.correctAnswers) : [],
        na: payload.numericAnswer ?? null,
        tr: mode === "multiple"
            ? (payload.translations || [])
                .map((t) => ({
                    l: norm(t.lang),
                    q: norm(t.question),
                    qi: imgKey(t.questionImage),
                    c: correctKeys(t.options, payload.correctAnswers)
                }))
                .sort((a, b) => a.l.localeCompare(b.l))
            : []
    };
    return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export default mongoose.model("Question", questionSchema);