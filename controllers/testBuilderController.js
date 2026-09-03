import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Test from "../models/Test.js";
import Question, { computeContentHash } from "../models/Question.js";   // 👈 CHANGED
import TestQuestion from "../models/TestQuestion.js";
import ExpressError from "../utils/ExpressError.js";


function normalizeOptions(optionsArr) {
    if (!Array.isArray(optionsArr)) return [];
    return optionsArr.map(opt => {
        if (typeof opt === "string") {
            return { text: opt, image: null };
        }
        return { text: opt?.text || "", image: opt?.image || null };
    });
}

function getMarksForSubject(subjectsConfig, subjectName) {
    const found = subjectsConfig.find(s => s.subject === subjectName);
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };   
}

function resolveQuestionLanguageMode(q, testLanguageMode) {
    const subjectName = (q.subject || "").trim().toLowerCase();
    if (subjectName === "english") {
        return "single";
    }
    return testLanguageMode === "multiple" ? "multiple" : "single";
}

function pickSingleSource(q) {
    if (!Array.isArray(q.translations) || q.translations.length === 0) return q;
    const subjectName = (q.subject || "").trim().toLowerCase();

    if (subjectName === "english") {
        const englishSlot = q.translations.find(t => (t.lang || "").trim().toLowerCase() === "english");
        if (englishSlot) return englishSlot;
    }

    const withContent = q.translations.find(t =>
        (t.question && t.question.trim()) || (t.questionImage && t.questionImage.trim())
    );
    return withContent || q.translations[0] || q;
}

export const renderTestBuilder = async (req, res) => {
    const { listingId, sectionId, parentType, parentId, returnUrl, editId } = req.query;
    if (!listingId) throw new ExpressError(400, "listingId query param zaroori hai");

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });

    let currentSection = null;
    if (sectionId) currentSection = await Section.findById(sectionId);

    res.render("dashboard/test-builder", {
        layout: "layouts/dashboard",
        listing, sections, currentSection,
        folder: null, file: null,
        listingId,
        sectionId: sectionId || "",
        parentType: parentType || "section",
        parentId: parentId || "",
        returnUrl: returnUrl || "/",
        editId: editId || "",
        robots: "noindex, nofollow"
    });
};

export const getListingSubjects = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).select("marks");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });
    res.status(200).json({ success: true, data: listing.marks });
};

