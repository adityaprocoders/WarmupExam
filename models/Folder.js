import mongoose from "mongoose";

const folderSchema = new mongoose.Schema(
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

    icon:{
        type:String,
        default:"fa-solid fa-folder"
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


    // Parent can be Folder or File
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
    }

},
{
    timestamps:true
});


// Same parent ke andar same naam ka folder allow nahi hoga
folderSchema.index(
{
    listing:1,
    section:1,
    parentId:1,
    slug:1
},
{
    unique:true
});


export default mongoose.model("Folder",folderSchema);