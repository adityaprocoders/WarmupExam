import Category from "../models/Category.js";
import Listing from "../models/listing.js";
import Question from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import Test from "../models/Test.js";
import CustomPaperAttempt from "../models/CustomPaperAttempt.js";
import { getCustomTestTier, isPaidCustomTestTier } from "../utils/customTestTier.js";
import CustomTestPricing from "../models/customTestPricing.js";
import mongoose from "mongoose";
import Attempt from "../models/TestAttempt.js";
import { getValidEnrollments } from "../utils/cleanupHelpers.js";
import ExamPatternSummary from "../models/ExamPatternSummary.js";
import Section from "../models/Section.js";
import { getUsageSummary } from "../utils/aiUsageTracker.js";
import { AI_LIMITS } from "../utils/aiLimits.js";


const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const splitList = (v) =>
    String(v || "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 25);

const DIFFS = ["easy", "medium", "hard"];
const FREE_MAX_QUESTIONS = 30;

const WEAK_MIN_ATTEMPTED = 1;   // topic me kam se kam itne attempted questions
const WEAK_MAX_ACCURACY = 65;   // isse kam accuracy = weak


function pickSolution(q, lang) {
    const root = q.solution || {};
    if (root.text || root.image) return { text: root.text || "", image: root.image || null };
    const list = Array.isArray(q.translations) ? q.translations : [];
    const t = (lang && list.find((x) => x.lang === lang))
        || list.find((x) => x.solution && (x.solution.text || x.solution.image));
    return { text: t?.solution?.text || "", image: t?.solution?.image || null };
}


async function userHasPaidListing(user) {
    if (!user) return false;
    if (user.role === "owner") return true;
    const { enrolledIds } = getValidEnrollments(user);
    if (!enrolledIds.length) return false;
    const exists = await Listing.exists({ _id: { $in: enrolledIds }, type: { $ne: "Free" } });
    return !!exists;
}


const normalizeDiff = (v) => {
    const s = String(v || "").toLowerCase();
    if (s.startsWith("easy") || s.includes("basic")) return "easy";
    if (s.startsWith("hard") || s.includes("advance")) return "hard";
    return "medium";
};
const toSchemaDiff = (level) => (level === "easy" ? "Easy" : level === "hard" ? "Hard" : "Medium");

async function getTestIdsForExams({ exams = [], isOwner }) {
    if (!exams.length) return [];
    const listingFilter = { exam: { $in: exams.map((e) => new RegExp(`^${escapeRegex(e)}$`, "i")) } };
    if (!isOwner) listingFilter.visibility = "public";
    const listings = await Listing.find(listingFilter).select("_id").lean();
    if (!listings.length) return [];
    const tests = await Test.find({ listing: { $in: listings.map((l) => l._id) } }).select("_id languages").lean();
    return tests;
}

async function getAllTestIds({ isOwner }) {
    const listingFilter = {};
    if (!isOwner) listingFilter.visibility = "public";
    const listings = await Listing.find(listingFilter).select("_id").lean();
    if (!listings.length) return [];
    const tests = await Test.find({ listing: { $in: listings.map((l) => l._id) } }).select("_id").lean();
    return tests.map((t) => t._id);
}

/* ------------------------------------------------------------
   Shared render helper — free route (layouts/main) vs paid route
   (layouts/dashboard, dashboard-shell ke andar) donon isi se render
   hote hain. isPaid originalUrl ke "/dashboard" prefix se decide hota hai.
------------------------------------------------------------ */

async function buildRenderOptions(req, { title, description, keywords, canonicalUrl, structuredData }) {
    const isPaid = req.originalUrl.startsWith("/dashboard");
    const tier = getCustomTestTier(req);

    const opts = {
        structuredData, title, description, keywords, canonicalUrl,
        robots: isPaid ? "noindex, nofollow" : "index, follow",
        tier,   
        isPaidPage: isPaid,
        customTestExpiresAt: req.user?.customTestExpiresAt || null, 
    };

    if (isPaid) {
        opts.layout = "layouts/dashboard";
        opts.isCustomTestPage = true;
        const now = new Date();
        const activeEnrollment = (req.user.enrolledListings || []).find(
            (e) => e && e.listing && (!e.expiresAt || new Date(e.expiresAt) > now)
        );
        opts.listing = req.user.lastAccessedBatch || (activeEnrollment && activeEnrollment.listing) || null;

        // 👇 असली sections DB से लाओ, hardcoded [] की जगह
        opts.sections = opts.listing
            ? await Section.find({ listing: opts.listing._id }).sort({ createdAt: 1 })
            : [];
        opts.currentSection = null;
    }
    
    opts.canWeakArea = await userHasPaidListing(req.user);
    return opts;
}


/* ------------------------------------------------------------
   GET /custom-test  |  GET /dashboard/custom-test  — wizard page
------------------------------------------------------------ */
export const customTestDashboard = async (req, res, next) => {
    try {
        const isOwner = req.user && req.user.role === "owner";
        const categories = await Category.find({}).sort({ createdAt: -1 }).lean();

        const listingFilter = { category: { $in: categories.map((c) => c._id) } };
        if (!isOwner) listingFilter.visibility = "public";

        const counts = await Listing.aggregate([
            { $match: { ...listingFilter, exam: { $nin: [null, ""] } } },
            { $group: { _id: "$category", exams: { $addToSet: "$exam" } } },
        ]);

        const countMap = {};
        let totalExams = 0;
        counts.forEach((c) => {
            const n = (c.exams || []).filter(Boolean).length;
            countMap[String(c._id)] = n;
            totalExams += n;
        });

        categories.forEach((c) => {
            c.examCount = countMap[String(c._id)] || 0;
            c.disabled = c.examCount === 0;
        });
        categories.sort((a, b) => Number(a.disabled) - Number(b.disabled));

        const availableCategories = categories.filter((c) => !c.disabled);
        const topCategoryNames = availableCategories.slice(0, 6).map((c) => c.name);

        const baseUrl = process.env.BASE_URL || "https://warmupexam.com";
        const canonicalUrl = req.originalUrl.startsWith("/dashboard")
            ? `${baseUrl}/dashboard/custom-test`
            : `${baseUrl}/custom-test`;

        const seoTitle = totalExams
            ? `Custom Practice Test Generator - ${totalExams}+ Exams | WarmupExam`
            : "Custom Practice Test Generator - Build Your Own Mock Test | WarmupExam";

        const seoDescription = topCategoryNames.length
            ? `Create a custom practice paper for ${topCategoryNames.join(", ")} and more. Choose subject, topic, difficulty and question count — get an instant mock test with true negative marking on WarmupExam.`
            : "Create a custom practice paper in seconds — pick subject, topic, difficulty and question count.";

        const seoKeywords = [
            "custom test generator", "custom practice paper", "custom mock test",
            "build your own test", "WarmupExam custom paper", "subject wise mock test",
            "topic wise practice test", "weak area based test", "exam pattern paper",
            ...topCategoryNames.map((n) => `${n} custom test`),
            ...topCategoryNames.map((n) => `${n} mock test`),
        ].join(", ");

        const structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "WarmupExam Custom Practice Test Generator",
            url: canonicalUrl,
            applicationCategory: "EducationApplication",
            description: seoDescription,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        });

        const renderOptions = await buildRenderOptions(req, { title: seoTitle, description: seoDescription, keywords: seoKeywords, canonicalUrl, structuredData });
        renderOptions.categories = categories;

        res.render("pages/custompaper/customTest", renderOptions);
    } catch (err) {
        next(err);
    }
};

