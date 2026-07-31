import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import User from "../models/usersShema.js";
import ExpressError from "../utils/ExpressError.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { uploadAvatar } from "../middleware/upload.js";
import * as profileController from "../controllers/profileController.js";
import cloudinary from "../config/cloudinary.js";
import { validateBody } from "../middleware/validate.js";
import { updateProfileSchema, changePasswordSchema } from "../utils/schemas.js";
import { doubleCsrfProtection } from "../config/csrf.js";

const router = express.Router();

function getPublicIdFromUrl(url) {
    if (!url || !url.includes("cloudinary.com")) return null;
    const parts = url.split("/");
    const fileWithExt = parts[parts.length - 1];
    const folder = parts[parts.length - 2];
    const publicId = fileWithExt.split(".")[0];
    return `${folder}/${publicId}`;
}

// ---------------- SHOW PROFILE ----------------
router.get("/profile", isLoggedIn, wrapAsync(profileController.getProfile));

// ---------------- LIVE USERNAME AVAILABILITY CHECK ----------------
router.get("/profile/check-username", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const raw = (req.query.username || "").trim().toLowerCase();

        const validFormat = /^[a-z0-9_]{3,20}$/.test(raw);
        if (!validFormat) {
            return res.json({
                available: false,
                message: "3-20 characters, only letters, numbers, underscore"
            });
        }

        if (raw === (req.user.username || "").toLowerCase()) {
            return res.json({ available: true, message: "This is your current username" });
        }

        const exists = await User.exists({ username: raw, _id: { $ne: req.user._id } });

        if (exists) {
            return res.json({ available: false, message: "Username already taken" });
        }

        return res.json({ available: true, message: "Username available" });
    } catch (err) {
        console.error("USERNAME CHECK ERROR:", err);
        res.status(500).json({ available: false, message: "Error checking username" });
    }
}));

// ---------------- LIVE EMAIL AVAILABILITY CHECK ----------------
router.get("/profile/check-email", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const raw = (req.query.email || "").trim().toLowerCase();

        const validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
        if (!validFormat) {
            return res.json({ available: false, message: "Enter a valid email address" });
        }

        if (raw === (req.user.email || "").toLowerCase()) {
            return res.json({ available: true, message: "This is your current email" });
        }

        const exists = await User.exists({ email: raw, _id: { $ne: req.user._id } });

        if (exists) {
            return res.json({ available: false, message: "Email already registered" });
        }

        return res.json({ available: true, message: "Email available" });
    } catch (err) {
        console.error("EMAIL CHECK ERROR:", err);
        res.status(500).json({ available: false, message: "Error checking email" });
    }
}));

// ---------------- UPDATE PROFILE ----------------
router.patch(
    "/profile",
    isLoggedIn,
    uploadAvatar.single("avatar"),
     doubleCsrfProtection,
    validateBody(updateProfileSchema),
    wrapAsync(async (req, res, next) => {
        try {
            const { name, username, email, mobile, city, class: userClass, exam } = req.body;

            const cleanUsername = (username || "").trim().toLowerCase();
            const cleanEmail = (email || "").trim().toLowerCase();

            if (cleanUsername && cleanUsername !== req.user.username) {
                const usernameTaken = await User.exists({ username: cleanUsername, _id: { $ne: req.user._id } });
                if (usernameTaken) {
                    req.flash("error", "Username already taken, please choose another");
                    return res.redirect("/profile");
                }
            }

            if (cleanEmail && cleanEmail !== req.user.email) {
                const emailTaken = await User.exists({ email: cleanEmail, _id: { $ne: req.user._id } });
                if (emailTaken) {
                    req.flash("error", "Email already registered, please use another");
                    return res.redirect("/profile");
                }
            }

            const updateData = { name, mobile, city, class: userClass, exam };
            if (cleanUsername) updateData.username = cleanUsername;
            if (cleanEmail) updateData.email = cleanEmail;

            if (req.file) {
                const oldPublicId = getPublicIdFromUrl(req.user.avatar);
                if (oldPublicId) {
                    cloudinary.uploader.destroy(oldPublicId).catch(() => {});
                }
                updateData.avatar = req.file.path;
            }

            await User.findByIdAndUpdate(req.user._id, updateData, { runValidators: true });
            req.flash("success", "Profile updated successfully");
            res.redirect("/profile");
        } catch (err) {
            console.error("PROFILE UPDATE ERROR:", err);
            if (err.code === 11000) {
                req.flash("error", "Username or email already taken, please choose another");
                return res.redirect("/profile");
            }
            next(new ExpressError(400, "Profile update failed"));
        }
    })
);

// ---------------- CHANGE PASSWORD ----------------
router.patch(
    "/profile/change-password",
    isLoggedIn,
    doubleCsrfProtection,
    validateBody(changePasswordSchema),
    wrapAsync(profileController.changePassword)
);

// ---------------- DELETE ACCOUNT ----------------
router.delete("/profile/delete-account", isLoggedIn, doubleCsrfProtection, wrapAsync(profileController.deleteAccount));

// ---------------- UPDATE AVATAR ----------------
router.patch("/profile/update-avatar", isLoggedIn, uploadAvatar.single("avatar"),  doubleCsrfProtection, wrapAsync(profileController.updateAvatar));

export default router;