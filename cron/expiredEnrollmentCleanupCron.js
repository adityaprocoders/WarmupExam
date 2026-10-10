import cron from "node-cron";
import User from "../models/usersShema.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";

cron.schedule("0 3 * * *", async () => {
    try {
        const now = new Date();
        const users = await User.find({
            "enrolledListings.expiresAt": { $lt: now }
        }).select("_id enrolledListings");

        let cleaned = 0;
        for (const user of users) {
            const ids = [...new Set(
                user.enrolledListings
                    .filter(e => e.listing && e.expiresAt && new Date(e.expiresAt) < now)
                    .map(e => String(e.listing))
            )];

            for (const listingId of ids) {
                try {
                    await cleanupExpiredBatchData(user._id, listingId);
                    cleaned++;
                } catch (err) {
                    console.error(`[expiry-cleanup] user ${user._id} listing ${listingId} failed:`, err);
                }
            }
        }
        console.log(`[expiry-cleanup] ${users.length} users checked, ${cleaned} batches processed`);
    } catch (err) {
        console.error("[expiry-cleanup] cron failed:", err);
    }
});