import mongoose from "mongoose";

const listingSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    shortDescription: { 
        type: String,
        required: true,
        maxlength: 150
    },

    description: {
        type: String,
        required: true
    },

    image: {
        type: String,
        default: "https://i0.wp.com/www.bishoprook.com/wp-content/uploads/2021/05/placeholder-image-gray-16x9-1.png?ssl=1",
        set: (v) =>
            v === ""
                ? "https://i0.wp.com/www.bishoprook.com/wp-content/uploads/2021/05/placeholder-image-gray-16x9-1.png?ssl=1"
                : v,
    },

    type: {
        type: String,
        enum: ["Free", "Paid"],
        default: "Free"
    },

    price: {
        type: Number,
        default: 0
    },

    originalPrice: {  
        type: Number,
        required: true
    },
    
    discountPercentage: {  
        type: Number,
        default: 0
    },
    language: {
        type: String,
        default: "English"
    },

    exam: {
        type: String,
        required: true
    },
 
    marks: [
        {
            subject: {
                type: String,
                required: true
            },
            positiveMarks: {
                type: Number,
                required: true,
                default: 0
            },
            negativeMarks: {
                type: Number,
                required: true,
                default: 0
            },
             qualifyingOnly: {
                type: Boolean,
                default: false
            }
        }
    ],

    // Rank Predictor — marks vs rank ke pairs, owner manually enter karega
    rankPredictorData: [
        {
            marks: { type: Number, required: true },
            rank: { type: Number, required: true }
        }
    ],

    // Validity — enrollment ke baad kitne din tak access rahega
    validityDays: {
        type: Number,
        default: 365
    },

    slug: {
        type: String,
        unique: true,
        required: true
    },

    // Private/Public visibility
    visibility: {
        type: String,
        enum: ["private", "public"],
        default: "private"
    }

}, {
    timestamps: true
});

export default mongoose.model("Listing", listingSchema);