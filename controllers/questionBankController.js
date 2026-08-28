import Listing from "../models/listing.js";
import Question, { computeContentHash } from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import QuestionReport from "../models/QuestionReport.js";
import User from "../models/usersShema.js";

function getQuestionDisplayText(q) {
    if (q.languageMode === "multiple") {
        const withText = (q.translations || []).find(t => t.question?.trim());
        return withText?.question || "";
    }
    return q.question || "";
}

async function attachUsedInAndReports(questions) {
    if (!questions.length) return questions;
    const ids = questions.map(q => q._id);

    const usedAgg = await TestQuestion.aggregate([
        { $match: { question: { $in: ids } } },
        { $group: { _id: "$question", tests: { $addToSet: "$test" } } }
    ]);
    const usedMap = new Map(usedAgg.map(a => [String(a._id), a.tests.length]));

    const reports = await QuestionReport.find({ question: { $in: ids } }).select("question alsoReportedBy").lean();
    const reportMap = new Map(reports.map(r => [String(r.question), 1 + r.alsoReportedBy.length]));

    return questions.map(q => ({
        ...q,
        usedIn: usedMap.get(String(q._id)) || 0,
        reportCount: reportMap.get(String(q._id)) || 0
    }));
}

// ---------------- STATS ----------------
export const getQuestionBankStats = async (req, res) => {
    try {
        const totalQuestions = await Question.countDocuments();
        const active = await Question.countDocuments({ status: "Active" });
        const reported = await Question.countDocuments({ status: "Reported" });
        const disabled = await Question.countDocuments({ status: "Disabled" });

        res.json({ success: true, stats: { totalQuestions, active, reported, disabled } });
    } catch (err) {
        console.error("QB stats error:", err);
        res.status(500).json({ success: false, message: "Stats load nahi ho payi" });
    }
};

// ---------------- FILTER OPTIONS (exam/subject/topic dropdowns) ----------------
export const getFilterOptions = async (req, res) => {
    try {
        const { listing } = req.query;
        const listingFilter = listing && listing !== "all" ? { listing } : {};

        const listings = await Listing.find({}).select("title").sort({ title: 1 }).lean();
        const subjects = await Question.distinct("subject", { ...listingFilter, subject: { $ne: "" } });
        const topics = await Question.distinct("topic", { ...listingFilter, topic: { $ne: "" } });

        res.json({ success: true, listings, subjects, topics });
    } catch (err) {
        console.error("Filter options error:", err);
        res.status(500).json({ success: false, message: "Filters load nahi ho paye" });
    }
};

// ---------------- LIST (filtered + paginated) ----------------
export const getQuestions = async (req, res) => {
    try {
        const { listing, subject, topic, difficulty, status, language, search, page = 1, limit = 10 } = req.query;

        const filter = {};
        if (listing && listing !== "all") filter.listing = listing;
        if (subject && subject !== "all") filter.subject = subject;
        if (topic && topic !== "all") filter.topic = topic;
        if (difficulty && difficulty !== "all") filter.difficulty = difficulty;
        if (status && status !== "all") filter.status = status;
        if (search && search.trim()) filter.question = { $regex: search.trim(), $options: "i" };

        const totalMatching = await Question.countDocuments(filter);
        const skip = (Number(page) - 1) * Number(limit);

        let docs = await Question.find(filter).populate("listing", "title").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

        if (language && language !== "all") {
            docs = docs.filter(q => q.languageMode === "multiple"
                ? (q.translations || []).some(t => t.lang === language)
                : language === "English");
        }

        docs = await attachUsedInAndReports(docs);

        res.json({
            success: true,
            total: totalMatching,
            page: Number(page),
            limit: Number(limit),
            questions: docs.map(q => ({
                _id: q._id,
                question: getQuestionDisplayText(q),
                exam: q.listing?.title || "-",
                topic: q.topic,
                difficulty: q.difficulty,
                language: q.languageMode === "multiple" ? (q.translations || []).map(t => t.lang).join(", ") : "English",
                status: q.status || "Active",
                usedIn: q.usedIn,
                reportCount: q.reportCount
            }))
        });
    } catch (err) {
        console.error("Get questions error:", err);
        res.status(500).json({ success: false, message: "Questions load nahi ho paye" });
    }
};

