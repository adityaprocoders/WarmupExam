import Test from "../models/Test.js";
import Listing from "../models/listing.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
import ExpressError from "../utils/ExpressError.js";
import { calculateRankFromPredictor } from "../utils/rankHelper.js";
import { getTestStatus, formatDateTime } from "../utils/testStatus.js";

export const showInstructions = async (req, res) => {
    const { id } = req.params;

    const test = await Test.findById(id);
    if (!test) throw new ExpressError(404, "Test Not Found");

    const { status, publishAt } = getTestStatus(test);
    if (status === "upcoming" || status === "expired") {
        const message = status === "upcoming"
            ? `This test has not started yet. It will begin at ${formatDateTime(publishAt)}.`
            : "This test is no longer available because its time window has expired.";

        return res.status(200).send(`
            <div class="bg-white rounded-2xl p-8 max-w-md mx-auto text-center">
                <p class="text-slate-700 font-medium mb-4">${message}</p>
                <button onclick="closeInstructionsModal()" class="bg-indigo-600 text-white px-6 py-2 rounded-xl">Close</button>
            </div>
        `);
    }

    const listing = await Listing.findById(test.listing).select("exam title");
    const mappings = await TestQuestion.find({ test: id }).sort({ order: 1 }).populate("question");

    const questions = mappings.filter(m => m.question).map(m => ({
        ...m.question.toObject(), order: m.order, positiveMarks: m.positiveMarks, negativeMarks: m.negativeMarks
    }));

    const subjectMap = {};
    questions.forEach(q => {
        if (!subjectMap[q.subject]) {
            subjectMap[q.subject] = { subject: q.subject, count: 0, positiveMarks: q.positiveMarks, negativeMarks: q.negativeMarks };
        }
        subjectMap[q.subject].count += 1;
    });

    res.render("dashboard/instructions", {
        layout: false, test, listing, questions,
        subjectBreakdown: Object.values(subjectMap)
    });
};

export const showAttempt = async (req, res) => {
    const { id } = req.params;

    const test = await Test.findById(id);
    if (!test) throw new ExpressError(404, "Test Not Found");

    const { status, publishAt } = getTestStatus(test);
    if (status === "upcoming") {
        req.flash("error", `This test has not started yet. It will begin at ${formatDateTime(publishAt)}.`);
        return res.redirect("back");
    }
    if (status === "expired") {
        req.flash("error", "This test is no longer available because its time window has expired.");
        return res.redirect("back");
    }

    const mappings = await TestQuestion.find({ test: id }).sort({ order: 1 }).populate("question");

    const questions = mappings.filter(m => m.question).map(m => ({
        ...m.question.toObject(), order: m.order, positiveMarks: m.positiveMarks, negativeMarks: m.negativeMarks
    }));

    const subjectsOrder = [];
    const grouped = {};

    questions.forEach(q => {
        if (!grouped[q.subject]) {
            grouped[q.subject] = [];
            subjectsOrder.push(q.subject);
        }
        grouped[q.subject].push(q);
    });

    // ✅ Har fresh render par (naya attempt ya reattempt, dono allowed) ek naya
    // one-time submit-token banao. "Unlimited reattempt" feature affect nahi hota —
    // sirf isi ek session ka double-submit blocked hoga.
    const session = await AttemptSession.create({ test: id, user: req.user._id });

    res.render("dashboard/attempt", {
        layout: false, test, subjectsOrder, grouped,
        sessionId: session._id.toString()
    });
};

export const submitAttempt = async (req, res) => {
    const { testId } = req.params;
    const { answers, timeTaken, submitType, sessionId } = req.body;

    const test = await Test.findById(testId);
    if (!test) throw new ExpressError(404, "Test Not Found");

    if (!sessionId) {
        return res.status(400).json({ success: false, message: "Session missing. Please restart the test." });
    }

    // ✅ Atomic consume — findOneAndDelete race-safe hai (double-click, network retry,
    // 2 tabs, ya stale back-button page se dobara submit — sab yahin block ho jaate hain).
    const session = await AttemptSession.findOneAndDelete({
        _id: sessionId, test: testId, user: req.user._id
    });

    if (!session) {
        return res.status(409).json({
            success: false,
            message: "This attempt has already been submitted or has expired. Please start a new attempt."
        });
    }

    const { status, publishAt } = getTestStatus(test);
    if (status === "upcoming") {
        return res.status(403).json({
            success: false,
            message: `This test has not started yet. It will begin at ${formatDateTime(publishAt)}.`
        });
    }
    if (status === "expired") {
        return res.status(403).json({
            success: false,
            message: "This test is no longer available because its time window has expired."
        });
    }

    const mappings = await TestQuestion.find({ test: testId }).populate("question");

    let score = 0, correctCount = 0, wrongCount = 0, skippedCount = 0;
    const savedAnswers = [];

    mappings.forEach(m => {
        const q = m.question;
        if (!q) return;

        const userAns = answers.find(a => a.questionId === String(q._id));

        let isCorrect = false, attempted = false;

        if (userAns) {
            if (q.type === "integer") {
                attempted = userAns.numericAnswer !== null && userAns.numericAnswer !== undefined;
                isCorrect = attempted && Number(userAns.numericAnswer) === Number(q.numericAnswer);
            } else {
                const sel = userAns.selectedOptions || [];
                attempted = sel.length > 0;
                const correct = q.correctAnswers || [];
                isCorrect = attempted && sel.length === correct.length && sel.every(i => correct.includes(i));
            }
        }

        if (!attempted) skippedCount++;
        else if (isCorrect) { correctCount++; score += m.positiveMarks; }
        else { wrongCount++; score -= m.negativeMarks; }

        savedAnswers.push({
            question: q._id,
            selectedOptions: userAns?.selectedOptions || [],
            numericAnswer: userAns?.numericAnswer ?? null,
            status: userAns?.status || "notVisited"
        });
    });

    const attempt = await Attempt.create({
        test: testId,
        listing: test.listing,
        user: req.user._id,
        answers: savedAnswers,
        score, totalMarks: test.totalMarks, correctCount, wrongCount, skippedCount,
        timeTaken: timeTaken || 0, submitType: submitType || "manual"
    });

    res.status(200).json({ success: true, attemptId: attempt._id });
};

