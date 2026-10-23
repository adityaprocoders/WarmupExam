import Test from "../models/Test.js";
import Listing from "../models/listing.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
import ExpressError from "../utils/ExpressError.js";
import Section from "../models/Section.js";
import LiveTestResult from "../models/LiveTestResult.js";
import { calculateRankFromPredictor, calculateRankRange } from "../utils/rankHelper.js";
import { getTestStatus, formatDateTime } from "../utils/testStatus.js";
import { getLiveTestRank } from "../utils/liveRankHelper.js";
import { getAccuracyComparison } from "../utils/testStatsHelper.js";
import { getInstructionStrings, getLanguageLabel, htmlLangCode, buildInstructionBundle } from "../utils/instructionI18n.js";
import { getTierConfigForTest } from "../utils/tierHelper.js";
import { isOwnerUser } from "../utils/authHelpers.js";
import { isSafeRedirectPath } from "../utils/safeRedirect.js";
 


function buildClientQuestions(mappings, lang) {
    return mappings.filter(m => m.question).map(m => {
        const resolved = resolveQuestionForLanguage(m.question, lang);
        return stripAnswerFields({
            ...resolved,
            subject: m.subject || resolved.subject || "",
            topic: m.topic || resolved.topic || "",
            subTopic: m.subTopic || resolved.subTopic || "",
            order: m.order,
            positiveMarks: m.positiveMarks,
            negativeMarks: m.negativeMarks
        });
    });
}


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

function resolveTestLanguage(test, requested) {
    let lang = requested || (test.languages && test.languages[0]) || "English";

    if (test.languageMode === "multiple") {
        if (!test.languages || !test.languages.includes(lang)) {
            lang = test.languages && test.languages[0] ? test.languages[0] : "English";
        }
    } else {
        lang = (test.languages && test.languages[0]) || "English";
    }

    let availableLanguages = test.languages || ["English"];
    if (test.languageMode === "multiple" && test.showLanguage && test.showLanguage !== "all") {
        if (test.languages && test.languages.includes(test.showLanguage)) {
            availableLanguages = [test.showLanguage];
        }
    }
    if (availableLanguages.length === 1) lang = availableLanguages[0];

    return lang;
}

export const startAttempt = async (req, res) => {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) throw new ExpressError(404, "Test Not Found");

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

    if (test.isLiveTest) {
        if (test.liveTestExpiresAt && new Date(test.liveTestExpiresAt) <= new Date()) {
            return res.status(403).json({ success: false, message: "This Live Test has ended." });
        }
        const existingAttempt = await Attempt.findOne({ test: testId, user: req.user._id });
        if (existingAttempt) {
            return res.status(409).json({
                success: false,
                code: "ALREADY_SUBMITTED",
                message: "You have already attempted this test.",
                redirect: `/attempt/${existingAttempt._id}/analysis`
            });
        }
    }

    const lang = resolveTestLanguage(test, req.body?.lang);

    let session = null;
    if (test.isLiveTest) {
        session = await AttemptSession.findOne({ test: testId, user: req.user._id });
        if (session) {
            session.exited = false;
            session.language = lang;
            await session.save();
        }
    } else {
        await AttemptSession.deleteMany({ test: testId, user: req.user._id });
    }

    if (!session || session.exited) {
        session = await AttemptSession.create({ test: testId, user: req.user._id, language: lang });
    }

    res.json({ success: true });
};

