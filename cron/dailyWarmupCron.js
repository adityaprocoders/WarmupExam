import cron from "node-cron";
import DailyWarmupConfig from "../models/DailyWarmupConfig.js";
import { generateWarmupForExam, cleanupExpiredWarmups } from "../controllers/dailyWarmupController.js";

function currentHHMM() {
    const now = new Date();
    return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
}

const cronExpression = process.env.WARMUP_CRON_EXPRESSION || "*/1 * * * *";
const isDevMode = process.env.WARMUP_DEV_MODE === "true";

cron.schedule(cronExpression, async () => {
    try {
        const configs = await DailyWarmupConfig.find().lean();
        const nowHHMM = currentHHMM();

        for (const config of configs) {
            // DEV MODE: startTime ignore karo — jab bhi purana expire ho, turant naya bana do
            // PROD MODE: sirf exact startTime match pe generate karo
            if (isDevMode || config.startTime === nowHHMM) {
                await generateWarmupForExam(config.exam);
            }
        }

        await cleanupExpiredWarmups();
    } catch (err) {
        console.error("[daily-warmup] cron failed:", err);
    }
});