import mongoose from "mongoose";

const testQuestionSchema = new mongoose.Schema({

    test: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Test",
        required: true
    },

    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true
    },

    order: { type: Number, required: true },

    positiveMarks: { type: Number, default: 0 },
    negativeMarks: { type: Number, default: 0 },

     qualifyingOnly: { type: Boolean, default: false },

     sourceTest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Test",
        default: null
    }

}, { timestamps: true });

// Same order repeat nahi hoga ek test ke andar
 testQuestionSchema.index({ test: 1, question: 1 }, { unique: true });
testQuestionSchema.index({ test: 1 });

export default mongoose.model("TestQuestion", testQuestionSchema);