/* ------------------------------------------------------------
   GET /custom-test/create  |  GET /dashboard/custom-test/create
   — history/CTA landing page
------------------------------------------------------------ */
export const customTestLanding = async (req, res, next) => {
    try {
        const isOwner = req.user && req.user.role === "owner";
        const categories = await Category.find({}).sort({ createdAt: -1 }).lean();

        const listingFilter = { category: { $in: categories.map((c) => c._id) } };
        if (!isOwner) listingFilter.visibility = "public";

        const counts = await Listing.aggregate([
            { $match: { ...listingFilter, exam: { $nin: [null, ""] } } },
            { $group: { _id: "$category", exams: { $addToSet: "$exam" } } },
        ]);

        const countMap = {};
        counts.forEach((c) => {
            const n = (c.exams || []).filter(Boolean).length;
            countMap[String(c._id)] = n;
        });

        categories.forEach((c) => {
            c.examCount = countMap[String(c._id)] || 0;
            c.disabled = c.examCount === 0;
        });
        categories.sort((a, b) => Number(a.disabled) - Number(b.disabled));

        const baseUrl = process.env.BASE_URL || "https://warmupexam.com";
        const canonicalUrl = req.originalUrl.startsWith("/dashboard")
            ? `${baseUrl}/dashboard/custom-test`
            : `${baseUrl}/custom-test`;

        const seoDescription = "Create free custom mock tests for competitive exams by selecting exams, subjects, topics, difficulty and number of questions.";

        const structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "WarmupExam Custom Paper Generator",
            url: canonicalUrl,
            description: seoDescription,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
        });

        const renderOptions = await buildRenderOptions(req, {
            title: "Custom Paper Generator | WarmupExam",
            description: seoDescription,
            keywords: "free custom paper generator, custom mock test, practice paper generator",
            canonicalUrl,
            structuredData,
        });

        renderOptions.categories = categories;

        res.render("pages/custompaper/customtestcreate", renderOptions);
    } catch (err) {
        next(err);
    }
};

/* ------------------------------------------------------------
   GET /api/custom-test/exams?categoryId=&q=
------------------------------------------------------------ */
export const searchExams = async (req, res) => {
    try {
        const { categoryId, q = "" } = req.query;
        if (!categoryId) return res.json({ exams: [] });
        const isOwner = req.user && req.user.role === "owner";
        const filter = { category: categoryId };
        if (!isOwner) filter.visibility = "public";
        if (q.trim()) filter.exam = new RegExp(escapeRegex(q.trim()), "i");
        const exams = await Listing.distinct("exam", filter);
        res.json({ exams: exams.filter(Boolean).sort().slice(0, 20) });
    } catch (err) {
        console.error("searchExams error:", err);
        res.status(500).json({ exams: [] });
    }
};

