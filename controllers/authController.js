import resend from "../utils/mailer.js";
import bcrypt from "bcrypt";
import passport from "../config/passport.js";
import ExpressError from "../utils/ExpressError.js";
import User from "../models/usersShema.js";
import { getDashboardRedirectUrl } from "../utils/authHelpers.js";
import { logOwnerLogin } from "../utils/loginLogger.js";
import LoginHistory from "../models/LoginHistory.js";
import { generateSessionId } from "../utils/sessionHelper.js";



export const renderOwnerLogin = (req, res) => res.render("auth/owner-login", {
    title: "Login | WarmupExam",
    robots: "noindex, nofollow"
});

export const ownerLogin = (req, res, next) => {
    passport.authenticate("owner-local", (err, owner, info) => {
        if (err) return next(err);

        if (!owner) {
            req.flash("error", "Invalid owner credentials");
            return req.session.save(() => res.redirect("/owner-login"));
        }

        req.login(owner, async (err) => {
            if (err) return next(err);

            // 👇 yahan hona chahiye tha — async callback ke andar
            const newSessionId = generateSessionId();
            owner.activeSessionId = newSessionId;
            await owner.save();
            req.session.currentSessionId = newSessionId;

            await logOwnerLogin(req, owner);

            await LoginHistory.create({
                ownerEmail: req.body.email,
                ipAddress: req.ip || req.headers["x-forwarded-for"] || "Unknown",
                userAgent: req.headers["user-agent"] || "",
                device: req.headers["user-agent"] || "Unknown",
                location: "Unknown",
                status: "success"
            });

            req.flash("success", "Welcome Owner!");
            req.session.save(() => res.redirect("/owner-dashboard"));
        });
    })(req, res, next);
};


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

export const ownerDashboard = (req, res) => res.render("owner/dashboard", { user: req.user });

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

        req.login(newUser, async (err) => {
    if (err) return next(err);
 
    const newSessionId = generateSessionId();
    newUser.activeSessionId = newSessionId;
    await newUser.save();
    req.session.currentSessionId = newSessionId;

    req.flash("success", "Account created successfully!");
    const redirectUrl = (req.body.returnTo && req.body.returnTo.startsWith('/')) ? req.body.returnTo : "/";
    req.session.save(() => {
        res.redirect(redirectUrl);
    });
});
    } catch (err) {
        next(err); // koi aur unexpected error ho to normal error-handler ko de do
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

        req.login(user, async (err) => {
    if (err) return next(err);

    // 👇 add these 3 lines (yahan missing thi)
    const newSessionId = generateSessionId();
    user.activeSessionId = newSessionId;
    await user.save();
    req.session.currentSessionId = newSessionId;

    req.flash("success", "Logged in successfully!");

    const dashboardUrl = await getDashboardRedirectUrl(user);

    const hasSpecificReturnTo = req.body.returnTo
        && req.body.returnTo.startsWith('/')
        && req.body.returnTo !== '/';

    const redirectUrl = hasSpecificReturnTo
        ? req.body.returnTo
        : (dashboardUrl || "/");

    req.session.save(() => {
        res.redirect(redirectUrl);
    });
});
         
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
            req.flash("error", "Google sign-in was cancelled or has expired.");
            return req.session.save(() => res.redirect("/?showLogin=true"));
        }

        req.login(user, async (err) => {
            if (err) return next(err);

             const newSessionId = generateSessionId();
             user.activeSessionId = newSessionId;
             await user.save();
             req.session.currentSessionId = newSessionId;

            req.flash("success", "Successfully signed in with Google.");

            const redirectUrl = (await getDashboardRedirectUrl(user)) || "/";

            req.session.save(() => res.redirect(redirectUrl));
        });
    })(req, res, next);
};

export const logout = (req, res, next) => {
    const userId = req.user?._id; // logout se PEHLE user id save kar lo

    req.logout(async (err) => {
        if (err) return next(err);

        if (userId) {
            await User.findByIdAndUpdate(userId, { activeSessionId: null });
        }
        req.session.currentSessionId = null;

        req.flash("success", "Logged out successfully!");
        req.session.save(() => {
            res.redirect("/");
        });
    });
};



export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: "Email zaroori hai" });
    }

    const cleaned = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleaned, authProvider: "local" });

    if (!user) {
        return res.json({ success: true, message: "Agar ye email registered hai, to OTP bhej diya gaya hai" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 👈 5 minute valid (10 se 5 kiya)

    user.resetOtp = otp;
    user.resetOtpExpiry = otpExpiry;
    await user.save();

    console.log("🔑 Generated OTP for", cleaned, ":", otp); // debug — production mein hata dena

    try {
        const { data, error } = await resend.emails.send({
            from: `WarmupExam <${process.env.CONTACT_SENDER_EMAIL}>`,
            to: cleaned,
            subject: "Your WarmupExam Password Reset OTP",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color:#4f46e5; margin-bottom: 8px;">Password Reset Request</h2>
                    <p style="color:#334155; font-size: 14px;">Use the OTP below to reset your password. It is valid for 5 minutes.</p>
                    <div style="background:#f8fafc; border-radius:8px; padding: 20px; text-align:center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color:#4f46e5;">${otp}</span>
                    </div>
                    <p style="color:#94a3b8; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `
        });

        console.log("📧 Resend response — data:", data, "error:", error); // debug

        if (error) {
            console.error("❌ OTP mail error:", error);
            return res.status(500).json({ success: false, message: "OTP email nahi bhej paye, dobara try karo" });
        }

        res.json({ success: true, message: "OTP sent to your email", expiresIn: 300 }); // 300 sec = 5 min
    } catch (err) {
        console.error("❌ Forgot password error:", err.message);
        res.status(500).json({ success: false, message: "Kuch galat ho gaya" });
    }
};

// Step 2: OTP verify karo aur password reset karo
export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ success: false, message: "Sabhi fields zaroori hain" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "Password kam se kam 6 characters ka hona chahiye" });
    }

    const cleaned = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleaned, authProvider: "local" });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
        return res.status(400).json({ success: false, message: "Invalid request, dobara OTP mangwao" });
    }

    if (user.resetOtp !== otp) {
        return res.status(400).json({ success: false, message: "Incorrect OTP" });
    }

    if (new Date() > user.resetOtpExpiry) {
        return res.status(400).json({ success: false, message: "OTP expire ho gaya, naya mangwao" });
    }

    // Naya password set karo — pre('save') hook khud hash kar dega
    user.password = newPassword;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    res.json({ success: true, message: "Password reset successful" });
};