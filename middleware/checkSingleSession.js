export const checkSingleSession = async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) return next();

    if (req.user.activeSessionId && req.session.currentSessionId !== req.user.activeSessionId) {
        req.logout((err) => {
            if (err) return next(err);
           req.flash("error", "Your account was signed in on another device. For security reasons, you have been signed out.");
            req.session.save(() => res.redirect("/?showLogin=true"));
        });
        return;
    }

    next();
};