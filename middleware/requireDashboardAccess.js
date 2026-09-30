export function requireDashboardAccess(req, res, next) {
    if (req.user.role === "owner") return next();
    const now = new Date();
    const hasAny = (req.user.enrolledListings || []).some(
        (e) => e && e.listing && (!e.expiresAt || new Date(e.expiresAt) > now) && !e.suspendedByOwner
    );
    if (hasAny) return next();
    req.flash("error", "Please enroll in a free or paid batch first to access the dashboard.");
    return res.redirect("/categories");
}