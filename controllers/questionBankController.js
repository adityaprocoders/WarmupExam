import mongoose from "mongoose";
import Listing from "../models/listing.js";
import Question, { computeContentHash } from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import QuestionReport from "../models/QuestionReport.js";
import User from "../models/usersShema.js";
import Attempt from "../models/TestAttempt.js";
import Test from "../models/Test.js";

const EDITABLE_FIELDS = [
    "listing", "type", "section", "difficulty", "languageMode", "subject", "topic", "subTopic",
    "question", "questionImage", "options", "solution", "translations",
    "correctAnswers", "numericAnswer"
];

// Mapping hatne/badalne ke baad Test.totalQuestions ko sahi count par laata hai
async function recountTests(testIds, session = null) {
    for (const t of testIds) {
        const count = await TestQuestion.countDocuments({ test: t }).session(session);
        await Test.updateOne({ _id: t }, { $set: { totalQuestions: count } }, { session });
    }
}


function pickEditable(body) {
    const out = {};
    for (const k of EDITABLE_FIELDS) if (body[k] !== undefined) out[k] = body[k];
    return out;
}

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
        res.status(500).json({ success: false, message: "Failed to load stats." });
    }
};

// ---------------- FILTER OPTIONS (exam/subject/topic dropdowns) ----------------
// ---------------- FILTER OPTIONS (cascading: exam -> subject -> topic -> difficulty -> status) ----------------
export const getFilterOptions = async (req, res) => {
    try {
        const { listing, subject, topic, difficulty } = req.query;
        const has = (v) => v && v !== "all";

        const listings = await Listing.find({}).select("title").sort({ title: 1 }).lean();

        // 1) Exam select hone par sirf usi exam ke subjects
        const base = {};
        if (has(listing)) base.listing = listing;

        const subjects = (await Question.distinct("subject", { ...base, subject: { $ne: "" } })).filter(Boolean);

        // 2) Subject select hone par sirf usi subject ke topics
        const topicFilter = { ...base, topic: { $ne: "" } };
        if (has(subject)) topicFilter.subject = subject;
        const topics = (await Question.distinct("topic", topicFilter)).filter(Boolean);

        // 3) Topic select hone par sirf usi topic ki difficulty
        const diffFilter = { ...base };
        if (has(subject)) diffFilter.subject = subject;
        if (has(topic)) diffFilter.topic = topic;
        const diffFound = await Question.distinct("difficulty", diffFilter);
        const difficulties = ["Easy", "Medium", "Hard"].filter(d => diffFound.includes(d));

        // 4) Difficulty select hone par sirf usi combination ke status
        const statusFilter = { ...diffFilter };
        if (has(difficulty)) statusFilter.difficulty = difficulty;
        const statusFound = await Question.distinct("status", statusFilter);
        const statuses = ["Active", "Reported", "Disabled"].filter(s => statusFound.includes(s));

        res.json({
            success: true,
            listings,
            subjects: subjects.sort(),
            topics: topics.sort(),
            difficulties,
            statuses
        });
    } catch (err) {
        console.error("Filter options error:", err);
        res.status(500).json({ success: false, message: "Failed to load filters." });
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
        if (search && search.trim()) {
            const rx = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
            filter.$or = [{ question: rx }, { "translations.question": rx }];
        }

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
        res.status(500).json({ success: false, message: "Failed to load questions." });
    }
};

// ---------------- SINGLE DETAIL (with report info) ----------------
export const getQuestionDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const q = await Question.findById(id).populate("listing", "title").lean();
        if (!q) return res.status(404).json({ success: false, message: "Question not found." });

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
        res.status(500).json({ success: false, message: "Failed to load question." });
    }
};

// ---------------- CREATE ----------------
export const createQuestion = async (req, res) => {
    try {
        const body = req.body;
        if (!body.listing) return res.status(400).json({ success: false, message: "Listing is required." });
        if (!body.subject || !body.topic) return res.status(400).json({ success: false, message: "Subject and topic are required." });

                if (body.type === "integer") {
            if (body.numericAnswer === null || body.numericAnswer === undefined || Number.isNaN(Number(body.numericAnswer))) {
                return res.status(400).json({ success: false, message: "Numeric answer is required." });
            }
        } else if (!Array.isArray(body.correctAnswers) || body.correctAnswers.length === 0) {
            return res.status(400).json({ success: false, message: "Please select the correct answer." });
        }
        
        const hash = computeContentHash(body);
        const existing = await Question.findOne({ contentHash: hash });
        if (existing) return res.status(409).json({ success: false, message: "This question already exists (duplicate content)." });

        let newQ;
        try {
            newQ = await Question.create({ ...pickEditable(body), contentHash: hash });
        } catch (e) {
            if (e.code === 11000) {
                return res.status(409).json({ success: false, message: "This question already exists (duplicate content)." });
            }
            throw e;
        }
        res.json({ success: true, question: newQ, message: "Question created successfully." });
    } catch (err) {
        console.error("Create question error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to create question." });
    }
};

