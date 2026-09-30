export const BAN_REASONS = {
    CHEATING: { label: "Cheating during a test", group: "Academic Integrity" },
    QUESTION_ANSWER_SHARING: { label: "Sharing question/answer content", group: "Academic Integrity" },
    TEST_RESULT_MANIPULATION: { label: "Manipulating test results", group: "Academic Integrity" },
    LEADERBOARD_MANIPULATION: { label: "Manipulating leaderboard rankings", group: "Academic Integrity" },
    UNAUTHORIZED_TEST_ASSISTANCE: { label: "Unauthorized test assistance", group: "Academic Integrity" },

    ACCOUNT_SHARING: { label: "Account sharing", group: "Account & Payment Abuse" },
    MULTIPLE_ACCOUNT_ABUSE: { label: "Multiple account abuse", group: "Account & Payment Abuse" },
    UNAUTHORIZED_ACCESS: { label: "Unauthorized access", group: "Account & Payment Abuse" },
    PAID_CONTENT_ABUSE: { label: "Paid content abuse", group: "Account & Payment Abuse" },
    COUPON_OFFER_ABUSE: { label: "Coupon/offer abuse", group: "Account & Payment Abuse" },
    PAYMENT_REFUND_ABUSE: { label: "Payment/refund abuse", group: "Account & Payment Abuse" },

    BOT_AUTOMATION: { label: "Bot / automation usage", group: "Technical Abuse" },
    API_ABUSE: { label: "API abuse", group: "Technical Abuse" },
    DATA_SCRAPING: { label: "Data scraping", group: "Technical Abuse" },
    VULNERABILITY_EXPLOITATION: { label: "Exploiting a vulnerability", group: "Technical Abuse" },
    RESTRICTION_BYPASS: { label: "Bypassing platform restrictions", group: "Technical Abuse" },

    SPAM: { label: "Spam", group: "Conduct Violations" },
    HARASSMENT: { label: "Harassment", group: "Conduct Violations" },
    THREATENING_BEHAVIOR: { label: "Threatening behavior", group: "Conduct Violations" },
    FRAUDULENT_ACTIVITY: { label: "Fraudulent activity", group: "Conduct Violations" },
    IMPERSONATION: { label: "Impersonation", group: "Conduct Violations" },

    SUSPICIOUS_ACTIVITY: { label: "Suspicious activity", group: "Security" },
    COMPROMISED_ACCOUNT: { label: "Compromised account", group: "Security" },
    SECURITY_VIOLATION: { label: "Security violation", group: "Security" },

    REPEATED_POLICY_VIOLATION: { label: "Repeated policy violations", group: "General" },
    TERMS_VIOLATION: { label: "Violation of platform policies", group: "General" },
    OTHER: { label: "Violation of platform policies", group: "General" },
};

export function getBanReasonLabel(code) {
    return BAN_REASONS[code]?.label || "Violation of platform policies";
}