// ---------------- SINGLE DETAIL (with report info) ----------------
export const getQuestionDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const q = await Question.findById(id).populate("listing", "title").lean();
        if (!q) return res.status(404).json({ success: false, message: "Question nahi mili" });

        const [withMeta] = await attachUsedInAndReports([q]);

        let reportInfo = null;
        const reportDoc = await QuestionReport.findOne({ question: id }).populate("reportedBy", "name username").lean();
        if (reportDoc) {
            reportInfo = {
                reporterName: reportDoc.reportedBy?.name || reportDoc.reportedBy?.username || "Unknown",
                reason: reportDoc.reason,
                description: reportDoc.description,
                totalReports: 1 + reportDoc.alsoReportedBy.length,
                reportedAt: reportDoc.createdAt
            };
        }

        res.json({ success: true, question: { ...withMeta, reportInfo } });
    } catch (err) {
        console.error("Get question detail error:", err);
        res.status(500).json({ success: false, message: "Question load nahi ho payi" });
    }
};

// ---------------- CREATE ----------------
export const createQuestion = async (req, res) => {
    try {
        const body = req.body;
        if (!body.listing) return res.status(400).json({ success: false, message: "Listing zaroori hai" });
        if (!body.subject || !body.topic) return res.status(400).json({ success: false, message: "Subject aur topic zaroori hain" });

        const hash = computeContentHash(body);
        const existing = await Question.findOne({ contentHash: hash });
        if (existing) return res.status(409).json({ success: false, message: "Ye question already maujood hai (duplicate content)" });

        const newQ = await Question.create({ ...body, contentHash: hash });
        res.json({ success: true, question: newQ, message: "Question create ho gaya" });
    } catch (err) {
        console.error("Create question error:", err);
        res.status(500).json({ success: false, message: err.message || "Create nahi ho paya" });
    }
};

// ---------------- UPDATE ----------------
export const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Question.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: "Question nahi mili" });

        const hash = computeContentHash(req.body);
        const updated = await Question.findByIdAndUpdate(id, { ...req.body, contentHash: hash }, { new: true, runValidators: true });

        res.json({ success: true, question: updated, message: "Question update ho gaya" });
    } catch (err) {
        console.error("Update question error:", err);
        res.status(500).json({ success: false, message: err.message || "Update nahi ho paya" });
    }
};

// ---------------- RESOLVE (clears report, back to Active) ----------------
export const resolveQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question nahi mili" });

        await QuestionReport.deleteOne({ question: id });
        question.status = "Active";
        await question.save();

        res.json({ success: true, message: "Question resolve ho gaya, status Active kar diya" });
    } catch (err) {
        console.error("Resolve error:", err);
        res.status(500).json({ success: false, message: "Resolve nahi ho paya" });
    }
};

// ---------------- DISABLE (also clears any open report) ----------------
export const disableQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question nahi mili" });

        await QuestionReport.deleteOne({ question: id });
        question.status = "Disabled";
        await question.save();

        res.json({ success: true, message: "Question disable kar diya" });
    } catch (err) {
        console.error("Disable error:", err);
        res.status(500).json({ success: false, message: "Disable nahi ho paya" });
    }
};

// ---------------- ENABLE ----------------
export const enableQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question nahi mili" });

        question.status = "Active";
        await question.save();

        res.json({ success: true, message: "Question enable kar diya" });
    } catch (err) {
        console.error("Enable error:", err);
        res.status(500).json({ success: false, message: "Enable nahi ho paya" });
    }
};

// ---------------- DELETE (real delete — blocked if in-use unless forced) ----------------
export const deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        const usedInTests = await TestQuestion.find({ question: id }).distinct("test");

        if (usedInTests.length > 0 && force !== "true") {
            return res.status(409).json({
                success: false,
                requiresForce: true,
                usedInCount: usedInTests.length,
                message: `Ye question ${usedInTests.length} test(s) me use ho raha hai. Delete karne se un tests me ye question tootegi.`
            });
        }

        if (usedInTests.length > 0) await TestQuestion.deleteMany({ question: id });
        await QuestionReport.deleteOne({ question: id });
        await Question.findByIdAndDelete(id);

        res.json({ success: true, message: "Question permanently delete ho gaya" });
    } catch (err) {
        console.error("Delete question error:", err);
        res.status(500).json({ success: false, message: "Delete nahi ho paya" });
    }
};

// ---------------- DUPLICATE ----------------
export const duplicateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await Question.findById(id).lean();
        if (!original) return res.status(404).json({ success: false, message: "Question nahi mili" });

        const copy = { ...original };
        delete copy._id; delete copy.createdAt; delete copy.updatedAt; delete copy.contentHash;
        copy.question = (copy.question || "") + " (Copy)";
        copy.status = "Active";
        copy.contentHash = computeContentHash(copy);

        const created = await Question.create(copy);
        res.json({ success: true, question: created, message: "Question duplicate ho gaya" });
    } catch (err) {
        console.error("Duplicate question error:", err);
        res.status(500).json({ success: false, message: "Duplicate nahi ho paya" });
    }
};