export const createTestBuilder = async (req, res) => {
   try {
    const body = req.body;

    if (!body.title) return res.status(400).json({ success: false, message: "Test title zaroori hai" });
    if (!body.listingId) return res.status(400).json({ success: false, message: "listingId missing hai" });

    const listingDoc = await Listing.findById(body.listingId).select("marks");
    const subjectsConfig = listingDoc?.marks || [];

    const allowedVisibility = ["public", "private", "scheduled"];
    const visibility = allowedVisibility.includes(body.visibility) ? body.visibility : "private";

    if (visibility === "scheduled" && !body.publishAt) {
        return res.status(400).json({ success: false, message: "Schedule ke liye publish date/time zaroori hai" });
    }

    const testLanguageMode = body.languageMode === "multiple" ? "multiple" : "single";
    let testLanguages = Array.isArray(body.languages) && body.languages.length > 0
        ? body.languages.map(l => String(l).trim()).filter(Boolean)
        : ["English"];

    if (testLanguageMode === "single" && testLanguages.length > 1) {
        testLanguages = [testLanguages[0]];
    }
    if (testLanguageMode === "multiple" && testLanguages.length < 2) {
        return res.status(400).json({ success: false, message: "Multiple language mode me kam se kam do languages choose karo" });
    }

    let testShowLanguage = body.showLanguage && String(body.showLanguage).trim()
    ? String(body.showLanguage).trim()
    : "all";

if (testLanguageMode !== "multiple") {
    testShowLanguage = "all";
} else if (testShowLanguage !== "all" && !testLanguages.includes(testShowLanguage)) {
    testShowLanguage = "all";
}

    if (Array.isArray(body.questions)) {
        for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i];

            if (!q.subject || !q.subject.trim()) {
             return res.status(400).json({ success: false, message: `Question ${i + 1}: Subject choose karna zaroori hai` });
            }

            if (!q.topic || !q.topic.trim()) {
                return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
            }

            const qMode = resolveQuestionLanguageMode(q, testLanguageMode);

            if (qMode === "multiple") {
                if (!Array.isArray(q.translations) || q.translations.length === 0) {
                    return res.status(400).json({ success: false, message: `Question ${i + 1}: har language ka content dena zaroori hai` });
                }
                for (const t of q.translations) {
                    const hasText = t.question && t.question.trim();
                    const hasImage = t.questionImage && t.questionImage.trim();
                    if (!hasText && !hasImage) {
                        return res.status(400).json({ success: false, message: `Question ${i + 1} (${t.lang}): question text ya image zaroori hai` });
                    }
                }
            } else {
                const source = pickSingleSource(q);
                const hasText = source.question && source.question.trim();
                const hasImage = source.questionImage && source.questionImage.trim();
                if (!hasText && !hasImage) {
                    return res.status(400).json({ success: false, message: `Question ${i + 1}: question text ya image me se kam se kam ek dena zaroori hai` });
                }
            }
        }
    }

    let calculatedTotalMarks = 0;
    if (Array.isArray(body.questions)) {
        calculatedTotalMarks = body.questions.reduce((sum, q) => sum + getMarksForSubject(subjectsConfig, q.subject).positiveMarks, 0);
    }

    const testDoc = new Test({
        title: body.title,
        listing: body.listingId,
        section: body.sectionId || null,
        parentType: body.parentType || "section",
        parentId: body.parentId || null,
        languageMode: testLanguageMode,
        languages: testLanguages,
        showLanguage: testShowLanguage,
        timeStrategy: body.timeStrategy || "total",
        duration: body.duration || 60,
        subjectTime: body.subjectTime || [],
        totalQuestions: Array.isArray(body.questions) ? body.questions.length : (body.totalQuestions || 0),
        totalMarks: calculatedTotalMarks,
        visibility,
        publishAt: visibility === "scheduled" ? new Date(body.publishAt) : null
    });

    const savedTest = await testDoc.save();

    // 👇 CHANGED: poora block naya — dedup + mapping me subject/topic
    if (Array.isArray(body.questions) && body.questions.length > 0) {
        const mappingDocs = [];

        for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i];
            const marks = getMarksForSubject(subjectsConfig, q.subject);
            const qLanguageMode = resolveQuestionLanguageMode(q, testLanguageMode);

            const questionPayload = {
                listing: body.listingId,
                subject: q.subject,
                type: q.type || "mcq",
                section: q.section || "",
                topic: q.topic,
                subTopic: q.subTopic || "",
                difficulty: q.difficulty || "Medium",
                languageMode: qLanguageMode,
                correctAnswers: q.correctAnswers || [],
                numericAnswer: q.numericAnswer ?? null
            };

            if (qLanguageMode === "multiple") {
                questionPayload.translations = (q.translations || []).map(t => ({
                    lang: t.lang,
                    question: t.question || "",
                    questionImage: t.questionImage || null,
                    options: normalizeOptions(t.options),
                    solution: t.solution || { text: "", image: null }
                }));
                    questionPayload.question = "";
    questionPayload.questionImage = q.questionImage || null;
    questionPayload.options = normalizeOptions(q.options);
    questionPayload.solution = { text: "", image: q.solution?.image || null };
} else {
                const singleSource = pickSingleSource(q);
                questionPayload.question = singleSource.question || q.question || "";
                questionPayload.questionImage = singleSource.questionImage || q.questionImage || null;
                questionPayload.options = normalizeOptions(singleSource.options || q.options);
                questionPayload.solution = singleSource.solution || q.solution || { text: "", image: null };
                questionPayload.translations = [];
            }

            // 👇 NAYA: dedup check — globally (koi listing/subject filter nahi)
            const hash = computeContentHash(questionPayload);
            let questionId;

            const existing = await Question.findOne({ contentHash: hash });
            if (existing) {
                questionId = existing._id;   // same content mila — reuse karo
            } else {
                questionPayload.contentHash = hash;
                const newQ = await Question.create(questionPayload);
                questionId = newQ._id;
            }

            mappingDocs.push({
                test: savedTest._id, question: questionId,
                order: i + 1,
                subject: q.subject,             // 👈 NAYA
                topic: q.topic,                 // 👈 NAYA
                subTopic: q.subTopic || "",     // 👈 NAYA
                section: q.section || "",       // 👈 NAYA
                positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks
            });
        }

        await TestQuestion.insertMany(mappingDocs);
    }

    res.status(200).json({ success: true, message: "Test aur questions DB me save ho gaye", testId: savedTest._id });
 } catch (err) {
        console.error("Test create error:", err);
        res.status(500).json({ success: false, message: err.message || "Test create karte waqt error aaya" });
    }

};

