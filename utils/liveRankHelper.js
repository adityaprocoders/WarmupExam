import Attempt from "../models/TestAttempt.js";

// Isi test ke SAARE real attempts se live rank nikalta hai
// (jitne bhi students ne ye test diya, unme se tumse zyada score kitno ne kiya — usi se rank)
export async function getLiveTestRank(testId, userScore) {
    const attempts = await Attempt.find({ test: testId }).select("score").lean();
    const totalUsers = attempts.length;

    if (totalUsers === 0) return { rank: null, totalUsers: 0 };

    const higherCount = attempts.filter(a => (a.score || 0) > userScore).length;
    const rank = higherCount + 1;

    return { rank, totalUsers };
}