import Notification from "../models/Notification.js";

// ---------------- STUDENT: GET MY NOTIFICATIONS ----------------
export const getMyNotifications = async (req, res) => {
    try {
        const now = new Date();
        const userId = req.user._id;

        const hasActiveSub = (req.user.enrolledListings || []).some(e =>
            !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now) && e.amountPaid > 0
        );
        const audienceMatch = hasActiveSub
            ? ["all", "paid"]
            : ["all", "free"];

        const notifications = await Notification.find({
            status: "sent",
            expiresAt: { $gt: now },
            $or: [
                { audienceType: { $in: audienceMatch } },
                { audienceType: "custom", customUserIds: userId }
            ]
        }).sort({ sentAt: -1 }).limit(30).lean();

        const unseen = notifications.filter(n => !n.seenBy?.some(id => String(id) === String(userId)));

        res.json({
            success: true,
            notifications,
            unseenCount: unseen.length
        });
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


export const clearMyNotifications = async (req, res) => {
    try {
        const userId = req.user._id;
        const now = new Date();

        await Notification.updateMany(
            { status: "sent", expiresAt: { $gt: now }, clearedBy: { $ne: userId } },
            { $addToSet: { clearedBy: userId } }
        );

        res.json({ success: true, message: "Notifications clear ho gayi" });
    } catch (err) {
        console.error("Clear notifications error:", err);
        res.status(500).json({ success: false, message: "Clear nahi ho paya" });
    }
};