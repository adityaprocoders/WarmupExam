import User from "../models/usersShema.js"; 
import cloudinary from "../config/cloudinary.js";
import { getPublicIdFromUrl } from "../utils/cloudinaryHelper.js";
import Attempt from "../models/TestAttempt.js"; 
 
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate({
                path: "enrolledListings.listing",
                select: "title image price type slug"
            })
            .lean();

            if (!user) {
             
            return req.logout(function (err) {
                if (err) console.error("Logout error (stale session user):", err);
                req.flash("error", "Your session is invalid. Please log in again.");
                res.redirect("/login");
            });
        }


        const myPurchases = (user.enrolledListings || [])
            .filter(item => item.listing && item.listing.type === "Paid") // 👈 sirf PAID batch
            .map(item => {
                const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
                let expiryMessage = null;

                if (item.expiresAt) {
                    if (isExpired) {
                        expiryMessage = `Expired on ${new Date(item.expiresAt).toLocaleDateString("en-IN")}`;
                    } else {
                        const daysLeft = Math.ceil((new Date(item.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
                        if (daysLeft <= 7) {
                            expiryMessage = `Expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
                        }
                    }
                }

                return {
                    listingUrl: `/listings/${item.listing.slug}`,
                    thumbnail: item.listing.image || null,
                    listingTitle: item.listing.title,
                    badge: isExpired ? "expired" : "success",
                    date: new Date(item.enrolledAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                    }),
                    isFree: false, // sirf paid dikha rahe hain, isliye hamesha false
                    price: item.amountPaid,
                    expiryMessage
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render("user/profile", {
            currentUser: req.user,
            isOwner: req.user.role === "owner",
            myPurchases
        });
    } catch (err) {
        console.error(err);
        req.flash("error", "Could not load profile");
        res.redirect("/");
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, mobile, city, class: userClass, exam, username, email } = req.body;
        const updateData = { name, mobile, city, class: userClass, exam };

        if (username && username.trim().toLowerCase() !== req.user.username) {
            const exists = await User.exists({
                username: username.trim().toLowerCase(),
                _id: { $ne: req.user._id }
            });
            if (exists) {
                req.flash("error", "Username already taken");
                return res.redirect("/profile");
            }
            updateData.username = username.trim().toLowerCase();
        }

        if (email && email.trim().toLowerCase() !== req.user.email) {
            const exists = await User.exists({
                email: email.trim().toLowerCase(),
                _id: { $ne: req.user._id }
            });
            if (exists) {
                req.flash("error", "Email already in use");
                return res.redirect("/profile");
            }
            updateData.email = email.trim().toLowerCase();
        }

        // ---------- AVATAR: 7 din me sirf 1 baar ----------
        if (req.file) {
            const lastChanged = req.user.avatarChangedAt;
            if (lastChanged) {
                const daysSince = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince < 7) {
                    const daysLeft = Math.ceil(7 - daysSince);
                    req.flash("error", `You can change your avatar again after ${daysLeft} day`);
                    return res.redirect("/profile");
                }
            }

            const oldPublicId = getPublicIdFromUrl(req.user.avatar);
            if (oldPublicId) {
                cloudinary.uploader.destroy(oldPublicId).catch(() => {});
            }

            updateData.avatar = req.file.path;
            updateData.avatarChangedAt = new Date();
        }

        await User.findByIdAndUpdate(req.user._id, updateData, { runValidators: true });
        req.flash("success", "Profile updated successfully");
        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        req.flash("error", "Profile update failed");
        res.redirect("/profile");
    }
};

// ---------------- UPDATE AVATAR (standalone, 7-din rate limit) ----------------
export const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image uploaded" });
        }

        const lastChanged = req.user.avatarChangedAt;
        if (lastChanged) {
            const daysSince = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) {
                const daysLeft = Math.ceil(7 - daysSince);
                return res.status(400).json({
                    success: false,
                    message: `You can change your avatar again after ${daysLeft} days.`
                });
            }
        }

        const oldPublicId = getPublicIdFromUrl(req.user.avatar);
        if (oldPublicId) {
            cloudinary.uploader.destroy(oldPublicId).catch(() => {});
        }

        await User.findByIdAndUpdate(req.user._id, {
            avatar: req.file.path,
            avatarChangedAt: new Date()
        });

        res.json({ success: true, avatarUrl: req.file.path, message: "Avatar updated successfully" });
    } catch (err) {
        console.error("AVATAR UPDATE ERROR:", err);
        res.status(500).json({ success: false, message: "Could not update avatar, try again" });
    }
};

export const checkUsername = async (req, res) => {
    const username = (req.query.username || "").trim().toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return res.json({ available: false, message: "3-20 chars: letters, numbers, underscore only" });
    }

    const exists = await User.exists({ username, _id: { $ne: req.user._id } });
    res.json(
        exists
            ? { available: false, message: "Username already taken" }
            : { available: true, message: "Username is available" }
    );
};

export const checkEmail = async (req, res) => {
    const email = (req.query.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.json({ available: false, message: "Invalid email format" });
    }

    const exists = await User.exists({ email, _id: { $ne: req.user._id } });
    res.json(
        exists
            ? { available: false, message: "Email already registered" }
            : { available: true, message: "Email is available" }
    );
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }

        const user = await User.findById(req.user._id);

        if (user.authProvider === "google" || !user.password) {
            return res.status(400).json({
                success: false,
                message: "Password change not available for Google login accounts"
            });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Current password is incorrect" });
        }

        // ---------- PASSWORD: 1 din me max 2 baar ----------
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        // Purane (24hr se purane) timestamps hata do
        user.passwordChangeLog = (user.passwordChangeLog || []).filter(
            ts => new Date(ts).getTime() > oneDayAgo
        );

        if (user.passwordChangeLog.length >= 2) {
            return res.status(400).json({
                success: false,
                message: "`You have reached your daily password change limit. Please try again tomorrow.`"
            });
        }

        user.password = newPassword; // pre-save hook hash kar dega
        user.passwordChangeLog.push(new Date());
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Something went wrong, try again" });
    }
};

 
export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ---------- Avatar cloudinary se hatao ----------
        const publicId = getPublicIdFromUrl(user.avatar);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(() => {});
        }

        // ---------- Attempts + User delete ----------
        await Attempt.deleteMany({ user: userId });
        await User.findByIdAndDelete(userId);

        // ---------- Session/login clear karke logout ----------
        req.logout(function (err) {
            if (err) console.error("Logout error during account delete:", err);
            req.session.destroy(() => {
                res.clearCookie("connect.sid");
                return res.json({ success: true, message: "Account deleted successfully" });
            });
        });
    } catch (err) {
        console.error("DELETE ACCOUNT ERROR:", err);
        res.status(500).json({ success: false, message: "Could not delete account, try again" });
    }
};