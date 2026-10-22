import Attempt from "../models/TestAttempt.js";
import User from "../models/usersShema.js";

// Har user ka sirf LATEST attempt count hota hai; current attempt alag se gina jaata hai
export async function getLiveTestRank(testId, userScore, userTime = 0, userId = null) {
    const all = await Attempt.find({ test: testId })
        .select("user score timeTaken")
        .sort({ createdAt: -1 })
        .lean();

    const seen = new Set();
    if (userId) seen.add(String(userId));
    const others = [];
    for (const a of all) {
        const key = String(a.user);
        if (seen.has(key)) continue;
        seen.add(key);
        others.push(a);
    }

    const totalUsers = others.length + (userId ? 1 : 0);
    if (totalUsers === 0) return { rank: null, totalUsers: 0 };

    const higherCount = others.filter(a => {
        const s = a.score || 0;
        return s > userScore || (s === userScore && (a.timeTaken || 0) < userTime);
    }).length;

    return { rank: higherCount + 1, totalUsers };
}