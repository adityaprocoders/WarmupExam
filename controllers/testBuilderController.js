import Listing from "../models/listing.js";
import Section from "../models/section.js";
import Test from "../models/Test.js";
import Question from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import ExpressError from "../utils/ExpressError.js";

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

    if (Array.isArray(body.questions)) {
    for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i];

        const hasText = q.question && q.question.trim();
        const hasImage = q.questionImage && q.questionImage.trim();

        if (!hasText && !hasImage) {
            return res.status(400).json({ success: false, message: `Question ${i + 1}: question text ya image me se kam se kam ek dena zaroori hai` });
        }

        if (!q.topic || !q.topic.trim()) {
            return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
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
        const questionDocs = body.questions.map(q => ({
            listing: body.listingId,
            subject: q.subject,
            type: q.type || "mcq",
            topic: q.topic,
            subTopic: q.subTopic || "",
            difficulty: q.difficulty || "Medium",
            question: q.question,
            questionImage: q.questionImage || null,
            options: q.options || [],
            correctAnswers: q.correctAnswers || [],
            numericAnswer: q.numericAnswer ?? null,
            solution: q.solution || { text: "", image: null }
        }));

        const savedQuestions = await Question.insertMany(questionDocs);

        const mappingDocs = savedQuestions.map((q, i) => {
            const marks = getMarksForSubject(subjectsConfig, body.questions[i].subject);
            return {
                test: savedTest._id, question: q._id,
                order: body.questions[i].order || (i + 1),
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

    const questions = mappings.filter(m => m.question).map(m => ({
        _id: m.question._id,
        order: m.order,
        positiveMarks: m.positiveMarks,
        negativeMarks: m.negativeMarks,
        subject: m.question.subject,
        type: m.question.type,
        topic: m.question.topic,
        subTopic: m.question.subTopic,
        difficulty: m.question.difficulty,
        question: m.question.question,
        questionImage: m.question.questionImage,
        options: m.question.options,
        correctAnswers: m.question.correctAnswers,
        numericAnswer: m.question.numericAnswer,
        solution: m.question.solution
    }));

    res.status(200).json({ success: true, data: { test, questions } });
};

export const updateTestBuilder = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        const existingTest = await Test.findById(id);
        if (!existingTest) return res.status(404).json({ success: false, message: "Test not found" });
        if (!body.title) return res.status(400).json({ success: false, message: "Test title zaroori hai" });

        if (Array.isArray(body.questions)) {
    for (let i = 0; i < body.questions.length; i++) {
        const q = body.questions[i];

        const hasText = q.question && q.question.trim();
        const hasImage = q.questionImage && q.questionImage.trim();

        if (!hasText && !hasImage) {
            return res.status(400).json({ success: false, message: `Question ${i + 1}: question text ya image me se kam se kam ek dena zaroori hai` });
        }

        if (!q.topic || !q.topic.trim()) {
            return res.status(400).json({ success: false, message: `Question ${i + 1}: topic zaroori hai` });
        }
    }
}

        const listingId = body.listingId || existingTest.listing;
        const listingDoc = await Listing.findById(listingId).select("marks");
        const subjectsConfig = listingDoc?.marks || [];

        const allowedVisibility = ["public", "private", "scheduled"];
        const visibility = allowedVisibility.includes(body.visibility) ? body.visibility : existingTest.visibility;

        if (visibility === "scheduled" && !body.publishAt) {
            return res.status(400).json({ success: false, message: "Schedule ke liye publish date/time zaroori hai" });
        }

        let calculatedTotalMarks = 0;
        if (Array.isArray(body.questions)) {
            calculatedTotalMarks = body.questions.reduce((sum, q) => sum + getMarksForSubject(subjectsConfig, q.subject).positiveMarks, 0);
        }

        existingTest.title = body.title;
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

                const questionPayload = {
                    listing: listingId,
                    subject: q.subject,
                    type: q.type || "mcq",
                    topic: q.topic,
                    subTopic: q.subTopic || "",
                    difficulty: q.difficulty || "Medium",
                    question: q.question,
                    questionImage: q.questionImage || null,
                    options: q.options || [],
                    correctAnswers: q.correctAnswers || [],
                    numericAnswer: q.numericAnswer ?? null,
                    solution: q.solution || { text: "", image: null }
                };

                let questionId = q._id;

                if (questionId) {
                    await Question.findByIdAndUpdate(questionId, questionPayload);
                } else {
                    const newQ = await Question.create(questionPayload);
                    questionId = newQ._id;
                }

                mappingDocs.push({
                    test: updatedTest._id, question: questionId,
                    order: q.order || (i + 1),
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