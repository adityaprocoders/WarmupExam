import resend from "../utils/mailer.js";
import bcrypt from "bcrypt";
import passport from "../config/passport.js";
import ExpressError from "../utils/ExpressError.js";
import User from "../models/usersShema.js";
import { getDashboardRedirectUrl } from "../utils/authHelpers.js";
import { logOwnerLogin } from "../utils/loginLogger.js";
import LoginHistory from "../models/LoginHistory.js";
import { generateSessionId } from "../utils/sessionHelper.js";
import { isSafeRedirectPath } from "../utils/safeRedirect.js";
import crypto from "crypto";
import { generateOtp, hashSecret, safeEqualHash } from "../utils/secretHash.js";
import { buildOtpEmail } from "../utils/emailTemplates/otpEmail.js";

const guardAsync = (next, fn) => (err) => {
    if (err) return next(err);
    Promise.resolve().then(fn).catch(next);
};


export const renderOwnerLogin = (req, res) => res.render("auth/owner-login", {
    title: "Login | WarmupExam",
    robots: "noindex, nofollow",
    loginPath: `/${process.env.OWNER_LOGIN_PATH}`
});

export const ownerLogin = (req, res, next) => {
    passport.authenticate("owner-local", (err, owner, info) => {
        if (err) return next(err);

        if (!owner) {
            req.flash("error", "Invalid owner credentials");
            return req.session.save(() => res.redirect(`/${process.env.OWNER_LOGIN_PATH}`));
        }

        req.login(owner, guardAsync(next, async () => {
            const newSessionId = generateSessionId();
            req.session.currentSessionId = newSessionId;

            try {
                await logOwnerLogin(req, owner);

                await LoginHistory.create({
                    ownerEmail: req.body.email,
                    ipAddress: req.ip || req.headers["x-forwarded-for"] || "Unknown",
                    userAgent: req.headers["user-agent"] || "",
                    device: req.headers["user-agent"] || "Unknown",
                    location: "Unknown",
                    status: "success"
                });
            } catch (logErr) {
                console.error("Owner login history failed:", logErr);
            }

            req.flash("success", "Welcome Owner!");
            req.session.save(() => res.redirect("/owner-dashboard"));
        }));
    })(req, res, next);
};;


export const getLoginHistoryApi = async (req, res) => {
  try {
    const history = await LoginHistory.find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load history" });
  }
};

export const deleteLoginHistoryEntry = async (req, res) => {
  try {
    const { id } = req.params;
    await LoginHistory.findOneAndDelete({ _id: id, ownerEmail: req.user.email });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

export const ownerDashboard = (req, res) => res.render("owner/dashboard", { 
    user: req.user,
    robots: "noindex, nofollow"
});

export const renderRegister = (req, res) => res.redirect("/?showLogin=true");

export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const cleaned = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: cleaned });

        if (existingUser) {
            req.flash("error", "Email already registered, please login instead");
            return req.session.save(() => {
                res.redirect("/?showLogin=true");
            });
        }

        const newUser = await User.create({ name, email: cleaned, password, authProvider: "local" });

        req.login(newUser, guardAsync(next, async () => {
            const newSessionId = generateSessionId();
            newUser.activeSessionId = newSessionId;
            await newUser.save();
            req.session.currentSessionId = newSessionId;

            req.flash("success", "Account created successfully!");
            const sessionReturnTo = req.session.returnTo;
            const hasSessionReturnTo = sessionReturnTo
                && isSafeRedirectPath(sessionReturnTo)
                && sessionReturnTo !== '/';

            const redirectUrl = (req.body.returnTo && isSafeRedirectPath(req.body.returnTo))
                ? req.body.returnTo
                : hasSessionReturnTo
                ? sessionReturnTo
                : "/";

            delete req.session.returnTo;
            req.session.save(() => {
                res.redirect(redirectUrl);
            });
        }));
    } catch (err) {
        next(err);
    }
};

export const renderLogin = (req, res) => res.redirect("/?showLogin=true");

