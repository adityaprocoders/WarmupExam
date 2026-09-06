import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import LiveTestConfig from "../models/LiveTestConfig.js";
import LiveTestUsageLog from "../models/LiveTestUsageLog.js";
import Attempt from "../models/TestAttempt.js";
import ExpressError from "../utils/ExpressError.js";
import User from "../models/usersShema.js";

const VALIDITY_HOURS = Number(process.env.LIVETEST_VALIDITY_HOURS) || 24;

function getMarksForSubject(subjectsConfig, subjectName) {
    const found = subjectsConfig.find(
        s => s.subject?.trim().toLowerCase() === subjectName?.trim().toLowerCase()
    );
    if (found) return { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks };
    console.warn(`[live-test] marks config missing for subject "${subjectName}" — using 0/0 fallback.`);
    return { positiveMarks: 0, negativeMarks: 0 };
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function getNextOccurrence(scheduledDays, startTime) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const allowedDays = (scheduledDays && scheduledDays.length > 0) ? scheduledDays : dayNames;

    const now = new Date();
    const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentHHMM = String(nowIST.getHours()).padStart(2, "0") + ":" + String(nowIST.getMinutes()).padStart(2, "0");
    const todayIdx = nowIST.getDay();
    const todayName = dayNames[todayIdx];

    if (allowedDays.includes(todayName) && currentHHMM < startTime) {
        return { day: "Today", time: startTime };
    }

    for (let i = 1; i <= 7; i++) {
        const idx = (todayIdx + i) % 7;
        const name = dayNames[idx];
        if (allowedDays.includes(name)) {
            return { day: i === 1 ? "Tomorrow" : name, time: startTime };
        }
    }

    return null;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// weighted distribution (generatePaper.js wala hi pattern — total ko row-weights ke hisaab se baato)
function distributeCount(totalCount, rows) {
    const n = rows.length;
    if (n === 0 || totalCount <= 0) return rows.map(() => 0);

    const weights = rows.map(r => (r.minCount + r.maxCount) / 2);
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    const rawShares = weights.map(w => (sumWeights > 0 ? (w / sumWeights) : (1 / n)) * totalCount);

    let result = rawShares.map(x => Math.round(x));
    result = result.map((v, i) => Math.min(rows[i].maxCount, Math.max(rows[i].minCount, v)));

    let diff = totalCount - result.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (diff !== 0 && guard < 1000) {
        guard++;
        if (diff > 0) {
            const idx = result.findIndex((v, i) => v < rows[i].maxCount);
            if (idx === -1) break;
            result[idx]++;
            diff--;
        } else {
            const idx = result.findIndex((v, i) => v > rows[i].minCount);
            if (idx === -1) break;
            result[idx]--;
            diff++;
        }
    }

    return result.map(x => Math.max(0, x));
}

/* ================================================================ */
/* GET /series/:slug/Live-Test                                    */
/* ================================================================ */
export const renderLiveTestPage = async (req, res) => {
    const { slug } = req.params;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });

    const liveTestConfig = await LiveTestConfig.findOne({ exam: listing.exam }).lean();

    let todaysLiveTest = await Test.findOne({
        liveTestExam: listing.exam,
        isLiveTest: true,
        liveTestExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

       if (todaysLiveTest) {
    const attempt = await Attempt.findOne({
        test: todaysLiveTest._id,
        user: req.user._id
    }).lean();

    todaysLiveTest.attempted = !!attempt;
    todaysLiveTest.attemptId = attempt ? attempt._id : null;
}

let nextOccurrence = null;
if (!todaysLiveTest && liveTestConfig) {
    nextOccurrence = getNextOccurrence(liveTestConfig.scheduledDays, liveTestConfig.startTime);
}

    res.render("dashboard/liveTest", {
    layout: "layouts/dashboard",
    listing, sections,
    currentSection: null, folder: null, file: null,
    isLiveTestPage: true,
    liveTestConfig, todaysLiveTest, nextOccurrence,
    title: `Live Test | ${listing.title}`,
    robots: "noindex, nofollow"
});
};

/* ================================================================ */
/* CORE — Live Test generate karo config.criteria (filter builder    */
/* rows) ke hisaab se, overall difficultyDistribution ko har row pe   */
/* proportionally apply karke, aur exam-level maxRepeat (overall      */
/* history me ek question max kitni baar dobara aa sakta hai) ke      */
/* hisaab se pick karke.                                              */
/* ================================================================ */
export async function generateLiveTestForExam(exam) {
    const config = await LiveTestConfig.findOne({ exam }).lean();
    if (!config) return;

    const existing = await Test.findOne({
        liveTestExam: exam, isLiveTest: true, liveTestExpiresAt: { $gt: new Date() }
    });
    if (existing) return;

    if (!Array.isArray(config.criteria) || config.criteria.length === 0) return;

    // saari included listings ke Tests
    const testIds = await Test.find({ listing: { $in: config.includedListings } }).distinct("_id");
    if (testIds.length === 0) return;

    // question -> source listing map (marks lookup ke liye)
    const allMappings = await TestQuestion.find({ test: { $in: testIds } }).populate("test", "listing");
    if (allMappings.length === 0) return;

    const questionToListing = new Map();
    allMappings.forEach(m => {
        if (m.question) questionToListing.set(String(m.question), m.test.listing);
    });

    /* ---------- Step 1: har criteria row ka pool banao ---------- */
    // subject/topic/subTopic/section MAPPING (TestQuestion) se liye jaate hain, Question.subject se NAHI —
    // kyunki dedup ke baad Question.subject sirf "pehli baar wala" subject hota hai (poore Question model comment dekho)
    const rowPools = [];
    for (const row of config.criteria) {
        const tqMatch = { test: { $in: testIds }, subject: row.subject };
        if (Array.isArray(row.section) && row.section.length > 0) tqMatch.section = { $in: row.section };
        if (Array.isArray(row.topic) && row.topic.length > 0) tqMatch.topic = { $in: row.topic };
        if (Array.isArray(row.subTopic) && row.subTopic.length > 0) tqMatch.subTopic = { $in: row.subTopic };

        const matchingTQs = await TestQuestion.find(tqMatch).select("question subject topic subTopic section");

        const qMeta = new Map();
        matchingTQs.forEach(tq => {
            const qid = String(tq.question);
            if (!qMeta.has(qid)) {
                qMeta.set(qid, { subject: tq.subject, topic: tq.topic, subTopic: tq.subTopic, section: tq.section });
            }
        });

        const uniqueQIds = [...qMeta.keys()];
        if (uniqueQIds.length === 0) { rowPools.push({ row, pool: [] }); continue; }
          
        const qFilter = { _id: { $in: uniqueQIds } };
if (Array.isArray(row.difficulty) && row.difficulty.length > 0) {
    qFilter.difficulty = { $in: row.difficulty };
}
        const questionsData = await Question.find(qFilter).select("_id difficulty").lean();
        const pool = questionsData.map(q => ({
            _id: q._id,
            difficulty: q.difficulty,
            ...qMeta.get(String(q._id))
        }));

        rowPools.push({ row, pool });
    }

    /* ---------- Step 2: har row ka effective needed-count nikalo ---------- */
    let effectiveCounts;

    if (config.totalQuestionsStrategy === "subject" && Array.isArray(config.subjectQuestionCounts) && config.subjectQuestionCounts.length > 0) {
        effectiveCounts = config.criteria.map(() => 0);

        const subjectToRowIdx = {};
        config.criteria.forEach((c, idx) => {
            if (!subjectToRowIdx[c.subject]) subjectToRowIdx[c.subject] = [];
            subjectToRowIdx[c.subject].push(idx);
        });

        config.subjectQuestionCounts.forEach(sq => {
    const idxs = subjectToRowIdx[sq.subject];
    if (!idxs || idxs.length === 0) {
        console.warn(`[live-test] ${exam}: subjectQuestionCounts me "${sq.subject}" hai lekin criteria me koi matching row nahi mili — is subject ka count ignore ho gaya.`);
        return;
    }
    const rowsForSubject = idxs.map(idx => config.criteria[idx]);
    const distributed = distributeCount(sq.count, rowsForSubject);
    idxs.forEach((idx, k) => { effectiveCounts[idx] = distributed[k]; });
});
    } else {
       effectiveCounts = distributeCount(config.questionCount, config.criteria);
    }

    /* ---------- Step 3: usage-log lookup (max-repeat ke liye) ---------- */
    const allCandidateIds = [...new Set(rowPools.flatMap(rp => rp.pool.map(q => String(q._id))))];
    if (allCandidateIds.length === 0) return;

    const usageLogs = await LiveTestUsageLog.find({ exam, question: { $in: allCandidateIds } }).lean();
    const usageMap = new Map(usageLogs.map(u => [String(u.question), { lastUsedAt: u.lastUsedAt, usageCount: u.usageCount || 0 }]));

    const maxRepeat = config.maxRepeat || 2;
    const dist = config.difficultyDistribution || { easy: 30, medium: 50, hard: 20 };

    const globalPicked = new Set(); // dedupe across rows (agar ek hi question do rows me match ho jaaye)

    function pickFromPool(pool, needed) {
        if (needed <= 0) return [];
        const avail = pool.filter(q => !globalPicked.has(String(q._id)));

        const fresh = [];
        const cooldownOk = [];
        avail.forEach(q => {
            const usage = usageMap.get(String(q._id));
            if (!usage) { fresh.push(q); return; }
            if (usage.usageCount < maxRepeat) cooldownOk.push({ ...q, lastUsedAt: usage.lastUsedAt });
        });

        shuffle(fresh);
        cooldownOk.sort((a, b) => new Date(a.lastUsedAt) - new Date(b.lastUsedAt)); // least-recently-used pehle

        const picked = fresh.slice(0, needed);
        if (picked.length < needed) picked.push(...cooldownOk.slice(0, needed - picked.length));

        picked.forEach(q => globalPicked.add(String(q._id)));
        return picked;
    }

    function pickRowQuestions(pool, needed) {
        if (needed <= 0 || pool.length === 0) return [];

        const targetEasy = Math.round((dist.easy / 100) * needed);
        const targetMedium = Math.round((dist.medium / 100) * needed);
        const targetHard = Math.max(0, needed - targetEasy - targetMedium);

        const easyPool = pool.filter(q => q.difficulty === "Easy");
        const mediumPool = pool.filter(q => q.difficulty === "Medium");
        const hardPool = pool.filter(q => q.difficulty === "Hard");

        let selected = [
            ...pickFromPool(easyPool, targetEasy),
            ...pickFromPool(mediumPool, targetMedium),
            ...pickFromPool(hardPool, targetHard)
        ];

        // smart fallback — difficulty-wise kam pade to isi row ke pool se (kisi bhi difficulty) bharo
if (selected.length < needed) {
    selected = selected.concat(pickFromPool(pool, needed - selected.length));
}
shuffle(selected);
return selected.slice(0, needed);
    }

    /* ---------- Step 4: har row se pick karo ---------- */
    let allSelected = [];
    const shortfalls = [];

    rowPools.forEach((rp, idx) => {
        const needed = effectiveCounts[idx] || 0;
        const picked = pickRowQuestions(rp.pool, needed);
        if (picked.length < needed) {
            shortfalls.push(`"${rp.row.subject}" row: ${needed} chahiye the, sirf ${picked.length} mile.`);
        }
        allSelected = allSelected.concat(picked);
    });

    if (allSelected.length === 0) {
        console.log(`[live-test] ${exam}: koi question select nahi hua.`);
        return;
    }
    if (shortfalls.length > 0) {
        console.warn(`[live-test] ${exam} shortfall:`, shortfalls.join(" | "));
    }

    /* ---------- Step 5: marks + Test/TestQuestion create ---------- */
    const listingIdsNeeded = [...new Set(allSelected.map(q => String(questionToListing.get(String(q._id)))))];
    const listingsData = await Listing.find({ _id: { $in: listingIdsNeeded } }).select("marks").lean();
    const listingMarksMap = new Map(listingsData.map(l => [String(l._id), l.marks || []]));

    let totalMarks = 0;
    const mappingDocs = allSelected.map((q, i) => {
        const sourceListingId = String(questionToListing.get(String(q._id)));
        const marksConfig = listingMarksMap.get(sourceListingId) || [];
        const marks = getMarksForSubject(marksConfig, q.subject);
        totalMarks += marks.positiveMarks;
        return {
            question: q._id, order: i + 1,
            subject: q.subject || "", topic: q.topic || "", subTopic: q.subTopic || "", section: q.section || "",
            positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks
        };
    });

    const languages = config.languageMode === "both" ? ["English", "Hindi"] : (config.languages || ["English"]);

    const testDoc = await Test.create({
        title: `Live Test — ${exam}`,
        listing: config.includedListings[0],
        section: null,
        parentType: "section",
        parentId: null,
        languageMode: config.languageMode === "both" ? "multiple" : "single",
        languages,
        showLanguage: "all",
        timeStrategy: config.timeStrategy === "subject" ? "subject" : "total",
        duration: config.duration || 10,
        subjectTime: config.timeStrategy === "subject"
            ? config.subjectTimes.map(st => ({ subject: st.subject, duration: st.minutes }))
            : [], 
        totalQuestions: allSelected.length,
        totalMarks,
        visibility: "public",
        publishAt: null,
        isLiveTest: true,
        liveTestExam: exam,
        liveTestDate: todayStr(),
        liveTestExpiresAt: new Date(Date.now() + VALIDITY_HOURS * 60 * 60 * 1000)
    });

    await TestQuestion.insertMany(mappingDocs.map(m => ({ ...m, test: testDoc._id })));

    const bulkOps = allSelected.map(q => ({
        updateOne: {
            filter: { exam, question: q._id },
            update: { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } },
            upsert: true
        }
    }));
    await LiveTestUsageLog.bulkWrite(bulkOps);

    return testDoc;
}

