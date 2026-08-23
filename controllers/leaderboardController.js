import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Test from "../models/Test.js";
import Attempt from "../models/TestAttempt.js";

/* ------------------------------------------------------------------ */
/* Page render — sirf shell + block-check                              */
/* ------------------------------------------------------------------ */
export const getLeaderboard = async (req, res) => {
    const listing = await Listing.findOne({ slug: req.params.slug });
    if (!listing) return res.status(404).send("Series not found");

    const allSections = await Section.find({ listing: listing._id });

    // Sirf owner ne jo sections allow kiye hain, dropdown mein wahi jayenge
    const leaderboardSections = allSections.filter(s => s.showInStatsFilter);

    const { section: sectionId } = req.query;
    let currentSection = null;
    let leaderboardBlocked = false;

    if (sectionId && sectionId !== "all") {
        currentSection = allSections.find(s => String(s._id) === sectionId);
        if (!currentSection || !currentSection.showInStatsFilter) {
            leaderboardBlocked = true;
        }
    }

    res.render("dashboard/leaderboard", {
        layout: "layouts/dashboard",
        currentUser: req.user,
        listing,
        sections: allSections,
        leaderboardSections,
        currentSection,
        isWeakAreaPage: false,
        csrfToken: req.csrfToken(),
        leaderboardBlocked,
        sectionId: sectionId || "all",
        robots: "noindex, nofollow"
    });
};

export const getLeaderboardData = async (req, res) => {
    const listing = await Listing.findOne({ slug: req.params.slug });
    if (!listing) {
        return res.status(404).json({ success: false, message: "Series not found" });
    }

    const { section: sectionId, period } = req.query; // period: 'today' | 'yesterday'

    // ---- Block check yahi bhi zaroori hai (API directly hit ho sakta hai) ----
    if (sectionId && sectionId !== "all") {
        const section = await Section.findOne({ _id: sectionId, listing: listing._id });
        if (!section || !section.showInStatsFilter) {
            return res.status(403).json({
                success: false,
                message: "Leaderboard is not available for this section."
            });
        }
    }

    // ---- Tests fetch karo (section-specific ya poori listing ke) ----
    const testQuery = { listing: listing._id };
    if (sectionId && sectionId !== "all") testQuery.section = sectionId;

    const tests = await Test.find(testQuery).select("_id totalMarks");
    const testIds = tests.map(t => t._id);

    // ---- Date range banao (default = today) ----
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);

    let dateFilter;
    if (period === "yesterday") {
        const startYesterday = new Date(startToday);
        startYesterday.setDate(startYesterday.getDate() - 1);
        dateFilter = { createdAt: { $gte: startYesterday, $lt: startToday } };
    } else {
        dateFilter = { createdAt: { $gte: startToday, $lte: now } };
    }

    // ---- Har student ke saare attempts nikaalo (date-filtered) ----
    const attempts = await Attempt.find({ test: { $in: testIds }, ...dateFilter })
        .populate("user", "name")
        .select("user score correctCount wrongCount duration timeTaken createdAt");

    if (!attempts.length) {
        return res.json({
            success: true,
            podium: [],
            table: [],
            yourRank: null
        });
    }

    // ---- Per-user aggregate: avg score, avg accuracy, total time ----
    const statsByUser = {};

    attempts.forEach(a => {
        if (!a.user) return;
        const uid = String(a.user._id);

        if (!statsByUser[uid]) {
            statsByUser[uid] = {
                userId: uid,
                name: a.user.name || "Student",
                scores: [],
                correct: 0,
                wrong: 0,
                totalTime: 0
            };
        }

        statsByUser[uid].scores.push(a.score || 0);
        statsByUser[uid].correct += a.correctCount || 0;
        statsByUser[uid].wrong += a.wrongCount || 0;
        statsByUser[uid].totalTime += (a.duration ?? a.timeTaken ?? 0);
    });

    // ---- Final leaderboard list banao ----
    let leaderboard = Object.values(statsByUser).map(s => {
        const avgScore = s.scores.reduce((sum, v) => sum + v, 0) / s.scores.length;
        const attempted = s.correct + s.wrong;
        const accuracy = attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0;

        return {
            userId: s.userId,
            name: s.name,
            accuracy,
            totalTime: s.totalTime,
            avgScore: Math.round(avgScore * 100) / 100
        };
    });

    // ---- Rank karo: accuracy zyada = upar, tie pe kam time = upar ----
    leaderboard.sort((a, b) => {
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return a.totalTime - b.totalTime;
    });

    leaderboard = leaderboard.map((entry, idx) => ({
        ...entry,
        rank: idx + 1
    }));

    const podium = leaderboard.slice(0, 3);
    const table = leaderboard.slice(3, 53); // top 50 niche table mein (podium ke baad)

    const yourEntry = leaderboard.find(e => e.userId === String(req.user._id)) || null;

    res.json({
        success: true,
        podium,
        table,
        yourRank: yourEntry
    });
};

/* ------------------------------------------------------------------ */
/* Owner: kaunse sections dropdown mein dikhein, wo update karta hai   */
/* ------------------------------------------------------------------ */
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