export const exitAttempt = async (req, res) => {
    const { testId } = req.params;

    const test = await Test.findById(testId).select("isLiveTest");
    if (!test) throw new ExpressError(404, "Test Not Found");

    if (test.isLiveTest) {
        await AttemptSession.updateMany({ test: testId, user: req.user._id }, { $set: { exited: true } });
    } else {
        await AttemptSession.deleteMany({ test: testId, user: req.user._id });
    }

    res.json({ success: true });
};

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

    const questions = buildClientQuestions(mappings, lang);
 

    const subjectMap = {};
    questions.forEach(q => {
        if (!subjectMap[q.subject]) {
            subjectMap[q.subject] = { subject: q.subject, count: 0, positiveMarks: q.positiveMarks, negativeMarks: q.negativeMarks };
        }
        subjectMap[q.subject].count += 1;
    });


        // ===== Paper Pattern table (section-wise) =====
    // Logic attempt.js ke buildSections() jaisa hi hai, taaki instructions me jo dikhe wahi test me chale
    const DEFAULT_SUBJECT_MINUTES = 20;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

    const subjStats = {};
    const subjOrder = [];
    questions.forEach(q => {
        const name = q.subject || "General";
        if (!subjStats[name]) {
            subjStats[name] = { subject: name, count: 0, marks: 0 };
            subjOrder.push(name);
        }
        subjStats[name].count += 1;
        subjStats[name].marks += Number(q.positiveMarks) || 0;
    });

    const makeRow = (names, minutes) => {
        const list = names.map(n => ({ subject: n, count: subjStats[n].count }));
        return {
            name: names.join(" + "),
            subjects: list,
            questions: list.reduce((s, x) => s + x.count, 0),
            marks: round2(names.reduce((s, n) => s + subjStats[n].marks, 0)),
            minutes
        };
    };

    const hasSubjectTiming = test.timeStrategy === "subject"
        && Array.isArray(test.subjectTime) && test.subjectTime.length > 0;
    const paperSections = [];

    if (hasSubjectTiming) {
        const used = new Set();
        test.subjectTime.forEach(entry => {
            const whole = norm(entry.subject);
            const wanted = subjOrder.some(s => norm(s) === whole)
                ? [whole]
                : String(entry.subject || "").split(/\s\+\s/).map(norm).filter(Boolean);
            const matched = subjOrder.filter(s => wanted.includes(norm(s)) && !used.has(s));
            if (!matched.length) return;
            matched.forEach(s => used.add(s));
            const mins = Number(entry.duration) > 0 ? Number(entry.duration) : DEFAULT_SUBJECT_MINUTES;
            paperSections.push(makeRow(matched, mins));
        });
        subjOrder.forEach(s => {
            if (!used.has(s)) paperSections.push(makeRow([s], DEFAULT_SUBJECT_MINUTES));
        });
    } else {
        subjOrder.forEach(s => paperSections.push(makeRow([s], null)));
    }

    const paperTotals = {
        questions: paperSections.reduce((s, r) => s + r.questions, 0),
        marks: round2(paperSections.reduce((s, r) => s + r.marks, 0)),
        minutes: hasSubjectTiming
            ? paperSections.reduce((s, r) => s + r.minutes, 0)
            : (Number(test.duration) || 0),
        perSection: hasSubjectTiming
    };



    res.render("dashboard/instructions", {
        layout: false, test, listing, questions,
        paperSections, paperTotals,
        subjectBreakdown: Object.values(subjectMap),
        availableLanguages,
        lang,
        t: getInstructionStrings(lang),
        ...buildInstructionBundle(availableLanguages),
        getLanguageLabel,
        htmlLang: htmlLangCode(lang)
    });
};