/* ------------------------------------------------------------
   GET /api/custom-test/subjects?exams=A|B
------------------------------------------------------------ */
export const getSubjects = async (req, res) => {
    try {
        const exams = splitList(req.query.exams);
        if (!exams.length) return res.json({ subjects: [], languages: [] });
        const isOwner = req.user && req.user.role === "owner";
        const tests = await getTestIdsForExams({ exams, isOwner });
        if (!tests.length) return res.json({ subjects: [], languages: [] });

        const rows = await TestQuestion.aggregate([
            { $match: { test: { $in: tests.map((t) => t._id) } } },
            { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
            { $unwind: "$q" },
            { $match: { "q.status": "Active" } },
            { $group: { _id: "$subject", questions: { $addToSet: "$q._id" } } },
            { $project: { _id: 1, count: { $size: "$questions" } } },
            { $sort: { count: -1 } },
        ]);

        const subjects = rows.filter((r) => r._id).map((r) => ({ name: String(r._id), count: r.count }));
        const languages = Array.from(new Set(tests.flatMap((t) => t.languages || []))).filter(Boolean);
        res.json({ subjects, languages: languages.length ? languages : ["English"] });
    } catch (err) {
        console.error("getSubjects error:", err);
        res.status(500).json({ subjects: [], languages: [] });
    }
};

/* ------------------------------------------------------------
   GET /api/custom-test/topics?exams=A|B&subjects=X|Y
------------------------------------------------------------ */
export const getTopics = async (req, res) => {
    try {
        const exams = splitList(req.query.exams);
        const subjects = splitList(req.query.subjects);
        if (!exams.length || !subjects.length) return res.json({ groups: [] });
        const isOwner = req.user && req.user.role === "owner";
        const tests = await getTestIdsForExams({ exams, isOwner });
        if (!tests.length) return res.json({ groups: [] });

        const rows = await TestQuestion.aggregate([
            { $match: { test: { $in: tests.map((t) => t._id) }, subject: { $in: subjects } } },
            { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
            { $unwind: "$q" },
            { $match: { "q.status": "Active" } },
            { $group: { _id: { subject: "$subject", topic: "$topic" }, questions: { $addToSet: "$q._id" } } },
            { $project: { _id: 1, count: { $size: "$questions" } } },
            { $sort: { count: -1 } },
        ]);

        const map = new Map();
        rows.forEach((r) => {
            const { subject, topic } = r._id;
            if (!subject || !topic) return;
            if (!map.has(subject)) map.set(subject, []);
            map.get(subject).push({ name: topic, count: r.count });
        });

        const groups = subjects.filter((s) => map.has(s)).map((s) => ({ subject: s, topics: map.get(s).slice(0, 60) }));
        res.json({ groups });
    } catch (err) {
        console.error("getTopics error:", err);
        res.status(500).json({ groups: [] });
    }
};

/* ------------------------------------------------------------
   GET /api/custom-test/weak-areas?exams=A
   Sirf valid paid-listing wale user ke liye
------------------------------------------------------------ */
export const getWeakAreas = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "LOGIN_REQUIRED", groups: [] });
        if (!(await userHasPaidListing(req.user))) {
            return res.status(403).json({ error: "PAID_LISTING_REQUIRED", groups: [] });
        }

        const exams = splitList(req.query.exams);
        if (!exams.length) return res.json({ groups: [] });

        const listings = await Listing.find({
            exam: { $in: exams.map((e) => new RegExp(`^${escapeRegex(e)}$`, "i")) },
        }).select("_id").lean();
        if (!listings.length) return res.json({ groups: [] });

        const attempts = await Attempt.find({
            user: req.user._id,
            listing: { $in: listings.map((l) => l._id) },
        }).select("test answers.question answers.selectedOptions answers.numericAnswer").lean();
        if (!attempts.length) return res.json({ groups: [] });

        const testIds = [...new Set(attempts.map((a) => String(a.test)))];
        const qIds = [...new Set(attempts.flatMap((a) => a.answers.map((x) => String(x.question))))];

        const [qDocs, mappings] = await Promise.all([
            Question.find({ _id: { $in: qIds } }).select("type correctAnswers numericAnswer").lean(),
            TestQuestion.find({ test: { $in: testIds }, question: { $in: qIds } })
                .select("test question subject topic").lean(),
        ]);
        const qMap = new Map(qDocs.map((q) => [String(q._id), q]));
        const tqMap = new Map(mappings.map((m) => [`${m.test}_${m.question}`, m]));

        const stats = new Map();
        attempts.forEach((att) => {
            att.answers.forEach((a) => {
                const q = qMap.get(String(a.question));
                const tq = tqMap.get(`${att.test}_${a.question}`);
                if (!q || !tq || !tq.subject || !tq.topic) return;

                let attempted, isCorrect;
                if (q.type === "integer") {
                    attempted = a.numericAnswer !== null && a.numericAnswer !== undefined;
                    isCorrect = attempted && Number(a.numericAnswer) === Number(q.numericAnswer);
                } else {
                    const sel = a.selectedOptions || [];
                    const correct = q.correctAnswers || [];
                    attempted = sel.length > 0;
                    isCorrect = attempted && sel.length === correct.length && sel.every((i) => correct.includes(i));
                }
                if (!attempted) return;

                const key = `${tq.subject}||${tq.topic}`;
                if (!stats.has(key)) stats.set(key, { subject: tq.subject, topic: tq.topic, attempted: 0, correct: 0 });
                const s = stats.get(key);
                s.attempted += 1;
                if (isCorrect) s.correct += 1;
            });
        });

        const bySubject = new Map();
        [...stats.values()].forEach((s) => {
            const accuracy = Math.round((s.correct / s.attempted) * 100);
            if (s.attempted < WEAK_MIN_ATTEMPTED || accuracy >= WEAK_MAX_ACCURACY) return;
            if (!bySubject.has(s.subject)) bySubject.set(s.subject, []);
            bySubject.get(s.subject).push({ name: s.topic, accuracy, attempted: s.attempted });
        });

        const groups = [...bySubject.entries()]
            .map(([subject, topics]) => ({ subject, topics: topics.sort((a, b) => a.accuracy - b.accuracy) }))
            .sort((a, b) => a.topics[0].accuracy - b.topics[0].accuracy);

        res.json({ groups });
    } catch (err) {
        console.error("getWeakAreas error:", err);
        res.status(500).json({ groups: [] });
    }
};

/* ------------------------------------------------------------
   GET /api/custom-test/patterns?exams=A
   Exam ke real tests se pattern nikalta hai (Pro / Pro Max only)
------------------------------------------------------------ */
 export const getPatterns = async (req, res) => {
    try {
        if (!isPaidCustomTestTier(getCustomTestTier(req))) {
            return res.status(403).json({ error: "UPGRADE_REQUIRED", pattern: null });
        }
        const exams = splitList(req.query.exams);
        const categoryId = req.query.categoryId;
        if (!exams.length || !categoryId) return res.json({ pattern: null });

        const doc = await ExamPatternSummary.findOne({ category: categoryId, exam: exams[0] }).lean();
        if (!doc) return res.json({ pattern: null });

        res.json({ pattern: doc });
    } catch (err) {
        console.error("getPatterns error:", err);
        res.status(500).json({ pattern: null });
    }
};

