import Question from "../models/Question.js";
import QuestionReport from "../models/QuestionReport.js";
import Listing from "../models/listing.js";

export const submitReport = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { reason, description } = req.body;
        const userId = req.user._id;

        const allowedReasons = ["Wrong Question", "Wrong Answer", "Wrong Solution", "Other"];
        if (!allowedReasons.includes(reason)) {
            return res.status(400).json({ success: false, message: "Invalid reason" });
        }

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ success: false, message: "Question nahi mili" });

        // 👇 Sirf Listing.type check — "Paid" (exact enum value, capital P)
        const listing = await Listing.findById(question.listing).select("type");
        if (!listing || listing.type !== "Paid") {
            return res.status(403).json({
                success: false,
                message: "Report is available only for questions in paid test series."
            });
        }

        let report = await QuestionReport.findOne({ question: questionId });

        if (!report) {
            report = await QuestionReport.create({
                question: questionId,
                reportedBy: userId,
                reason,
                description: reason === "Other" ? (description || "") : ""
            });
            if (question.status !== "Disabled") {
                question.status = "Reported";
                await question.save();
            }
            return res.json({ success: true, alreadyReported: false, message: "Thanks for reporting! Our team will review this within 24-48 hours." });
        }

        const alreadyReported =
            String(report.reportedBy) === String(userId) ||
            report.alsoReportedBy.some(id => String(id) === String(userId));

        if (alreadyReported) {
            return res.json({ success: true, alreadyReported: true, message: "You already reported this question." });
        }

        report.alsoReportedBy.push(userId);
        await report.save();
        return res.json({ success: true, alreadyReported: false, message: "Thanks for reporting! Our team will review this within 24-48 hours." });

    } catch (err) {
        console.error("Submit report error:", err);
        res.status(500).json({ success: false, message: "Report could not be submitted." });
    }
};