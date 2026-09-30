import ExpressError from "../utils/ExpressError.js";

// User authenticated hai ya nahi check karta hai
export function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    const isApiRequest = req.originalUrl.startsWith("/api/") || req.xhr;

    if (isApiRequest) {
        let returnTo = "/";
        if (req.headers.referer) {
            try {
                const refUrl = new URL(req.headers.referer);
                returnTo = refUrl.pathname + refUrl.search;
            } catch (_) {}
        }
        req.session.returnTo = returnTo;
        return res.status(401).json({
            success: false,
            error: "LOGIN_REQUIRED",
            message: "Please login to continue.",
            returnTo,
        });
    }

    req.session.returnTo = req.originalUrl;
    req.flash("error", "Please login to continue");
    return res.redirect("/?showLogin=true");
}

// Sirf Owner ke liye
export const isOwner = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "owner") {
        return next();
    }
    if (req.originalUrl.startsWith("/api/") || req.xhr) {
        return res.status(404).json({ success: false, message: "Not found" });
    }
    return next(new ExpressError(404, "Page Not Found"));
};

// Already logged in user login/register page pe na jaaye (optional use)
export function isLoggedOut(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    return next();
}