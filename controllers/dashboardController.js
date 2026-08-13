import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import Attempt from "../models/TestAttempt.js";
import ExpressError from "../utils/ExpressError.js";
import slugify from "slugify";
import { checkEnrollment, isOwnerUser } from "../utils/authHelpers.js";
import { calculateRankFromPredictor } from "../utils/rankHelper.js";
import { getTestStatus } from "../utils/testStatus.js";

/* ------------------------------------------------------------------ */
/* Small stats helpers (pure functions — koi DB call nahi)             */
/* ------------------------------------------------------------------ */

// Value ka percentile nikalta hai ek numeric array ke andar (0-100)
function getPercentile(value, arr) {
    if (!arr.length) return 0;
    let below = 0, equal = 0;
    for (const v of arr) {
        if (v < value) below++;
        else if (v === value) equal++;
    }
    const percentile = ((below + 0.5 * equal) / arr.length) * 100;
    return Math.round(percentile * 100) / 100;
}

// Standard deviation — spread of everyone's scores
function getStdDev(arr) {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

// Score distribution histogram — Chart ke liye buckets banata hai,
// aur batata hai user kis bucket me aata hai
function buildDistribution(arr, userValue, bins = 10) {
    if (!arr.length) return [];
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    const binSize = range / bins;

    const buckets = Array.from({ length: bins }, (_, i) => ({
        rangeStart: Math.round(min + i * binSize),
        rangeEnd: Math.round(min + (i + 1) * binSize),
        count: 0,
        isUserBucket: false
    }));

    arr.forEach(v => {
        let idx = Math.floor((v - min) / binSize);
        if (idx >= bins) idx = bins - 1;
        if (idx < 0) idx = 0;
        buckets[idx].count++;
    });

    let userIdx = Math.floor((userValue - min) / binSize);
    if (userIdx >= bins) userIdx = bins - 1;
    if (userIdx < 0) userIdx = 0;
    if (buckets[userIdx]) buckets[userIdx].isUserBucket = true;

    return buckets;
}

async function enrichFilesWithProgress(files, userId) {
    if (!files.length) return files;

    const fileIds = files.map(f => f._id);

    const allTests = await Test.find({
        parentType: "file",
        parentId: { $in: fileIds }
    }).select("_id parentId");

    const testsByFile = {};
    allTests.forEach(t => {
        const key = String(t.parentId);
        if (!testsByFile[key]) testsByFile[key] = [];
        testsByFile[key].push(t._id);
    });

    const allTestIds = allTests.map(t => t._id);

    const attempts = await Attempt.find({
        test: { $in: allTestIds },
        user: userId
    }).select("test");

    const attemptedTestIds = new Set(attempts.map(a => String(a.test)));

    return files.map(f => {
        const testIds = testsByFile[String(f._id)] || [];
        const testCount = testIds.length;
        const completedCount = testIds.filter(id => attemptedTestIds.has(String(id))).length;

        return {
            ...f.toObject(),
            testCount,
            completedCount
        };
    });
}

export const showSeries = async (req, res) => {
    const { slug } = req.params;
    const { section, statsSection } = req.query;

    if (req.user.role !== "owner" && typeof req.user.populate === "function") {
        await req.user.populate([
            { path: "enrolledListings.listing" },
            { path: "lastAccessedBatch" }
        ]);
    }

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    if (!checkEnrollment(req, listing._id)) {
        req.flash("error", "You must be enrolled in this batch to access this test.");
        return res.redirect(`/test/${listing._id}`);
    }

    if (!isOwnerUser(req)) {
        await req.user.updateOne({ lastAccessedBatch: listing._id });
        req.user.lastAccessedBatch = listing;
    }

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });;
    const statsFilterSections = sections;

    let currentSection = null;
    if (section) {
        currentSection = await Section.findOne({ _id: section, listing: listing._id });
        if (!currentSection) throw new ExpressError(404, "Section Not Found");
    }

    let folders = [], files = [], tests = [];

    if (currentSection) {
        folders = await Folder.find({
            listing: listing._id, section: currentSection._id, parentType: "section", parentId: null
        }).sort({ createdAt: 1 });

        files = await File.find({
            listing: listing._id, section: currentSection._id, parentType: "section", parentId: null
        }).sort({ createdAt: 1 });

        files = await enrichFilesWithProgress(files, req.user._id);

        tests = await Test.find({
            listing: listing._id, section: currentSection._id, parentType: "section", parentId: null
        }).sort({ createdAt: 1 });

        const testIds = tests.map(t => t._id);

        // Sirf current logged-in user ke attempts fetch honge
        const attempts = await Attempt.find({ test: { $in: testIds }, user: req.user._id }).sort({ createdAt: -1 });

        const latestAttemptByTest = {};
        attempts.forEach(a => {
            const key = String(a.test);
            if (!latestAttemptByTest[key]) latestAttemptByTest[key] = a;
        });

        tests = tests.map(t => ({
            ...t.toObject(),
            latestAttempt: latestAttemptByTest[String(t._id)] || null,
            testStatus: getTestStatus(t)
        }));
    }

    // Dashboard home-page ke stats sirf tabhi chahiye jab koi section/folder/file open na ho
    let dashboardStats = null;
    let recentActivity = [];
    let performanceGrowth = [];
    let showRankPredictor = false;

    if (!currentSection) {
     if (statsSection && statsSection !== "all") {
        const selectedSec = sections.find(s => String(s._id) === String(statsSection));
        showRankPredictor = !!(selectedSec && selectedSec.showInStatsFilter);
    }

    const testQuery = { listing: listing._id, isDailyWarmup: { $ne: true } };
    if (statsSection && statsSection !== "all") {
        testQuery.section = statsSection;
    }
        
        const allTests = await Test.find(testQuery).select("_id title totalMarks");
        const allTestIds = allTests.map(t => t._id);
        const testMap = {};
        allTests.forEach(t => { testMap[String(t._id)] = t; });

        // Sirf current logged-in student ke attempts (latest to oldest)
        const allAttempts = await Attempt.find({
            test: { $in: allTestIds },
            user: req.user._id
        }).sort({ createdAt: -1 });

        const testsAttemptedCount = allAttempts.length;

        const avgScore = testsAttemptedCount > 0
            ? Math.round((allAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / testsAttemptedCount) * 10) / 10
            : 0;

        const totalCorrect = allAttempts.reduce((sum, a) => sum + (a.correctCount || 0), 0);
        const totalWrong = allAttempts.reduce((sum, a) => sum + (a.wrongCount || 0), 0);
        const totalAttemptedQs = totalCorrect + totalWrong;
        const avgAccuracy = totalAttemptedQs > 0
            ? Math.round((totalCorrect / totalAttemptedQs) * 100)
            : 0;

        /* ---------------------------------------------------------------- */
        /* NEW: Puri listing ke SAARE enrolled students ka real attempt data */
        /* — isi se Comparison + Score Distribution + Rank Range dynamic     */
        /* banenge (koi hardcoded 55.32 / 90.00 / ±15% ab nahi)               */
        /* ---------------------------------------------------------------- */
        const allStudentsAttempts = await Attempt.find({ test: { $in: allTestIds } })
            .select("user score");

        const attemptsByUser = {};
        allStudentsAttempts.forEach(a => {
            if (!a.user) return; // safety: attempt bina user reference ke skip
            const uid = String(a.user);
            if (!attemptsByUser[uid]) attemptsByUser[uid] = [];
            attemptsByUser[uid].push(a.score || 0);
        });

        // Har enrolled student ka average score (jitne bhi tests unhone diye unka average)
        const studentAvgScores = Object.values(attemptsByUser)
            .map(scores => Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100)
            .filter(v => !isNaN(v));

        const totalStudentsCompared = studentAvgScores.length;
        const meanOfAllStudents = totalStudentsCompared
            ? Math.round((studentAvgScores.reduce((a, b) => a + b, 0) / totalStudentsCompared) * 100) / 100
            : 0;

        // --- EXISTING CURRENT RANK LOGIC (UNCHANGED) ---
        let currentRank = "--";
        let rankRange = { best: "--", likely: "--", worst: "--" };

        // Comparison card ke liye — ab real distribution se nikalta hai
        let percentileData = { userPercentile: 0, avgPercentile: 0, topPercentile: 90 };

        if (allAttempts.length > 0) {
            // Latest attempt score
            const latestAttempt = allAttempts[0];
            const { rank } = calculateRankFromPredictor(latestAttempt.score, listing.rankPredictorData);
            currentRank = rank;
        }

        if (testsAttemptedCount > 0 && totalStudentsCompared > 0) {
            // User apne average score pe kaha khada hai, baaki sab enrolled students ke against
            percentileData.userPercentile = getPercentile(avgScore, studentAvgScores);
            // "Average" student (poori batch ka mean score) kis percentile pe aata hai
            percentileData.avgPercentile = getPercentile(meanOfAllStudents, studentAvgScores);
            // Top 10% by definition 90th percentile hi hota hai (isse data nahi badalta)
            percentileData.topPercentile = 90;
        }

        // --- Rank Range (Best / Likely / Worst) — ab batch ke real spread (std-dev) se ---
        if (currentRank !== "--" && listing.rankPredictorData?.length) {
            const numRank = Number(currentRank);

            if (totalStudentsCompared >= 2) {
                const stdDev = getStdDev(studentAvgScores);
                const minScore = Math.min(...studentAvgScores);
                const maxScore = Math.max(...studentAvgScores);

                const bestScore = Math.min(maxScore, avgScore + stdDev);
                const worstScore = Math.max(minScore, avgScore - stdDev);

                const { rank: bestRankRaw } = calculateRankFromPredictor(bestScore, listing.rankPredictorData);
                const { rank: worstRankRaw } = calculateRankFromPredictor(worstScore, listing.rankPredictorData);

                let bestNum = Number(bestRankRaw);
                let worstNum = Number(worstRankRaw);

                // Rank number chhota = behtar, so agar order ulta aaye to swap kar do
                if (!isNaN(bestNum) && !isNaN(worstNum) && bestNum > worstNum) {
                    [bestNum, worstNum] = [worstNum, bestNum];
                }

                rankRange = {
                    best: isNaN(bestNum) ? currentRank : Math.max(1, Math.round(bestNum)),
                    likely: numRank,
                    worst: isNaN(worstNum) ? currentRank : Math.round(worstNum)
                };
            } else if (!isNaN(numRank) && numRank > 0) {
                // Fallback: itne kam students hain ki real spread nikalna possible nahi,
                // to purana ±15% heuristic hi use karo
                rankRange = {
                    best: Math.max(1, Math.round(numRank * 0.85)),
                    likely: numRank,
                    worst: Math.round(numRank * 1.15)
                };
            } else {
                rankRange = { best: currentRank, likely: currentRank, worst: currentRank };
            }
        }

        // --- Score Distribution — real histogram of every enrolled student's avg score ---
        const scoreDistribution = testsAttemptedCount > 0
            ? buildDistribution(studentAvgScores, avgScore, 10)
            : [];

        // --- AVERAGE-BASED RANK (graph marker / "your location" point) ---
        let avgRank = "--";
        if (testsAttemptedCount > 0 && listing.rankPredictorData) {
            const { rank: computedAvgRank } = calculateRankFromPredictor(avgScore, listing.rankPredictorData);
            avgRank = computedAvgRank;
        }

        
        dashboardStats = {
            testsAttempted: testsAttemptedCount,
            avgScore,
            avgAccuracy,
            currentRank,
            avgRank,
            rankRange,
            percentileData,
            scoreDistribution,       // NEW — histogram buckets for the chart
            totalStudentsCompared,   // NEW — kitne real students ke against compare hua
            rankPredictorData: listing.rankPredictorData || [] // For Marks vs Rank curve
        };

        // Recent Activity — latest 5 attempts (UNCHANGED)
        recentActivity = allAttempts.map(a => ({
            attemptId: a._id,
            testTitle: testMap[String(a.test)]?.title || "Untitled Test",
            date: a.createdAt,
            score: a.score,
            totalMarks: a.totalMarks
        }));

        // Performance Growth & Rank Progress (Purane se naye order me) (UNCHANGED)
        performanceGrowth = [...allAttempts].reverse().map(a => {
            const { rank } = calculateRankFromPredictor(a.score, listing.rankPredictorData);
            return {
                date: a.createdAt,
                score: a.score,
                rank: rank,
                totalMarks: a.totalMarks || testMap[String(a.test)]?.totalMarks || 0
            };
        });
    }

    res.render("dashboard/index", {
        layout: "layouts/dashboard",
        listing, sections, currentSection,
        folder: null, file: null,
        folders, files, tests,
        currentType: currentSection ? "section" : "dashboard",
        pageTitle: currentSection ? currentSection.title : listing.title,
        breadcrumb: currentSection
            ? [
                { title: listing.title, url: `/series/${listing.slug}` },
                { title: currentSection.title, url: "#" }
            ]
            : [{ title: listing.title, url: "#" }],
        dashboardStats, recentActivity, performanceGrowth,
        selectedStatsSection: statsSection || "all" ,
         statsFilterSections,
         showRankPredictor,
         
          title: `${currentSection ? currentSection.title : listing.title} | WarmupExam Dashboard`,
         description: `Track your performance, view detailed analytics and attempt mock tests for ${listing.title} on WarmupExam.`,
          robots: "noindex, nofollow"
    });
};

