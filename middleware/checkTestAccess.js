import Test from "../models/Test.js";
import ExpressError from "../utils/ExpressError.js";
import { checkEnrollment } from "../utils/authHelpers.js";
import { cleanupExpiredBatchData } from "../utils/cleanupHelpers.js";   // 👈 NAYA

export const checkTestAccess = async (req, res, next) => {
    try {
        const testId = req.params.id || req.params.testId;

        const test = await Test.findById(testId);
        if (!test) throw new ExpressError(404, "Test Not Found");

        // 👇 CHANGED: purana behaviour bilkul waisa hi — pehle enrollment check
        if (checkEnrollment(req, test.listing)) {
            req.test = test;
            return next();
        }

        // 👇 NAYA: access fail hua — pata karo kya wajah SPECIFICALLY expiry hai
        // (suspend ya "kabhi enroll hi nahi hua" case me cleanup nahi chalega)
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

        // purana fallback message — jaisa pehle tha
        req.flash("error", "You must be enrolled in this batch to access this test.");
        return res.redirect(`/test/${test.listing}`);

    } catch (err) {
        next(err);
    }
};