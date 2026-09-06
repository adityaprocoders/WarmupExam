import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Attempt from "../models/TestAttempt.js";
import ExpressError from "../utils/ExpressError.js";
import { checkEnrollment } from "../utils/authHelpers.js";
import { findOrCreateDailyWarmupTest } from "../utils/dailyWarmupGenerator.js";

export const showDailyWarmupSummary = async (req, res) => {
    const { slug } = req.params;

    const listing = await Listing.findOne({ slug });
    if (!listing) throw new ExpressError(404, "Series Not Found");

    if (!checkEnrollment(req, listing._id)) {
        req.flash("error", "You must be enrolled in this batch to access this page.");
        return res.redirect(`/test/${listing._id}`);
    }

    const sections = await Section.find({ listing: listing._id }).sort({ createdAt: 1 });
    const warmupTest = await findOrCreateDailyWarmupTest(req.user._id, listing._id);
    const existingAttempt = await Attempt.findOne({ test: warmupTest._id, user: req.user._id });

    res.render("dashboard/dailyWarmup", {
        layout: "layouts/dashboard",
        listing, sections,
        currentSection: null,
        isDailyWarmupPage: true,
        warmupTest,
        attempted: !!existingAttempt,
        attemptId: existingAttempt ? existingAttempt._id : null,

        // SEO — ye private/user-specific page hai, isliye index nahi hona chahiye
        title: `Daily Warmup | ${listing.title} | WarmupExam`,
        description: `Attempt your personalized Daily Warmup — 10 AI-selected questions from your weak areas, refreshed every day.`,
        robots: "noindex, nofollow"
    });
};