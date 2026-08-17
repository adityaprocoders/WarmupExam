import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Question from "../models/Question.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import DailyWarmupConfig from "../models/DailyWarmupConfig.js";
import WarmupUsageLog from "../models/WarmupUsageLog.js";
import Attempt from "../models/TestAttempt.js";
import ExpressError from "../utils/ExpressError.js";
import WarmupStreak from "../models/WarmupStreak.js";
import User from "../models/usersShema.js";

const COOLDOWN_DAYS = 10;
const VALIDITY_MINUTES = Number(process.env.WARMUP_VALIDITY_MINUTES) || 2; // DEV default: 2 min

function getMarksForSubject(subjectsConfig, subjectName) {
    const found = subjectsConfig.find(s => s.subject === subjectName);
    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

/* ================================================================ */
/* GET /series/:slug/daily-warmup                                    */
/* ================================================================ */
export const renderDailyWarmupPage = async (req, res) => {
    const { slug } = req.params;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });


    const warmupConfig = await DailyWarmupConfig.findOne({ exam: listing.exam }).lean();

let todaysWarmup = await Test.findOne({
    warmupExam: listing.exam,
    isDailyWarmup: true,
    warmupExpiresAt: { $gt: new Date() }
}).sort({ createdAt: -1 }).lean();

const streakDoc = await WarmupStreak.findOne({
    user: req.user._id,
    exam: listing.exam
}).lean();
    
    

    const streakCount = streakDoc ? streakDoc.currentStreak : 0;

    if (todaysWarmup) {
        const attempt = await Attempt.findOne({
            test: todaysWarmup._id,
            user: req.user._id
        }).lean();

        todaysWarmup.attempted = !!attempt;
        todaysWarmup.attemptId = attempt ? attempt._id : null;
    }

    res.render("dashboard/dailyWarmup", {
        layout: "layouts/dashboard",
        listing, sections,
        currentSection: null, folder: null, file: null,
        isDailyWarmupPage: true,
        warmupConfig, todaysWarmup,
        streakCount, 
        title: `Daily Warmup | ${listing.title}`,
        robots: "noindex, nofollow"
    });
};