export const createSection = async (req, res) => {
    const { slug } = req.params;
    const { title, icon } = req.body;

    const listing = await Listing.findOne({ slug });
    if (!listing) return res.status(404).send("Listing Not Found");

    await Section.create({ title, icon, listing: listing._id });
    res.redirect(`/series/${slug}`);
};

export const updateSection = async (req, res) => {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) return res.status(404).send("Section Not Found");

    await Section.findByIdAndUpdate(id, { title: req.body.title });
    const listing = await Listing.findById(section.listing);
    res.redirect(`/series/${listing.slug}`);
};

export const deleteSection = async (req, res) => {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) return res.status(404).send("Section Not Found");

    const listing = await Listing.findById(section.listing);
    await Section.findByIdAndDelete(id);
    res.redirect(`/series/${listing.slug}`);
};

export const createFolder = async (req, res) => {
    const { title, icon, section } = req.body;

    await Folder.create({
        title, icon, section,
        slug: slugify(title, { lower: true, strict: true })
    });

    const currentSection = await Section.findById(section);
    const listing = await Listing.findById(currentSection.listing);
    res.redirect(`/series/${listing.slug}`);
};

export const showFolder = async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== "owner" && typeof req.user.populate === "function") {
        await req.user.populate([
            { path: "enrolledListings.listing" },
            { path: "lastAccessedBatch" }
        ]);
    }

    const folder = await Folder.findById(id);
    if (!folder) throw new ExpressError(404, "Folder Not Found");

    if (!checkEnrollment(req, folder.listing)) {
        req.flash("error", "You must be enrolled in this batch to access this content.");
        return res.redirect(`/test/${folder.listing}`);
    }

    const currentSection = await Section.findById(folder.section);
    if (!currentSection) throw new ExpressError(404, "Section Not Found");

    const listing = await Listing.findById(folder.listing);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });;

    const folders = await Folder.find({ parentType: "folder", parentId: folder._id });
    let files = await File.find({ parentType: "folder", parentId: folder._id });
    files = await enrichFilesWithProgress(files, req.user._id);
    let tests = await Test.find({ parentType: "folder", parentId: folder._id });

    const testIds = tests.map(t => t._id);

    // Sirf current logged-in user ke attempts fetch honge, kisi aur student ya owner ke nahi
    const attempts = await Attempt.find({ test: { $in: testIds }, user: req.user._id }).sort({ createdAt: -1 });

    const latestAttemptByTest = {};
    attempts.forEach(a => {
        const key = String(a.test);
        if (!latestAttemptByTest[key]) latestAttemptByTest[key] = a;
    });

    tests = tests.map(t => ({
        ...t.toObject(),
        latestAttempt: latestAttemptByTest[String(t._id)] || null,
        testStatus: getTestStatus(t)
    }));

    res.render("dashboard/index", {
        layout: "layouts/dashboard",
        listing, sections, currentSection,
        folder, file: null,
        folders, files, tests,
        currentType: "folder",
        pageTitle: folder.title,
        breadcrumb: [
            { title: listing.title, url: `/series/${listing.slug}` },
            { title: currentSection.title, url: `/series/${listing.slug}?section=${currentSection._id}` },
            { title: folder.title, url: "#" }
        ],
        dashboardStats: null, recentActivity: [], performanceGrowth: [],


        title: `${folder.title} | WarmupExam Dashboard`,
    robots: "noindex, nofollow"
    });
};

