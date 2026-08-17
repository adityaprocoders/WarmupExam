import mongoose from "mongoose";

const dailyWarmupConfigSchema = new mongoose.Schema({
category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
exam: { type: String, required: true, unique: true, trim: true },
includedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true }],
languageMode: { type: String, enum: ["single", "both"], default: "single" },
languages: { type: [String], default: ["English"] },
subjects: { type: [String], required: true },
questionCount: { type: Number, required: true, min: 5, max: 50 }, 
duration: { type: Number, required: true, min: 1, max: 60, default: 10 },
difficultyDistribution: {
    easy: { type: Number, default: 30 },
    medium: { type: Number, default: 50 },
    hard: { type: Number, default: 20 }
},
startTime: { type: String, required: true },        
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("DailyWarmupConfig", dailyWarmupConfigSchema);