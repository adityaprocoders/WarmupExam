import Category from "../models/Category.js";
import Listing from "../models/listing.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import DailyWarmupConfig from "../models/DailyWarmupConfig.js";
import WarmupUsageLog from "../models/WarmupUsageLog.js";
import { generateWarmupForExam } from "./dailyWarmupController.js";
import WarmupStreak from "../models/WarmupStreak.js";

import Question from "../models/Question.js";

function currentHHMM() {
    const now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

async function getListingQuestionCount(listingId) {
    const testIds = await Test.find({ listing: listingId }).distinct("_id");
    if (testIds.length === 0) return 0;
    const qIds = await TestQuestion.find({ test: { $in: testIds } }).distinct("question");
    return qIds.length;
}

/* ================================================================ */
/* GET /owner/daily-warmup/dashboard-stats                           */
/* ================================================================ */
export const getDashboardStats = async (req, res) => {
    const configs = await DailyWarmupConfig.find().populate("category", "name").lean();

    let liveNow = 0, upcoming = 0, completedToday = 0, totalParticipants = 0;
    const rows = [];

    for (const config of configs) {
        const activeTest = await Test.findOne({
            isDailyWarmup: true,
            warmupExam: config.exam,
            warmupExpiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).lean();

        let status;
        if (currentHHMM() < config.startTime && !activeTest) {
            status = "upcoming";
            upcoming++;
        } else if (activeTest) {
            status = "live";
            liveNow++;
        } else {
            status = "completed";
            completedToday++;
        }

        let participants = 0, avgScore = 0, topScore = 0;
        if (activeTest) {
            const attempts = await Attempt.find({ test: activeTest._id }).select("score").lean();
            participants = attempts.length;
            totalParticipants += participants;
            if (participants > 0) {
                avgScore = Math.round((attempts.reduce((s, a) => s + a.score, 0) / participants) * 10) / 10;
                topScore = Math.max(...attempts.map(a => a.score));
            }
        }

        rows.push({
            exam: config.exam,
            category: config.category?.name || "",
            status,
            startTime: config.startTime,
            questionCount: config.questionCount,
            participants,
            avgScore,
            topScore,
            totalMarks: activeTest ? activeTest.totalMarks : null
        });
    }

    res.json({
        success: true,
        stats: {
            totalExams: configs.length,
            liveNow,
            upcoming,
            completedToday,
            totalParticipants
        },
        rows
    });
};

/* ================================================================ */
/* GET /owner/daily-warmup/categories                                */
/* ================================================================ */
export const getCategories = async (req, res) => {
    const categories = await Category.find().select("name").sort({ name: 1 }).lean();
    res.json({ success: true, categories });
};

/* ================================================================ */
/* GET /owner/daily-warmup/exams?category=ID                         */
/* ================================================================ */
export const getExamsByCategory = async (req, res) => {
    const { category } = req.query;
    if (!category) return res.status(400).json({ success: false, message: "category required" });

    const exams = await Listing.distinct("exam", { category });
    const configuredExams = await DailyWarmupConfig.find({ exam: { $in: exams } }).distinct("exam");
    const configuredSet = new Set(configuredExams);

    res.json({
        success: true,
        exams: exams.map(e => ({ name: e, configured: configuredSet.has(e) }))
    });
};

/* ================================================================ */
/* GET /owner/daily-warmup/sources?category=ID&exam=NAME              */
/* ================================================================ */
export const getSourcesForExam = async (req, res) => {
    const { category, exam } = req.query;
    if (!category || !exam) return res.status(400).json({ success: false, message: "category & exam required" });

    const listings = await Listing.find({ category, exam }).select("title marks").lean();

    const sources = [];
    for (const l of listings) {
        const count = await getListingQuestionCount(l._id);
        sources.push({ _id: l._id, title: l.title, questionCount: count });
    }

    const subjects = listings[0]?.marks?.map(m => m.subject) || [];

    res.json({ success: true, sources, subjects });
};

/* ================================================================ */
/* GET /owner/daily-warmup/sources/unique-count?listingIds=id1,id2    */
/* ================================================================ */
export const getUniqueQuestionCount = async (req, res) => {
    const { listingIds } = req.query;
    const ids = (listingIds || "").split(",").filter(Boolean);
    if (ids.length === 0) return res.json({ success: true, count: 0 });

    const testIds = await Test.find({ listing: { $in: ids } }).distinct("_id");
    const qIds = await TestQuestion.find({ test: { $in: testIds } }).distinct("question");

    res.json({ success: true, count: qIds.length });
};

/* ================================================================ */
/* GET /owner/daily-warmup/config/:exam   (for edit prefill)         */
/* ================================================================ */
export const getConfigByExam = async (req, res) => {
    const config = await DailyWarmupConfig.findOne({ exam: req.params.exam }).lean();
    res.json({ success: true, config: config || null });
};

/* ================================================================ */
/* POST /owner/daily-warmup/config   (create/update)                 */
/* ================================================================ */
export const saveConfig = async (req, res) => {
    
    const {
    category, exam, includedListings, languageMode, languages,
    subjects, questionCount, duration, difficultyDistribution, startTime
} = req.body;

    if (!category || !exam) return res.status(400).json({ success: false, message: "Category & exam required." });
    if (!Array.isArray(includedListings) || includedListings.length === 0) {
        return res.status(400).json({ success: false, message: "Select at least one question source." });
    }
    if (!Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ success: false, message: "Select at least one subject." });
    }
    if (!questionCount || questionCount < 5 || questionCount > 50) {
        return res.status(400).json({ success: false, message: "Question count must be between 5 and 50." });
    }


    if (!duration || duration < 1 || duration > 60) {
    return res.status(400).json({ success: false, message: "Duration must be between 1 and 60 minutes." });
}


    const { easy = 0, medium = 0, hard = 0 } = difficultyDistribution || {};
    if (easy + medium + hard !== 100) {
        return res.status(400).json({ success: false, message: "Difficulty distribution must total 100%." });
    }
    if (!startTime) return res.status(400).json({ success: false, message: "Start time is required." });

    // security check — saari listings sach me is category+exam ki hon
    const validCount = await Listing.countDocuments({ _id: { $in: includedListings }, category, exam });
    if (validCount !== includedListings.length) {
        return res.status(400).json({ success: false, message: "One or more sources don't belong to this exam." });
    }

    const config = await DailyWarmupConfig.findOneAndUpdate(
    { exam },
    {
        category, exam, includedListings,
        languageMode: languageMode === "both" ? "both" : "single",
        languages: languageMode === "both" ? ["English", "Hindi"] : [languageMode === "Hindi" ? "Hindi" : "English"],
        subjects, questionCount, duration,
        difficultyDistribution: { easy, medium, hard },
        startTime,
        createdBy: req.user._id
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
);

    // agar is exam ka koi active warmup nahi hai to turant generate kar do
    const active = await Test.findOne({
        isDailyWarmup: true,
        warmupExam: exam,
        warmupExpiresAt: { $gt: new Date() }
    });
    if (!active) {
        await generateWarmupForExam(exam);
    }

    res.json({ success: true, config });
};




/* ================================================================ */
/* DELETE /owner/daily-warmup/config/:exam                           */
/* ================================================================ */
export const deleteConfig = async (req, res) => {
    const { exam } = req.params;

    const config = await DailyWarmupConfig.findOneAndDelete({ exam });
    if (!config) return res.status(404).json({ success: false, message: "Config not found." });

    // is exam ke saare warmup Tests (active + expired/past sab) dhundo
    const allTests = await Test.find({ isDailyWarmup: true, warmupExam: exam }).select("_id");
    const testIds = allTests.map(t => t._id);

    if (testIds.length > 0) {
        // in tests ke TestQuestion mappings hatao
        await TestQuestion.deleteMany({ test: { $in: testIds } });

        // in tests pe hue saare student Attempts bhi hatao
        await Attempt.deleteMany({ test: { $in: testIds } });

        // ab Test docs khud hatao
        await Test.deleteMany({ _id: { $in: testIds } });
    }

    // is exam ke cooldown/usage-log records hatao
    await WarmupUsageLog.deleteMany({ exam });

    // is exam ke streak records bhi hatao
    await WarmupStreak.deleteMany({ exam });

    res.json({ success: true });
};



export const getWarmupLeaderboardForOwner = async (req, res) => {
    const { exam } = req.params;

    const todaysWarmup = await Test.findOne({
        warmupExam: exam,
        isDailyWarmup: true,
        warmupExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    if (!todaysWarmup) {
        return res.json({ success: true, leaderboard: [], totalParticipants: 0, active: false });
    }

    const attempts = await Attempt.find({ test: todaysWarmup._id })
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
            totalMarks: todaysWarmup.totalMarks,
            correctCount: a.correctCount || 0,
            accuracy,
            time: timeFormatted
        };
    });

    res.json({
        success: true,
        leaderboard,
        totalParticipants: leaderboard.length,
        active: true
    });
};