import Category from "../models/Category.js";
import Listing from "../models/listing.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";
import LiveTestConfig from "../models/LiveTestConfig.js";
import LiveTestUsageLog from "../models/LiveTestUsageLog.js";
import { generateLiveTestForExam } from "./liveTestController.js";

function currentHHMM() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

async function getListingQuestionCount(listingId) {
    const testIds = await Test.find({ listing: listingId }).distinct("_id");
    if (testIds.length === 0) return 0;
    const qIds = await TestQuestion.find({ test: { $in: testIds } }).distinct("question");
    return qIds.length;
}

// selected listings (owner ne "Question Sources" me tick ki hui) ke Test _id's
async function getTestIdsForListings(listingIds) {
    if (!Array.isArray(listingIds) || listingIds.length === 0) return [];
    const tests = await Test.find({ listing: { $in: listingIds } }).select("_id");
    return tests.map(t => t._id);
}

/* ================================================================ */
/* GET /owner/live-test/dashboard-stats                            */
/* ================================================================ */
export const getDashboardStats = async (req, res) => {
    const configs = await LiveTestConfig.find().populate("category", "name").lean();

    let liveNow = 0, upcoming = 0, completedToday = 0, totalParticipants = 0;
    const rows = [];

    for (const config of configs) {
        const activeTest = await Test.findOne({
            isLiveTest: true,
            liveTestExam: config.exam,
            liveTestExpiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 }).lean();

        const today = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
const allowedDays = (config.scheduledDays && config.scheduledDays.length > 0)
    ? config.scheduledDays
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let status;
if (activeTest) {
    status = "live";
    liveNow++;
} else if (!allowedDays.includes(today)) {
    status = "not_scheduled";
} else if (currentHHMM() < config.startTime) {
    status = "upcoming";
    upcoming++;
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
/* GET /owner/live-test/categories                                 */
/* ================================================================ */
export const getCategories = async (req, res) => {
    const categories = await Category.find().select("name").sort({ name: 1 }).lean();
    res.json({ success: true, categories });
};

/* ================================================================ */
/* GET /owner/live-test/exams?category=ID                          */
/* ================================================================ */
export const getExamsByCategory = async (req, res) => {
    const { category } = req.query;
    if (!category) return res.status(400).json({ success: false, message: "category required" });

    const exams = await Listing.distinct("exam", { category });
    const configuredExams = await LiveTestConfig.find({ exam: { $in: exams } }).distinct("exam");
    const configuredSet = new Set(configuredExams);

    res.json({
        success: true,
        exams: exams.map(e => ({ name: e, configured: configuredSet.has(e) }))
    });
};

/* ================================================================ */
/* GET /owner/live-test/sources?category=ID&exam=NAME               */
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

    res.json({ success: true, sources });
};

/* ================================================================ */
/* GET /owner/live-test/sources/unique-count?listingIds=id1,id2     */
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
/* GET /owner/live-test/subjects?listingIds=id1,id2                 */
/* -> Filter-builder ka Subject dropdown yahin se populate hoga     */
/* ================================================================ */
export const getSubjectsForExam = async (req, res) => {
    const { listingIds } = req.query;
    const ids = (listingIds || "").split(",").filter(Boolean);
    if (ids.length === 0) return res.json({ success: true, subjects: [] });

    const testIds = await getTestIdsForListings(ids);
    if (testIds.length === 0) return res.json({ success: true, subjects: [] });

    const subjects = (await TestQuestion.distinct("subject", { test: { $in: testIds } }))
        .filter(s => s && s.trim() !== "")
        .sort();

    res.json({ success: true, subjects });
};

/* ================================================================ */
/* GET /owner/live-test/question-filters                            */
/*     ?listingIds=id1,id2&subject=&section=&qsection=&topic=       */
/* -> Filter-builder row ke Section/Topic/SubTopic dropdowns cascade */
/*    yahin se hote hain (generatePaper ke getQuestionFilters jaisa) */
/* ================================================================ */
export const getQuestionFiltersForExam = async (req, res) => {
    const { listingIds, subject, qsection, topic } = req.query;
    const ids = (listingIds || "").split(",").filter(Boolean);

    if (ids.length === 0) {
        return res.json({ success: true, data: { qsections: [], topics: [], subTopics: [] } });
    }

    const testIds = await getTestIdsForListings(ids);
    if (testIds.length === 0) {
        return res.json({ success: true, data: { qsections: [], topics: [], subTopics: [] } });
    }

    const baseMatch = { test: { $in: testIds } };
    if (subject) baseMatch.subject = subject;

    const qsections = (await TestQuestion.distinct("section", baseMatch))
        .filter(s => s && s.trim() !== "")
        .sort();

    const topicMatch = { ...baseMatch };
    if (qsection) {
        const qsecArr = qsection.split(",").map(s => s.trim()).filter(Boolean);
        if (qsecArr.length > 0) topicMatch.section = { $in: qsecArr };
    }
    const topics = (await TestQuestion.distinct("topic", topicMatch))
        .filter(t => t && t.trim() !== "")
        .sort();

    const subTopicMatch = { ...topicMatch };
    if (topic) {
        const topicArr = topic.split(",").map(s => s.trim()).filter(Boolean);
        if (topicArr.length > 0) subTopicMatch.topic = { $in: topicArr };
    }
    const subTopics = (await TestQuestion.distinct("subTopic", subTopicMatch))
        .filter(st => st && st.trim() !== "")
        .sort();

    res.json({ success: true, data: { qsections, topics, subTopics } });
};

/* ================================================================ */
/* GET /owner/live-test/config/:exam   (for edit prefill)          */
/* ================================================================ */
export const getConfigByExam = async (req, res) => {
    const config = await LiveTestConfig.findOne({ exam: req.params.exam }).lean();
    res.json({ success: true, config: config || null });
};

/* ================================================================ */
/* POST /owner/live-test/config   (create/update)                  */
/* ================================================================ */
export const saveConfig = async (req, res) => {
    const {
    category, exam, includedListings, languageMode,
    criteria, totalQuestionsStrategy, subjectQuestionCounts,
    questionCount, maxRepeat, timeStrategy, duration, subjectTimes, difficultyDistribution,
    startTime, scheduledDays
} = req.body;

    if (!category || !exam) return res.status(400).json({ success: false, message: "Category & exam required." });

    if (!Array.isArray(includedListings) || includedListings.length === 0) {
        return res.status(400).json({ success: false, message: "Select at least one question source." });
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
        return res.status(400).json({ success: false, message: "Kam se kam ek filter row add karo (Subject choose karke)." });
    }
    for (const row of criteria) {
    if (!row.subject) {
        return res.status(400).json({ success: false, message: "Har row me Subject choose karna zaroori hai." });
    }
    if (row.countMode !== "subject") {
        if (!row.minCount || !row.maxCount || row.minCount < 1 || row.maxCount < row.minCount) {
            return res.status(400).json({ success: false, message: `"${row.subject}" row ka Min/Max Q sahi nahi hai.` });
        }
    }
}

    const strategy = totalQuestionsStrategy === "subject" ? "subject" : "all";

    if (strategy === "all") {
        if (!questionCount || questionCount < 5 || questionCount > 200) {
            return res.status(400).json({ success: false, message: "Total question count 5 se 200 ke beech hona chahiye." });
        }
    } else {
        if (!Array.isArray(subjectQuestionCounts) || subjectQuestionCounts.length === 0) {
            return res.status(400).json({ success: false, message: "Subject-wise question count add karo." });
        }
    }

  const tStrategy = timeStrategy === "subject" ? "subject" : "total";
let effectiveDuration;
if (tStrategy === "total") {
    if (!duration || duration < 1 || duration > 180) {
        return res.status(400).json({ success: false, message: "Duration 1 se 180 minutes ke beech hona chahiye." });
    }
    effectiveDuration = duration;
} else {
    if (!Array.isArray(subjectTimes) || subjectTimes.length === 0) {
        return res.status(400).json({ success: false, message: "Subject-wise time add karo." });
    }
    for (const st of subjectTimes) {
        if (!st.subject || !st.minutes || st.minutes < 1) {
            return res.status(400).json({ success: false, message: "Har subject ka valid time (minutes) hona chahiye." });
        }
    }
    effectiveDuration = subjectTimes.reduce((s, st) => s + (Number(st.minutes) || 0), 0);
    if (effectiveDuration < 1 || effectiveDuration > 180) {
        return res.status(400).json({ success: false, message: "Total (subject-wise sum) duration 1 se 180 minutes ke beech hona chahiye." });
    }
}

    const { easy = 0, medium = 0, hard = 0 } = difficultyDistribution || {};
    if (easy + medium + hard !== 100) {
        return res.status(400).json({ success: false, message: "Difficulty distribution must total 100%." });
    }
    
    if (!Array.isArray(scheduledDays) || scheduledDays.length === 0) {
    return res.status(400).json({ success: false, message: "Kam se kam ek Day select karo." });
}

    // security check — saari listings sach me is category+exam ki hon
    const validCount = await Listing.countDocuments({ _id: { $in: includedListings }, category, exam });
    if (validCount !== includedListings.length) {
        return res.status(400).json({ success: false, message: "One or more sources don't belong to this exam." });
    }

    // total questionCount hamesha store karo (subject-wise mode me sum se calculate)
    const effectiveQuestionCount = strategy === "subject"
        ? subjectQuestionCounts.reduce((sum, sq) => sum + (Number(sq.count) || 0), 0)
        : questionCount;

    const config = await LiveTestConfig.findOneAndUpdate(
        { exam },
        {
            category, exam, includedListings,
            languageMode: languageMode === "both" ? "both" : "single",
            languages: languageMode === "both" ? ["English", "Hindi"] : [languageMode === "Hindi" ? "Hindi" : "English"],
            criteria,
            totalQuestionsStrategy: strategy,
            subjectQuestionCounts: strategy === "subject" ? subjectQuestionCounts : [],
            questionCount: effectiveQuestionCount,
            maxRepeat: Math.max(1, Number(maxRepeat) || 2),
timeStrategy: tStrategy,
duration: effectiveDuration,
subjectTimes: tStrategy === "subject" ? subjectTimes : [],
            difficultyDistribution: { easy, medium, hard },
            startTime,
            scheduledDays,
            createdBy: req.user._id
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.json({ success: true, config });
};

/* ================================================================ */
/* DELETE /owner/live-test/config/:exam                             */
/* ================================================================ */
export const deleteConfig = async (req, res) => {
    const { exam } = req.params;

    const config = await LiveTestConfig.findOneAndDelete({ exam });
    if (!config) return res.status(404).json({ success: false, message: "Config not found." });

    const allTests = await Test.find({ isLiveTest: true, liveTestExam: exam }).select("_id");
    const testIds = allTests.map(t => t._id);

    if (testIds.length > 0) {
        await TestQuestion.deleteMany({ test: { $in: testIds } });
        await Attempt.deleteMany({ test: { $in: testIds } });
        await Test.deleteMany({ _id: { $in: testIds } });
    }

    await LiveTestUsageLog.deleteMany({ exam });

    res.json({ success: true });
};

/* ================================================================ */
/* GET /owner/live-test/leaderboard/:exam                           */
/* ================================================================ */
export const getLiveTestLeaderboardForOwner = async (req, res) => {
    const { exam } = req.params;

    const todaysLiveTest = await Test.findOne({
        liveTestExam: exam,
        isLiveTest: true,
        liveTestExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    if (!todaysLiveTest) {
        return res.json({ success: true, leaderboard: [], totalParticipants: 0, active: false });
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