/* ================================================================ */
/* Cleanup — expired live tests hatao, Attempt safe                 */
/* ================================================================ */
export async function cleanupExpiredLiveTests() {
    const expired = await Test.find({
        isLiveTest: true,
        liveTestExpiresAt: { $lt: new Date() }
    }).select("_id");

    const testIds = expired.map(t => t._id);
    if (testIds.length === 0) return;

    await TestQuestion.deleteMany({ test: { $in: testIds } });
    await Attempt.deleteMany({ test: { $in: testIds } });
    await Test.deleteMany({ _id: { $in: testIds } });
}

/* ================================================================ */
/* GET /series/:slug/live-test/leaderboard                        */
/* ================================================================ */
export const renderLiveTestLeaderboard = async (req, res) => {
    const { slug } = req.params;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    const todaysLiveTest = await Test.findOne({
        liveTestExam: listing.exam,
        isLiveTest: true,
        liveTestExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    if (!todaysLiveTest) {
    req.flash("error", "No active Live Test right now.");
    return res.redirect(`/series/${listing.slug}/live-test`);
}

    const attempts = await Attempt.find({ test: todaysLiveTest._id })
        .populate("user", "name")
        .sort({ score: -1, timeTaken: 1 })
        .lean();

    const leaderboard = attempts.map((a, idx) => {
        const attempted = (a.correctCount || 0) + (a.wrongCount || 0);
        const accuracy = attempted > 0 ? Math.round((a.correctCount / attempted) * 100) : 0;

        const mins = Math.floor((a.timeTaken || 0) / 60);
        const secs = (a.timeTaken || 0) % 60;
        const timeFormatted = String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");

        return {
            rank: idx + 1,
            name: a.user?.name || "Anonymous",
            score: a.score,
            totalMarks: todaysLiveTest.totalMarks,
            totalQuestions: todaysLiveTest.totalQuestions,
            correctCount: a.correctCount,
            accuracy,
            time: timeFormatted,
            isCurrentUser: String(a.user?._id) === String(req.user._id)
        };
    });

    const myEntry = leaderboard.find(l => l.isCurrentUser) || null;
    const top10 = leaderboard.slice(0, 10);
    const myRowNeeded = myEntry && myEntry.rank > 10;

    res.render("dashboard/liveTestLeaderboard", {
    layout: "layouts/dashboard",
    listing, sections: [],
    currentSection: null, folder: null, file: null,
    isLiveTestPage: true,
    top10, myEntry, myRowNeeded,
    totalParticipants: leaderboard.length,
    title: `Live Test Leaderboard | ${listing.title}`,
    robots: "noindex, nofollow"
});
};