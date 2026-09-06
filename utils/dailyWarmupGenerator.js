import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import Question from "../models/Question.js"; // apna actual path check kar lena
import Listing from "../models/listing.js";

export function getWarmupDayKey(date = new Date()) {
    const d = new Date(date);
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function getWarmupExpiryDate(dayKey) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const expiry = new Date(y, m - 1, d, 6, 0, 0, 0);
    expiry.setDate(expiry.getDate() + 1);
    return expiry;
}

function seedToInt(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return h >>> 0;
}
function mulberry32(seed) {
    let s = seed;
    return function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function seededShuffle(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function evaluateAnswer(q, a) {
    if (!q || !a) return { attempted: false, isCorrect: false };
    if (q.type === "integer") {
        const attempted = a.numericAnswer !== null && a.numericAnswer !== undefined;
        const isCorrect = attempted && Number(a.numericAnswer) === Number(q.numericAnswer);
        return { attempted, isCorrect };
    }
    const sel = a.selectedOptions || [];
    const attempted = sel.length > 0;
    const correct = q.correctAnswers || [];
    const isCorrect = attempted && sel.length === correct.length && sel.every(i => correct.includes(i));
    return { attempted, isCorrect };
}

async function computeWeakTopicsAndProblemQuestions(userId, listingId) {
    const allTests = await Test.find({ listing: listingId, isDailyWarmup: { $ne: true } }).select("_id");
    const testIds = allTests.map(t => t._id);
    if (testIds.length === 0) return { weakTopics: [], wrongQuestionIds: [], skippedQuestionIds: [] };

    const attempts = await Attempt.find({ test: { $in: testIds }, user: userId }).populate("answers.question");
    if (attempts.length === 0) return { weakTopics: [], wrongQuestionIds: [], skippedQuestionIds: [] };

    const attemptTestIds = [...new Set(attempts.map(a => String(a.test)))];
    const tqMappings = await TestQuestion.find({ test: { $in: attemptTestIds } });
    const marksMap = {};
    tqMappings.forEach(m => {
        marksMap[`${m.test}_${m.question}`] = { subject: m.subject, topic: m.topic, subTopic: m.subTopic };
    });

    const topicStats = {};
    const wrongQuestionIds = new Set();
    const skippedQuestionIds = new Set();

    attempts.forEach(attempt => {
        attempt.answers.forEach(a => {
            const q = a.question;
            if (!q) return;
            const map = marksMap[`${attempt.test}_${q._id}`] || {};
            const subject = map.subject || q.subject;
            const topic = map.topic || q.topic;
            const { attempted, isCorrect } = evaluateAnswer(q, a);

            if (!topicStats[subject]) topicStats[subject] = {};
            if (!topicStats[subject][topic]) topicStats[subject][topic] = { correct: 0, wrong: 0, total: 0 };
            topicStats[subject][topic].total += 1;

            if (attempted && isCorrect) topicStats[subject][topic].correct += 1;
            else if (attempted && !isCorrect) {
                topicStats[subject][topic].wrong += 1;
                wrongQuestionIds.add(String(q._id));
            } else {
                skippedQuestionIds.add(String(q._id));
            }
        });
    });

    const weakTopics = [];
    Object.entries(topicStats).forEach(([subject, tMap]) => {
        Object.entries(tMap).forEach(([topic, t]) => {
            const attemptedQs = t.correct + t.wrong;
            if (attemptedQs === 0) return;
            const pct = Math.round((t.correct / attemptedQs) * 100);
            if (pct <= 60) weakTopics.push({ subject, topic, pct });
        });
    });
    weakTopics.sort((a, b) => a.pct - b.pct);

    return { weakTopics, wrongQuestionIds: [...wrongQuestionIds], skippedQuestionIds: [...skippedQuestionIds] };
}

export async function findOrCreateDailyWarmupTest(userId, listingId) {
    const dayKey = getWarmupDayKey();

    let test = await Test.findOne({
        listing: listingId, isDailyWarmup: true,
        dailyWarmupUser: userId, dailyWarmupDayKey: dayKey
    });
    if (test) return test;

    const seed = seedToInt(`${userId}-${listingId}-${dayKey}`);
    const rng = mulberry32(seed);
    const listing = await Listing.findById(listingId).select("language").lean();
const listingLanguage = listing?.language || "English";



    const { weakTopics, wrongQuestionIds, skippedQuestionIds } =
        await computeWeakTopicsAndProblemQuestions(userId, listingId);

    const priorityIds = [...new Set([...wrongQuestionIds, ...skippedQuestionIds])];

    let extraQuestions = [];
    if (weakTopics.length > 0) {
        const topWeak = weakTopics.slice(0, 10);
        extraQuestions = await Question.find({
            $or: topWeak.map(w => ({ subject: w.subject, topic: w.topic })),
            _id: { $nin: priorityIds }
        }).select("_id subject topic subTopic").lean();
    }

    let pool = [...priorityIds.map(id => ({ _id: id })), ...extraQuestions];
    if (pool.length === 0) {
        pool = await Question.find({}).select("_id subject topic subTopic").limit(100).lean();
    }

    const chosen = seededShuffle(pool, rng).slice(0, 10);
    const chosenIds = chosen.map(c => c._id);

    const fullQuestions = await Question.find({ _id: { $in: chosenIds } });
    const qMap = {};
    fullQuestions.forEach(q => { qMap[String(q._id)] = q; });

    const POSITIVE_MARKS = 4, NEGATIVE_MARKS = 1;

    test = await Test.create({
    title: `Daily Warmup — ${dayKey}`,
    listing: listingId,
    parentType: "section",
    visibility: "private",
    timeStrategy: "total",
    duration: 10,
    totalQuestions: chosenIds.length,
    totalMarks: chosenIds.length * POSITIVE_MARKS,
    languageMode: "single",
    languages: [listingLanguage],
    showLanguage: "all",
    isDailyWarmup: true,
    dailyWarmupUser: userId,
    dailyWarmupDayKey: dayKey,
    dailyWarmupExpiresAt: getWarmupExpiryDate(dayKey)
});

    const tqDocs = chosenIds.map((qid, idx) => {
        const q = qMap[String(qid)];
        return {
            test: test._id, question: qid, order: idx + 1,
            subject: q?.subject || "", topic: q?.topic || "", subTopic: q?.subTopic || "",
            positiveMarks: POSITIVE_MARKS, negativeMarks: NEGATIVE_MARKS
        };
    });
    await TestQuestion.insertMany(tqDocs);

    return test;
}