// utils/testStatus.js

const WINDOW_HOURS = 24;

export function getTestStatus(test) {
    if (test.visibility !== "scheduled" || !test.publishAt) {
        return { status: "live", publishAt: null, expiresAt: null };
    }

    const now = new Date();
    const publishAt = new Date(test.publishAt);
    const expiresAt = new Date(publishAt.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

    if (now < publishAt) return { status: "upcoming", publishAt, expiresAt };
    if (now > expiresAt) return { status: "expired", publishAt, expiresAt };
    return { status: "live", publishAt, expiresAt };
}

export function formatDateTime(date) {
    return new Date(date).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
    });
}