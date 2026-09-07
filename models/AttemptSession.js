import mongoose from "mongoose";

const attemptSessionSchema = new mongoose.Schema({
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    language: { type: String, default: "English" },
    createdAt: { type: Date, default: Date.now, expires: 25200 } 
});

export default mongoose.model("AttemptSession", attemptSessionSchema);