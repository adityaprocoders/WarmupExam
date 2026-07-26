// middleware/checkEnrollmentAccess.js
import User from "../models/usersShema.js";
import Listing from "../models/listing.js";

// Series (slug based) ke liye
export const checkSeriesAccess = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const listing = await Listing.findOne({ slug });
        if (!listing) {
            req.flash("error", "Test series nahi mili");
            return res.redirect("/dashboard");
        }

        // ✅ FIX: Owner check ko robust banaya — pehle sirf req.user.permissions
        // aur req.isOwner check ho raha tha, jo agar kisi wajah se match nahi
        // hota (jaise role field alag naam se hai, ya listing ka owner khud
        // login kiya hua current user hai), to code neeche User.findById()
        // tak chala jaata tha — aur owner ka record usersShema me match na
        // hone/expected shape na hone ki wajah se null aa raha tha, jisse
        // crash ho raha tha.
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

        // ✅ FIX: null-check — agar user record na mile (session stale/invalid),
        // crash karne ke bajaye clean redirect karo login pe.
        if (!user) {
            req.flash("error", "Aapka session invalid ho gaya hai. Please dobara login karo.");
            return res.redirect("/login");
        }

        const enrollment = user.enrolledListings.find(
            e => String(e.listing) === String(listing._id)
        );

        if (!enrollment) {
            req.flash("error", "Aap is test series me enrolled nahi hain");
            return res.redirect("/dashboard");
        }

        const now = new Date();
        const isSuspended = enrollment.suspendedByOwner;
        const isExpired = enrollment.expiresAt && enrollment.expiresAt <= now;

        if (isSuspended || isExpired) {
            req.flash("error", isSuspended
                ? "Aapka subscription owner ne suspend kar diya hai."
                : "Aapka subscription expire ho chuka hai."
            );
            return res.redirect("/dashboard");
        }

        req.listing = listing;
        req.enrollment = enrollment;
        next();
    } catch (err) {
        console.error("Series access check error:", err);
        res.status(500).send("Kuch galat ho gaya");
    }
};