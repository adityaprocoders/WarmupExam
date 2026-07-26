import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
{
    // Test Details
    title:{
        type:String,
        required:true,
        trim:true
    },

    listing:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Listing",
        required:true
    },

    section:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Section",
        default:null
    },

    
    parentType:{
        type:String,
        enum:["section","folder","file"],
        default:"section"
    },

    parentId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    },

    // Time Strategy
    timeStrategy:{
        type:String,
        enum:["total","subject"],
        default:"total"
    },

    // Used when timeStrategy = total
    duration:{
        type:Number,
        default:60
    },

    // Used when timeStrategy = subject
    subjectTime:[
        {
            subject:{
                type:String,
                required:true
            },
            duration:{
                type:Number,
                required:true
            }
        }
    ],

    totalQuestions:{
        type:Number,
        default:0
    },

    totalMarks:{
        type:Number,
        default:0
    },

    
    visibility: {
        type: String,
        enum: ["public", "private", "scheduled"],
        default: "private"
    },

    // Sirf visibility = "scheduled" hone par use hota hai
    publishAt: {
        type: Date,
        default: null
    }

},


{
    timestamps:true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Public listing me dikhega ya nahi (private ke alawa sab dikhenge)
testSchema.virtual("isVisible").get(function () {
    return this.visibility === "public" || this.visibility === "scheduled";
});

// Test actually start ho sakta hai ya nahi (scheduled time aaya ki nahi)
testSchema.virtual("canStart").get(function () {
    if (this.visibility === "public") return true;
    if (this.visibility === "scheduled") {
        return this.publishAt ? new Date() >= new Date(this.publishAt) : false;
    }
    return false; // private
});


export default mongoose.model("Test", testSchema);