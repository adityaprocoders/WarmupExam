import Test from "../models/Test.js";
import Listing from "../models/listing.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
import ExpressError from "../utils/ExpressError.js";
import { calculateRankFromPredictor } from "../utils/rankHelper.js";
import { getTestStatus, formatDateTime } from "../utils/testStatus.js";

import { updateWarmupStreak } from "./dailyWarmupController.js";


// Question document ko selected language ke hisaab se FLAT object me convert karta hai
// (translations[] se ya single-mode field se) — attempt.ejs isi flat shape ko expect karta hai.
function resolveQuestionForLanguage(qDoc, lang) {
    const q = qDoc.toObject ? qDoc.toObject() : qDoc;

    if (q.languageMode === "multiple") {
        const t =
            (q.translations || []).find(tr => tr.lang === lang) ||
            (q.translations || [])[0]; // fallback: pehli available translation

        return {
            ...q,
            question: t?.question || "",
            questionImage: t?.questionImage || q.questionImage || null, // image shared bhi ho sakti hai
            options: (t?.options && t.options.length > 0)
                ? t.options.map((opt, idx) => ({
                    text: opt.text || "",
                    image: opt.image || (q.options?.[idx]?.image ?? null) // fallback shared image
                }))
                : q.options || [],
            solution: {
                text: t?.solution?.text || q.solution?.text || "",
                image: t?.solution?.image || q.solution?.image || null
            }
        };
    }

    // single mode — jaisa hai waisa hi (already flat)
    return q;
}

function stripAnswerFields(q) {
    const { correctAnswers, numericAnswer, solution, translations, ...safe } = q;
    return safe;
}


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
        <button data-action="close-instructions" class="bg-indigo-600 text-white px-6 py-2 rounded-xl">Close</button>
    </div>
