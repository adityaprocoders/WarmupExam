import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { uploadAvatar } from "../middleware/upload.js";
import { validateBody } from "../middleware/validate.js";
import { updateProfileSchema, changePasswordSchema } from "../utils/schemas.js";
import { doubleCsrfProtection } from "../config/csrf.js";
import { deleteAccountLimiter } from "../middleware/rateLimiters.js";
import * as profileController from "../controllers/profileController.js";

const router = express.Router();

// ---------------- SHOW PROFILE ----------------
router.get("/profile", isLoggedIn, wrapAsync(profileController.getProfile));

// ---------------- LIVE USERNAME / EMAIL AVAILABILITY CHECK ----------------
router.get("/profile/check-username", isLoggedIn, wrapAsync(profileController.checkUsername));
router.get("/profile/check-email", isLoggedIn, wrapAsync(profileController.checkEmail));

// ---------------- UPDATE PROFILE ----------------
// Form me ab file nahi jaati (avatar alag route se), isliye multer yahan nahi chahiye
router.patch(
    "/profile",
    isLoggedIn,
    doubleCsrfProtection,
    validateBody(updateProfileSchema),
    wrapAsync(profileController.updateProfile)
);

// ---------------- CHANGE PASSWORD ----------------
router.patch(
    "/profile/change-password",
    isLoggedIn,
    doubleCsrfProtection,
    validateBody(changePasswordSchema),
    wrapAsync(profileController.changePassword)
);

// ---------------- UPDATE AVATAR ----------------
router.patch(
    "/profile/update-avatar",
    isLoggedIn,
    uploadAvatar.single("avatar"),
    doubleCsrfProtection,
    wrapAsync(profileController.updateAvatar)
);

// ---------------- DELETE ACCOUNT ----------------
router.delete(
    "/profile/delete-account",
    isLoggedIn,
    deleteAccountLimiter,
    doubleCsrfProtection,
    wrapAsync(profileController.deleteAccount)
);

export default router;