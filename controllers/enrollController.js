import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import ExpressError from "../utils/ExpressError.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";

export const enrollListing = async (req, res) => {
    const { listingId } = req.params;

    const listing = await Listing.findById(listingId);
    if (!listing) throw new ExpressError(404, "Test Series Not Found");

    if (listing.type !== "Free") {
        throw new ExpressError(400, "This is a paid batch. Please complete the payment to enroll.");
    }

    const userId = req.user._id;


        const suspended = await User.exists({
        _id: userId,
        enrolledListings: { $elemMatch: { listing: listingId, suspendedByOwner: true } }
    });
    if (suspended) {
        return res.status(403).json({
            success: false,
            message: "Your access to this series is suspended. Please contact support."
        });
    }

    // Agar purani entry expire ho chuki hai (cron se pehle), to pehle uska data saaf karo.
    // Valid entry ho to ye kuch delete nahi karega.
    await cleanupExpiredBatchData(userId, listingId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (listing.validityDays || 365));

    // Atomic: push tabhi hoga jab is listing ki koi entry hai hi nahi
    const result = await User.updateOne(
        { _id: userId, "enrolledListings.listing": { $ne: listingId } },
        { $push: { enrolledListings: { listing: listingId, enrolledAt: new Date(), expiresAt } } }
    );

    if (result.modifiedCount === 1) {
        req.flash("success", `🎉 Enrolled successfully in "${listing.title}"! Start your test now.`);
    } else {
        req.flash("success", `Welcome back! Continue "${listing.title}".`);
    }

    res.status(200).json({ success: true, slug: listing.slug });
};