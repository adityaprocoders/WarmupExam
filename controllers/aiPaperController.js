import { GoogleGenAI } from "@google/genai";
import { getCustomTestTier, isPaidCustomTestTier } from "../utils/customTestTier.js";
import { randomUUID } from "crypto";
import { processImageFiles, processPDFFile } from "../utils/aiFileProcessing.js";
import { buildAIExtractPrompt, parseAIQuestions } from "../utils/geminiPrompt.js";
import { getLimitsForTier, nextResetAt } from "../utils/aiLimits.js";
import { checkAILimits, recordAIUsage, getUsageSummary } from "../utils/aiUsageTracker.js";
import CustomAIPaper from "../models/CustomAIPaper.js";
import { buildAIGeneratePrompt, cleanGenerated, parseDifficulty } from "../utils/aiGeneratePrompt.js";


const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MAX_FILES_HARD_CAP = 10; // absolute upper bound, tier limits neeche aur bhi restrict karenge

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err) {
    // 503 UNAVAILABLE (overload) ya 429 rate-limit — dono transient hain, retry karne layak
    return err?.status === 503 || err?.status === 429;
}

async function callGemini(parts, maxOutputTokens = 8000, opts = {}, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    const { temperature = 0.2, thinkingLevel = "minimal" } = opts;
    try {
        const response = await genAI.models.generateContent({
            model: "gemini-3.6-flash",
            contents: [{ role: "user", parts }],
            config: {
                maxOutputTokens,
                temperature,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel },
            },
        });
        return response.text;
    } catch (err) {
        if (isRetryableGeminiError(err) && attempt < MAX_ATTEMPTS) {
            const delayMs = 1000 * Math.pow(2, attempt - 1);
            console.warn(`Gemini overloaded (attempt ${attempt}) — retrying in ${delayMs}ms`);
            await sleep(delayMs);
            return callGemini(parts, maxOutputTokens, opts, attempt + 1);
        }
        throw err;
    }
}

/* ------------------------------------------------------------
   GET /api/custom-test/ai/usage — frontend ko quota dikhane ke liye
------------------------------------------------------------ */
export const getAIUsage = async (req, res) => {
    try {
        const tier = getCustomTestTier(req);
        const summary = await getUsageSummary(req.user._id, tier);
        res.json({ success: true, ...summary });
    } catch (err) {
        
        res.status(500).json({ success: false, message: "Failed to load usage." });
    }
};

