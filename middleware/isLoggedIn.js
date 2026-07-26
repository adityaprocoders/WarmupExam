// User authenticated hai ya nahi check karta hai
export function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
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
        return res.status(403).json({ success: false, message: "Owner access required" });
    }
    req.flash("error", "Owner access required");
    res.redirect("/owner-login");
};

// Already logged in user login/register page pe na jaaye (optional use)
export function isLoggedOut(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    return next();
}