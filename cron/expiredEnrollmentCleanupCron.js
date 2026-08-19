import cron from "node-cron";
import User from "../models/usersShema.js";
import Attempt from "../models/TestAttempt.js";

// Roz raat 3 baje — jin enrollments ki expiry guzar chuki hai unke Attempts delete karo
cron.schedule("0 3 * * *", async () => {
    try {
        const now = new Date();

        const users = await User.find({
            "enrolledListings.expiresAt": { $lt: now, $ne: null }
        }).select("_id enrolledListings");

        let totalDeleted = 0;

        for (const user of users) {
            const expiredListingIds = user.enrolledListings
                .filter(e => e.expiresAt && new Date(e.expiresAt) < now)
                .map(e => e.listing);

            if (expiredListingIds.length === 0) continue;

            const result = await Attempt.deleteMany({
                user: user._id,
                listing: { $in: expiredListingIds }
            });

            totalDeleted += result.deletedCount;
        }

        console.log(`[expiry-cleanup] ${users.length} users checked, ${totalDeleted} expired attempts deleted`);
    } catch (err) {
        console.error("[expiry-cleanup] cron failed:", err);
    }
});