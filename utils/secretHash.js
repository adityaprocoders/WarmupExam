import crypto from "crypto";

function getKey() {
    const key = process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET;
    if (!key) throw new Error("OTP_HASH_SECRET or SESSION_SECRET must be set");
    return key;
}

export function hashSecret(value) {
    return crypto.createHmac("sha256", getKey()).update(String(value)).digest("hex");
}

export function safeEqualHash(storedHash, plainValue) {
    if (!storedHash || plainValue === undefined || plainValue === null) return false;
    const a = Buffer.from(String(storedHash));
    const b = Buffer.from(hashSecret(plainValue));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}