export const showAttempt = async (req, res) => {
    const { id } = req.params;

    const test = await Test.findById(id);
    if (!test) throw new ExpressError(404, "Test Not Found");

    const from = req.query.from;
    const safeFrom = isSafeRedirectPath(from) ? from : null;

    const { status, publishAt } = getTestStatus(test);
    if (status === "upcoming") {
        req.flash("error", `This test has not started yet. It will begin at ${formatDateTime(publishAt)}.`);
        return res.redirect(req.get("Referer") || "/dashboard");
    }
    if (status === "expired") {
        req.flash("error", "This test is no longer available because its time window has expired.");
        return res.redirect(req.get("Referer") || "/dashboard");
    }

    if (test.isLiveTest) {
        const existingAttempt = await Attempt.findOne({ test: id, user: req.user._id });

        if (test.liveTestExpiresAt && new Date(test.liveTestExpiresAt) <= new Date()) {
            req.flash("error", "This Live Test has ended.");
            return res.redirect(req.get("Referer") || "/dashboard");
        }

        if (existingAttempt) {
            req.flash("error", "You have already attempted this test.");
            return res.redirect(`/attempt/${existingAttempt._id}/analysis`);
        }
    }

    // Session sirf Proceed (start endpoint) se banta hai. Nahi hai to test mat kholo.
    const session = await AttemptSession.findOne({ test: id, user: req.user._id }).sort({ createdAt: -1 });
    if (!session || session.exited) {
        return res.redirect(safeFrom || "/dashboard");
    }

    const mappings = await TestQuestion.find({ test: id }).sort({ order: 1 }).populate("question");

    let lang = req.query.lang || (test.languages && test.languages[0]) || "English";

    if (test.languageMode === "multiple") {
        if (!test.languages || !test.languages.includes(lang)) {
            lang = test.languages && test.languages[0] ? test.languages[0] : "English";
        }
    } else {
        lang = (test.languages && test.languages[0]) || "English";
    }

    let availableLanguages = test.languages || ["English"];
    if (test.languageMode === "multiple" && test.showLanguage && test.showLanguage !== "all") {
        if (test.languages && test.languages.includes(test.showLanguage)) {
            availableLanguages = [test.showLanguage];
        }
    }
    if (availableLanguages.length === 1) {
        lang = availableLanguages[0];
    }

    const questions = buildClientQuestions(mappings, lang);

    const subjectsOrder = [];
    const grouped = {};

    questions.forEach(q => {
        if (!grouped[q.subject]) {
            grouped[q.subject] = [];
            subjectsOrder.push(q.subject);
        }
        grouped[q.subject].push(q);
    });

    const returnUrl = safeFrom || req.headers.referer || "/dashboard";

    res.render("dashboard/attempt", {
        layout: false, test, subjectsOrder, grouped,
        sessionId: session._id.toString(),
        returnUrl,
        currentUser: req.user
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

    if (!Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: "Invalid answers" });
    }

    const allowedSeconds = (() => {
        const total = (Number(test.duration) || 0) * 60;
        const sub = (test.subjectTime || []).reduce((s, st) => s + (Number(st.duration) || 0), 0) * 60;
        const secs = test.timeStrategy === "subject" ? Math.max(total, sub) : total;
        return secs > 0 ? secs : 3600;
    })();
    let safeTime = Math.max(0, Math.min(Math.floor(Number(timeTaken) || 0), allowedSeconds + 120));

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

        if (test.isLiveTest && test.liveTestExpiresAt && new Date(test.liveTestExpiresAt) <= new Date()) {
        return res.status(403).json({ success: false, message: "This Live Test has ended." });
    }

    if (test.isLiveTest) {
        const alreadyAttempted = await Attempt.findOne({ test: testId, user: req.user._id });
        if (alreadyAttempted) {
            return res.status(409).json({
                success: false,
                code: "ALREADY_SUBMITTED",
                message: "You have already submitted this test."
            });
        }
    }

    // Session ab sabse last check ke baad consume hoga
    const session = await AttemptSession.findOneAndDelete({
        _id: sessionId, test: testId, user: req.user._id
    });

    if (!session || session.exited) {
        return res.status(409).json({
            success: false,
            code: "SESSION_INVALID",
            message: "This attempt has already been submitted or has expired. Please start a new attempt."
        });
    }

    // Live test: time server-side session start se nikalo
    if (test.isLiveTest && session.createdAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000));
        safeTime = Math.min(elapsed, allowedSeconds);
    }

    const listingForMarks = await Listing.findById(test.listing).select("marks type examStructure tiers");
    const qualifyingSubjects = new Set(
        (getTierConfigForTest(listingForMarks, test).marks || [])
            .filter(m => m.qualifyingOnly)
            .map(m => m.subject)
    );

    const mappings = await TestQuestion.find({ test: testId }).sort({ order: 1 }).populate("question");

    let score = 0, correctCount = 0, wrongCount = 0, skippedCount = 0;
    const savedAnswers = [];

    mappings.forEach(m => {
        const q = m.question;
        if (!q) return;

        const userAns = answers.find(a => a && a.questionId === String(q._id));

        let cleanSel = [];
        let isCorrect = false, attempted = false;

        if (userAns) {
            if (q.type === "integer") {
                const v = userAns.numericAnswer;
                attempted = v !== null && v !== undefined && String(v).trim() !== "" && !isNaN(Number(v));
                isCorrect = attempted && Number(v) === Number(q.numericAnswer);
            } else {
                const rawSel = Array.isArray(userAns.selectedOptions) ? userAns.selectedOptions : [];
                cleanSel = [...new Set(rawSel.map(Number))].filter(Number.isInteger);
                attempted = cleanSel.length > 0;
                const correct = q.correctAnswers || [];
                isCorrect = attempted && cleanSel.length === correct.length && cleanSel.every(i => correct.includes(i));
            }
        }

        const isQualifyingOnly = qualifyingSubjects.has(m.subject || q.subject);

        if (!attempted) skippedCount++;
        else if (isCorrect) {
            correctCount++;
            if (!isQualifyingOnly) score += (m.positiveMarks || 0);
        } else {
            wrongCount++;
            if (!isQualifyingOnly) score -= (m.negativeMarks || 0);
        }

        savedAnswers.push({
            question: q._id,
            selectedOptions: cleanSel,
            numericAnswer: Number.isFinite(Number(userAns?.numericAnswer)) && userAns?.numericAnswer !== null && userAns?.numericAnswer !== "" ? Number(userAns.numericAnswer) : null,
            status: ["notVisited", "notAnswered", "answered", "markedNotAnswered", "markedAnswered"].includes(userAns?.status) ? userAns.status : "notVisited"
        });
    });

    // Live test: duplicate attempt rokne ke liye pehle LiveTestResult (unique user+test) se lock
    let liveLockCreated = false;
    if (test.isLiveTest) {
        try {
            await LiveTestResult.create({
                user: req.user._id, exam: test.liveTestExam, test: test._id,
                testTitle: test.title, score, totalMarks: test.totalMarks,
                correctCount, wrongCount, skippedCount, timeTaken: safeTime,
                attemptedAt: new Date(), analysisExpiresAt: test.liveTestExpiresAt
            });
            liveLockCreated = true;
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({
                    success: false,
                    code: "ALREADY_SUBMITTED",
                    message: "You have already submitted this test."
                });
            }
            console.error("[live-result] lock failed:", err);
        }
    }

    let attempt;
    try {
        attempt = await Attempt.create({
            test: testId,
            listing: test.listing,
            user: req.user._id,
            answers: savedAnswers,
            score, totalMarks: test.totalMarks, correctCount, wrongCount, skippedCount,
            timeTaken: safeTime, submitType: submitType || "manual",
            language: session.language || "English"
        });
    } catch (err) {
        if (liveLockCreated) {
            await LiveTestResult.deleteOne({ user: req.user._id, test: test._id }).catch(() => {});
        }
        await AttemptSession.create({
            _id: session._id, test: testId, user: req.user._id, language: session.language,
            createdAt: session.createdAt
        }).catch(() => {});
        throw err;
    }

    // Free listing test: re-attempt pe purana attempt delete hoga (sirf latest bachega)
    // Paid listing test: purane attempts rahenge, naya alag record banega
    // Live test: koi change nahi
    const isPaidListing = listingForMarks?.type === "Paid";
    if (!test.isLiveTest && !isPaidListing) {
        await Attempt.deleteMany({ user: req.user._id, test: testId, _id: { $ne: attempt._id } });
    }

    if (test.isLiveTest) {
        try {
            if (liveLockCreated) {
                await LiveTestResult.updateOne(
                    { user: req.user._id, test: test._id },
                    { $set: { attemptId: attempt._id, attemptedAt: attempt.createdAt } }
                );
            } else {
                await LiveTestResult.create({
                    user: req.user._id,
                    exam: test.liveTestExam,
                    test: test._id,
                    testTitle: test.title,
                    attemptId: attempt._id,
                    score, totalMarks: test.totalMarks,
                    correctCount, wrongCount, skippedCount,
                    timeTaken: safeTime,
                    attemptedAt: attempt.createdAt,
                    analysisExpiresAt: test.liveTestExpiresAt
                });
            }
        } catch (err) {
            if (err.code !== 11000) console.error("[live-result] save failed:", err);
        }
    }

    res.status(200).json({ success: true, attemptId: attempt._id });
};

