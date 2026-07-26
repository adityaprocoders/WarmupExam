import Section from "../models/section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";

async function copyQuestionMapping(oldTestId, newTestId) {
    const oldMappings = await TestQuestion.find({ test: oldTestId });
    if (oldMappings.length === 0) return;

    const newMappings = oldMappings.map(m => ({
        test: newTestId,
        question: m.question,
        order: m.order,
        positiveMarks: m.positiveMarks,
        negativeMarks: m.negativeMarks
    }));

    await TestQuestion.insertMany(newMappings);
}

export async function copyNode(sourceType, sourceId, destListingId, destSectionId, destParentType, destParentId) {

    if (sourceType === "test") {
        const oldTest = await Test.findById(sourceId);

        const newTest = await Test.create({
            title: oldTest.title,
            listing: destListingId,
            section: destSectionId,
            parentType: destParentType,
            parentId: destParentId,
            timeStrategy: oldTest.timeStrategy,
            duration: oldTest.duration,
            subjectTime: oldTest.subjectTime,
            totalQuestions: oldTest.totalQuestions,
            totalMarks: oldTest.totalMarks,
            visibility: "private"
        });

        await copyQuestionMapping(oldTest._id, newTest._id);
        return newTest;
    }

    if (sourceType === "file") {
        const oldFile = await File.findById(sourceId);

        const newFile = await File.create({
            title: oldFile.title,
            slug: `${oldFile.slug}-${Date.now().toString().slice(-5)}`,
            listing: destListingId,
            section: destSectionId,
            parentType: destParentType,
            parentId: destParentId,
            fileUrl: oldFile.fileUrl,
            fileType: oldFile.fileType,
            size: oldFile.size
        });

        const childTests = await Test.find({ parentType: "file", parentId: oldFile._id });
        for (const t of childTests) {
            await copyNode("test", t._id, destListingId, destSectionId, "file", newFile._id);
        }

        return newFile;
    }

    if (sourceType === "folder") {
        const oldFolder = await Folder.findById(sourceId);

        const newFolder = await Folder.create({
            title: oldFolder.title,
            slug: `${oldFolder.slug}-${Date.now().toString().slice(-5)}`,
            icon: oldFolder.icon,
            listing: destListingId,
            section: destSectionId,
            parentType: destParentType,
            parentId: destParentId
        });

        const childFolders = await Folder.find({ parentType: "folder", parentId: oldFolder._id });
        for (const f of childFolders) {
            await copyNode("folder", f._id, destListingId, destSectionId, "folder", newFolder._id);
        }

        const childFiles = await File.find({ parentType: "folder", parentId: oldFolder._id });
        for (const f of childFiles) {
            await copyNode("file", f._id, destListingId, destSectionId, "folder", newFolder._id);
        }

        const childTests = await Test.find({ parentType: "folder", parentId: oldFolder._id });
        for (const t of childTests) {
            await copyNode("test", t._id, destListingId, destSectionId, "folder", newFolder._id);
        }

        return newFolder;
    }

    if (sourceType === "section") {
        const oldSection = await Section.findById(sourceId);

        const newSection = await Section.create({
            title: oldSection.title,
            icon: oldSection.icon,
            listing: destListingId
        });

        const rootFolders = await Folder.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFolders) {
            await copyNode("folder", f._id, destListingId, newSection._id, "section", null);
        }

        const rootFiles = await File.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFiles) {
            await copyNode("file", f._id, destListingId, newSection._id, "section", null);
        }

        const rootTests = await Test.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const t of rootTests) {
            await copyNode("test", t._id, destListingId, newSection._id, "section", null);
        }

        return newSection;
    }
}