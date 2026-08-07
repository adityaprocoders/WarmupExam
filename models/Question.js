import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });

const solutionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });


const languageContentSchema = new mongoose.Schema({
    lang: { type: String, required: true }, // Test.languages me se koi bhi value
    question: { type: String, default: "" },
    questionImage: { type: String, default: null },
    options: { type: [optionSchema], default: [] },
    solution: { type: solutionSchema, default: () => ({}) }
}, { _id: false });


const questionSchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    subject: { type: String, required: true },
    type: { type: String, enum: ["mcq", "multiple", "integer"], default: "mcq" },
    section: { type: String, default: "", trim: true },
    topic: { type: String, required: true, trim: true },
    subTopic: { type: String, default: "", trim: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },

    languageMode: { type: String, enum: ["single", "multiple"], default: "single" },

    // Single mode ke liye text; Multiple mode me ye khaali/unused rahega (text translations[] me hai)
    question: { type: String, default: "" },

    // 👇 Ye SHARED hai — single aur multiple dono mode me same diagram/image use hoga
    questionImage: { type: String, default: null },
    options: { type: [optionSchema], default: [] }, // multiple mode me sirf .image use hoga, .text ignore
    solution: { type: solutionSchema, default: () => ({}) }, // multiple mode me sirf .image use hoga

    translations: { type: [languageContentSchema], default: [] },

    correctAnswers: { type: [Number], default: [] },
    numericAnswer: { type: Number, default: null }

}, { timestamps: true });

questionSchema.index({ listing: 1, subject: 1, topic: 1 });

 
questionSchema.pre("validate", function () {

    if (this.languageMode === "multiple") {
        // Multiple language mode validation
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
        // Single language mode validation (purana behaviour, as-is)
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


export default mongoose.model("Question", questionSchema);