export const showAnalysis = async (req, res) => {
    const { attemptId } = req.params;

    const attempt = await Attempt.findOne({ _id: attemptId, user: req.user._id }).populate("answers.question");
    if (!attempt) throw new ExpressError(404, "Attempt Not Found");

    const test = await Test.findById(attempt.test);
    if (!test) throw new ExpressError(404, "Test Not Found");
    const listing = await Listing.findById(attempt.listing);

        if (test.isLiveTest && test.liveTestExpiresAt && new Date(test.liveTestExpiresAt) <= new Date()) {
        req.flash("error", "Live Test analysis has expired.");
        return res.redirect("/dashboard");
    }

    const tierCfg = getTierConfigForTest(listing, test);
    const tierRankData = tierCfg.rankPredictorData || [];

    // ✅ Listing ke marks config se qualifying-only subjects nikal lo
    const qualifyingSubjects = new Set(
        (tierCfg.marks || [])
            .filter(m => m.qualifyingOnly)
            .map(m => m.subject)
    );

    const mappings = await TestQuestion.find({ test: attempt.test }).sort({ order: 1 });
const orderMap = {};
mappings.forEach(m => { orderMap[String(m.question)] = m.order; });
const sortedAnswers = [...attempt.answers].sort((a, b) =>
    (orderMap[String(a.question?._id)] ?? 99999) - (orderMap[String(b.question?._id)] ?? 99999)
);
const marksMap = {};
    mappings.forEach(m => {
        marksMap[String(m.question)] = {
            positiveMarks: m.positiveMarks || 0,
            negativeMarks: m.negativeMarks || 0,
             subject: m.subject || ""
        };
    });

    let positiveTotal = 0;
    let negativeTotal = 0;
    const subjectMap = {};
    const sectionStatusMap = {};
    const solutions = [];

    sortedAnswers.forEach((a, idx) => {
        const q = a.question;
        if (!q) return;

        const marks = marksMap[String(q._id)] || { positiveMarks: 0, negativeMarks: 0 };

        let attempted = false;
        let isCorrect = false;

        if (q.type === "integer") {
          const v = a.numericAnswer;
attempted = v !== null && v !== undefined && String(v).trim() !== "" && !isNaN(Number(v));
isCorrect = attempted && Number(v) === Number(q.numericAnswer);
        } else {
            const sel = a.selectedOptions || [];
            attempted = sel.length > 0;
            const correct = q.correctAnswers || [];
            isCorrect = attempted && sel.length === correct.length && sel.every(i => correct.includes(i));
        }

        let status = "skipped";
        if (attempted) status = isCorrect ? "correct" : "wrong";

        const subject = marks.subject || q.subject || "General";
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

        // 👇 NAYA — section-wise summary (Answered/Not Answered/Marked/Not Visited/Marks)
        if (!sectionStatusMap[subject]) {
            sectionStatusMap[subject] = {
                section: subject, questions: 0,
                answered: 0, notAnswered: 0, marked: 0, notVisited: 0,
                marks: 0, negativeMarks: 0
            };
        }
        const secStat = sectionStatusMap[subject];
        secStat.questions += 1;

        const rawStatus = String(a.status || "notVisited").toLowerCase();
        if (rawStatus.includes("marked")) secStat.marked += 1;
        else if (rawStatus.includes("notvisited")) secStat.notVisited += 1;
        else if (rawStatus.includes("notanswered")) secStat.notAnswered += 1;
        else if (rawStatus.includes("answered")) secStat.answered += 1;
        else if (attempted) secStat.answered += 1;
        else secStat.notVisited += 1;

        if (!isQualifyingOnly) {
            if (status === "correct") secStat.marks += marks.positiveMarks;
            if (status === "wrong") secStat.negativeMarks += marks.negativeMarks;
        }

        // ✅ Attempt ke waqt candidate ne jo language choose ki thi, wahi analysis me bhi dikhao
        const resolvedQ = resolveQuestionForLanguage(q, attempt.language || "English");

        solutions.push({
            order: idx + 1,
            questionId: q._id,  
            subject: subject,
            type: q.type || "",
            topic: q.topic || "",
            subtopic: q.subTopic || "",
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

    const { rank: predictorRank } = calculateRankFromPredictor(attempt.score, tierRankData);
const { rank: liveRank, totalUsers: liveTotalUsers } = await getLiveTestRank(attempt.test, attempt.score, test.isLiveTest ? (attempt.timeTaken || 0) : 0, req.user._id);

     // 🆕 NAYA — Rank Predictor Card (gate + range)
let rankPredictorCard = { show: false };

// 🔧 CHANGED — ab do tarike se gate khul sakta hai:
// 1) Live Test hai (isLiveTest true) → section-check ki zaroorat nahi, hamesha allow
// 2) Normal test hai lekin uske section ka showInStatsFilter switch ON hai
let sectionAllows = false;
if (test.section) {
    const section = await Section.findById(test.section).select("showInStatsFilter");
    sectionAllows = !!section?.showInStatsFilter;
}

const isAllowed = test.isLiveTest || sectionAllows;

if (isAllowed && tierRankData.length > 0) {
    const rankRange = calculateRankRange(attempt.score, tierRankData, attempt.totalMarks);
    rankPredictorCard = {
        show: true,
        rankPredictorData: tierRankData,
        userScore: attempt.score,
        userRank: predictorRank,
        rankRange
    };
}

    const totalQuestions = attempt.answers.length;
    const attemptedCount = attempt.correctCount + attempt.wrongCount;
    
    const accuracy = attemptedCount > 0
        ? Math.round((attempt.correctCount / attemptedCount) * 1000) / 10
        : 0;

    const comparisonData = await getAccuracyComparison(attempt.test, accuracy);

    const totalSeconds = attempt.timeTaken || 0;
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const timeFormatted = [hrs, mins, secs].map(v => String(v).padStart(2, "0")).join(":");

    const sectionBreakdown = Object.values(sectionStatusMap);  

        const canDownloadKey = isOwnerUser(req) || listing?.type === "Paid";

    const analysisData = {
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        attempted: attemptedCount,
        totalQuestions,
        timeTaken: timeFormatted,
        rank: liveRank,
        totalUsers: liveTotalUsers,
        rankPredictorCard,
        accuracy,
        comparisonData,   // 👈 NAYI LINE ADD KARO
        positiveMarks: positiveTotal,
        negativeMarks: negativeTotal,
        skippedCount: attempt.skippedCount,
        topicBreakdown,
        sectionBreakdown,
                testTitle: test?.title || "",
        listingTitle: listing?.title || "",
        attemptedOn: attempt.createdAt,
        durationMinutes: Number(test?.duration) || 0,
        timeTakenSeconds: totalSeconds,
        userName: req.user?.name || "",
        correctCount: attempt.correctCount || 0,
        wrongCount: attempt.wrongCount || 0,
        canDownloadKey,
        solutions
    };

    res.render("dashboard/analysis", { layout: false, attempt, test, listing, analysisData });
};