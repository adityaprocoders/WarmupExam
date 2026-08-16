import User from "../models/usersShema.js";
import Listing from "../models/listing.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";   // 👈 CHANGED: shared file se import

export const checkSeriesAccess = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const listing = await Listing.findOne({ slug });
        if (!listing) {
            req.flash("error", "Test series not found.");
            return res.redirect("/dashboard");
        }

        const isOwnerUser =
            req.isOwner ||
            req.user?.permissions?.includes("owner") ||
            req.user?.role === "owner" ||
            (listing.owner && String(listing.owner) === String(req.user?._id));

        if (isOwnerUser) {
            req.listing = listing;
            return next();
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            req.flash("error", "Your session has expired. Please log in again.");
            return res.redirect("/login");
        }

        const enrollment = user.enrolledListings.find(
            e => String(e.listing) === String(listing._id)
        );

        if (!enrollment) {
            req.flash("error", "You are not enrolled in this test series.");
            return res.redirect("/dashboard");
        }

        const now = new Date();
        const isSuspended = enrollment.suspendedByOwner;
        const isExpired = enrollment.expiresAt && enrollment.expiresAt <= now;

        if (isExpired && !isSuspended) {
            await cleanupExpiredBatchData(user._id, listing._id);
            req.flash("error", "Your subscription has expired. The data associated with this batch has been removed.");
            return res.redirect("/dashboard");
        }

        if (isSuspended) {
            req.flash("error", "Your subscription has been suspended by the owner.");
            return res.redirect("/dashboard");
        }

        req.listing = listing;
        req.enrollment = enrollment;
        next();
    } catch (err) {
        console.error("Series access check error:", err);
        res.status(500).send("Something went wrong. Please try again.");
    }
};