import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";

export async function deleteFolderRecursive(folderId) {
    const folders = await Folder.find({ parentType: "folder", parentId: folderId });
    for (const folder of folders) {
        await deleteFolderRecursive(folder._id);
    }

    const files = await File.find({ parentType: "folder", parentId: folderId });
    for (const file of files) {
        await deleteFileRecursive(file._id);
    }

    const testsToDelete = await Test.find({ parentType: "folder", parentId: folderId });
    await TestQuestion.deleteMany({ test: { $in: testsToDelete.map(t => t._id) } });
    await Test.deleteMany({ parentType: "folder", parentId: folderId });

    await Folder.findByIdAndDelete(folderId);
}

export async function deleteFileRecursive(fileId) {
    const folders = await Folder.find({ parentType: "file", parentId: fileId });
    for (const folder of folders) {
        await deleteFolderRecursive(folder._id);
    }

    const files = await File.find({ parentType: "file", parentId: fileId });
    for (const file of files) {
        await deleteFileRecursive(file._id);
    }

    // 🔧 FIX: original code me "folderId" (undefined) use ho raha tha, "fileId" hona chahiye
    const testsToDelete = await Test.find({ parentType: "file", parentId: fileId });
    await TestQuestion.deleteMany({ test: { $in: testsToDelete.map(t => t._id) } });
    await Test.deleteMany({ parentType: "file", parentId: fileId });

    await File.findByIdAndDelete(fileId);
}