import Listing from "../models/listing.js";
import User from "../models/usersShema.js";
import Notification from "../models/Notification.js";

export const notifyNewTestSeries = async (newListing) => {
    const exam = newListing.exam;

    // isi exam ke purane listings dhundo (naya wala chhod ke)
    const oldListingsOfExam = await Listing.find({
        exam,
        _id: { $ne: newListing._id }
    }).select("_id");

    if (oldListingsOfExam.length === 0) return; // ye exam ka pehla hi listing hai

    const oldListingIds = oldListingsOfExam.map(l => l._id);

    // un purane listings me enrolled users dhundo
    const enrolledUsers = await User.find({
        "enrolledListings.listing": { $in: oldListingIds }
    }).select("_id");

    if (enrolledUsers.length === 0) return;

    const userIds = enrolledUsers.map(u => u._id);

    await Notification.create({
        title: "New Test Series Available",
        message: `A new test series "${newListing.title}" is now available for ${exam}.`,
        audienceType: "custom",
        customUserIds: userIds,
        status: "sent",
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        estimatedReach: userIds.length,
        source: "auto",
        notifType: "new_test_series",
        meta: { exam, listingId: newListing._id }
    });
};