import Test from "../models/Test.js";
import ExpressError from "../utils/ExpressError.js";
import { checkEnrollment } from "../utils/authHelpers.js";

export const checkTestAccess = async (req, res, next) => {
    try {
        const testId = req.params.id || req.params.testId;

        const test = await Test.findById(testId);
        if (!test) throw new ExpressError(404, "Test Not Found");

        if (!checkEnrollment(req, test.listing)) {
            req.flash("error", "You must be enrolled in this batch to access this test.");
            return res.redirect(`/test/${test.listing}`);
        }

        req.test = test;  
        next();
    } catch (err) {
        next(err);
    }
};