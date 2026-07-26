import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });

const solutionSchema = new mongoose.Schema({
    text: { type: String, default: "" },
    image: { type: String, default: null }
}, { _id: false });

const questionSchema = new mongoose.Schema({

    // Ab question kisi ek Test se bandha nahi — poori Listing ka reusable bank hai
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },

    subject: { type: String, required: true },

    type: {
        type: String,
        enum: ["mcq", "multiple", "integer"],
        default: "mcq"
    },

    topic: { type: String, required: true, trim: true },
    subTopic: { type: String, default: "", trim: true },

    difficulty: {
        type: String,
        enum: ["Easy", "Medium", "Hard"],
        default: "Medium"
    },

   question: {
    type: String,
    required: function () {
        return !this.questionImage;  
    },
    default: ""
},
    questionImage: { type: String, default: null },

    options: { type: [optionSchema], default: [] },
    correctAnswers: { type: [Number], default: [] },
    numericAnswer: { type: Number, default: null },

    solution: { type: solutionSchema, default: () => ({}) }

}, { timestamps: true });

questionSchema.index({ listing: 1, subject: 1, topic: 1 });

// 👇 Har option me text ya image me se kam se kam ek hona zaroori hai
questionSchema.pre("validate", function () {
    if (this.options && this.options.length > 0) {
        const invalidOption = this.options.find(
            (opt) => !opt.text?.trim() && !opt.image
        );
        if (invalidOption) {
            throw new Error("Har option me text ya image me se kam se kam ek dena zaroori hai.");
        }
    }
});

export default mongoose.model("Question", questionSchema);