export const showFile = async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== "owner" && typeof req.user.populate === "function") {
        await req.user.populate([
            { path: "enrolledListings.listing" },
            { path: "lastAccessedBatch" }
        ]);
    }

    const file = await File.findById(id);
    if (!file) throw new ExpressError(404, "File Not Found");

    if (!checkEnrollment(req, file.listing)) {
        req.flash("error", "You must be enrolled in this batch to access this file.");
        return res.redirect(`/test/${file.listing}`);
    }

    const currentSection = await Section.findById(file.section);
    if (!currentSection) throw new ExpressError(404, "Section Not Found");

    const listing = await Listing.findById(file.listing);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });;

    const folders = await Folder.find({ parentType: "file", parentId: file._id }).sort({ createdAt: 1 });
    let files = await File.find({ parentType: "file", parentId: file._id }).sort({ createdAt: 1 });
files = await enrichFilesWithProgress(files, req.user._id);
    let tests = await Test.find({ parentType: "file", parentId: file._id }).sort({ createdAt: 1 });

const testIds = tests.map(t => t._id);

// ✅ Current user ke attempts fetch karo (jaise showFolder me hota hai)
const attempts = await Attempt.find({ test: { $in: testIds }, user: req.user._id }).sort({ createdAt: -1 });

const latestAttemptByTest = {};
attempts.forEach(a => {
    const key = String(a.test);
    if (!latestAttemptByTest[key]) latestAttemptByTest[key] = a;
});

