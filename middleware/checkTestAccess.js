import Listing from "../models/listing.js";
import Test from "../models/Test.js";
import ExpressError from "../utils/ExpressError.js";
import { checkEnrollment, isPaidListing, isOwnerUser } from "../utils/authHelpers.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";

// Live test exam ka hota hai: user ke paas us exam ki koi bhi VALID series ho to allow
async function hasValidSeriesForExam(user, exam) {
    if (!user || !exam) return false;

    const now = new Date();
    const validIds = (user.enrolledListings || [])
        .filter(e => e && e.listing && !e.suspendedByOwner && (!e.expiresAt || new Date(e.expiresAt) > now))
        .map(e => (e.listing._id ? e.listing._id : e.listing));

    if (validIds.length === 0) return false;
    return !!(await Listing.exists({ _id: { $in: validIds }, exam }));
}

export const checkTestAccess = async (req, res, next) => {
    try {
        const testId = req.params.id || req.params.testId;

        const test = await Test.findById(testId);
        if (!test) throw new ExpressError(404, "Test Not Found");

        // Live test: exam-wise access
        if (test.isLiveTest) {
            if (isOwnerUser(req) || await hasValidSeriesForExam(req.user, test.liveTestExam)) {
                req.test = test;
                return next();
            }
            req.flash("error", "You need an active test series of this exam to attempt the Live Test.");
            return res.redirect("/alltests");
        }

        // Normal test: pehle jaisa
        if (checkEnrollment(req, test.listing)) {
            if (test.isDailyWarmup) {
                const listing = await Listing.findById(test.listing).select("type slug");
                if (!isPaidListing(listing)) {
                    req.flash("error", "Daily Warmup is available only for paid batches.");
                    return res.redirect(`/test/${test.listing}`);
                }
            }
            req.test = test;
            return next();
        }

        const enrollment = req.user?.enrolledListings?.find(e => {
            const id = e.listing && e.listing._id ? e.listing._id : e.listing;
            return String(id) === String(test.listing);
        });

        const now = new Date();
        const isExpired = enrollment
            && enrollment.expiresAt
            && new Date(enrollment.expiresAt) <= now
            && !enrollment.suspendedByOwner;

        if (isExpired) {
            await cleanupExpiredBatchData(req.user._id, test.listing);
            req.flash("error", "Your subscription has expired, and access to this batch is no longer available.");
            return res.redirect(`/test/${test.listing}`);
        }

        req.flash("error", "You must be enrolled in this batch to access this test.");
        return res.redirect(`/test/${test.listing}`);

    } catch (err) {
        next(err);
    }
};