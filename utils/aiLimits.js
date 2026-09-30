// Tier-wise AI Paper Generator limits — sab ek jagah, easy to tune later
export const AI_LIMITS = {
    free: {
        questionsPerDay: 10,
        questionsPerRequest: 10,
        apiCallsPerDay: 2,
        textCharsPerRequest: 5000,
        textCharsPerDay: 10000,
        pdfAllowed: false,
        pdfMaxSizeMB: 0,
        pdfMaxPages: 0,
        imagesPerRequest: 1,
        imageMaxSizeMB: 5,
        requestsPerMinute: 2,
        imagesPerDay: 1,
        pdfMBPerDay: 0,
    },
    pro: {
        questionsPerDay: 100,
        questionsPerRequest: 25,
        apiCallsPerDay: 20,
        textCharsPerRequest: 25000,
        textCharsPerDay: 100000,
        pdfAllowed: true,
        pdfMaxSizeMB: 20,
        pdfMaxPages: 50,
        imagesPerRequest: 5,
        imageMaxSizeMB: 10,
        requestsPerMinute: 5,
        imagesPerDay: 5,
        pdfMBPerDay: 20,
    },
    promax: {
        questionsPerDay: 300,
        questionsPerRequest: 50,
        apiCallsPerDay: 50,
        textCharsPerRequest: 50000,
        textCharsPerDay: 300000,
        pdfAllowed: true,
        pdfMaxSizeMB: 50,
        pdfMaxPages: 100,
        imagesPerRequest: 10,
        imageMaxSizeMB: 15,
        requestsPerMinute: 10,
        imagesPerDay: 10,
        pdfMBPerDay: 50,
    },
};

export function getLimitsForTier(tier) {
    return AI_LIMITS[tier] || AI_LIMITS.free;
}

export function todayDateString() {
    // Server local date, "YYYY-MM-DD" — calendar-day reset
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

 
export function nextResetAt() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.toISOString();
}