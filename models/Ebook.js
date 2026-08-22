import mongoose from "mongoose";

const ebookSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    exam: {                     // Name of Exam (jaise Listing mein hai)
        type: String,
        required: true
    },

    contentType: {
        type: String,
        enum: ["E-Book", "Short Notes", "PYQ", "Handwritten Notes"],
        default: "E-Book",
        required: true
    },

    shortDescription: {
        type: String,
        required: true,
        maxlength: 150
    },

    description: {              // Book Description (full)
        type: String,
        required: true
    },

    coverImage: {
        url: {
            type: String,
            default: "https://i0.wp.com/www.bishoprook.com/wp-content/uploads/2021/05/placeholder-image-gray-16x9-1.png?ssl=1"
        },
        publicId: { type: String }   // Cloudinary public_id (delete ke liye)
    },

    file: {                      // PDF (Cloudinary)
        url: { type: String, required: true },
        publicId: { type: String, required: true }
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


    totalPages: {
        type: Number
    },

    // Purchase limit — kharidne ke baad kitne din tak access milega
    validityDays: {
        type: Number,
        default: 365
    },

    purchasedBy: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            purchasedAt: { type: Date, default: Date.now },
            expiresAt: { type: Date }     // purchasedAt + validityDays se calculate hoga
        }
    ],

    downloadCount: {
        type: Number,
        default: 0
    },

    slug: {
        type: String,
        unique: true,
        required: true
    },

    visibility: {
        type: String,
        enum: ["private", "public"],
        default: "private"
    }

}, {
    timestamps: true
});

export default mongoose.models.Ebook || mongoose.model("Ebook", ebookSchema);