import cron from "node-cron";
import Notification from "../models/Notification.js";
import User from "../models/usersShema.js";


const cronExpression = process.env.NOTIFICATION_CRON_EXPRESSION || "*/1 * * * *";

cron.schedule(cronExpression, async () => {
    try {
        const now = new Date();

        // 1) Scheduled notifications jinka time aa gaya — "sent" bana do
        const due = await Notification.find({ status: "scheduled", scheduledAt: { $lte: now } });
        for (const notif of due) {
            notif.status = "sent";
            notif.sentAt = now;
            notif.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            await notif.save();
        }

        // 2) 24hr expiry guzar chuki — poora document DELETE (sabke liye, chahe personal ho ya multi)
        await Notification.deleteMany({ status: "sent", expiresAt: { $lte: now } });
    } catch (err) {
        console.error("[notification] cron failed:", err);
    }
});


// ---------- Subscription Expiring Reminder (7 / 3 / 1 din pehle) ----------
const REMINDER_DAYS = [7, 3, 1];
const DAY_MS = 24 * 60 * 60 * 1000;

cron.schedule("0 9 * * *", async () => { // roz subah 9 baje chalega
    try {
        const now = new Date();

        const users = await User.find({
            "enrolledListings.expiresAt": { $gt: now }
        }).select("_id enrolledListings");

        for (const user of users) {
            for (const enrollment of user.enrolledListings) {
                if (!enrollment.expiresAt) continue;

                const msLeft = new Date(enrollment.expiresAt) - now;
                if (msLeft <= 0) continue;

                for (const days of REMINDER_DAYS) {
                    const withinWindow = msLeft <= days * DAY_MS;
                    if (!withinWindow) continue;

                    // duplicate check — isi listing + isi user + isi daysLeft ke liye pehle se ban chuka?
                    const exists = await Notification.findOne({
                        notifType: "subscription_expiring",
                        "meta.listingId": enrollment.listing,
                        "meta.daysLeft": days,
                        customUserIds: user._id
                    });
                    if (exists) continue;

                    const expiryTimeStr = new Date(enrollment.expiresAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "long", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                    });

                    await Notification.create({
                        title: "Subscription Expiring Soon",
                        message: `Your subscription is expiring in ${days} day${days > 1 ? "s" : ""}, on ${expiryTimeStr}. Renew now to continue access.`,
                        audienceType: "custom",
                        customUserIds: [user._id],
                        status: "sent",
                        sentAt: now,
                        expiresAt: new Date(now.getTime() + DAY_MS),
                        estimatedReach: 1,
                        source: "auto",
                        notifType: "subscription_expiring",
                        meta: { listingId: enrollment.listing, daysLeft: days }
                    });

                    break; // ek hi (sabse chhoti) window match hone ke baad loop se bahar — 1-day wala match hua to 3/7 check karne ki zaroorat nahi isi listing ke liye is run me
                }
            }
        }
    } catch (err) {
        console.error("[subscription-expiry] cron failed:", err);
    }
});