import Notification from "../models/Notification.js";

// ---------------- STUDENT: GET MY NOTIFICATIONS ----------------
export const getMyNotifications = async (req, res) => {
    try {
        const now = new Date();
        const userId = req.user._id;

        const hasActiveSub = (req.user.enrolledListings || []).some(e =>
            !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now) && e.amountPaid > 0
        );
        const audienceMatch = hasActiveSub ? ["all", "paid"] : ["all", "free"];

        const notifications = await Notification.find({
            status: "sent",
            expiresAt: { $gt: now },
            clearedBy: { $ne: userId },   // 👈 multi-recipient wali jo isne clear ki, wo exclude
            $or: [
                { audienceType: { $in: audienceMatch } },
                { audienceType: "custom", customUserIds: userId }
            ]
        }).sort({ sentAt: -1 }).limit(30).lean();

        const unseen = notifications.filter(n => !n.seenBy?.some(id => String(id) === String(userId)));

        res.json({ success: true, notifications, unseenCount: unseen.length });
    } catch (err) {
        console.error("Get my notifications error:", err);
        res.status(500).json({ success: false, message: "Notifications load nahi ho payi" });
    }
};

// ---------------- STUDENT: MARK ALL AS SEEN ----------------
export const markNotificationsSeen = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();

        await Notification.updateMany(
            { status: "sent", expiresAt: { $gt: now }, seenBy: { $ne: userId } },
            { $addToSet: { seenBy: userId } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Mark seen error:", err);
        res.status(500).json({ success: false, message: "Update nahi ho paya" });
    }
};

// ---------------- STUDENT: CLEAR MY NOTIFICATIONS ----------------
// Recipient count ke hisaab se decide karta hai: single-recipient (personal) → poora
// document delete. Multi-recipient (all/paid/free/custom-multiple) → sirf is user
// ke liye clearedBy me add, baaki students ko dikhti rahegi.
export const clearMyNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();

        const notifications = await Notification.find({
            status: "sent",
            expiresAt: { $gt: now },
            clearedBy: { $ne: userId }
        });

        const singleRecipientIds = [];
        const multiRecipientIds = [];

        for (const notif of notifications) {
            const isSingleRecipient =
                notif.audienceType === "custom" && notif.customUserIds.length === 1;

            if (isSingleRecipient) {
                singleRecipientIds.push(notif._id);
            } else {
                multiRecipientIds.push(notif._id);
            }
        }

        if (singleRecipientIds.length > 0) {
            await Notification.deleteMany({ _id: { $in: singleRecipientIds } });
        }

        if (multiRecipientIds.length > 0) {
            await Notification.updateMany(
                { _id: { $in: multiRecipientIds } },
                { $addToSet: { clearedBy: userId } }
            );
        }

        res.json({ success: true, message: "Notifications clear ho gayi" });
    } catch (err) {
        console.error("Clear notifications error:", err);
        res.status(500).json({ success: false, message: "Clear nahi ho paya" });
    }
};