/* ------------------------------------------------------------
   POST /api/custom-test/ai/generate
------------------------------------------------------------ */
export const generateAIPaper = async (req, res) => {
    try {
        const tier = getCustomTestTier(req);
        if (!isPaidCustomTestTier(tier) && tier !== "free") {
            return res.status(403).json({ success: false, error: "UPGRADE_REQUIRED" });
        }
        const limits = getLimitsForTier(tier);

        const { sourceType, pastedText = "", timeLimit } = req.body;
        const questionCount = Number(req.body.questionCount) || 0;
        const files = req.files || [];


        const mode = req.body.mode === "generate" ? "generate" : "extract";
const diffPct = mode === "generate" ? parseDifficulty(req.body.difficulty) : null;
if (mode === "generate" && !diffPct) {
    return res.status(400).json({ success: false, message: "Difficulty percentages must add up to 100%." });
}
if (mode === "generate" && sourceType === "text" && pastedText.trim().length < 200) {
    return res.status(400).json({ success: false, message: "The chapter text is too short. Please paste at least a few paragraphs." });
}

        if (!sourceType || (sourceType === "text" && !pastedText.trim()) || (sourceType !== "text" && !files.length)) {
            return res.status(400).json({ success: false, message: "Source data is missing." });
        }
        if (!questionCount || questionCount < 1) {
            return res.status(400).json({ success: false, message: "Invalid question count." });
        }
        if (files.length > MAX_FILES_HARD_CAP) {
            return res.status(400).json({ success: false, message: `Max ${MAX_FILES_HARD_CAP} files allowed.` });
        }

        // ---------------- Pre-compute limit-check inputs ----------------
        let textCharCount = 0;
        let imageCount = 0;
        let pdfSizeMB = 0;

        if (sourceType === "text") {
            textCharCount = pastedText.length;
        } else if (sourceType === "images") {
            imageCount = files.length;
            for (const f of files) {
                const sizeMB = f.size / (1024 * 1024);
                if (sizeMB > limits.imageMaxSizeMB) {
                    return res.status(400).json({ success: false, message: `Each image must be ${limits.imageMaxSizeMB}MB or smaller on your plan.` });
                }
            }
                } else if (sourceType === "pdf") {
            if (!limits.pdfAllowed) {
                return res.status(403).json({ success: false, error: "UPGRADE_REQUIRED", message: "PDF upload is available only on Pro and Pro Max plans." });
            }
            pdfSizeMB = files[0] ? files[0].size / (1024 * 1024) : 0;
            if (pdfSizeMB > limits.pdfMaxSizeMB) {
                return res.status(400).json({ success: false, message: `The PDF size must not exceed ${limits.pdfMaxSizeMB}MB.` });
            }
        }

        // ---------------- LIMIT CHECK (before spending any AI tokens) ----------------
        const limitCheck = await checkAILimits(req.user._id, tier, {
            requestedQuestionCount: questionCount,
            textCharCount, 
            imageCount,
            pdfSizeMB,
            pdfPages: 0,
        });
        if (!limitCheck.ok) {
           return res.status(429).json({ success: false, error: "LIMIT_EXCEEDED", message: limitCheck.message, daily: !!limitCheck.daily, resetAt: nextResetAt() });
        }

        // ---------------- Build Gemini parts ----------------
       const requestedForPrompt = Math.min(questionCount, limits.questionsPerRequest);
const parts = [{
    text: mode === "generate"
        ? buildAIGeneratePrompt(requestedForPrompt, diffPct)
        : buildAIExtractPrompt(requestedForPrompt),
}];
        if (sourceType === "text") {
            parts.push({ text: "\n\nCONTENT:\n" + pastedText.slice(0, limits.textCharsPerRequest) });
        } else if (sourceType === "images") {
            const imgs = await processImageFiles(files);
            imgs.forEach((img) => parts.push({ inlineData: img }));
        } else if (sourceType === "pdf") {
            let pdfResult;
            try {
                pdfResult = await processPDFFile(files[0].buffer);
            } catch (err) {
                if (err.code === "SCANNED_PDF_NOT_SUPPORTED") {
                    return res.status(422).json({
                        success: false,
                        message: "This PDF appears to be scanned or image-based. Please convert it to images (JPG/PNG) and upload them using 'Upload Images'.",
                    });
                }
                throw err;
            }

            // Page-count estimate (rough: form-feed characters se, ya length-based fallback)
            const estimatedPages = Math.max(1, (pdfResult.text.match(/\f/g) || []).length || Math.ceil(pdfResult.text.length / 3000));
            if (estimatedPages > limits.pdfMaxPages) {
                return res.status(400).json({ success: false, message: `Your plan supports processing up to ${limits.pdfMaxPages} pages per PDF.` });
            }

            parts.push({ text: "\n\nCONTENT:\n" + pdfResult.text.slice(0, limits.textCharsPerRequest) });
        } else {
            return res.status(400).json({ success: false, message: "Invalid source type." });
        }
 
        const isGen = mode === "generate";
const tokenBudget = isGen
    ? Math.min(32768, 4000 + requestedForPrompt * 600)
    : Math.min(32768, 1200 + requestedForPrompt * 450);

const rawResponse = await callGemini(
    parts, tokenBudget,
    isGen ? { temperature: 0.4, thinkingLevel: "medium" } : {}
);
let extracted = parseAIQuestions(rawResponse);
if (isGen) extracted = cleanGenerated(extracted);

if (!extracted.length) {
    return res.status(422).json({
        success: false,
        message: isGen
            ? "Questions could not be generated from this chapter. Please try again with a clearer image or more text."
            : "No questions could be extracted. Please try again with a clearer source.",
    });
}

        const requested = Math.min(questionCount, limits.questionsPerRequest);
        const finalSet = extracted.slice(0, requested);

        // ---------------- Record usage (AFTER successful generation) ----------------
        await recordAIUsage(req.user._id, { questionsGenerated: finalSet.length, textCharCount, imageCount, pdfSizeMB });

        const questions = finalSet.map((item, i) => ({
            _id: randomUUID(), index: i + 1,
            question: item.question, questionImage: null,
            options: item.options || [], correctAnswers: item.correctAnswers || [],
            numericAnswer: item.numericAnswer ?? null,
            solution: { text: item.solution || "", image: null },
            languageMode: "single", translations: [],
            type: item.type || "mcq",
            subject: item.subject || "General", topic: item.topic || "",
            difficulty: item.difficulty,
            marks: 1, negativeMarks: 1,
        }));

        const delivered = questions.length;
        const paperId = `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const finalTimeLimit = Number(timeLimit) || Math.max(5, Math.round(delivered * 0.75));
        const paperName = req.body.paperName || "AI Generated Paper";
 
        if (tier === "pro" || tier === "promax") {
            const expiryHours = tier === "promax" ? 48 : 24;
            try {
                await CustomAIPaper.create({
                    paperId,
                    user: req.user._id,
                    paperName,
                    timeLimit: finalTimeLimit,
                    questions,
                    expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
                });
            } catch (dbErr) {
                console.error("CustomAIPaper save failed (non-fatal):", dbErr);
               
            }
        }

        res.json({
            success: true,
            paperId,
            paperName,
            timeLimit: finalTimeLimit,
            requested, delivered,
            shortfall: delivered < requested,
            questions,
        });
    } catch (err) {
        
        if (err?.status === 503) {
            return res.status(503).json({
                success: false,
                message: "The AI service is busy due to high demand. Please try again in 1-2 minutes.",
            });
        }
        if (err?.status === 429) {
            return res.status(429).json({
                success: false,
                message: "The AI service rate limit has been reached. Please wait a moment and try again.",
            });
        }
        res.status(500).json({ success: false, message: "Failed to generate the AI paper. Please try again." });
    }
};



/* ------------------------------------------------------------
   GET /api/custom-test/ai/paper/:paperId — Pro+ ka DB se paper fetch
   (cross-device access ke liye, jab localStorage mein nahi mila)
------------------------------------------------------------ */
export const getAIPaper = async (req, res) => {
    try {
        const { paperId } = req.params;
        const paper = await CustomAIPaper.findOne({ paperId, user: req.user._id }).lean();

        if (!paper) {
            return res.status(404).json({ success: false, error: "PAPER_EXPIRED", message: "This paper was not found or has expired." });
        }

        res.json({
            success: true,
            paperId: paper.paperId,
            paperName: paper.paperName,
            timeLimit: paper.timeLimit,
            questions: paper.questions,
        });
    } catch (err) {
        console.error("getAIPaper error:", err);
        res.status(500).json({ success: false, message: "Server error." });
    }
};


/* ------------------------------------------------------------
   GET /api/custom-test/ai/papers — Pro+ ke saare ACTIVE AI papers
   (Manage/dashboard pe "Generated Paper" section ke liye)
------------------------------------------------------------ */
export const listAIPapers = async (req, res) => {
    try {
        const papers = await CustomAIPaper.find({
            user: req.user._id,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 }).lean();

        res.json({
            success: true,
            papers: papers.map((p) => ({
                id: p.paperId,
                source: "ai",
                createdAt: new Date(p.createdAt).getTime(),
                expiresAt: new Date(p.expiresAt).getTime(),
                config: {
                    exams: [p.paperName], subjects: [], topics: [],
                    questionCount: p.questions.length, timeLimit: p.timeLimit,
                    timeStrategy: "total", language: "English", mode: "ai",
                },
                questions: p.questions,
            })),
        });
    } catch (err) {
        console.error("listAIPapers error:", err);
        res.status(500).json({ success: false, papers: [] });
    }
};