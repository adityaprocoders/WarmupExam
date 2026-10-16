import User from "../models/usersShema.js";
import Test from "../models/Test.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";
import Listing from "../models/listing.js";
import LiveTestResult from "../models/LiveTestResult.js";

export async function cleanupExpiredBatchData(userId, listingId, { force = false } = {}) {
    const now = new Date();

    const user = await User.findById(userId).select("enrolledListings");
    if (!user) return;

    const entries = user.enrolledListings.filter(
        e => String(e.listing) === String(listingId)
    );
    if (entries.length === 0) return;

    // Suspended enrollment ko haath nahi lagana
    if (!force && entries.some(e => e.suspendedByOwner)) return;

    const hasValid = entries.some(e => !e.expiresAt || new Date(e.expiresAt) >= now);

    if (hasValid && !force) {
        // Valid entry maujood hai: sirf expired duplicate entries hatao, data mat chhuo
        await User.updateOne(
            { _id: userId },
            { $pull: { enrolledListings: { listing: listingId, expiresAt: { $lt: now } } } }
        );
        return;
    }

    // Saari entries expired hain (ya refund se force): data permanently delete.
        const testIds = await Test.find({ listing: listingId }).distinct("_id");
    const liveTestIds = await Test.find({ listing: listingId, isLiveTest: true }).distinct("_id");

    await Attempt.deleteMany({
        user: userId,
 
        $or: [{ listing: listingId }, { test: { $in: testIds } }]
    });

    if (testIds.length > 0) {
        await AttemptSession.deleteMany({ user: userId, test: { $in: testIds } });
    }

    const pullCond = force
        ? { listing: listingId }
        : { listing: listingId, expiresAt: { $lt: now } };   // fresh renewal kabhi nahi hatega
    await User.updateOne(
        { _id: userId },
        { $pull: { enrolledListings: pullCond } }
    );

    await User.updateOne(
        { _id: userId, lastAccessedBatch: listingId },
        { $set: { lastAccessedBatch: null } }
    );

    const expiredListing = await Listing.findById(listingId).select("exam").lean();
    if (expiredListing?.exam) {
        const otherValidIds = user.enrolledListings
            .filter(e => String(e.listing) !== String(listingId) && (!e.expiresAt || new Date(e.expiresAt) >= now))
            .map(e => e.listing);

        const sameExamLeft = otherValidIds.length > 0
            ? await Listing.exists({ _id: { $in: otherValidIds }, exam: expiredListing.exam })
            : null;

        if (!sameExamLeft) {
            await LiveTestResult.deleteMany({ user: userId, exam: expiredListing.exam });
        }
    }
}

export function getValidEnrollments(user) {
    const enrolledIds = [];
    const enrolledExpiryMap = {};

    if (user && user.enrolledListings) {
        const now = new Date();
        user.enrolledListings.forEach(e => {
            const isValid = !e.suspendedByOwner && (!e.expiresAt || new Date(e.expiresAt) > now);
            if (isValid) {
                const id = e.listing && e.listing._id ? e.listing._id : e.listing;
                enrolledIds.push(String(id));
                enrolledExpiryMap[String(id)] = e.expiresAt;
            }
        });
    }

    return { enrolledIds, enrolledExpiryMap };
}