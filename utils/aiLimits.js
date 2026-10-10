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

 
 const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function todayDateString() {
    // IST calendar day, "YYYY-MM-DD" (server UTC par ho tab bhi raat 12 baje IST reset)
    return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function nextResetAt() {
    // Agli IST midnight (ISO string)
    const next = (Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - IST_OFFSET_MS;
    return new Date(next).toISOString();
}