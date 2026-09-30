import { getBanReasonLabel } from "../utils/banReasons.js";

export function checkBanned(req, res, next) {
    if (!req.user) return next();

    if (req.user.banned && req.user.banType === "temporary" &&
        req.user.banExpiresAt && new Date(req.user.banExpiresAt) < new Date()) {
        req.user.banned = false;
        req.user.banReason = null;
        req.user.banType = null;
        req.user.bannedAt = null;
        req.user.banExpiresAt = null;
        req.user.save().catch(() => {});
        return next();
    }

    if (req.user.banned) {
        const isApi = req.originalUrl.startsWith("/api/") || req.xhr;
        if (isApi) {
            return res.status(403).json({ success: false, error: "ACCOUNT_BANNED" });
        }
        if (req.originalUrl.startsWith("/logout")) {
            return next();
        }

        const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", {
            day: "numeric", month: "long", year: "numeric"
        }) : null;

        return res.render("pages/accountRestricted", {
            layout: false,
            banReasonLabel: getBanReasonLabel(req.user.banReason),
            banType: req.user.banType,
            bannedAtFormatted: fmtDate(req.user.bannedAt),
            banExpiresAtFormatted: fmtDate(req.user.banExpiresAt),
            userEmail: req.user.email,
            userId: req.user._id.toString(),
            title: "Account Restricted | WarmupExam",
            robots: "noindex, nofollow"
        });
    }
    next();
}