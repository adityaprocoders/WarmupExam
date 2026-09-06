import cron from "node-cron";
import LiveTestConfig from "../models/LiveTestConfig.js";
import { generateLiveTestForExam, cleanupExpiredLiveTests } from "../controllers/liveTestController.js";

function currentHHMM() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
}

function todayShortDay() {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
}

function todayDateStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

const cronExpression = process.env.LIVETEST_CRON_EXPRESSION || "*/1 * * * *";
const isDevMode = process.env.LIVETEST_DEV_MODE === "true";

cron.schedule(cronExpression, async () => {
    try {
        const configs = await LiveTestConfig.find().lean();
        const nowHHMM = currentHHMM();
        const today = todayShortDay();
        const todayDate = todayDateStr();

        for (const config of configs) {
            const allowedDays = (config.scheduledDays && config.scheduledDays.length > 0)
                ? config.scheduledDays
                : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

            if (!allowedDays.includes(today)) continue;

            // 👇 FIX — exact match ki jagah range check: startTime aa chuka ho aur aaj abhi tak generate na hua ho
            const alreadyGeneratedToday = config.lastGeneratedDate === todayDate;

            if (isDevMode || (config.startTime <= nowHHMM && !alreadyGeneratedToday)) {
                const generated = await generateLiveTestForExam(config.exam);
                if (generated) {
                    await LiveTestConfig.updateOne({ _id: config._id }, { $set: { lastGeneratedDate: todayDate } });
                }
            }
        }

        await cleanupExpiredLiveTests();
    } catch (err) {
        console.error("[live-test] cron failed:", err);
    }
});