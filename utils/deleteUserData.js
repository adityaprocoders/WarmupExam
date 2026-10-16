import mongoose from "mongoose";
import SubscriptionReminderLog from "../models/SubscriptionReminderLog.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Coupon from "../models/coupon.js";
import Ebook from "../models/Ebook.js";
import Notification from "../models/Notification.js";
import QuestionReport from "../models/QuestionReport.js";
import PaymentRecord from "../models/PaymentRecord.js";

// true karoge to PaymentRecord poora delete hoga, false me sirf naam/email/UPI hat jaate hain
const HARD_DELETE_PAYMENT_RECORDS = false;

export async function deleteExtraUserData(userId) {
    await SubscriptionReminderLog.deleteMany({ user: userId });

    const warmupTestIds = await Test.find({ dailyWarmupUser: userId }).distinct("_id");
    if (warmupTestIds.length > 0) {
        await TestQuestion.deleteMany({ test: { $in: warmupTestIds } });
        await Test.deleteMany({ _id: { $in: warmupTestIds } });
    }

    await Coupon.updateMany({ "usedBy.user": userId }, { $pull: { usedBy: { user: userId } } });
    await Ebook.updateMany({ "purchasedBy.user": userId }, { $pull: { purchasedBy: { user: userId } } });
    await Notification.updateMany(
        { $or: [{ customUserIds: userId }, { seenBy: userId }, { clearedBy: userId }] },
        { $pull: { customUserIds: userId, seenBy: userId, clearedBy: userId } }
    );

    const myReports = await QuestionReport.find({ reportedBy: userId });
    for (const report of myReports) {
        const others = (report.alsoReportedBy || []).filter(id => String(id) !== String(userId));
        if (others.length > 0) {
            report.reportedBy = others[0];
            report.alsoReportedBy = others.slice(1);
            await report.save();
        } else {
            await report.deleteOne();
        }
    }
    await QuestionReport.updateMany({ alsoReportedBy: userId }, { $pull: { alsoReportedBy: userId } });

    if (HARD_DELETE_PAYMENT_RECORDS) {
        await PaymentRecord.deleteMany({ user: userId });
    } else {
        await PaymentRecord.updateMany(
            { user: userId },
            { $set: { userName: "Deleted User", userEmail: "", methodDetail: "" } }
        );
    }

    try {
        await mongoose.connection.db
            .collection("sessions")
            .deleteMany({ session: { $regex: String(userId) } });
    } catch (err) {
        console.error("Session cleanup failed:", err.message);
    }
}