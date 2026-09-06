import cron from "node-cron";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Attempt from "../models/TestAttempt.js";

async function cleanupExpiredDailyWarmups() {
    const now = new Date();
    const expiredTests = await Test.find({
        isDailyWarmup: true,
        dailyWarmupExpiresAt: { $lte: now }
    }).select("_id");

    if (expiredTests.length === 0) return;
    const expiredTestIds = expiredTests.map(t => t._id);

    await TestQuestion.deleteMany({ test: { $in: expiredTestIds } });
    await Attempt.deleteMany({ test: { $in: expiredTestIds } });
    await Test.deleteMany({ _id: { $in: expiredTestIds } });

    console.log(`🧹 Daily Warmup cleanup: ${expiredTestIds.length} expired test(s) removed`);
}

cron.schedule("*/30 * * * *", cleanupExpiredDailyWarmups);
export default cleanupExpiredDailyWarmups;