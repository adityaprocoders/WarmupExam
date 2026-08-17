import ExpressError from "../utils/ExpressError.js";


export function isOwnerUser(req) {
    return !!(req.user && req.user.role === "owner");
}

export function checkEnrollment(req, listingId) {
    if (isOwnerUser(req)) return true;
    if (!req.user || !req.user.enrolledListings) return false;

    return req.user.enrolledListings.some(e => {
        const id = e.listing && e.listing._id ? e.listing._id : e.listing;
        const matchesListing = String(id) === String(listingId);
        if (!matchesListing) return false;

        if (e.expiresAt && new Date(e.expiresAt) < new Date()) {
            return false;
        }

        if (e.suspendedByOwner) {          
            return false;
        }

        return true;
    });
}

export async function getDashboardRedirectUrl(user) {
    if (!user || user.role === "owner") return null;
    if (!user.enrolledListings || user.enrolledListings.length === 0) return null;

    await user.populate([
        { path: "enrolledListings.listing", select: "slug" },
        { path: "lastAccessedBatch", select: "slug" }
    ]);

    const target = user.lastAccessedBatch
        ? user.lastAccessedBatch
        : user.enrolledListings[0].listing;

    return target && target.slug ? `/series/${target.slug}` : null;
}

export function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    req.flash("error", "Please login to continue");
    return res.redirect("/?showLogin=true");
}

export const isOwner = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "owner") {
        return next();
    }
    if (req.originalUrl.startsWith("/api/") || req.xhr) {
        return res.status(404).json({ success: false, message: "Not found" });
    }
    return next(new ExpressError(404, "Page Not Found"));
};

export function isLoggedOut(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect("/");
    }
    return next();
}