export const getTestBuilder = async (req, res) => {
    const { id } = req.params;

    const test = await Test.findById(id);
    if (!test) return res.status(404).json({ success: false, message: "Test not found" });

    const mappings = await TestQuestion.find({ test: id }).sort({ order: 1 }).populate("question");

    const questions = mappings.filter(m => m.question).map(m => {
        const q = m.question;

                const base = {
            _id: q._id,
            order: m.order,
            positiveMarks: m.positiveMarks,
            negativeMarks: m.negativeMarks,
            subject: m.subject || q.subject,
            type: q.type,
            section: m.section || q.section,
            topic: m.topic || q.topic,
            subTopic: m.subTopic || q.subTopic,
            difficulty: q.difficulty,
            languageMode: q.languageMode || "single",
            correctAnswers: q.correctAnswers,
            numericAnswer: q.numericAnswer,
            questionImage: q.questionImage,
            options: q.options,
            solution: q.solution
        };

        if (q.languageMode === "multiple") {
            return {
                ...base,
                translations: q.translations || []
            };
        }

        return {
            ...base,
            question: q.question
        };
    });

    res.status(200).json({
        success: true,
        data: {
            test: {
                ...test.toObject(),
                languageMode: test.languageMode || "single",
                languages: test.languages || ["English"],
                showLanguage: test.showLanguage || "all" 
            },
            questions
        }
    });
};

export const updateTestBuilder = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        const existingTest = await Test.findById(id);
        if (!existingTest) return res.status(404).json({ success: false, message: "Test not found" });
        if (!body.title) return res.status(400).json({ success: false, message: "Test title zaroori hai" });

        const listingId = body.listingId || existingTest.listing;
        const listingDoc = await Listing.findById(listingId).select("marks");
        const subjectsConfig = listingDoc?.marks || [];

        const allowedVisibility = ["public", "private", "scheduled"];
        const visibility = allowedVisibility.includes(body.visibility) ? body.visibility : existingTest.visibility;

        if (visibility === "scheduled" && !body.publishAt) {
            return res.status(400).json({ success: false, message: "Schedule ke liye publish date/time zaroori hai" });
        }

        const testLanguageMode = body.languageMode === "multiple" ? "multiple" : "single";
        let testLanguages = Array.isArray(body.languages) && body.languages.length > 0
            ? body.languages.map(l => String(l).trim()).filter(Boolean)
            : (existingTest.languages && existingTest.languages.length > 0 ? existingTest.languages : ["English"]);

        if (testLanguageMode === "single" && testLanguages.length > 1) {
            testLanguages = [testLanguages[0]];
        }
        if (testLanguageMode === "multiple" && testLanguages.length < 2) {
            return res.status(400).json({ success: false, message: "Multiple language mode me kam se kam do languages choose karo" });
        }

let testShowLanguage = body.showLanguage && String(body.showLanguage).trim()
    ? String(body.showLanguage).trim()
    : (existingTest.showLanguage || "all");

