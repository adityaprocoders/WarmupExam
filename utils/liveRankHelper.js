import Attempt from "../models/TestAttempt.js";

// Har user ka sirf LATEST attempt count hota hai (re-attempt ke baad bhi rank sahi rahe)
export async function getLiveTestRank(testId, userScore, userTime = 0) {
    const all = await Attempt.find({ test: testId })
        .select("user score timeTaken")
        .sort({ createdAt: -1 })
        .lean();

    const seen = new Set();
    const attempts = [];
    for (const a of all) {
        const key = String(a.user);
        if (seen.has(key)) continue;
        seen.add(key);
        attempts.push(a);
    }

    const totalUsers = attempts.length;

    if (totalUsers === 0) return { rank: null, totalUsers: 0 };

    const higherCount = attempts.filter(a => {
        const s = a.score || 0;
        return s > userScore || (s === userScore && (a.timeTaken || 0) < userTime);
    }).length;

    return { rank: higherCount + 1, totalUsers };
}