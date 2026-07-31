import { getDashboardRedirectUrl } from "../utils/authHelpers.js";

export const redirectIfLoggedIn = async (req, res, next) => {
    try {
        if (req.isAuthenticated() && req.user?.role === "owner") {
            return res.redirect("/owner-dashboard");
        }

        if (req.isAuthenticated() && req.user) {
            const dashboardUrl = await getDashboardRedirectUrl(req.user);
            if (dashboardUrl) {
                return res.redirect(dashboardUrl);
            }
        }

        next();
    } catch (err) {
        next(err);
    }
};