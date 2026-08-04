import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import ExpressError from "../utils/ExpressError.js";


// Options ko hamesha { text, image } shape me normalize karta hai —
// chahe client se plain string aaye ("Mumbai") ya already object aaye ({text, image})
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
    let found = subjectsConfig.find(s => s.subject === subjectName);
    if (!found && subjectsConfig.length > 0) found = subjectsConfig[0];
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
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
        editId: editId || ""
    });
};

export const getListingSubjects = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).select("marks");
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });
    res.status(200).json({ success: true, data: listing.marks });
};

export const createTestBuilder = async (req, res) => {
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
    testShowLanguage = "all"; // single mode me hamesha "all"
} else if (testShowLanguage !== "all" && !testLanguages.includes(testShowLanguage)) {
    // agar admin ne jo language select ki wo languages list me hi nahi hai, to reject/reset karo
    testShowLanguage = "all";
}

    if (Array.isArray(body.questions)) {
        for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i];

            if (!q.topic || !q.topic.trim()) {
                return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
            }

            if (testLanguageMode === "multiple") {
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
                const hasText = q.question && q.question.trim();
                const hasImage = q.questionImage && q.questionImage.trim();
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

    if (Array.isArray(body.questions) && body.questions.length > 0) {
        const questionDocs = body.questions.map(q => {
            const qLanguageMode = testLanguageMode;

            const base = {
                listing: body.listingId,
                subject: q.subject,
                type: q.type || "mcq",
                topic: q.topic,
                subTopic: q.subTopic || "",
                difficulty: q.difficulty || "Medium",
                languageMode: qLanguageMode,
                correctAnswers: q.correctAnswers || [],
                numericAnswer: q.numericAnswer ?? null
            };

            if (qLanguageMode === "multiple") {
                return {
                    ...base,
                    translations: (q.translations || []).map(t => ({
                        lang: t.lang,
                        question: t.question || "",
                        questionImage: t.questionImage || null,
                        options: normalizeOptions(t.options),
                        solution: t.solution || { text: "", image: null }
                    }))
                };
            }

            return {
                ...base,
                question: q.question,
                questionImage: q.questionImage || null,
                options: normalizeOptions(q.options),
                solution: q.solution || { text: "", image: null }
            };
        });

        const savedQuestions = await Question.insertMany(questionDocs);

        const mappingDocs = savedQuestions.map((q, i) => {
            const marks = getMarksForSubject(subjectsConfig, body.questions[i].subject);
            return {
                test: savedTest._id, question: q._id,
                order: i + 1,
                positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks
            };
        });

        await TestQuestion.insertMany(mappingDocs);
    }

    res.status(200).json({ success: true, message: "Test aur questions DB me save ho gaye", testId: savedTest._id });
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
            subject: q.subject,
            type: q.type,
            topic: q.topic,
            subTopic: q.subTopic,
            difficulty: q.difficulty,
            languageMode: q.languageMode || "single",   // 👈 NAYA
            correctAnswers: q.correctAnswers,
            numericAnswer: q.numericAnswer
        };

        if (q.languageMode === "multiple") {
            // 👇 NAYA: multiple mode me translations bhejo
            return {
                ...base,
                translations: q.translations || []
            };
        }

        // single mode — purana behaviour as-is
        return {
            ...base,
            question: q.question,
            questionImage: q.questionImage,
            options: q.options,
            solution: q.solution
        };
    });

    res.status(200).json({
        success: true,
        data: {
            test: {
                ...test.toObject(),
                languageMode: test.languageMode || "single",   // 👈 NAYA
                languages: test.languages || ["English"],       // 👈 NAYA
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

        // 👇 NAYA: Test-level language settings normalize karo
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

        // 👇 NAYA: Show Language normalize + validate karo
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

                if (!q.topic || !q.topic.trim()) {
                    return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
                }

                // 👇 NAYA: language-mode ke hisaab se validation
                if (testLanguageMode === "multiple") {
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
                    const hasText = q.question && q.question.trim();
                    const hasImage = q.questionImage && q.questionImage.trim();
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

        existingTest.title = body.title;
        existingTest.languageMode = testLanguageMode;   // 👈 NAYA
        existingTest.languages = testLanguages;
        existingTest.showLanguage = testShowLanguage; 
        existingTest.timeStrategy = body.timeStrategy || "total";
        existingTest.duration = body.duration || 60;
        existingTest.subjectTime = body.subjectTime || [];
        existingTest.totalQuestions = Array.isArray(body.questions) ? body.questions.length : 0;
        existingTest.totalMarks = calculatedTotalMarks;
        existingTest.visibility = visibility;
        existingTest.publishAt = visibility === "scheduled" ? new Date(body.publishAt) : null;

        const updatedTest = await existingTest.save();

        await TestQuestion.deleteMany({ test: id });

        if (Array.isArray(body.questions) && body.questions.length > 0) {
            const mappingDocs = [];

            for (let i = 0; i < body.questions.length; i++) {
                const q = body.questions[i];
                const marks = getMarksForSubject(subjectsConfig, q.subject);
                const qLanguageMode = testLanguageMode;

                const questionPayload = {
                    listing: listingId,
                    subject: q.subject,
                    type: q.type || "mcq",
                    topic: q.topic,
                    subTopic: q.subTopic || "",
                    difficulty: q.difficulty || "Medium",
                    languageMode: qLanguageMode,     // 👈 NAYA
                    correctAnswers: q.correctAnswers || [],
                    numericAnswer: q.numericAnswer ?? null
                };

                if (qLanguageMode === "multiple") {
                    questionPayload.translations = (q.translations || []).map(t => ({
                        lang: t.lang,
                        question: t.question || "",
                        questionImage: t.questionImage || null,
                        options: normalizeOptions(t.options),   // 👈 FIX
                        solution: t.solution || { text: "", image: null }
                    }));
                    questionPayload.question = "";
                    questionPayload.questionImage = null;
                    questionPayload.options = [];
                    questionPayload.solution = { text: "", image: null };
                } else {
                    questionPayload.question = q.question;
                    questionPayload.questionImage = q.questionImage || null;
                    questionPayload.options = normalizeOptions(q.options),   // 👈 FIX
                    questionPayload.solution = q.solution || { text: "", image: null };
                    questionPayload.translations = [];
                }

                let questionId = q._id;

                if (questionId) {
                    await Question.findByIdAndUpdate(questionId, questionPayload);
                } else {
                    const newQ = await Question.create(questionPayload);
                    questionId = newQ._id;
                }

                mappingDocs.push({
                    test: updatedTest._id, question: questionId,
                    order: i + 1,
                    positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks
                });
            }

            await TestQuestion.insertMany(mappingDocs);
        }

        res.status(200).json({ success: true, message: "Test aur questions update ho gaye", testId: updatedTest._id });

    } catch (err) {
        console.error("Test update error:", err);
        res.status(500).json({ success: false, message: err.message || "Test update karte waqt error aaya" });
    }
};