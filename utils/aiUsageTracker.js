import AIUsage from "../models/AIUsage.js";
import { getLimitsForTier, todayDateString, nextResetAt } from "./aiLimits.js";


// Aaj ka (ya naya) usage doc laata hai
async function getOrCreateUsageDoc(userId) {
    const date = todayDateString();
    let doc = await AIUsage.findOne({ user: userId, date });
    if (!doc) {
        doc = await AIUsage.create({ user: userId, date, questionsUsed: 0, apiCallsUsed: 0, textCharsUsed: 0, imagesUsed: 0, pdfMBUsed: 0, recentRequestTimestamps: [] });
    }
    return doc;
}

export async function checkAILimits(userId, tier, { requestedQuestionCount, textCharCount = 0, imageCount = 0, pdfSizeMB = 0, pdfPages = 0 }) {
    const limits = getLimitsForTier(tier);
    const usage = await getOrCreateUsageDoc(userId);

    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentCount = (usage.recentRequestTimestamps || []).filter((t) => new Date(t).getTime() > oneMinuteAgo).length;
    if (recentCount >= limits.requestsPerMinute) {
        return { ok: false, message: `You're sending requests too quickly. Max ${limits.requestsPerMinute} per minute — please wait a moment.` };
    }

    // ---- Whole-generator limits ----
    if (usage.apiCallsUsed >= limits.apiCallsPerDay) {
       return { ok: false, daily: true, message: `You've used all ${limits.apiCallsPerDay} AI requests for today.` };
    }
    if (requestedQuestionCount > limits.questionsPerRequest) {
        return { ok: false,  daily: true, message: `Your plan allows up to ${limits.questionsPerRequest} questions per request.` };
    }
    if (usage.questionsUsed + requestedQuestionCount > limits.questionsPerDay) {
        const remaining = Math.max(0, limits.questionsPerDay - usage.questionsUsed);
        return { ok: false, daily: true,  message: `Only ${remaining} question(s) left for today (daily limit: ${limits.questionsPerDay}).` };
    }

    // ---- Text ----
    if (textCharCount > limits.textCharsPerRequest) {
        return { ok: false, message: `Text can be up to ${limits.textCharsPerRequest.toLocaleString()} characters per request.` };
    }
    if (usage.textCharsUsed + textCharCount > limits.textCharsPerDay) {
        return { ok: false, daily: true, message: `Daily text limit reached (${limits.textCharsPerDay.toLocaleString()} characters).` };
    }

    // ---- Images ----
    if (imageCount > limits.imagesPerRequest) {
        return { ok: false, message: `Your plan allows up to ${limits.imagesPerRequest} image(s) per request.` };
    }
    if (imageCount > 0 && usage.imagesUsed + imageCount > limits.imagesPerDay) {
        const left = Math.max(0, limits.imagesPerDay - usage.imagesUsed);
        return { ok: false, daily: true, message: `Daily image limit reached. ${left} image(s) left for today.` };
    }

    // ---- PDF ----
    if (pdfSizeMB > 0) {
        if (!limits.pdfAllowed) {
            return { ok: false, message: "PDF upload is available on Pro and Pro Max plans." };
        }
        if (pdfSizeMB > limits.pdfMaxSizeMB) {
            return { ok: false, message: `PDF can be up to ${limits.pdfMaxSizeMB} MB.` };
        }
        if (pdfPages > limits.pdfMaxPages) {
            return { ok: false, message: `PDF can have up to ${limits.pdfMaxPages} pages.` };
        }
        if ((usage.pdfMBUsed || 0) + pdfSizeMB > limits.pdfMBPerDay) {
            const left = Math.max(0, limits.pdfMBPerDay - (usage.pdfMBUsed || 0));
            return { ok: false,daily: true,  message: `Daily PDF limit reached. ${left.toFixed(1)} MB left for today.` };
        }
    }

    return { ok: true, doc: usage };
}

/**
 * Successful generation ke baad usage update karta hai.
 */

export async function recordAIUsage(userId, { questionsGenerated, textCharCount = 0, imageCount = 0, pdfSizeMB = 0 }) {
    const date = todayDateString();
    await AIUsage.updateOne(
        { user: userId, date },
        {
            $inc: { questionsUsed: questionsGenerated, apiCallsUsed: 1, textCharsUsed: textCharCount, imagesUsed: imageCount, pdfMBUsed: pdfSizeMB },
            $push: { recentRequestTimestamps: { $each: [new Date()], $slice: -50 } },
        },
        { upsert: true }
    );
}

/**
 * Frontend ko dikhane ke liye — kitna quota bacha hai (GET endpoint ke liye)
 */
export async function getUsageSummary(userId, tier) {
    const limits = getLimitsForTier(tier);
    const usage = await getOrCreateUsageDoc(userId);
    const r1 = (n) => Math.round((n || 0) * 10) / 10;

    const questionsFull = usage.questionsUsed >= limits.questionsPerDay;
    const requestsFull = usage.apiCallsUsed >= limits.apiCallsPerDay;

    return {
        tier,
        questionsUsed: usage.questionsUsed, questionsLimit: limits.questionsPerDay,
        apiCallsUsed: usage.apiCallsUsed, apiCallsLimit: limits.apiCallsPerDay,
        textCharsUsed: usage.textCharsUsed, textCharsLimit: limits.textCharsPerDay,
        imagesUsed: usage.imagesUsed || 0, imagesLimit: limits.imagesPerDay,
        pdfMBUsed: r1(usage.pdfMBUsed), pdfMBLimit: limits.pdfMBPerDay,
        locks: {
            all: questionsFull || requestsFull,
            allReason: questionsFull ? "questions" : requestsFull ? "requests" : null,
            text: usage.textCharsUsed >= limits.textCharsPerDay,
            images: (usage.imagesUsed || 0) >= limits.imagesPerDay,
            pdf: limits.pdfAllowed && (usage.pdfMBUsed || 0) >= limits.pdfMBPerDay,
        },
        resetAt: nextResetAt(),
        limits,
    };
}