/* ================================================================ */
/* POST /series/:slug/daily-warmup/config   (owner only)             */
/* ================================================================ */
 

 export async function generateWarmupForExam(exam) {
    const config = await DailyWarmupConfig.findOne({ exam }).lean();
    if (!config) return;

    const existing = await Test.findOne({ warmupExam: exam, isDailyWarmup: true, warmupExpiresAt: { $gt: new Date() } });
    if (existing) return; 
    if (existing) return;

    // saari included listings ke Tests → unke Questions
    const testIds = await Test.find({ listing: { $in: config.includedListings } }).distinct("_id");
    if (testIds.length === 0) return; 
    if (testIds.length === 0) return;

     const mappings = await TestQuestion.find({ test: { $in: testIds } }).populate("test", "listing");
if (mappings.length === 0) return;
if (mappings.length === 0) return;

// question -> source listing map (marks ke liye zaroori, kyunki alag listings ho sakti hain)
const questionToListing = new Map();
mappings.forEach(m => {
    if (m.question) questionToListing.set(String(m.question), m.test.listing);
});

// 👇 NAYA: question -> subject map, MAPPING se (Question.subject se nahi — 
// kyunki dedup ke baad Question.subject sirf "pehli baar wala" subject hai,
// asli/current subject TestQuestion mapping me hai)
const questionToSubject = new Map();
mappings.forEach(m => {
    if (m.question && m.subject) questionToSubject.set(String(m.question), m.subject);
});

const usedQuestionIds = [...new Set(mappings.map(m => String(m.question)).filter(Boolean))];

// 👇 CHANGED: subject filter ab Question.subject pe nahi, mapping-derived subject pe
const eligibleIds = usedQuestionIds.filter(qId => config.subjects.includes(questionToSubject.get(qId)));
 
const candidates = await Question.find({ _id: { $in: eligibleIds } }).select("_id difficulty").lean();
if (candidates.length === 0) return;
if (candidates.length === 0) return;

// 👇 NAYA: candidates me subject wapas add karo (mapping se), kyunki select() se nikal diya
candidates.forEach(c => { c.subject = questionToSubject.get(String(c._id)); });

     
  
 

    // cooldown check — exam-level
    const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const usageLogs = await WarmupUsageLog.find({
        exam,
        question: { $in: candidates.map(c => c._id) }
    }).lean();
    const usageMap = new Map(usageLogs.map(u => [String(u.question), u.lastUsedAt]));

    const fresh = [];
    const onCooldown = [];
    candidates.forEach(c => {
        const lastUsed = usageMap.get(String(c._id));
        if (!lastUsed || lastUsed < cooldownDate) fresh.push(c);
        else onCooldown.push({ ...c, lastUsedAt: lastUsed });
    });

    // difficulty-wise split target counts
    const dist = config.difficultyDistribution || { easy: 30, medium: 50, hard: 20 };
    const targetEasy = Math.round((dist.easy / 100) * config.questionCount);
    const targetMedium = Math.round((dist.medium / 100) * config.questionCount);
    const targetHard = config.questionCount - targetEasy - targetMedium;

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function pickByDifficulty(pool, level, count) {
        const matched = shuffle(pool.filter(q => q.difficulty === level));
        return matched.slice(0, count);
    }

    let selected = [
        ...pickByDifficulty(fresh, "Easy", targetEasy),
        ...pickByDifficulty(fresh, "Medium", targetMedium),
        ...pickByDifficulty(fresh, "Hard", targetHard)
    ];

    // smart fallback: kam pade to baaki fresh se bharo, fir cooldown wale se
    if (selected.length < config.questionCount) {
        const usedIds = new Set(selected.map(q => String(q._id)));
        const remainingFresh = shuffle(fresh.filter(q => !usedIds.has(String(q._id))));
        selected = selected.concat(remainingFresh.slice(0, config.questionCount - selected.length));
    }
    if (selected.length < config.questionCount) {
        const usedIds = new Set(selected.map(q => String(q._id)));
        const remaining = config.questionCount - selected.length;
        const sortedCooldown = onCooldown
            .filter(q => !usedIds.has(String(q._id)))
            .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
        selected = selected.concat(sortedCooldown.slice(0, remaining));
    }

    if (selected.length === 0) { console.log("STOP: selected.length is 0. fresh:", fresh.length, "onCooldown:", onCooldown.length); return; }

    // marks — har question ke apne source-listing se (batch fetch, N+1 avoid)
    const listingIdsNeeded = [...new Set(selected.map(q => String(questionToListing.get(String(q._id)))))];
    const listingsData = await Listing.find({ _id: { $in: listingIdsNeeded } }).select("marks").lean();
    const listingMarksMap = new Map(listingsData.map(l => [String(l._id), l.marks || []]));

    let totalMarks = 0;
    const mappingDocs = selected.map((q, i) => {
        const sourceListingId = String(questionToListing.get(String(q._id)));
        const marksConfig = listingMarksMap.get(sourceListingId) || [];
        const marks = getMarksForSubject(marksConfig, q.subject);
        totalMarks += marks.positiveMarks;
        return { question: q._id, order: i + 1, positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks };
    });

    const languages = config.languageMode === "both" ? ["English", "Hindi"] : (config.languages || ["English"]);

    const testDoc = await Test.create({
    title: `Daily Warmup — ${exam}`,
    listing: config.includedListings[0],   // placeholder, display ke liye
    section: null,
    parentType: "section",
    parentId: null,
    languageMode: config.languageMode === "both" ? "multiple" : "single",
    languages,
    showLanguage: "all",
    timeStrategy: "total",
    duration: config.duration || 10,
    subjectTime: [],
    totalQuestions: selected.length,
    totalMarks,
    visibility: "public",
    publishAt: null,
    isDailyWarmup: true,
    warmupExam: exam,
    warmupDate: todayStr(),
    warmupExpiresAt: new Date(Date.now() + VALIDITY_MINUTES * 60 * 1000)
});

    await TestQuestion.insertMany(mappingDocs.map(m => ({ ...m, test: testDoc._id })));

    const bulkOps = selected.map(q => ({
        updateOne: {
            filter: { exam, question: q._id },
            update: { $set: { lastUsedAt: new Date() } },
            upsert: true
        }
    }));
    await WarmupUsageLog.bulkWrite(bulkOps);

    return testDoc;
}