export const login = (req, res, next) => {
    passport.authenticate("user-local", (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash("error", info?.message || "Invalid email or password");
            return req.session.save(() => {
                res.redirect("/?showLogin=true");
            });
        }

        req.login(user, guardAsync(next, async () => {
            const newSessionId = generateSessionId();
            user.activeSessionId = newSessionId;
            await user.save();
            req.session.currentSessionId = newSessionId;

            req.flash("success", "Logged in successfully!");

            const dashboardUrl = await getDashboardRedirectUrl(user);

            const hasSpecificReturnTo = req.body.returnTo
                && isSafeRedirectPath(req.body.returnTo)
                && req.body.returnTo !== '/';

            const sessionReturnTo = req.session.returnTo;
            const hasSessionReturnTo = sessionReturnTo
                && isSafeRedirectPath(sessionReturnTo)
                && sessionReturnTo !== '/';

            const redirectUrl = hasSpecificReturnTo
                ? req.body.returnTo
                : hasSessionReturnTo
                ? sessionReturnTo
                : (dashboardUrl || "/");

            delete req.session.returnTo;

            req.session.save(() => {
                res.redirect(redirectUrl);
            });
        }));
    })(req, res, next);
};

export const googleCallback = (req, res, next) => {
    passport.authenticate("user-google", (err, user, info) => {
        if (err) {
            console.error("Google Auth Error:", err);
            req.flash("error", "Unable to connect to Google. Please try again.");
            return req.session.save(() => res.redirect("/?showLogin=true"));
        }

        if (!user) {
            req.flash("error", info?.message || "Google sign-in was cancelled or has expired.");
            return req.session.save(() => res.redirect("/?showLogin=true"));
        }

        req.login(user, guardAsync(next, async () => {
            const newSessionId = generateSessionId();
            user.activeSessionId = newSessionId;
            await user.save();
            req.session.currentSessionId = newSessionId;

            req.flash("success", "Successfully signed in with Google.");

            const sessionReturnTo = req.session.returnTo;
            const hasSessionReturnTo = sessionReturnTo
                && isSafeRedirectPath(sessionReturnTo)
                && sessionReturnTo !== '/';

            const redirectUrl = hasSessionReturnTo
                ? sessionReturnTo
                : (await getDashboardRedirectUrl(user)) || "/";

            delete req.session.returnTo;

            req.session.save(() => res.redirect(redirectUrl));
        }));
    })(req, res, next);
};




export const logout = (req, res, next) => {
    const userId = req.user?._id;

    req.logout(guardAsync(next, async () => {
        if (userId) {
            try {
                await User.findByIdAndUpdate(userId, { activeSessionId: null });
            } catch (e) {
                console.error("Logout: activeSessionId clear failed:", e);
            }
        }
        req.session.currentSessionId = null;

        req.flash("success", "Logged out successfully!");
        req.session.save(() => {
            res.redirect("/");
        });
    }));
};



export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email address is required." });
        }

        const cleaned = email.trim().toLowerCase();
        const user = await User.findOne({ email: cleaned, authProvider: "local" });

        if (!user) {
            return res.json({ success: true, message: "OTP sent to your email", expiresIn: 300 });
        }

        const otp = generateOtp();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 5 * 60 * 1000);

        const resetLink = `${process.env.BASE_URL}/?resetEmail=${encodeURIComponent(cleaned)}&resetToken=${resetToken}`;

        user.resetOtp = hashSecret(otp);
        user.resetOtpExpiry = otpExpiry;
        user.resetOtpAttempts = 0;
        user.resetToken = hashSecret(resetToken);
        user.resetTokenExpiry = resetTokenExpiry;
        await user.save();

                 const { subject, html, text } = buildOtpEmail({
            otp,
            resetLink,
            expiresInMinutes: 5,
            name: user.name
        });

        const { error } = await resend.emails.send({
            from: `WarmupExam <${process.env.CONTACT_SENDER_EMAIL}>`,
            to: [cleaned],
            subject,
            html,
            text
        });

        if (error) {
            console.error("❌ OTP mail error:", error);
            return res.status(500).json({ success: false, message: "We couldn't send the OTP email. Please try again." });
        }

        res.json({ success: true, message: "OTP sent to your email", expiresIn: 300 });
    } catch (err) {
        console.error("❌ Forgot password error:", err.message);
        res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
};


