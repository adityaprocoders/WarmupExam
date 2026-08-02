import mongoose from "mongoose";

const contentBlockSchema = new mongoose.Schema({
    
    name: {
        type: String,
        required: true,
        trim: true
    },

    html: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

export default mongoose.model("ContentBlock", contentBlockSchema);