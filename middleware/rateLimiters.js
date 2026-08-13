import rateLimit, { ipKeyGenerator } from "express-rate-limit";

 
const emailAndIpKeyGenerator = (req) => {
    const email = (req.body?.email || "unknown").toLowerCase().trim();
    const ip = ipKeyGenerator(req.ip);
    return `${ip}-${email}`;
};

const jsonRateLimitHandler = (message) => (req, res) => {
    res.status(429).json({
        success: false,
        error: message,
        message,
    });
};

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: emailAndIpKeyGenerator,
    handler: (req, res) => {
        req.flash("error", "Too many login attempts. Please try again after 15 minutes.");
        res.redirect(req.get("Referer") || "/");
    },
});

export const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: emailAndIpKeyGenerator,
    handler: jsonRateLimitHandler("Too many OTP requests. Please try again later."),
});

export const paymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler("Too many payment attempts. Please try again later."),
});