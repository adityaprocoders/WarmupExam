import User from "../models/usersShema.js";
import Test from "../models/Test.js";
import Attempt from "../models/TestAttempt.js";
import AttemptSession from "../models/AttemptSession.js";

// Ek batch (listing) ki validity expire hone par, us user ka is batch se
// related saara test-data delete karta hai. Account/profile bilkul untouched.
export async function cleanupExpiredBatchData(userId, listingId) {
    const testIds = await Test.find({ listing: listingId }).distinct("_id");

    // 1) Attempts (scores, answers, poori analysis history)
    await Attempt.deleteMany({ user: userId, listing: listingId });

    // 2) Koi beech-mein-chhoda-hua AttemptSession
    if (testIds.length > 0) {
        await AttemptSession.deleteMany({ user: userId, test: { $in: testIds } });
    }

    // 3) enrolledListings se is batch ki entry poori tarah hata do
    await User.updateOne(
        { _id: userId },
        { $pull: { enrolledListings: { listing: listingId } } }
    );

    // 4) lastAccessedBatch agar isi listing ko point kar raha tha, clear karo
    await User.updateOne(
        { _id: userId, lastAccessedBatch: listingId },
        { $set: { lastAccessedBatch: null } }
    );
}