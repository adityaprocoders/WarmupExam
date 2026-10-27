import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import crypto from "crypto";
import Listing from "../models/listing.js";
import Question from "../models/Question.js";

// Optional progress callback: onProgress() = "ek item copy ho gaya". Callback na ho to kuch nahi hota.
const tick = (cb) => { if (typeof cb === "function") cb(1); };

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
            const subjectName = m.subject || m.question.subject;
            const marks = getMarksForSubject(subjectsConfig, subjectName);

            return {
                test: newTestId,
                question: m.question._id,
                order: m.order,
                subject: subjectName,
                topic: m.topic || m.question.topic,
                subTopic: m.subTopic || m.question.subTopic,
                section: m.section || m.question.section,
                positiveMarks: marks.positiveMarks,
                negativeMarks: marks.negativeMarks
            };
        });

    await TestQuestion.insertMany(newMappings);
}

// overrideLanguage: null/undefined => keep original showLanguage as default
export async function copyNode(sourceType, sourceId, destListingId, destSectionId, destParentType, destParentId, overrideLanguage = null, pathLabel = "", fallbackLog = [], includeTests = true, onProgress = null) {

       if (sourceType === "test") {
        // includeTests=false: "without tests" copy — test kabhi copy nahi hota
        if (!includeTests) return null;

        const oldTest = await Test.findById(sourceId);
        if (!oldTest) {
            console.warn(`⚠️ Test ${sourceId} not found; skipped during copy`);
            return null;
        }

        // showLanguage ko test ki apni languages ke hisaab se safe banao (case-insensitive)
        const norm = (s) => String(s || "").trim().toLowerCase();
        const testLangs = Array.isArray(oldTest.languages) ? oldTest.languages : [];
        const isMulti = norm(oldTest.languageMode).startsWith("multi") || testLangs.length > 1;

        let safeShowLanguage = "all";
        let didFallback = false;

        if (overrideLanguage && norm(overrideLanguage) !== "all") {
            const matched = testLangs.find(l => norm(l) === norm(overrideLanguage));

            if (!matched) {
                didFallback = isMulti;              // test me ye language sach me nahi hai
                safeShowLanguage = "all";
            } else if (isMulti) {
                safeShowLanguage = matched;      // DB wali exact spelling
            } else {
                safeShowLanguage = "all";        // single-language test, fallback nahi
            }
        } else {
            const orig = oldTest.showLanguage || "all";
            const origMatched = testLangs.find(l => norm(l) === norm(orig));
            safeShowLanguage = (norm(orig) === "all" || !isMulti || !origMatched) ? "all" : origMatched;
        }

        if (didFallback) {
            fallbackLog.push({
                testTitle: oldTest.title,
                path: pathLabel ? `${pathLabel} > ${oldTest.title}` : oldTest.title,
                requestedLanguage: overrideLanguage
            });
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
            // 👇 CHANGED — ab safe/validated value use hogi, crash nahi hoga
            showLanguage: safeShowLanguage,
            // 👇 public test copy/share hone ke baad bhi public hi rahega
            visibility: oldTest.visibility === "public" ? "public" : "private"
        });

        await copyQuestionMapping(oldTest._id, newTest._id, destListingId);

        const newMappings = await TestQuestion.find({ test: newTest._id });
if (newMappings.length > 0) {
    newTest.totalMarks = newMappings.reduce((sum, m) => sum + (m.positiveMarks || 0), 0);
    await newTest.save();
}

        tick(onProgress);
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

        tick(onProgress);

        const childTests = includeTests ? await Test.find({ parentType: "file", parentId: oldFile._id }) : [];
        for (const t of childTests) {
            await copyNode("test", t._id, destListingId, destSectionId, "file", newFile._id, overrideLanguage, `${pathLabel ? pathLabel + " > " : ""}${oldFile.title}`, fallbackLog, includeTests, onProgress);
        }

        return newFile;
    }

    if (sourceType === "folder") {
    const oldFolder = await Folder.findById(sourceId);
    if (!oldFolder) { console.warn(`⚠️ Folder ${sourceId} not found`); return null; }

    // create se PEHLE snapshot (same folder me paste karne par loop nahi banega)
    const childFolders = await Folder.find({ parentType: "folder", parentId: oldFolder._id });
    const childFiles = await File.find({ parentType: "folder", parentId: oldFolder._id });
    const childTests = includeTests
        ? await Test.find({ parentType: "folder", parentId: oldFolder._id })
        : [];

    const newFolder = await Folder.create({
        title: oldFolder.title,
        slug: `${oldFolder.slug}-${crypto.randomBytes(4).toString("hex")}`,
        icon: oldFolder.icon,
        listing: destListingId,
        section: destSectionId,
        parentType: destParentType,
        parentId: destParentId
    });

    tick(onProgress);

    const nextPath = `${pathLabel ? pathLabel + " > " : ""}${oldFolder.title}`;

    for (const f of childFolders) {
        await copyNode("folder", f._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
    }
    for (const f of childFiles) {
        await copyNode("file", f._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
    }
    for (const t of childTests) {
        await copyNode("test", t._id, destListingId, destSectionId, "folder", newFolder._id, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
    }

    return newFolder;
}

    if (sourceType === "section") {
        const oldSection = await Section.findById(sourceId);
        if (!oldSection) { console.warn(`⚠️ Section ${sourceId} not found`); return null; }

       const newSection = await Section.create({
    title: oldSection.title,
    icon: oldSection.icon,
    unit: oldSection.unit,
    listing: destListingId
});

        tick(onProgress);

        const nextPath = `${pathLabel ? pathLabel + " > " : ""}${oldSection.title}`;

        const rootFolders = await Folder.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFolders) {
            await copyNode("folder", f._id, destListingId, newSection._id, "section", null, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
        }

        const rootFiles = await File.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        });
        for (const f of rootFiles) {
            await copyNode("file", f._id, destListingId, newSection._id, "section", null, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
        }

        const rootTests = includeTests ? await Test.find({
            listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null
        }) : [];
        for (const t of rootTests) {
            await copyNode("test", t._id, destListingId, newSection._id, "section", null, overrideLanguage, nextPath, fallbackLog, includeTests, onProgress);
        }

        return newSection;
    }
}