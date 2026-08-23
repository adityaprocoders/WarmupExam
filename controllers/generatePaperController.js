import Listing from "../models/listing.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Section from "../models/Section.js";
import mongoose from "mongoose";
import ExpressError from "../utils/ExpressError.js";


function getMarksForSubject(subjectsConfig, subjectName) {
    let found = subjectsConfig.find(s => s.subject === subjectName);
    if (!found && subjectsConfig.length > 0) found = subjectsConfig[0];
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
}


/* ============================================================
   PAGE RENDER — /generate-paper/new
============================================================ */
export const renderGeneratePaper = async (req, res) => {
    const { listingId, sectionId, parentType, parentId, returnUrl } = req.query;
    if (!listingId) throw new ExpressError(400, "listingId query param zaroori hai");

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });

    let currentSection = null;
    if (sectionId) currentSection = await Section.findById(sectionId);

    res.render("dashboard/generate", {
        layout: "layouts/dashboard",
        listing,
        sections,
        currentSection,
        folder: null,
        file: null,
        listingId,
        sectionId: sectionId || "",
        parentType: parentType || "section",
        parentId: parentId || "",
        returnUrl: returnUrl || "/",
        robots: "noindex, nofollow"
    });
};


/* ============================================================
   GET /api/listing/:id/question-bank-stats
   -> Poori listing (kisi bhi Section — Daily/Topic/PYQ/Full Length — sabko milakar)
      ka total available questions
============================================================ */
export const getQuestionBankStats = async (req, res) => {
    const { id } = req.params;

    const totalQuestions = await Question.countDocuments({ listing: id });

    const subjectBreakdown = await Question.aggregate([
        { $match: { listing: new mongoose.Types.ObjectId(id) } },
        { $group: { _id: "$subject", count: { $sum: 1 } } },
        { $project: { _id: 0, subject: "$_id", count: 1 } },
        { $sort: { subject: 1 } }
    ]);

    res.status(200).json({
        success: true,
        data: { totalQuestions, subjectBreakdown }
    });
};


/* ============================================================
   GET /api/listing/:id/question-filters?subject=&section=
============================================================ */
export const getQuestionFilters = async (req, res) => {
    const { id } = req.params;
    const { subject, section } = req.query;

    const baseMatch = { listing: id };
    if (subject) baseMatch.subject = subject;

    const sections = (await Question.distinct("section", baseMatch))
        .filter(s => s && s.trim() !== "")
        .sort();

    const topicMatch = { ...baseMatch };
    if (section) topicMatch.section = section;
    const topics = (await Question.distinct("topic", topicMatch))
        .filter(t => t && t.trim() !== "")
        .sort();

    res.status(200).json({
        success: true,
        data: { sections, topics }
    });
};


/* ============================================================
   GET /api/listing/:id/question-count?subject=&section=&topic=&difficulty=
============================================================ */
export const getQuestionCount = async (req, res) => {
    const { id } = req.params;
    const { subject, section, topic, difficulty } = req.query;

    const match = { listing: id };
    if (subject) match.subject = subject;
    if (section) match.section = section;
    if (topic) match.topic = topic;
    if (difficulty && difficulty !== "Any") match.difficulty = difficulty;

    const count = await Question.countDocuments(match);

    res.status(200).json({ success: true, data: { count } });
};


