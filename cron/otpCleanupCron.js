import cron from "node-cron";
import User from "../models/usersShema.js";

// Har ghante — expired reset-password OTPs clear karo (DB clean rakhne ke liye)
cron.schedule("0 * * * *", async () => {
    try {
        const result = await User.updateMany(
            {
                $or: [
                    { resetOtpExpiry: { $lt: new Date() }, resetOtp: { $ne: null } },
                    { resetTokenExpiry: { $lt: new Date() }, resetToken: { $ne: null } }
                ]
            },
            { $set: { resetOtp: null, resetOtpExpiry: null, resetToken: null, resetTokenExpiry: null } }
        );

        if (result.modifiedCount > 0) {
            console.log(`[otp-cleanup] ${result.modifiedCount} expired OTPs/tokens cleared`);
        }
    } catch (err) {
        console.error("[otp-cleanup] cron failed:", err);
    }
});