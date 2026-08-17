import { doubleCsrf } from "csrf-csrf";

const isProd = process.env.NODE_ENV === "production";

export const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,

    // getSecret: () => process.env.SESSION_SECRET,

    cookieName: "csrf-token",
    cookieOptions: {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    size: 64,
    getSessionIdentifier: (req) => req.sessionID,
    getCsrfTokenFromRequest: (req) => req.body?._csrf || req.headers["x-csrf-token"],
});