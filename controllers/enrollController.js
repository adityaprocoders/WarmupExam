import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import ExpressError from "../utils/ExpressError.js";

export const enrollListing = async (req, res) => {
    const { listingId } = req.params;

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    const user = await User.findById(req.user._id);

    const alreadyEnrolled = user.enrolledListings.some(
        e => String(e.listing) === String(listingId)
    );

    if (!alreadyEnrolled) {
        // validityDays ke hisaab se expiry date calculate karo
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (listing.validityDays || 365));

        user.enrolledListings.push({ listing: listingId, expiresAt });
        await user.save();
        req.flash("success", `🎉 Enrolled successfully in "${listing.title}"! Start your test now.`);
    } else {
        req.flash("success", `Welcome back! Continue "${listing.title}".`);
    }

    res.status(200).json({ success: true, slug: listing.slug });
};