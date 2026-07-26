import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        icon: {
            type: String,
            required: true,
            default: "fa-solid fa-folder",
        },

        listing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Listing",
            required: true,
            index: true,
        },
         showInStatsFilter: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Section", sectionSchema);