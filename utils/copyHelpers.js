import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import crypto from "crypto";
import Listing from "../models/listing.js";
import Question from "../models/Question.js";

function getMarksForSubject(subjectsConfig, subjectName) {
    const found = subjectsConfig.find(s => s.subject === subjectName);
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
}

async function copyQuestionMapping(oldTestId, newTestId, destListingId) {
    const oldMappings = await TestQuestion.find({ test: oldTestId }).populate("question");
    if (oldMappings.length === 0) return;

    const destListing = await Listing.findById(destListingId).select("marks");
    const subjectsConfig = destListing?.marks || [];

    const newMappings = oldMappings
        .filter(m => m.question)
        .map(m => {
            const subjectName = m.question.subject;
            const marks = getMarksForSubject(subjectsConfig, subjectName);

            return {
                test: newTestId,
                question: m.question._id,
                order: m.order,
                positiveMarks: marks.positiveMarks,
                negativeMarks: marks.negativeMarks
            };
        });

    await TestQuestion.insertMany(newMappings);
}

// overrideLanguage: null/undefined => keep original showLanguage as default
export async function copyNode(sourceType, sourceId, destListingId, destSectionId, destParentType, destParentId, overrideLanguage = null) {

    if (sourceType === "test") {
        const oldTest = await Test.findById(sourceId);
        if (!oldTest) {
            console.warn(`⚠️ Test ${sourceId} not found — skip kar diya copy`);
            return null;
        }

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
            languageMode: oldTest.languageMode,
            languages: oldTest.languages,
            // 👇 agar user ne language select ki hai to wahi, warna original test ka default
            showLanguage: overrideLanguage || oldTest.showLanguage,
            // 👇 public test copy/share hone ke baad bhi public hi rahega
            visibility: oldTest.visibility === "public" ? "public" : "private"
        });

        await copyQuestionMapping(oldTest._id, newTest._id, destListingId);

        const newMappings = await TestQuestion.find({ test: newTest._id });
        const recalculatedTotalMarks = newMappings.reduce((sum, m) => sum + m.positiveMarks, 0);
        newTest.totalMarks = recalculatedTotalMarks;
        await newTest.save();

        return newTest;
    }

    if (sourceType === "file") {
        const oldFile = await File.findById(sourceId);
        if (!oldFile) { console.warn(`⚠️ File ${sourceId} not found`); return null; }

        const newFile = await File.create({
            title: oldFile.title,
            slug: `${oldFile.slug}-${crypto.randomBytes(4).toString("hex")}`,
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
            await copyNode("test", t._id, destListingId, destSectionId, "file", newFile._id, overrideLanguage);
        }

        return newFile;
    }

    if (sourceType === "folder") {
        const oldFolder = await Folder.findById(sourceId);
        if (!oldFolder) { console.warn(`⚠️ Folder ${sourceId} not found`); return null; }

        const newFolder = await Folder.create({
            title: oldFolder.title,
            slug: `${oldFolder.slug}-${crypto.randomBytes(4).toString("hex")}`,
            icon: oldFolder.icon,
            listing: destListingId,
            section: destSectionId,
            parentType: destParentType,
            parentId: destParentId
        });

        const childFolders = await Folder.find({ parentType: "folder", parentId: oldFolder._id });
        for (const f of childFolders) {
            await copyNode("folder", f._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage);
        }

        const childFiles = await File.find({ parentType: "folder", parentId: oldFolder._id });
        for (const f of childFiles) {
            await copyNode("file", f._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage);
        }

        const childTests = await Test.find({ parentType: "folder", parentId: oldFolder._id });
        for (const t of childTests) {
            await copyNode("test", t._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage);
        }

        return newFolder;
    }

    if (sourceType === "section") {
        const oldSection = await Section.findById(sourceId);
        if (!oldSection) { console.warn(`⚠️ Section ${sourceId} not found`); return null; }

        const newSection = await Section.create({
            title: oldSection.title,
            icon: oldSection.icon,
            listing: destListingId
        });

        const rootFolders = await Folder.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFolders) {
            await copyNode("folder", f._id, destListingId, newSection._id, "section", null, overrideLanguage);
        }

        const rootFiles = await File.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFiles) {
            await copyNode("file", f._id, destListingId, newSection._id, "section", null, overrideLanguage);
        }

        const rootTests = await Test.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const t of rootTests) {
            await copyNode("test", t._id, destListingId, newSection._id, "section", null, overrideLanguage);
        }

        return newSection;
    }
}