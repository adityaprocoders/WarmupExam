import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";

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
     const testIds = testsToDelete.map(t => t._id);

     
    await TestQuestion.deleteMany({ test: { $in: testIds } });
    await Attempt.deleteMany({ test: { $in: testIds } });
    await AttemptSession.deleteMany({ test: { $in: testIds } });
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

     await TestQuestion.deleteMany({ test: { $in: testIds } });
    await Attempt.deleteMany({ test: { $in: testIds } });
    await AttemptSession.deleteMany({ test: { $in: testIds } });
    await Test.deleteMany({ parentType: "file", parentId: fileId });

     
    await File.findByIdAndDelete(fileId);
}