`);
    }

    const listing = await Listing.findById(test.listing).select("exam title");
    const mappings = await TestQuestion.find({ test: id }).sort({ order: 1 }).populate("question");
     
    // ✅ Language validate karo (query param se)
    let lang = req.query.lang || (test.languages && test.languages[0]) || "English";
    if (test.languageMode === "multiple") {
        if (!test.languages || !test.languages.includes(lang)) {
            lang = test.languages && test.languages[0] ? test.languages[0] : "English";
        }
    } else {
        lang = (test.languages && test.languages[0]) || "English";
    }

    // 👇 NAYA
let availableLanguages = test.languages || ["English"];
if (test.languageMode === "multiple" && test.showLanguage && test.showLanguage !== "all") {
    if (test.languages && test.languages.includes(test.showLanguage)) {
        availableLanguages = [test.showLanguage];
    }
}
if (availableLanguages.length === 1) {
    lang = availableLanguages[0];
}

    const questions = mappings.filter(m => m.question).map(m => stripAnswerFields({
        ...resolveQuestionForLanguage(m.question, lang),
        order: m.order,
        positiveMarks: m.positiveMarks,
        negativeMarks: m.negativeMarks
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
        subjectBreakdown: Object.values(subjectMap),
        availableLanguages,
        lang
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

    // ✅ Language validate karo (query param se) — questions banane se PEHLE
    let lang = req.query.lang || (test.languages && test.languages[0]) || "English";

    if (test.languageMode === "multiple") {
        if (!test.languages || !test.languages.includes(lang)) {
            lang = test.languages && test.languages[0] ? test.languages[0] : "English";
        }
    } else {
        lang = (test.languages && test.languages[0]) || "English";
    }

    // ✅ Har question ko isi language ke hisaab se resolve karo (translations[] handle karega)
    const questions = mappings.filter(m => m.question).map(m => stripAnswerFields({
        ...resolveQuestionForLanguage(m.question, lang),
        order: m.order,
        positiveMarks: m.positiveMarks,
        negativeMarks: m.negativeMarks
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

    const session = await AttemptSession.create({ test: id, user: req.user._id, language: lang });

    
    const returnUrl = req.query.from || req.headers.referer || "/dashboard";

    res.render("dashboard/attempt", {
        layout: false, test, subjectsOrder, grouped,
        sessionId: session._id.toString(),
        returnUrl,
        currentUser: req.user   // ✅ candidate info ke liye
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

    // ✅ Listing ke marks config se qualifying-only subjects nikal lo
    const listingForMarks = await Listing.findById(test.listing).select("marks");
    const qualifyingSubjects = new Set(
        (listingForMarks?.marks || [])
            .filter(m => m.qualifyingOnly)
            .map(m => m.subject)
    );

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

        // ✅ Qualifying-only subject hai to sirf marks add na karo, baki sab (correct/wrong count) normal chalega
        const isQualifyingOnly = qualifyingSubjects.has(q.subject);

        if (!attempted) skippedCount++;
        else if (isCorrect) {
            correctCount++;
            if (!isQualifyingOnly) score += m.positiveMarks;
        } else {
            wrongCount++;
            if (!isQualifyingOnly) score -= m.negativeMarks;
        }

        savedAnswers.push({
            question: q._id,
            selectedOptions: userAns?.selectedOptions || [],
            numericAnswer: userAns?.numericAnswer ?? null,
            status: userAns?.status || "notVisited"
        });
    });

    if (!test.isDailyWarmup) {                                    // 👈 NAYA
        await Attempt.deleteOne({ user: req.user._id, test: testId });  // 👈 NAYA
    }                                                              // 👈 NAYA


    const attempt = await Attempt.create({
        test: testId,
        listing: test.listing,
        user: req.user._id,
        answers: savedAnswers,
        score, totalMarks: test.totalMarks, correctCount, wrongCount, skippedCount,
        timeTaken: timeTaken || 0, submitType: submitType || "manual",
        language: session.language || "English"   // 👈 naya
    });
    
if (test.isDailyWarmup) {
    await updateWarmupStreak(req.user._id, test.warmupExam);
}


    res.status(200).json({ success: true, attemptId: attempt._id });
};

export const showAnalysis = async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await Attempt.findOne({ _id: attemptId, user: req.user._id }).populate("answers.question");
    if (!attempt) throw new ExpressError(404, "Attempt Not Found");

    const test = await Test.findById(attempt.test);
    const listing = await Listing.findById(attempt.listing);

    // ✅ Listing ke marks config se qualifying-only subjects nikal lo
    const qualifyingSubjects = new Set(
        (listing?.marks || [])
            .filter(m => m.qualifyingOnly)
            .map(m => m.subject)
    );

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

        const subject = q.subject || "General";
        const isQualifyingOnly = qualifyingSubjects.has(subject);

        // ✅ Sirf marks add karna skip karo, baaki (topicBreakdown counts) normal rahenge
        if (!isQualifyingOnly) {
            if (status === "correct") positiveTotal += marks.positiveMarks;
            if (status === "wrong") negativeTotal += marks.negativeMarks;
        }

        if (!subjectMap[subject]) subjectMap[subject] = { subject, total: 0, correct: 0, wrong: 0 };
        subjectMap[subject].total += 1;
        if (status === "correct") subjectMap[subject].correct += 1;
        if (status === "wrong") subjectMap[subject].wrong += 1;

        // ✅ Attempt ke waqt candidate ne jo language choose ki thi, wahi analysis me bhi dikhao
        const resolvedQ = resolveQuestionForLanguage(q, attempt.language || "English");

        solutions.push({
            order: idx + 1,
            questionId: q._id,  
            subject: q.subject || "",
            type: q.type || "",
            topic: q.topic || "",
            subtopic: q.subtopic || "",
            difficulty: q.difficulty || "",
            status,
            questionText: resolvedQ.question || "",
            questionImage: resolvedQ.questionImage || null,
            options: resolvedQ.options || [],
            correctAnswers: q.correctAnswers || [],
            numericAnswer: q.numericAnswer ?? null,
            selectedOptions: a.selectedOptions || [],
            userNumericAnswer: a.numericAnswer ?? null,
            solutionText: resolvedQ.solution?.text || "",
            solutionImage: resolvedQ.solution?.image || null
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