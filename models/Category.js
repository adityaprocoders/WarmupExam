import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 40
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 40
        },

        // Owner khud Font Awesome class daalega (jaise "fa-solid fa-shield-halved")
        icon: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50   // FA classes generally 30-40 chars ke andar hoti hain
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120    
        },

        examCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true,
        versionKey: false    
    }
);

export default mongoose.model("Category", categorySchema);