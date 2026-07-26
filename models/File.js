import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
{
    title:{
        type:String,
        required:true,
        trim:true
    },


    slug:{
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


    // Parent can be Section, Folder or File
    parentType:{
        type:String,
        enum:[
            "section",
            "folder",
            "file"
        ],
        default:"section"
    },


    parentId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null
    },


    // future file details
    fileUrl:{
        type:String,
        default:null
    },


    fileType:{
        type:String,
        default:null
    },


    size:{
        type:Number,
        default:0
    }


},
{
    timestamps:true
});


// Same parent ke andar same naam ki file nahi hogi
fileSchema.index(
{
    listing: 1,
    section: 1,
    parentId: 1,
    slug: 1
},
{
    unique: true
});

export default mongoose.model("File", fileSchema);

 