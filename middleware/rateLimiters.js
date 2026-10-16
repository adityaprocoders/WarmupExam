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
        keyGenerator: (req) => (req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip)),
});

export const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonRateLimitHandler("Too many messages sent. Please try again later."),
});


const userOrIpKey = (req) => (req.user?._id ? String(req.user._id) : ipKeyGenerator(req.ip));

export const customTestAvailabilityLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    handler: jsonRateLimitHandler("Too many requests. Please slow down and try again in a minute."),
});

export const customTestGenerateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    handler: jsonRateLimitHandler("Too many papers generated. Please try again in a few minutes."),
});


export const verifyOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: emailAndIpKeyGenerator,
    handler: jsonRateLimitHandler("Too many attempts. Please try again after 15 minutes."),
});




export const deleteAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    handler: jsonRateLimitHandler("Too many attempts. Please try again after 15 minutes."),
});