/* ============================================================
   POST /api/generate-paper
   -> Sirf EXISTING questions ko reference karta hai (TestQuestion.question = q._id)
      Koi naya Question document NAHI banta — isliye DB me duplicate storage
      bilkul nahi hoti. Har paper ke andar ek hi question (_id se) dobara nahi aayega.
============================================================ */
export const generatePaper = async (req, res) => {
    const body = req.body;

    if (!body.listingId) return res.status(400).json({ success: false, message: "listingId missing hai" });
    if (!Array.isArray(body.criteria) || body.criteria.length === 0) {
        return res.status(400).json({ success: false, message: "Kam se kam ek criteria row zaroori hai" });
    }

    const listingDoc = await Listing.findById(body.listingId).select("marks");
    if (!listingDoc) return res.status(404).json({ success: false, message: "Listing not found" });

    const subjectsConfig = listingDoc.marks || [];
    const noOfPapers = Math.max(1, Number(body.noOfPapers) || 1);

    const listingObjectId = new mongoose.Types.ObjectId(body.listingId);   // 👈 NAYA

    // Pehle validate — itne questions available hain ya nahi
    for (const c of body.criteria) {
        const match = { listing: listingObjectId };   // 👈 FIX
        if (c.subject) match.subject = c.subject;
        if (Array.isArray(c.section) && c.section.length > 0) match.section = { $in: c.section };
        if (Array.isArray(c.topic) && c.topic.length > 0) match.topic = { $in: c.topic };
        if (c.difficulty && c.difficulty !== "Any") match.difficulty = c.difficulty;

        const available = await Question.countDocuments(match);
        if (available < c.count) {
            return res.status(400).json({
                success: false,
                message: `"${c.subject || 'Subject'} / ${c.topic || 'Topic'}" ke liye sirf ${available} questions available hain, ${c.count} maange gaye hain.`
            });
        }
    }

    const createdTestIds = [];

    for (let p = 0; p < noOfPapers; p++) {
        const pickedQuestions = [];
        const usedIds = new Set(); // isi paper ke andar same _id dobara na aaye

        for (const c of body.criteria) {
            const match = { listing: listingObjectId };   // 👈 FIX
            if (c.subject) match.subject = c.subject;
            if (Array.isArray(c.section) && c.section.length > 0) match.section = { $in: c.section };
            if (Array.isArray(c.topic) && c.topic.length > 0) match.topic = { $in: c.topic };
            if (c.difficulty && c.difficulty !== "Any") match.difficulty = c.difficulty;

            // thoda extra fetch — taaki usedIds me se kuch skip hone ke baad bhi count pura mil jaye
            const candidates = await Question.aggregate([
                { $match: match },
                { $sample: { size: (c.count * 2) || c.count } }
            ]);

            let added = 0;
            for (const q of candidates) {
                if (added >= c.count) break;
                const idStr = q._id.toString();
                if (usedIds.has(idStr)) continue; // same question doosri criteria row se already aa chuka
                usedIds.add(idStr);
                pickedQuestions.push(q);
                added++;
            }
        }

        const calculatedTotalMarks = pickedQuestions.reduce(
            (sum, q) => sum + getMarksForSubject(subjectsConfig, q.subject).positiveMarks,
            0
        );

         const baseTitle = (body.title && body.title.trim()) ? body.title.trim() : "Generated Paper";
         const paperTitle = noOfPapers > 1
         ? `${baseTitle} ${p + 1}`
         : baseTitle; 

        const languageMode = body.languageMode === "multiple" ? "multiple" : "single";
        let languages = Array.isArray(body.languages) && body.languages.length > 0
            ? body.languages.map(l => String(l).trim()).filter(Boolean)
            : ["English"];

        if (languageMode === "single" && languages.length > 1) {
            languages = [languages[0]];
        }

        let showLanguage = body.showLanguage && String(body.showLanguage).trim()
            ? String(body.showLanguage).trim()
            : "all";

        if (languageMode !== "multiple") {
            showLanguage = "all";
        } else if (showLanguage !== "all" && !languages.includes(showLanguage)) {
            showLanguage = "all";
        }

        const testDoc = new Test({
            title: paperTitle,
            listing: body.listingId,
            section: body.sectionId || null,
            parentType: body.parentType || "section",
            parentId: body.parentId || null,
            languageMode: languageMode,
            languages: languages,
            showLanguage: showLanguage,
            timeStrategy: body.timeStrategy || "total",
            duration: body.duration || body.timeLimit || 60,
            subjectTime: body.subjectTime || [],
            totalQuestions: pickedQuestions.length,
            totalMarks: calculatedTotalMarks,
            visibility: "private",
            publishAt: null
        });

        const savedTest = await testDoc.save();

        // 👇 Sirf REFERENCE save ho raha hai (q._id) — koi naya Question document nahi bana
        const mappingDocs = pickedQuestions.map((q, i) => {
            const marks = getMarksForSubject(subjectsConfig, q.subject);
            return {
                test: savedTest._id,
                question: q._id,
                order: i + 1,
                positiveMarks: marks.positiveMarks,
                negativeMarks: marks.negativeMarks
            };
        });

        if (mappingDocs.length > 0) {
            await TestQuestion.insertMany(mappingDocs);
        }

        createdTestIds.push(savedTest._id);
    }

    res.status(200).json({
        success: true,
        message: `${createdTestIds.length} paper(s) generate ho gaye`,
        testIds: createdTestIds
    });
};

/* ============================================================
   GET /api/listing/:id/subjects
============================================================ */
export const getListingSubjects = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const subjects = (await Question.distinct("subject", { listing: id }))
        .filter(s => s && s.trim() !== "")
        .sort()
        .map(s => ({ subject: s }));

    res.status(200).json({ success: true, data: subjects });
};

/* ============================================================
   GET /api/listing/:id/languages
   -> Us listing ke Question collection me jo bhi languages
      actually available hain (DB se distinct), sirf wahi return
============================================================ */
export const getListingLanguages = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid listing id" });
    }

    const languageSet = new Set();

    // 1) Single-mode questions hamesha "English" maane jaate hain
    const singleModeCount = await Question.countDocuments({
        listing: id,
        languageMode: "single"
    });
    if (singleModeCount > 0) {
        languageSet.add("English");
    }

    // 2) Multiple-mode questions ki languages translations.lang se nikaalo
    const multiLangResult = await Question.distinct("translations.lang", {
        listing: id,
        languageMode: "multiple"
    });
    multiLangResult
        .filter(l => l && l.trim() !== "")
        .forEach(l => languageSet.add(l));

    const languages = Array.from(languageSet).sort();

    res.status(200).json({ success: true, data: languages });
};