export const showAnalysis = async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await Attempt.findOne({ _id: attemptId, user: req.user._id }).populate("answers.question");
    if (!attempt) throw new ExpressError(404, "Attempt Not Found");

    const test = await Test.findById(attempt.test);
    const listing = await Listing.findById(attempt.listing);

    const mappings = await TestQuestion.find({ test: attempt.test });
    const marksMap = {};
    mappings.forEach(m => {
        marksMap[String(m.question)] = {
            positiveMarks: m.positiveMarks || 0,
            negativeMarks: m.negativeMarks || 0
        };
    });

    let positiveTotal = 0;
    let negativeTotal = 0;
    const subjectMap = {};
    const solutions = [];

    attempt.answers.forEach((a, idx) => {
        const q = a.question;
        if (!q) return;

        const marks = marksMap[String(q._id)] || { positiveMarks: 0, negativeMarks: 0 };

        let attempted = false;
        let isCorrect = false;

        if (q.type === "integer") {
            attempted = a.numericAnswer !== null && a.numericAnswer !== undefined;
            isCorrect = attempted && Number(a.numericAnswer) === Number(q.numericAnswer);
        } else {
            const sel = a.selectedOptions || [];
            attempted = sel.length > 0;
            const correct = q.correctAnswers || [];
            isCorrect = attempted && sel.length === correct.length && sel.every(i => correct.includes(i));
        }

        let status = "skipped";
        if (attempted) status = isCorrect ? "correct" : "wrong";

        if (status === "correct") positiveTotal += marks.positiveMarks;
        if (status === "wrong") negativeTotal += marks.negativeMarks;

        const subject = q.subject || "General";
        if (!subjectMap[subject]) subjectMap[subject] = { subject, total: 0, correct: 0, wrong: 0 };
        subjectMap[subject].total += 1;
        if (status === "correct") subjectMap[subject].correct += 1;
        if (status === "wrong") subjectMap[subject].wrong += 1;

        solutions.push({
    order: idx + 1,
    subject: q.subject || "",
    type: q.type || "",
    topic: q.topic || "",
    subtopic: q.subtopic || "",
    difficulty: q.difficulty || "",
    status,
    questionText: q.question || "",
    questionImage: q.questionImage || null,
    options: q.options || [],
    correctAnswers: q.correctAnswers || [],
    numericAnswer: q.numericAnswer ?? null,
    selectedOptions: a.selectedOptions || [],
    userNumericAnswer: a.numericAnswer ?? null,
    solutionText: q.solution?.text || "",
    solutionImage: q.solution?.image || null
});
    });

    const topicBreakdown = Object.values(subjectMap).map(s => {
        const attempted = s.correct + s.wrong;
        return {
            subject: s.subject,
            attempted,
            correct: s.correct,
            wrong: s.wrong,
            accuracy: attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0
        };
    });

    const { rank, totalUsers } = calculateRankFromPredictor(attempt.score, listing?.rankPredictorData);

    const totalQuestions = attempt.answers.length;
    const attemptedCount = attempt.correctCount + attempt.wrongCount;
    const accuracy = attemptedCount > 0
        ? Math.round((attempt.correctCount / attemptedCount) * 1000) / 10
        : 0;

    const totalSeconds = attempt.timeTaken || 0;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const timeFormatted = [hrs, mins, secs].map(v => String(v).padStart(2, "0")).join(":");

    const analysisData = {
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        attempted: attemptedCount,
        totalQuestions,
        timeTaken: timeFormatted,
        rank,
        totalUsers,
        accuracy,
        positiveMarks: positiveTotal,
        negativeMarks: negativeTotal,
        skippedCount: attempt.skippedCount,
        topicBreakdown,
        solutions
    };

    res.render("dashboard/analysis", { layout: false, attempt, test, listing, analysisData });
};