/* ---- Exam pattern paper generator — ExamPatternSummary se driven ---- */
async function sampleQuestionsByDiff(testIds, subject, topics, level, size, excludeIds) {
    if (size <= 0) return [];
    const match = { test: { $in: testIds }, subject };
    if (topics && topics.length) match.topic = { $in: topics };

    return TestQuestion.aggregate([
        { $match: match },
        { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
        { $unwind: "$q" },
        { $match: { "q.status": "Active", "q.difficulty": toSchemaDiff(level), "q._id": { $nin: excludeIds } } },
        {
            $group: {
                _id: "$q._id", subject: { $first: "$subject" }, topic: { $first: "$topic" },
                positiveMarks: { $first: "$positiveMarks" }, negativeMarks: { $first: "$negativeMarks" },
                q: { $first: "$q" },
            },
        },
        { $sample: { size } },
    ]);
}

async function generateExamPatternPaper(req, res) {
    try {
        if (!isPaidCustomTestTier(getCustomTestTier(req))) {
            return res.status(403).json({ success: false, error: "UPGRADE_REQUIRED", requiredTier: "pro" });
        }
        const { exams = [], categoryId, topicSelections = {}, difficulty = { easy: 25, medium: 50, hard: 25 } } = req.body || {};
        if (!exams.length || !categoryId) {
            return res.status(400).json({ success: false, message: "Exam or category is missing." });
        }

        const pctSum = DIFFS.reduce((s, k) => s + (Number(difficulty[k]) || 0), 0);
        if (pctSum !== 100) {
            return res.status(400).json({ success: false, message: "Difficulty percentages must add up to 100%." });
        }

        const patternDoc = await ExamPatternSummary.findOne({ category: categoryId, exam: exams[0] }).lean();
        if (!patternDoc || !patternDoc.rows || !patternDoc.rows.length) {
            return res.status(404).json({ success: false, message: "No pattern is configured for this exam." });
        }

        const isOwner = req.user && req.user.role === "owner";
        const examTests = await getTestIdsForExams({ exams, isOwner });
        const examTestIds = examTests.map((t) => t._id);
        const allTestIds = await getAllTestIds({ isOwner });

        const picked = [];
        const marksBySubject = {};
        patternDoc.rows.forEach((r) => {
            marksBySubject[r.subject] = { positiveMarks: r.positiveMarks, negativeMarks: r.negativeMarks };
        });

        for (const row of patternDoc.rows) {
            const totalNeed = row.questions || 0;
            if (totalNeed <= 0) continue;

            const want = {
                easy: Math.round((Number(difficulty.easy) / 100) * totalNeed),
                medium: Math.round((Number(difficulty.medium) / 100) * totalNeed),
                hard: 0,
            };
            want.hard = Math.max(0, totalNeed - want.easy - want.medium);

            const selectedTopics = Array.isArray(topicSelections[row.subject]) ? topicSelections[row.subject] : [];
            const excludeIds = () => picked.map((p) => p._id);

            for (const level of DIFFS) {
                let need = want[level];
                if (need <= 0) continue;

                let got = [];

                if (selectedTopics.length) {
                    // Step 1: selected topics + is difficulty, exam ke tests se
                    got = await sampleQuestionsByDiff(examTestIds, row.subject, selectedTopics, level, need, excludeIds());
                    got.forEach((r) => picked.push(r));

                    // Step 2: kami — same subject baaki topics, same difficulty, exam ke tests se
                    if (got.length < need) {
                        const more = await sampleQuestionsByDiff(examTestIds, row.subject, [], level, need - got.length, excludeIds());
                        more.forEach((r) => picked.push(r));
                        got = got.concat(more);
                    }
                } else {
                    // Auto — poore subject se, isi difficulty, exam ke tests se
                    got = await sampleQuestionsByDiff(examTestIds, row.subject, [], level, need, excludeIds());
                    got.forEach((r) => picked.push(r));
                }

                // Step 3: phir bhi kami — same subject, same difficulty, kisi bhi exam ke tests se
                if (got.length < need && allTestIds.length) {
                    const more2 = await sampleQuestionsByDiff(allTestIds, row.subject, [], level, need - got.length, excludeIds());
                    more2.forEach((r) => picked.push(r));
                }
            }
        }

        if (!picked.length) {
            return res.status(404).json({ success: false, message: "No questions were found for this pattern." });
        }

        const requested = patternDoc.rows.reduce((s, r) => s + (r.questions || 0), 0);
        const questions = picked.map((r, i) => {
            const m = marksBySubject[r.subject] || { positiveMarks: r.positiveMarks, negativeMarks: r.negativeMarks };
            return {
                _id: String(r._id), index: i + 1,
                question: r.q.question, questionImage: r.q.questionImage || null,
                options: r.q.options || [], correctAnswers: r.q.correctAnswers || [],
                numericAnswer: r.q.numericAnswer ?? null, solution: pickSolution(r.q),
                languageMode: r.q.languageMode || "single", translations: r.q.translations || [],
                type: r.q.type || "mcq", subject: r.subject || "", topic: r.topic || "",
                difficulty: normalizeDiff(r.q.difficulty), marks: m.positiveMarks ?? 1, negativeMarks: m.negativeMarks ?? 0,
            };
        });

        const delivered = questions.length;
        const paperId = `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const timeStrategy = patternDoc.timeStrategy === "sectional" ? "sectional" : "total";

        const responsePayload = {
            success: true, paperId,
            requested, delivered, shortfall: delivered < requested,
            questions, timeStrategy,
        };

        if (timeStrategy === "sectional") {
            responsePayload.subjectTime = patternDoc.sectionTime || [];
            responsePayload.timeLimit = (patternDoc.sectionTime || []).reduce((s, st) => s + (Number(st.duration) || 0), 0);
        } else {
            responsePayload.timeLimit = patternDoc.totalDuration || Math.max(5, Math.round(delivered * 0.75));
        }

        res.json(responsePayload);
    } catch (err) {
        console.error("generateExamPatternPaper error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
}


/* ------------------------------------------------------------
   POST /api/custom-test/availability
------------------------------------------------------------ */
export const getAvailability = async (req, res) => {
    try {
        const { exams = [], subjects = [], topics = [] } = req.body || {};
        if (!exams.length || !subjects.length) return res.json({ total: 0, byDifficulty: { easy: 0, medium: 0, hard: 0 } });

        const isOwner = req.user && req.user.role === "owner";
        const tests = await getTestIdsForExams({ exams, isOwner });
        if (!tests.length) return res.json({ total: 0, byDifficulty: { easy: 0, medium: 0, hard: 0 } });

        const tqMatch = { test: { $in: tests.map((t) => t._id) }, subject: { $in: subjects } };
        if (topics.length) tqMatch.topic = { $in: topics };

        const rows = await TestQuestion.aggregate([
            { $match: tqMatch },
            { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
            { $unwind: "$q" },
            { $match: { "q.status": "Active" } },
            { $group: { _id: { diff: "$q.difficulty", qid: "$q._id" } } },
            { $group: { _id: "$_id.diff", count: { $sum: 1 } } },
        ]);

        const byDifficulty = { easy: 0, medium: 0, hard: 0 };
        let total = 0;
        rows.forEach((r) => { byDifficulty[normalizeDiff(r._id)] += r.count; total += r.count; });
        res.json({ total, byDifficulty });
    } catch (err) {
        console.error("getAvailability error:", err);
        res.status(500).json({ total: 0, byDifficulty: { easy: 0, medium: 0, hard: 0 } });
    }
};

/* ------------------------------------------------------------
   POST /api/custom-test/generate
   Free: max 50 questions, browser storage only.
   Pro: no cap, browser storage only.
   Pro+: no cap, DB me 24hr ke liye bhi save hota hai (cross-device).
------------------------------------------------------------ */
export const generatePaper = async (req, res) => {
    try {
        const {
            exams = [], subjects = [], topics = [],
            difficulty = { easy: 25, medium: 50, hard: 25 },
            questionCount, timeLimit, options = {}, mode = "custom",
        } = req.body || {};

        if (mode === "examPattern") return generateExamPatternPaper(req, res);
if (mode === "weakArea" && !(await userHasPaidListing(req.user))) {
    return res.status(403).json({ success: false, error: "PAID_LISTING_REQUIRED", message: "An active paid test-series enrollment is required for Weak Area Mode." });
}

        const tier = getCustomTestTier(req);
        const paid = isPaidCustomTestTier(tier);
        const total = Number(questionCount);

        if (!exams.length || !subjects.length || !total || total < 1) {
            return res.status(400).json({ success: false, message: "Your selection is incomplete." });
        }
        if (!paid && total > FREE_MAX_QUESTIONS) {
            return res.status(403).json({
                success: false,
                error: "UPGRADE_REQUIRED",
                requiredTier: "pro",
                message: `The Free plan allows up to ${FREE_MAX_QUESTIONS} questions. Upgrade to Pro for more.`,
            });
        }

        const pctSum = DIFFS.reduce((s, k) => s + (Number(difficulty[k]) || 0), 0);
        if (pctSum !== 100) {
            return res.status(400).json({ success: false, message: "Difficulty percentages must total 100%." });
        }

        const want = {
            easy: Math.round((Number(difficulty.easy) / 100) * total),
            medium: Math.round((Number(difficulty.medium) / 100) * total),
            hard: 0,
        };
        want.hard = Math.max(0, total - want.easy - want.medium);

        const isOwner = req.user && req.user.role === "owner";
        const tests = await getTestIdsForExams({ exams, isOwner });
        if (!tests.length) {
            return res.status(404).json({ success: false, message: "No tests are available for this exam." });
        }
        const testIds = tests.map((t) => t._id);
        const topicFilter = topics.length ? { topic: { $in: topics } } : {};

        const picked = [];
        const seen = new Set();

        // STEP 1: exact exam+subject+topic, difficulty-wise, random
        for (const level of DIFFS) {
            if (!want[level]) continue;
            const rows = await TestQuestion.aggregate([
                { $match: { test: { $in: testIds }, subject: { $in: subjects }, ...topicFilter } },
                { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
                { $unwind: "$q" },
                { $match: { "q.status": "Active", "q.difficulty": toSchemaDiff(level) } },
                {
                    $group: {
                        _id: "$q._id", subject: { $first: "$subject" }, topic: { $first: "$topic" },
                        positiveMarks: { $first: "$positiveMarks" }, negativeMarks: { $first: "$negativeMarks" },
                        q: { $first: "$q" },
                    },
                },
                { $sample: { size: want[level] } },
            ]);
            rows.forEach((r) => { if (!seen.has(String(r._id))) { seen.add(String(r._id)); picked.push(r); } });
        }

        // ---------------- STEP 2: shortfall fill (exam ka bandhan nahi, difficulty match rehta hai) ----------------
        if (picked.length < total) {
            const allTestIds = await getAllTestIds({ isOwner });

            if (allTestIds.length) {
                // Har difficulty-bucket ki apni kami khud calculate karo:
                // want[level] - us bucket me abhi tak kitne pick ho chuke — utna hi fill karna hai
                const pickedByDiff = { easy: 0, medium: 0, hard: 0 };
                picked.forEach((r) => { pickedByDiff[normalizeDiff(r.q.difficulty)]++; });

                for (const level of DIFFS) {
                    const need = want[level] - pickedByDiff[level];
                    if (need <= 0) continue;

                    // 2a: same subject + same topic + same difficulty, kisi bhi exam ka
                    const fillA = await TestQuestion.aggregate([
                        { $match: { test: { $in: allTestIds }, subject: { $in: subjects }, ...topicFilter } },
                        { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
                        { $unwind: "$q" },
                        { $match: { "q.status": "Active", "q.difficulty": toSchemaDiff(level), "q._id": { $nin: picked.map((p) => p._id) } } },
                        {
                            $group: {
                                _id: "$q._id", subject: { $first: "$subject" }, topic: { $first: "$topic" },
                                positiveMarks: { $first: "$positiveMarks" }, negativeMarks: { $first: "$negativeMarks" },
                                q: { $first: "$q" },
                            },
                        },
                        { $sample: { size: need } },
                    ]);
                    fillA.forEach((r) => picked.push(r));

                    // 2b: agar 2a ke baad bhi kami rahe — sirf topic + same difficulty (subject bhi drop), kisi bhi exam
                    const stillNeed = need - fillA.length;
                    if (stillNeed > 0 && topicFilter.topic) {
                        const fillB = await TestQuestion.aggregate([
                            { $match: { test: { $in: allTestIds }, ...topicFilter } },
                            { $lookup: { from: "questions", localField: "question", foreignField: "_id", as: "q" } },
                            { $unwind: "$q" },
                            { $match: { "q.status": "Active", "q.difficulty": toSchemaDiff(level), "q._id": { $nin: picked.map((p) => p._id) } } },
                            {
                                $group: {
                                    _id: "$q._id", subject: { $first: "$subject" }, topic: { $first: "$topic" },
                                    positiveMarks: { $first: "$positiveMarks" }, negativeMarks: { $first: "$negativeMarks" },
                                    q: { $first: "$q" },
                                },
                            },
                            { $sample: { size: stillNeed } },
                        ]);
                        fillB.forEach((r) => picked.push(r));
                    }
                }
            }
        }

        if (!picked.length) {
            return res.status(404).json({ success: false, message: "No questions match your current selection." });
        }

        if (options.smartRandomization !== false) {
            for (let i = picked.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [picked[i], picked[j]] = [picked[j], picked[i]];
            }
        }

        const questions = picked.slice(0, total).map((r, i) => ({
            _id: String(r._id), index: i + 1,
            question: r.q.question, questionImage: r.q.questionImage || null,
            options: r.q.options || [], correctAnswers: r.q.correctAnswers || [],
            numericAnswer: r.q.numericAnswer ?? null, solution: pickSolution(r.q),
            languageMode: r.q.languageMode || "single", translations: r.q.translations || [],
            type: r.q.type || "mcq", subject: r.subject || "", topic: r.topic || "",
            difficulty: normalizeDiff(r.q.difficulty), marks: r.positiveMarks ?? 1, negativeMarks: r.negativeMarks ?? 0,
        }));

        const delivered = questions.length;
        const paperId = `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const finalTimeLimit = Number(timeLimit) || Math.max(5, Math.round(delivered * 0.75));


        res.json({
            success: true, paperId, timeLimit: finalTimeLimit,
            requested: total, delivered, shortfall: delivered < total,
            questions,
        });
 
    } catch (err) {
        console.error("generatePaper error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

 
/* ------------------------------------------------------------
   GET /custom-test/attempt/:paperId | /dashboard/custom-test/attempt/:paperId
------------------------------------------------------------ */
export const customTestAttempt = async (req, res, next) => {
    try {
        const isPaid = req.originalUrl.startsWith("/dashboard");
        const tier = getCustomTestTier(req);
        res.render("pages/custompaper/customAttempt", {
            layout: false,    
            paperId: req.params.paperId,
            returnUrl: req.query.from || (isPaid ? "/dashboard/custom-test" : "/custom-test"),
            title: "Custom Practice Paper | WarmupExam",
            robots: "noindex, nofollow",
            tier,
        });
    } catch (err) {
        next(err);
    }
};

export const customTestAnalysisPage = async (req, res, next) => {
    try {
        const isPaid = req.originalUrl.startsWith("/dashboard");
        const tier = getCustomTestTier(req);   // 👈 NAYA
        res.render("pages/custompaper/customAnalysis", {
            layout: false,
            paperId: req.params.paperId,
            returnUrl: req.query.from || (isPaid ? "/dashboard/custom-test" : "/custom-test"),
            title: "Custom Practice Paper - Analysis | WarmupExam",
            robots: "noindex, nofollow",
            tier,   
                        userName: (req.user && req.user.name) || "",
        });
    } catch (err) {
        next(err);
    }
};





/* ------------------------------------------------------------
   POST /api/custom-test/attempt/:paperId/submit — Pro+ ka attempt DB me save
------------------------------------------------------------ */
export const submitCustomPaperAttempt = async (req, res) => {
    try {
        const tier = getCustomTestTier(req);
        if (tier === "free") {
            return res.json({ success: true, stored: false });
        }

        const { paperId } = req.params;
        const result = req.body || {};
        if (!Array.isArray(result.perQuestion) || !result.perQuestion.length) {
            return res.status(400).json({ success: false, message: "Result data missing." });
        }

        const answers = result.perQuestion.map((p) => ({
            index: p.index ?? 0,
            questionId: p.questionId || "",
            subject: p.subject || "",
            topic: p.topic || "",
            difficulty: p.difficulty || "",
            type: p.type || "mcq",
            selected: p.selected,
            numericValue: p.numericValue,
            correctAnswers: Array.isArray(p.correctAnswers) ? p.correctAnswers : [],
            numericAnswer: p.numericAnswer ?? null,
            answered: !!p.answered,
            isCorrect: !!p.isCorrect,
            marks: p.marks,
            negativeMarks: p.negativeMarks,
            questionText: p.questionText || "",
            questionImage: p.questionImage || null,
            options: p.options || [],
            solutionText: p.solutionText || "",
            solutionImage: p.solutionImage || null,
        }));

        const expiryHours = tier === "promax" ? 48 : 24;

        await CustomPaperAttempt.deleteOne({ user: req.user._id, paperId });

        const attempt = await CustomPaperAttempt.create({
            paperId, user: req.user._id,
            language: result.language || "English",
                        title: String((Array.isArray(result.config?.exams) ? result.config.exams.join(", ") : "") || "").slice(0, 120),
            source: String(paperId).startsWith("ai_") ? "ai" : "manual",
            subjects: (Array.isArray(result.config?.subjects) && result.config.subjects.length
                ? result.config.subjects
                : Object.keys(result.bySubject || {})).map(String).slice(0, 10),
            answers,
            score: result.score, totalMarks: result.totalMarks, totalQuestions: result.totalQuestions,
            attempted: result.attempted, correct: result.correct, wrong: result.wrong,
            accuracy: result.accuracy, timeTakenSeconds: result.timeTakenSeconds,
            bySubject: result.bySubject,
            timeLimitSeconds: Number(result.timeLimitSeconds) || 0,
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
        });

        res.json({ success: true, stored: true, attemptId: attempt._id });
    } catch (err) {
        console.error("submitCustomPaperAttempt error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};



function resolveForLang(q, lang) {
    if (q.languageMode === "multiple" && Array.isArray(q.translations) && q.translations.length) {
        const t = q.translations.find((x) => x.lang === lang) || q.translations[0];
        return {
            question: t.question || q.question,
            questionImage: t.questionImage ?? q.questionImage ?? null,
            options: (t.options && t.options.length) ? t.options : (q.options || []),
            solution: pickSolution(q, lang),
        };
    }
    return {
        question: q.question,
        questionImage: q.questionImage || null,
        options: q.options || [],
        solution: pickSolution(q, lang),
    };
}

/* ------------------------------------------------------------
   GET /api/custom-test/attempt/:paperId/analysis — Pro+ ka cross-device analysis
------------------------------------------------------------ */
export const getCustomPaperAnalysis = async (req, res) => {
    try {
        const { paperId } = req.params;
        const attempt = await CustomPaperAttempt.findOne({ paperId, user: req.user._id }).lean();
        if (!attempt) return res.status(404).json({ success: false, message: "This attempt was not found or has expired." });

        res.json({
            success: true, paperId,
            score: attempt.score, totalMarks: attempt.totalMarks, totalQuestions: attempt.totalQuestions,
            attempted: attempt.attempted, correct: attempt.correct, wrong: attempt.wrong,
            accuracy: attempt.accuracy, timeTakenSeconds: attempt.timeTakenSeconds,
            bySubject: attempt.bySubject || {},
            title: attempt.title || "", subjects: attempt.subjects || [], language: attempt.language,
            submittedAt: attempt.createdAt, timeLimitSeconds: attempt.timeLimitSeconds || 0,
            perQuestion: attempt.answers || [],
        });
    } catch (err) {
        console.error("getCustomPaperAnalysis error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};


export const deleteCustomPaperAttempt = async (req, res) => {
    try {
        const r = await CustomPaperAttempt.deleteOne({ user: req.user._id, paperId: req.params.paperId });
        res.json({ success: true, deleted: r.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
};

export const clearCustomPaperAttempts = async (req, res) => {
    try {
        const r = await CustomPaperAttempt.deleteMany({ user: req.user._id });
        res.json({ success: true, deleted: r.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error." });
    }
};


/* ------------------------------------------------------------
   GET /api/custom-test/dashboard-stats?limit=7|15|all — Pro / Pro Max
------------------------------------------------------------ */
const STRONG_MIN_ACCURACY = 70;

export const getCustomDashboardStats = async (req, res) => {
    try {
        const tier = getCustomTestTier(req);
        if (!isPaidCustomTestTier(tier)) {
            return res.status(403).json({ success: false, error: "UPGRADE_REQUIRED" });
        }

        const rawLimit = String(req.query.limit || "7");
        const limit = rawLimit === "all" ? 0 : Math.min(Math.max(parseInt(rawLimit, 10) || 7, 1), 50);

        let query = CustomPaperAttempt.find({ user: req.user._id })
            .select("paperId title source subjects bySubject score totalMarks accuracy createdAt answers.subject answers.topic answers.difficulty answers.answered answers.isCorrect")
            .sort({ createdAt: -1 });
        if (limit) query = query.limit(limit);
        const attempts = await query.lean();

        const pct = (a) => (a.totalMarks > 0 ? Math.max(0, Math.round((a.score / a.totalMarks) * 100)) : 0);
        const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0);
        const isAi = (id) => String(id).startsWith("ai_");
        const diffKey = (v) => {
            const d = String(v || "").toLowerCase();
            return d === "easy" || d === "medium" || d === "hard" ? d : null;
        };

        // Topic-wise and subject-wise stats across the selected attempts
        const topicMap = new Map();
        const subjectMap = new Map();

        attempts.forEach((a) => (a.answers || []).forEach((ans) => {
            const subject = ans.subject || "General";
            const name = ans.topic || subject;
            const key = `${subject}||${name}`;

            if (!topicMap.has(key)) {
                topicMap.set(key, {
                    name, subject, total: 0, attempted: 0, correct: 0,
                    diff: { easy: { attempted: 0, correct: 0 }, medium: { attempted: 0, correct: 0 }, hard: { attempted: 0, correct: 0 } },
                });
            }
            if (!subjectMap.has(subject)) subjectMap.set(subject, { name: subject, attempted: 0, correct: 0 });

            const t = topicMap.get(key);
            const s = subjectMap.get(subject);
            t.total += 1;
            if (!ans.answered) return;

            t.attempted += 1; s.attempted += 1;
            if (ans.isCorrect) { t.correct += 1; s.correct += 1; }

            const dk = diffKey(ans.difficulty);
            if (dk) {
                t.diff[dk].attempted += 1;
                if (ans.isCorrect) t.diff[dk].correct += 1;
            }
        }));

        const topics = [...topicMap.values()]
            .filter((t) => t.attempted >= WEAK_MIN_ATTEMPTED)
            .map((t) => ({
                ...t,
                wrong: t.attempted - t.correct,
                skipped: t.total - t.attempted,
                accuracy: Math.round((t.correct / t.attempted) * 100),
            }));

        const strongTopics = topics.filter((t) => t.accuracy >= STRONG_MIN_ACCURACY).sort((a, b) => b.accuracy - a.accuracy);
        // Weakest first; if accuracy ties, the topic with more wrong answers comes first
        const weakTopics = topics.filter((t) => t.accuracy < WEAK_MAX_ACCURACY)
            .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);
        // Weakest subject first
        const subjects = [...subjectMap.values()]
            .filter((s) => s.attempted > 0)
            .map((s) => ({ ...s, accuracy: Math.round((s.correct / s.attempted) * 100) }))
            .sort((a, b) => a.accuracy - b.accuracy);

        res.json({
            success: true,
            totals: {
                testsAttempted: attempts.length,
                avgScore: avg(attempts.map(pct)),
                accuracy: avg(attempts.map((a) => a.accuracy || 0)),
                strongTopics: strongTopics.length,
            },
            trend: attempts.slice().reverse().map((a) => ({
                paperId: a.paperId, date: a.createdAt,
                accuracy: Math.round(a.accuracy || 0), scorePercent: pct(a),
            })),
            strongTopics: strongTopics.slice(0, 5),
            weakTopics: weakTopics.slice(0, 5),
            subjects,
            recent: attempts.slice(0, 10).map((a) => ({
                paperId: a.paperId,
                title: a.title || (isAi(a.paperId) ? "AI Generated Paper" : "Custom Paper"),
                source: a.source || (isAi(a.paperId) ? "ai" : "manual"),
                subjects: a.subjects && a.subjects.length ? a.subjects : Object.keys(a.bySubject || {}),
                score: a.score, totalMarks: a.totalMarks, date: a.createdAt,
            })),
        });
    } catch (err) {
        console.error("getCustomDashboardStats error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// ---------------- UPGRADE TO PRO PAGE ----------------
export const customTestUpgradePage = async (req, res) => {
    try {
        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();

        const pro = (pricingDoc?.pro || []).sort((a, b) => a.months - b.months);
        const promax = (pricingDoc?.promax || []).sort((a, b) => a.months - b.months);

        res.render("pages/custompaper/upgrade", {
    pro,
    promax,
    activePlan: ["pro", "promax"].includes(req.query.plan) ? req.query.plan : "pro",
    currentTier: req.user?.customTestTier || "free",
    returnUrl: req.query.returnTo || "/custom-test",
    title: "Upgrade Your Plan | WarmupExam",
    robots: "noindex, nofollow"
});
    } catch (err) {
        console.error("Upgrade page error:", err);
        req.flash("error", "Unable to load pricing details. Please try again.");
        res.redirect("/custom-test");
    }
};

// ---------------- PUBLIC PRICING (modal ke liye, JSON) ----------------
export const getCustomTestPricingPublic = async (req, res) => {
    try {
        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();
        res.json({
            success: true,
            pro: (pricingDoc?.pro || []).sort((a, b) => a.months - b.months),
            promax: (pricingDoc?.promax || []).sort((a, b) => a.months - b.months),
        });
    } catch (err) {
        console.error("Public pricing error:", err);
        res.status(500).json({ success: false, message: "Failed to load pricing." });
    }
};

// ---------------- STANDALONE PRICING PAGE (GET /pricing) ----------------
export const pricingPage = async (req, res) => {
    try {
        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();
        const baseUrl = process.env.BASE_URL || "https://warmupexam.com";

        let backUrl = req.query.from;
        if (!backUrl) {
            const referer = req.get("referer");
            if (referer && referer.startsWith(baseUrl)) {
                backUrl = referer.replace(baseUrl, "");
            }
        }
        if (!backUrl || !backUrl.startsWith("/")) backUrl = "/custom-test";

        const proPrice = pricingDoc?.pro?.find(r => r.months === 1)?.price ?? 299;
        const promaxPrice = pricingDoc?.promax?.find(r => r.months === 1)?.price ?? 699;
        const canonicalUrl = `${baseUrl}/pricing`;

        const structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "WarmupExam Custom Test Plans",
            description: "Custom mock test generator subscription plans — Free, Pro and Pro Max.",
            offers: [
                { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR", url: canonicalUrl },
                { "@type": "Offer", name: "Pro", price: String(proPrice), priceCurrency: "INR", url: canonicalUrl },
                { "@type": "Offer", name: "Pro Max", price: String(promaxPrice), priceCurrency: "INR", url: canonicalUrl },
            ],
        });

        res.render("pages/custompaper/pricing", {
            AL: AI_LIMITS,
            proPrice,
            promaxPrice,
            backUrl,
            title: "Pricing | WarmupExam",
            description: "Choose the Custom Test plan that fits your preparation — Free, Pro, or Pro Max.",
            canonicalUrl,
            structuredData,
            robots: "index, follow",
        });
    } catch (err) {
        console.error("Pricing page error:", err);
        res.redirect("/custom-test");
    }
};



/* ------------------------------------------------------------
   GET /custom-test/ai-generate | /dashboard/custom-test/ai-generate
------------------------------------------------------------ */
export const aiGeneratorPage = async (req, res, next) => {
    try {
        const baseUrl = process.env.BASE_URL || "https://warmupexam.com";
        const canonicalUrl = req.originalUrl.startsWith("/dashboard")
            ? `${baseUrl}/custom-test/ai-generate`
            : `${baseUrl}/custom-test/ai-generate`;

        const seoDescription = "Generate a custom practice paper using AI from images, PDF, or pasted text — upload your notes and get an instant mock test.";

        const structuredData = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "WarmupExam AI Question Generator",
            url: canonicalUrl,
            description: seoDescription,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR", availability: "https://schema.org/InStock" },
        });

        const renderOptions = await buildRenderOptions(req, {
            title: "AI Question Import & Paper Generator | WarmupExam",
            description: seoDescription,
            keywords: "ai question generator, ai custom paper, ai mock test from pdf, ai practice paper generator",
            canonicalUrl,
            structuredData,
        });

        res.render("pages/custompaper/aiGenerator", renderOptions);
    } catch (err) {
        next(err);
    }
};




/* ------------------------------------------------------------
   GET /custom-test/manage | /dashboard/custom-test/manage
------------------------------------------------------------ */
export const manageplanPage = async (req, res, next) => {
    try {
        const isPaid = req.originalUrl.startsWith("/dashboard");
        const tier = getCustomTestTier(req);
        const pricingDoc = await CustomTestPricing.findOne({ key: "default" }).lean();

        const pro = (pricingDoc?.pro || []).sort((a, b) => a.months - b.months);
        const promax = (pricingDoc?.promax || []).sort((a, b) => a.months - b.months);

               const currentPrice = tier === "pro"
            ? (pro.find(r => r.months === 1)?.price ?? 299)
            : tier === "promax"
                ? (promax.find(r => r.months === 1)?.price ?? 699)
                : 0;

        const expiresAt = req.user?.customTestExpiresAt || null;
        let daysRemaining = null;
        if (expiresAt) {
            const diffMs = new Date(expiresAt) - new Date();
            daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }

        // Real usage — AIUsage collection se, live/dynamic, sab tiers (Free bhi) ke liye
        const summary = await getUsageSummary(req.user._id, tier);
         const usage = {
            aiQuestions: { used: summary.questionsUsed, limit: summary.questionsLimit },
            requests: { used: summary.apiCallsUsed, limit: summary.apiCallsLimit },
            text: { used: summary.textCharsUsed, limit: summary.textCharsLimit },
            images: { used: summary.imagesUsed, limit: summary.imagesLimit },
            pdf: { used: summary.pdfMBUsed, limit: summary.pdfMBLimit },
        };

        const renderOpts = {
    isPaidPage: isPaid,
    isCustomTestPage: true,
    tier,
    currentPrice,
    expiresAt,
    daysRemaining,
    usage,
    limits: summary.limits,
    returnUrl: isPaid ? "/dashboard/custom-test" : "/custom-test",
    title: "Manage Plan | WarmupExam",
    robots: "noindex, nofollow",
};

if (isPaid) {
    renderOpts.layout = "layouts/dashboard";

    const now = new Date();
    const activeEnrollment = (req.user.enrolledListings || []).find(
        (e) => e && e.listing && (!e.expiresAt || new Date(e.expiresAt) > now)
    );
    renderOpts.listing = req.user.lastAccessedBatch || (activeEnrollment && activeEnrollment.listing) || null;
    renderOpts.sections = renderOpts.listing
        ? await Section.find({ listing: renderOpts.listing._id }).sort({ createdAt: 1 })
        : [];
    renderOpts.currentSection = null;
}

res.render("pages/custompaper/managePlan", renderOpts);
    } catch (err) {
        next(err);
    }
};

/* ------------------------------------------------------------
   POST /api/custom-test/manage/toggle-auto-renew
------------------------------------------------------------ */
export const toggleAutoRenew = async (req, res) => {
    try {
        const current = req.user.customTestAutoRenew !== false;
        req.user.customTestAutoRenew = !current;
        await req.user.save();
        res.json({ success: true, autoRenew: req.user.customTestAutoRenew });
    } catch (err) {
        console.error("toggleAutoRenew error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

 