// ---------------- UPDATE ----------------
export const updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Question.findById(id);
        if (!existing) return res.status(404).json({ success: false, message: "Question not found." });

        // Partial body aaye to bhi sahi hash bane, isliye purane doc ke upar merge karke hash nikalte hain
        const changes = pickEditable(req.body);
        const merged = { ...existing.toObject(), ...changes };
        const hash = computeContentHash(merged);

                
        try {
            await new Question(merged).validate();
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const clash = await Question.findOne({ contentHash: hash, _id: { $ne: id } });

        if (!clash) {
            const updated = await Question.findByIdAndUpdate(
                id, { ...changes, contentHash: hash }, { new: true, runValidators: true }
            );
            return res.json({ success: true, question: updated, message: "Question updated successfully." });
        }

        // Naya content kisi doosre existing question jaisa ho gaya -> is question ko clash me merge karo (transaction me)
        const session = await mongoose.startSession();
        try {
                        await session.withTransaction(async () => {
                const mappings = await TestQuestion.find({ question: id }).session(session);
                const touchedTests = [];
                for (const m of mappings) {
                    const alreadyThere = await TestQuestion.exists({ test: m.test, question: clash._id }).session(session);
                    if (alreadyThere) {
                        await TestQuestion.deleteOne({ _id: m._id }, { session });
                        touchedTests.push(m.test);
                    } else {
                        await TestQuestion.updateOne({ _id: m._id }, { $set: { question: clash._id } }, { session });
                    }
                }
                await recountTests(touchedTests, session);

                await Attempt.updateMany(
                    { "answers.question": id },
                    { $set: { "answers.$[a].question": clash._id } },
                    { arrayFilters: [{ "a.question": id }], session }
                );

                await QuestionReport.deleteOne({ question: id }, { session });
                await Question.findByIdAndDelete(id, { session });
            });
        } finally {
            await session.endSession();
        }

        return res.json({
            success: true,
            question: clash,
            merged: true,
            message: "This content matched an existing question, so the two have been merged."
        });
    } catch (err) {
        console.error("Update question error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to update." });
    }
};

// ---------------- RESOLVE (clears report, back to Active) ----------------
export const resolveQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found." });

        await QuestionReport.deleteOne({ question: id });
        question.status = "Active";
        await question.save();

        res.json({ success: true, message: "Question resolved and its status has been set to Active." });
    } catch (err) {
        console.error("Resolve error:", err);
        res.status(500).json({ success: false, message: "Failed to resolve question." });
    }
};

// ---------------- DISABLE (also clears any open report) ----------------
export const disableQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found." });

        await QuestionReport.deleteOne({ question: id });
        question.status = "Disabled";
        await question.save();

        res.json({ success: true, message: "Question disabled successfully." });
    } catch (err) {
        console.error("Disable error:", err);
        res.status(500).json({ success: false, message: "Failed to disable question." });
    }
};

// ---------------- ENABLE ----------------
export const enableQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found." });

        question.status = "Active";
        await question.save();

        res.json({ success: true, message: "Question enabled successfully." });
    } catch (err) {
        console.error("Enable error:", err);
        res.status(500).json({ success: false, message: "Failed to enable question." });
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
                message: `This question is used in ${usedInTests.length} test(s). Deleting it will break the question in those tests.`
            });
        }

        if (usedInTests.length > 0) {
            await TestQuestion.deleteMany({ question: id });
            await recountTests(usedInTests);
        }
        await QuestionReport.deleteOne({ question: id });
        await Question.findByIdAndDelete(id);

        res.json({ success: true, message: "Question permanently deleted." });
    } catch (err) {
        console.error("Delete question error:", err);
        res.status(500).json({ success: false, message: "Failed to delete." });
    }
};

// ---------------- DUPLICATE ----------------
export const duplicateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await Question.findById(id).lean();
        if (!original) return res.status(404).json({ success: false, message: "Question not found." });

        let created = null;
        for (let n = 1; n <= 20 && !created; n++) {
            const label = n === 1 ? " (Copy)" : ` (Copy ${n})`;
            const copy = { ...original };
            delete copy._id; delete copy.createdAt; delete copy.updatedAt; delete copy.contentHash;
            copy.status = "Active";

            if (original.languageMode === "multiple") {
                copy.translations = (original.translations || []).map(t => ({ ...t, question: (t.question || "") + label }));
            } else {
                copy.question = (original.question || "") + label;
            }
            copy.contentHash = computeContentHash(copy);

            try {
                created = await Question.create(copy);
            } catch (e) {
                if (e.code !== 11000) throw e; // is label wali copy pehle se hai -> agla number try karo
            }
        }
        if (!created) return res.status(409).json({ success: false, message: "Too many copies of this question already exist." });

        res.json({ success: true, question: created, message: "Question duplicated successfully." });
    } catch (err) {
        console.error("Duplicate question error:", err);
        res.status(500).json({ success: false, message: "Failed to duplicate question." });
    }
};