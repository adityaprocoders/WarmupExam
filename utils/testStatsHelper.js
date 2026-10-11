import Attempt from "../models/TestAttempt.js";

// Isi test ke saare real attempts se accuracy-comparison banata hai
export async function getAccuracyComparison(testId, userAccuracy) {
    const allAttempts = await Attempt.find({ test: testId })
        .select("user correctCount wrongCount")
        .sort({ createdAt: -1 })
        .lean();

    // Har user ka sirf latest attempt
    const seenUsers = new Set();
    const attempts = [];
    for (const a of allAttempts) {
        const key = String(a.user);
        if (seenUsers.has(key)) continue;
        seenUsers.add(key);
        attempts.push(a);
    }

    const accuracyList = attempts
        .map(a => {
            const attempted = (a.correctCount || 0) + (a.wrongCount || 0);
            return attempted > 0 ? (a.correctCount / attempted) * 100 : null;
        })
        .filter(v => v !== null);

    if (accuracyList.length === 0) {
        return { yourAccuracy: userAccuracy, avgAccuracy: userAccuracy, top10Accuracy: userAccuracy };
    }

    const avgAccuracy = Math.round(
        (accuracyList.reduce((a, b) => a + b, 0) / accuracyList.length) * 10
    ) / 10;

    // Top 10% threshold — sorted list me 90th percentile wali value
    const sorted = [...accuracyList].sort((a, b) => a - b);
    const idx = Math.max(0, Math.ceil(0.9 * sorted.length) - 1);
    const top10Accuracy = Math.round(sorted[idx] * 10) / 10;

    return {
        yourAccuracy: Math.round(userAccuracy * 10) / 10,
        avgAccuracy,
        top10Accuracy
    };
}