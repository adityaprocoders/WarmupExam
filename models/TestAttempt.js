import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema({
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },

    // Attempt karne wale student ka reference — owner ka nahi
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    answers: [{
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        selectedOptions: [Number],
        numericAnswer: Number,
        status: {
            type: String,
            enum: ["notVisited", "notAnswered", "answered", "markedNotAnswered", "markedAnswered"],
            default: "notVisited"
        }
    }],

    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    wrongCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },

    timeTaken: { type: Number, default: 0 },
    submitType: { type: String, enum: ["manual", "auto"], default: "manual" },
    
    language: { type: String, default: "English" } 

}, { timestamps: true });

export default mongoose.model("Attempt", attemptSchema);