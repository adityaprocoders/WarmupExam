import cron from "node-cron";
import Notification from "../models/Notification.js";
import User from "../models/usersShema.js";
import Listing from "../models/listing.js";
import SubscriptionReminderLog from "../models/SubscriptionReminderLog.js";


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
          await Notification.deleteMany({ status: { $in: ["sent", "expired"] }, expiresAt: { $lte: now } });
    } catch (err) {
        console.error("[notification] cron failed:", err);
    }
});



// ---------- Subscription Expiring Reminder (7 / 3 / 1 din pehle) ----------
const REMINDER_DAYS = [1, 3, 7];   // chhoti se badi — pehla match = sabse chhoti window
const DAY_MS = 24 * 60 * 60 * 1000;

cron.schedule("0 9 * * *", async () => { // roz subah 9 baje (IST) chalega
    try {
        const now = new Date();
        const maxWindow = new Date(now.getTime() + 7 * DAY_MS);

        // Sirf paid + active (suspend nahi) enrollments, jo 7 din ke andar expire ho rahe hain
        const users = await User.find({
            enrolledListings: {
                $elemMatch: {
                    expiresAt: { $gt: now, $lte: maxWindow },
                    amountPaid: { $gt: 0 },
                    suspendedByOwner: { $ne: true }
                }
            }
        }).select("_id enrolledListings");

        for (const user of users) {
            try {   // ek user ka error baaki users ko na roke
                for (const enrollment of user.enrolledListings) {
                    if (!enrollment.expiresAt) continue;
                    if (!(enrollment.amountPaid > 0) || enrollment.suspendedByOwner) continue;

                    const msLeft = new Date(enrollment.expiresAt) - now;
                    if (msLeft <= 0) continue;

                    for (const days of REMINDER_DAYS) {
                        const withinWindow = msLeft <= days * DAY_MS;
                        if (!withinWindow) continue;

                        const logKey = {
                            user: user._id,
                            listing: enrollment.listing,
                            enrollmentExpiresAt: new Date(enrollment.expiresAt),
                            daysLeft: days
                        };
                        try {
                            await SubscriptionReminderLog.create(logKey);
                        } catch (err) {
                            if (err.code === 11000) break; // ye window ka reminder pehle ja chuka — badi window par mat jao
                            throw err;
                        }

                        const expiryTimeStr = new Date(enrollment.expiresAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit", month: "long", year: "numeric",
                            hour: "2-digit", minute: "2-digit"
                        });

                        // Kaunsa batch expire ho raha hai wo message me dikhe
                        const listingDoc = await Listing.findById(enrollment.listing).select("title").lean();
                        const batchText = listingDoc?.title ? ` to "${listingDoc.title}"` : "";

                        try {
                            await Notification.create({
                                title: "Subscription Expiring Soon",
                                message: `Your subscription${batchText} is expiring in ${days} day${days > 1 ? "s" : ""}, on ${expiryTimeStr}. Renew now to continue access.`,
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
                        } catch (err) {
                            await SubscriptionReminderLog.deleteOne(logKey).catch(() => {});
                            throw err;
                        }

                        break; // ek hi (sabse chhoti) window match hone ke baad loop se bahar
                    }
                }
            } catch (err) {
                console.error(`[subscription-expiry] user ${user._id} failed:`, err);
            }
        }
    } catch (err) {
        console.error("[subscription-expiry] cron failed:", err);
    }
}, { timezone: "Asia/Kolkata" });