if (testLanguageMode !== "multiple") {
    testShowLanguage = "all";
} else if (testShowLanguage !== "all" && !testLanguages.includes(testShowLanguage)) {
    testShowLanguage = "all";
}

        if (Array.isArray(body.questions)) {
            for (let i = 0; i < body.questions.length; i++) {
                const q = body.questions[i];

                if (!q.subject || !q.subject.trim()) {
                 return res.status(400).json({ success: false, message: `Question ${i + 1}: Subject choose karna zaroori hai` });
                }

                if (!q.topic || !q.topic.trim()) {
                    return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
                }

                const qMode = resolveQuestionLanguageMode(q, testLanguageMode);

if (qMode === "multiple") {

    if (!Array.isArray(q.translations) || q.translations.length === 0) {
        return res.status(400).json({
            success: false,
            message: `Question ${i + 1}: har language ka content dena zaroori hai`
        });
    }

    for (const t of q.translations) {
        const hasText = t.question && t.question.trim();
        const hasImage = t.questionImage && t.questionImage.trim();

        if (!hasText && !hasImage) {
            return res.status(400).json({
                success: false,
                message: `Question ${i + 1} (${t.lang}): question text ya image zaroori hai`
            });
        }
    }

} else {

    const source = pickSingleSource(q);

    const hasText = source.question && source.question.trim();
    const hasImage = source.questionImage && source.questionImage.trim();

    if (!hasText && !hasImage) {
        return res.status(400).json({
            success: false,
            message: `Question ${i + 1}: question text ya image me se kam se kam ek dena zaroori hai`
        });
    }

}
            }
        }

        let calculatedTotalMarks = 0;
        if (Array.isArray(body.questions)) {
            calculatedTotalMarks = body.questions.reduce((sum, q) => sum + getMarksForSubject(subjectsConfig, q.subject).positiveMarks, 0);
        }

        existingTest.title = body.title;
        existingTest.languageMode = testLanguageMode;
        existingTest.languages = testLanguages;
        existingTest.showLanguage = testShowLanguage; 
        existingTest.timeStrategy = body.timeStrategy || "total";
        existingTest.duration = body.duration || 60;
        existingTest.subjectTime = body.subjectTime || [];
        existingTest.totalQuestions = Array.isArray(body.questions) ? body.questions.length : 0;
        existingTest.totalMarks = calculatedTotalMarks;
        existingTest.visibility = visibility;
        existingTest.publishAt = visibility === "scheduled" ? new Date(body.publishAt) : null;

        const oldMappings = await TestQuestion.find({ test: id }).sort({ order: 1 });
        const oldQuestionIds = [...new Set(oldMappings.map(m => m.question.toString()))]; 

        const updatedTest = await existingTest.save();

        await TestQuestion.deleteMany({ test: id });

        if (Array.isArray(body.questions) && body.questions.length > 0) {
            const mappingDocs = [];

            for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const marks = getMarksForSubject(subjectsConfig, q.subject);
    const qLanguageMode = resolveQuestionLanguageMode(q, testLanguageMode);

    const questionPayload = {
        listing: listingId,
        subject: q.subject,
        type: q.type || "mcq",
        section: q.section || "",
        topic: q.topic,
        subTopic: q.subTopic || "",
        difficulty: q.difficulty || "Medium",
        languageMode: qLanguageMode,
        correctAnswers: q.correctAnswers || [],
        numericAnswer: q.numericAnswer ?? null
    };

    if (qLanguageMode === "multiple") {
        questionPayload.translations = (q.translations || []).map(t => ({
            lang: t.lang,
            question: t.question || "",
            questionImage: t.questionImage || null,
            options: normalizeOptions(t.options),
            solution: t.solution || { text: "", image: null }
        }));
               questionPayload.question = "";
        questionPayload.questionImage = q.questionImage || null;
        questionPayload.options = normalizeOptions(q.options);
        questionPayload.solution = { text: "", image: q.solution?.image || null };
    } else {
        const singleSource = pickSingleSource(q);
        questionPayload.question = singleSource.question || q.question || "";
        questionPayload.questionImage = singleSource.questionImage || q.questionImage || null;
        questionPayload.options = normalizeOptions(singleSource.options || q.options);
        questionPayload.solution = singleSource.solution || q.solution || { text: "", image: null };
        questionPayload.translations = [];
    }

    let questionId = (q._id && oldQuestionIds.includes(String(q._id))) ? q._id : null;

    // 👇 NAYA: hash nikaalo, dedup + shared-edit logic
    const hash = computeContentHash(questionPayload);
    questionPayload.contentHash = hash;

    if (questionId) {
        // Existing question — content update karo. Ye document agar kisi
        // aur test me bhi shared hai, to wahan bhi reflect hoga (jaisa chaha gaya).
        await Question.findByIdAndUpdate(questionId, questionPayload);
    } else {
        // Naya question is test me add ho raha hai — pehle dedup check karo
        const existing = await Question.findOne({ contentHash: hash });
        if (existing) {
            questionId = existing._id;
        } else {
            const newQ = await Question.create(questionPayload);
            questionId = newQ._id;
        }
    }

    mappingDocs.push({
        test: updatedTest._id, question: questionId,
        order: i + 1,
        subject: q.subject,             // 👈 NAYA
        topic: q.topic,                 // 👈 NAYA
        subTopic: q.subTopic || "",     // 👈 NAYA
        section: q.section || "",       // 👈 NAYA
        positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks
    });
}

            await TestQuestion.insertMany(mappingDocs);
            
            for (const qId of oldQuestionIds) {
    const stillUsed = await TestQuestion.exists({ question: qId });
    if (!stillUsed) {
        await Question.findByIdAndDelete(qId);
    }
}


        }

        res.status(200).json({ success: true, message: "Test aur questions update ho gaye", testId: updatedTest._id });

    } catch (err) {
        console.error("Test update error:", err);
        res.status(500).json({ success: false, message: err.message || "Test update karte waqt error aaya" });
    }
};