import cron from "node-cron";
import LiveTestConfig from "../models/LiveTestConfig.js";
import { generateLiveTestForExam, cleanupExpiredLiveTests } from "../controllers/liveTestController.js";

function currentHHMM() {
   return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' });
}

function todayShortDay() {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' });
}

function todayDateStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

const cronExpression = process.env.LIVETEST_CRON_EXPRESSION || "*/1 * * * *";
const isDevMode = process.env.LIVETEST_DEV_MODE === "true";

let isRunning = false; // pichhla run khatam hone se pehle naya run na chale

cron.schedule(cronExpression, async () => {
    if (isRunning) return;
    isRunning = true;

    try {
        // 1) Pehle cleanup: generate me error aaye tab bhi 24 ghante wala delete chalna chahiye
        try {
            await cleanupExpiredLiveTests();
        } catch (err) {
            console.error("[live-test] cleanup failed:", err);
        }

        // 2) Har exam alag try/catch: ek exam ka error baaki ko na roke
        const configs = await LiveTestConfig.find().lean();
        const nowHHMM = currentHHMM();
        const today = todayShortDay();
        const todayDate = todayDateStr();

        for (const config of configs) {
            try {
                const allowedDays = (config.scheduledDays && config.scheduledDays.length > 0)
                    ? config.scheduledDays
                    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                if (!allowedDays.includes(today)) continue;

                if (!isDevMode) {
                    if (config.startTime > nowHHMM) continue;
                    if (config.lastGeneratedDate === todayDate) continue;

                    // Aaj ka slot atomically claim karo (2 instance chalein tab bhi duplicate test nahi banega)
                    const claimed = await LiveTestConfig.findOneAndUpdate(
                        { _id: config._id, lastGeneratedDate: { $ne: todayDate } },
                        { $set: { lastGeneratedDate: todayDate } }
                    );
                    if (!claimed) continue;
                }

                let generated = null;
                try {
                    generated = await generateLiveTestForExam(config.exam);
                } catch (err) {
                    console.error(`[live-test] ${config.exam} generate failed:`, err);
                }

                // Generate nahi hua to claim wapas, taaki agle minute dobara try ho
                if (!generated && !isDevMode) {
                    await LiveTestConfig.updateOne(
                        { _id: config._id },
                        { $set: { lastGeneratedDate: config.lastGeneratedDate ?? null } }
                    );
                }
            } catch (err) {
                console.error(`[live-test] ${config.exam} failed:`, err);
            }
        }
    } catch (err) {
        console.error("[live-test] cron failed:", err);
    } finally {
        isRunning = false;
    }
});