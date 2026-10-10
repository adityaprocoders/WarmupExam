import Notification from "../models/Notification.js";


// Is user ko kaunsi notifications dikhni chahiye (teeno functions yahi use karte hain)
const getAudienceFilter = (user) => {
    const now = new Date();
    const hasActiveSub = (user.enrolledListings || []).some(e =>
        !e.suspendedByOwner && (!e.expiresAt || e.expiresAt > now) && e.amountPaid > 0
    );
    const audienceMatch = hasActiveSub ? ["all", "paid"] : ["all", "free"];
    return {
        $or: [
            { audienceType: { $in: audienceMatch } },
            { audienceType: "custom", customUserIds: user._id }
        ]
    };
};

// ---------------- STUDENT: GET MY NOTIFICATIONS ----------------
export const getMyNotifications = async (req, res) => {
    try {
               if (req.user.role === "owner") {
            return res.json({ success: true, notifications: [], unseenCount: 0 });
        }

        const now = new Date();
        const userId = req.user._id;

                const baseFilter = {
            status: "sent",
            expiresAt: { $gt: now },
            clearedBy: { $ne: userId },
            ...getAudienceFilter(req.user)
        };

        // Sirf wahi fields jo bell dropdown ko chahiye — seenBy / clearedBy / customUserIds / createdBy bahar nahi jaate
        const [notifications, unseenCount] = await Promise.all([
            Notification.find(baseFilter)
                .select("title message sentAt notifType meta.listingId")
                .sort({ sentAt: -1 }).limit(30).lean(),
            Notification.countDocuments({ ...baseFilter, seenBy: { $ne: userId } })   // sirf latest 30 nahi, sab ka count
        ]);

        res.json({ success: true, notifications, unseenCount });
    } catch (err) {
        console.error("Get my notifications error:", err);
        res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
};

// ---------------- STUDENT: MARK ALL AS SEEN ----------------
export const markNotificationsSeen = async (req, res) => {
    try {
        if (req.user.role === "owner") return res.json({ success: true });

        const userId = req.user._id;
        const now = new Date();

        await Notification.updateMany(
            {
                status: "sent",
                expiresAt: { $gt: now },
                seenBy: { $ne: userId },
                ...getAudienceFilter(req.user)
            },
            { $addToSet: { seenBy: userId } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Mark seen error:", err);
        res.status(500).json({ success: false, message: "Failed to update." });
    }
};

// ---------------- STUDENT: CLEAR MY NOTIFICATIONS ----------------
// Recipient count ke hisaab se decide karta hai: single-recipient (personal) → poora
// document delete. Multi-recipient (all/paid/free/custom-multiple) → sirf is user
// ke liye clearedBy me add, baaki students ko dikhti rahegi.
export const clearMyNotifications = async (req, res) => {
    try {
        if (req.user.role === "owner") return res.json({ success: true });

        const userId = req.user._id;
        const now = new Date();

        // Sirf wahi notifications jo is user ko dikhti hain
        const mine = {
            status: "sent",
            expiresAt: { $gt: now },
            clearedBy: { $ne: userId },
            ...getAudienceFilter(req.user)
        };

        // 1) Sirf is user ki personal (single-recipient) notifications delete
        await Notification.deleteMany({
            ...mine,
            audienceType: "custom",
            customUserIds: { $size: 1, $all: [userId] }
        });

        // 2) Baaki (all/paid/free/multi-custom): sirf is user ke liye clear
        await Notification.updateMany(mine, { $addToSet: { clearedBy: userId } });

        res.json({ success: true, message: "Notifications cleared successfully." });
    } catch (err) {
        console.error("Clear notifications error:", err);
        res.status(500).json({ success: false, message: "Failed to clear notifications." });
    }
};