/* ================================================================ */
/* Cleanup — expired warmup Test/TestQuestion hatao, Attempt safe    */
/* ================================================================ */
export async function cleanupExpiredWarmups() {
    const expired = await Test.find({
        isDailyWarmup: true,
        warmupExpiresAt: { $lt: new Date() }
    }).select("_id");

    const testIds = expired.map(t => t._id);
    if (testIds.length === 0) return;

    await TestQuestion.deleteMany({ test: { $in: testIds } });
    await Test.deleteMany({ _id: { $in: testIds } });
    // Attempt records jaan-bujh kar delete NAHI kiye — user ki analysis history safe rahegi
}


/* ================================================================ */
/* Streak update — sirf daily warmup submit hone par call hota hai   */
/* (attemptController.submitAttempt se import ho ke call hoga)       */
/* ================================================================ */
 export async function updateWarmupStreak(userId, exam) {
    const today = todayStr();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let streak = await WarmupStreak.findOne({ user: userId, exam });

if (!streak) {
    return WarmupStreak.create({ user: userId, exam, currentStreak: 1, lastAttemptDate: today });
}

    if (streak.lastAttemptDate === today) {
        return streak; // aaj already count ho chuka
    }

    if (streak.lastAttemptDate === yesterday) {
        streak.currentStreak += 1;   // continuous — badhao
    } else {
        streak.currentStreak = 1;    // gap tha — reset
    }

    streak.lastAttemptDate = today;
    await streak.save();
    return streak;
}

/* ================================================================ */
/* GET /series/:slug/daily-warmup/leaderboard                        */
/* Poori tarah LIVE compute hota hai — koi permanent storage nahi.   */
/* Naya warmup Test banate hi purana leaderboard automatically       */
/* inaccessible ho jata hai (kyunki naya Test._id use hoga)          */
/* ================================================================ */
export const renderWarmupLeaderboard = async (req, res) => {
    const { slug } = req.params;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    const todaysWarmup = await Test.findOne({
    warmupExam: listing.exam,
    isDailyWarmup: true,
    warmupExpiresAt: { $gt: new Date() }
}).sort({ createdAt: -1 }).lean();

    if (!todaysWarmup) {
        req.flash("error", "No active Daily Warmup right now.");
        return res.redirect(`/series/${listing.slug}/daily-warmup`);
    }

    const attempts = await Attempt.find({ test: todaysWarmup._id })
        .populate("user", "name")
        .sort({ score: -1, timeTaken: 1 })  // zyada score pehle; tie me kam time jeetega
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
            totalMarks: todaysWarmup.totalMarks,
            totalQuestions: todaysWarmup.totalQuestions,
            correctCount: a.correctCount,
            accuracy,
            time: timeFormatted,
            isCurrentUser: String(a.user?._id) === String(req.user._id)
        };
    });

    const myEntry = leaderboard.find(l => l.isCurrentUser) || null;
    const top10 = leaderboard.slice(0, 10);
    const myRowNeeded = myEntry && myEntry.rank > 10;

    res.render("dashboard/dailyWarmupLeaderboard", {
        layout: "layouts/dashboard",
        listing, sections: [],
        currentSection: null, folder: null, file: null,
        isDailyWarmupPage: true,
        top10, myEntry, myRowNeeded,
        totalParticipants: leaderboard.length,
        title: `Daily Warmup Leaderboard | ${listing.title}`,
        robots: "noindex, nofollow"
    });
};