// Email-link click hone par token verify karta hai (OTP flow se alag, independent)
export const verifyResetToken = async (req, res) => {
    try {
        const { email, resetToken } = req.body;

        if (!email || !resetToken) {
            return res.status(400).json({ success: false, message: "Invalid request" });
        }

        const cleaned = email.trim().toLowerCase();
        const user = await User.findOne({ email: cleaned, authProvider: "local" });

        if (!user || !user.resetToken || !user.resetTokenExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired link" });
        }

        if (!safeEqualHash(user.resetToken, resetToken)) {
            return res.status(400).json({ success: false, message: "Invalid or expired link" });
        }

        if (new Date() > user.resetTokenExpiry) {
            user.resetToken = null;
            user.resetTokenExpiry = null;
            await user.save();
            return res.status(400).json({ success: false, message: "This link has expired, please request a new one" });
        }

         

        res.json({ success: true, message: "Token verified", email: cleaned });
    } catch (err) {
        console.error("❌ Verify reset token error:", err.message);
        res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
};



// Step 2: OTP verify karo aur password reset karo
export const resetPassword = async (req, res) => {
    const { email, otp, resetToken, newPassword } = req.body;

    if (!email || !newPassword || (!otp && !resetToken)) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const cleaned = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleaned, authProvider: "local" });

    if (!user) {
        return res.status(400).json({ success: false, message: "Invalid request. Please try again." });
    }

    if (otp) {
        // ----- Path A: Manual OTP flow (jaisa pehle tha) -----
        if (!user.resetOtp || !user.resetOtpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid request. Please request a new OTP." });
        }

        // Max 5 koshish. Counter atomic hai, to ek saath 100 request bhejne se bypass nahi hoga
        const tracked = await User.findOneAndUpdate(
            { _id: user._id },
            { $inc: { resetOtpAttempts: 1 } },
            { new: true }
        );
        if (tracked.resetOtpAttempts > 5) {
            await User.updateOne(
                { _id: user._id },
                { $set: { resetOtp: null, resetOtpExpiry: null, resetOtpAttempts: 0 } }
            );
            return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new OTP." });
        }

        if (!safeEqualHash(user.resetOtp, otp)) {
            return res.status(400).json({ success: false, message: "Incorrect OTP" });
        }
        if (new Date() > user.resetOtpExpiry) {
            user.resetOtp = null;
            user.resetOtpExpiry = null;
            await user.save();
            return res.status(400).json({ success: false, message: "The OTP has expired. Please request a new one." });
        }
    } else {
        // ----- Path B: Email-link token flow (naya) -----
        if (!user.resetToken || !user.resetTokenExpiry) {
            return res.status(400).json({ success: false, message: "Invalid or expired link" });
        }
        if (!safeEqualHash(user.resetToken, resetToken)) {
            return res.status(400).json({ success: false, message: "Invalid or expired link" });
        }
        if (new Date() > user.resetTokenExpiry) {
            user.resetToken = null;
            user.resetTokenExpiry = null;
            await user.save();
            return res.status(400).json({ success: false, message: "This link has expired, please request a new one" });
        }
    }

    // Naya password set karo — pre('save') hook khud hash kar dega
    user.password = newPassword;
    user.activeSessionId = generateSessionId(); // purane saare sessions logout ho jayenge
    user.resetOtpAttempts = 0;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ success: true, message: "Password reset successful" });
};


// Step 1: sirf OTP verify karo. Sahi ho to password step ke liye naya one-time resetToken do
export const verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required." });
        }

        const cleaned = email.trim().toLowerCase();
        const user = await User.findOne({ email: cleaned, authProvider: "local" });

        if (!user || !user.resetOtp || !user.resetOtpExpiry) {
            return res.status(400).json({ success: false, message: "Invalid request. Please request a new OTP." });
        }

        // Max 5 koshish (atomic counter)
        const tracked = await User.findOneAndUpdate(
            { _id: user._id },
            { $inc: { resetOtpAttempts: 1 } },
            { new: true }
        );
        if (tracked.resetOtpAttempts > 5) {
            await User.updateOne(
                { _id: user._id },
                { $set: { resetOtp: null, resetOtpExpiry: null, resetOtpAttempts: 0 } }
            );
            return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new OTP." });
        }

        if (!safeEqualHash(user.resetOtp, otp)) {
            return res.status(400).json({ success: false, message: "Incorrect OTP" });
        }

        if (new Date() > user.resetOtpExpiry) {
            await User.updateOne(
                { _id: user._id },
                { $set: { resetOtp: null, resetOtpExpiry: null, resetOtpAttempts: 0 } }
            );
            return res.status(400).json({ success: false, message: "The OTP has expired. Please request a new one." });
        }

        // OTP sahi: OTP ek hi baar chalega (delete), aur password step ke liye naya token
        const newResetToken = crypto.randomBytes(32).toString("hex");
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    resetOtp: null,
                    resetOtpExpiry: null,
                    resetOtpAttempts: 0,
                    resetToken: hashSecret(newResetToken),
                    resetTokenExpiry: new Date(Date.now() + 5 * 60 * 1000)
                }
            }
        );

        res.json({ success: true, message: "OTP verified", email: cleaned, resetToken: newResetToken });
    } catch (err) {
        console.error("❌ Verify reset OTP error:", err.message);
        res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
};