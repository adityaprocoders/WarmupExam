import Attempt from "../models/TestAttempt.js";

// Isi test ke SAARE real attempts se live rank nikalta hai
export async function getLiveTestRank(testId, userScore, userTime = 0) {
    const attempts = await Attempt.find({ test: testId }).select("score timeTaken").lean();
    const totalUsers = attempts.length;

    if (totalUsers === 0) return { rank: null, totalUsers: 0 };

    const higherCount = attempts.filter(a => {
        const s = a.score || 0;
        return s > userScore || (s === userScore && (a.timeTaken || 0) < userTime);
    }).length;

    return { rank: higherCount + 1, totalUsers };
}