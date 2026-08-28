import cron from "node-cron";
import User from "../models/usersShema.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";

cron.schedule("0 3 * * *", async () => {
    try {
        const now = new Date();

        const users = await User.find({
            "enrolledListings.expiresAt": { $lt: now, $ne: null }
        }).select("_id enrolledListings");

        let totalCleaned = 0;

        for (const user of users) {
            const expiredListingIds = user.enrolledListings
                .filter(e => e.expiresAt && new Date(e.expiresAt) < now)
                .map(e => e.listing);

            for (const listingId of expiredListingIds) {
                await cleanupExpiredBatchData(user._id, listingId);
                totalCleaned++;
            }
        }

        console.log(`[expiry-cleanup] ${users.length} users checked, ${totalCleaned} expired batches cleaned`);
    } catch (err) {
        console.error("[expiry-cleanup] cron failed:", err);
    }
});