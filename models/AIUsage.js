import mongoose from "mongoose";

const aiUsageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"

    questionsUsed: { type: Number, default: 0 },
    apiCallsUsed: { type: Number, default: 0 },
    textCharsUsed: { type: Number, default: 0 },
    pdfCharsUsed: { type: Number, default: 0 },
    imagesUsed: { type: Number, default: 0 },
    pdfMBUsed: { type: Number, default: 0 },

    // Rate-limit ke liye: last N request timestamps (minute-window)
    recentRequestTimestamps: { type: [Date], default: [] },
}, { timestamps: true });

aiUsageSchema.index({ user: 1, date: 1 }, { unique: true });

aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("AIUsage", aiUsageSchema);