tests = tests.map(t => ({
    ...t.toObject(),
    latestAttempt: latestAttemptByTest[String(t._id)] || null,
    testStatus: getTestStatus(t)
}));

    res.render("dashboard/index", {
        layout: "layouts/dashboard",
        listing, sections, currentSection,
        folder: null, file,
        folders, files, tests,
        currentType: "file",
        pageTitle: file.title,
        breadcrumb: [
            { title: listing.title, url: `/series/${listing.slug}` },
            { title: currentSection.title, url: `/series/${listing.slug}?section=${currentSection._id}` },
            { title: file.title, url: "#" }
        ],
        dashboardStats: null, recentActivity: [], performanceGrowth: [],

        title: `${file.title} | WarmupExam Dashboard`,
    robots: "noindex, nofollow"
    });
};




export const exportAllAttempts = async (req, res) => {
    const { slug } = req.params;
    const { statsSection } = req.query;

    const listing = await Listing.findOne({ slug });
    if (!listing) {
        return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const testQuery = { listing: listing._id, isDailyWarmup: { $ne: true } };
    if (statsSection && statsSection !== "all") {
        testQuery.section = statsSection;
    }

    const allTests = await Test.find(testQuery).select("_id title section totalMarks");
    const allTestIds = allTests.map(t => t._id);

    const attempts = await Attempt.find({ test: { $in: allTestIds }, user: req.user._id })
        .populate({
            path: "test",
            select: "title section totalMarks",
            populate: { path: "section", select: "title" }
        })
        .sort({ createdAt: -1 });

    const data = attempts.map(a => {
        const correct = a.correctCount || 0;
        const wrong = a.wrongCount || 0;
        const attempted = correct + wrong;
        const maxMarks = a.totalMarks || a.test?.totalMarks || 0;
        const score = a.score ?? 0;

        const accuracy = attempted > 0
            ? Math.round((correct / attempted) * 100)
            : 0;

        const { rank } = calculateRankFromPredictor(score, listing.rankPredictorData);

        return {
            testName: a.test?.title || "Untitled Test",
            category: a.test?.section?.title || "General",
            date: a.createdAt,
            attempted,
            correct,
            wrong,
            maxMarks,
            score,
            rank: rank ?? "--",
            accuracy,
            time: a.duration ?? a.timeTaken ?? "--"
        };
    });

    res.json({ success: true, listingTitle: listing.title, data });
};
 


export const updateStatsVisibility = async (req, res) => {
    const { slug } = req.params;
    const { visibleSectionIds } = req.body;

    const listing = await Listing.findOne({ slug });
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    const allSections = await Section.find({ listing: listing._id });

    await Promise.all(allSections.map(sec => {
        const shouldShow = (visibleSectionIds || []).includes(String(sec._id));
        return Section.findByIdAndUpdate(sec._id, { showInStatsFilter: shouldShow });
    }));

    res.json({ success: true });
};