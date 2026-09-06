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

    // Language Settings
languageMode: {
    type: String,
    enum: ["single", "multiple"],
    default: "single"
},

languages: {
    type: [String],       // free text — "English", "Punjabi", "Bhojpuri", koi bhi
    default: ["English"],  // single mode me default ek language
    validate: {
        validator: function (arr) {
            if (this.languageMode === "single") {
                return arr.length === 1; // single mode me sirf 1 language honi chahiye
            }
            return arr.length >= 2; // multiple mode me kam se kam 2 languages
        },
        message: "Single mode me sirf ek language honi chahiye, Multiple mode me kam se kam do."
    }
},


// Student ko kaunsi language(s) attempt karte waqt dikhengi
showLanguage: {
    type: String,
    default: "all",   // "all" ya "languages" array me se koi ek specific language
    validate: {
        validator: function (val) {
            // "all" hamesha valid hai
            if (val === "all") return true;
            // agar specific language di hai, to wo "languages" array me honi chahiye
            return Array.isArray(this.languages) && this.languages.includes(val);
        },
        message: "Show Language ya to 'all' honi chahiye, ya languages list me se koi valid language."
    }
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
    },
    isDailyWarmup: { type: Boolean, default: false },
dailyWarmupUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
dailyWarmupDayKey: { type: String, default: null },
dailyWarmupExpiresAt: { type: Date, default: null, index: true },


     isLiveTest: {
    type: Boolean,
    default: false
},
liveTestExam: {                   
    type: String,
    default: null,
    index: true
},
liveTestDate: {
    type: String,
    default: null
},
liveTestExpiresAt: {
    type: Date,
    default: null,
    index: true
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