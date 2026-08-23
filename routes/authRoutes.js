import express from "express";
import passport from "../config/passport.js";
import wrapAsync from "../utils/wrapAsync.js";
import { isOwner, isLoggedOut } from "../middleware/isLoggedIn.js";
import * as authController from "../controllers/authController.js";
import { forgotPassword, resetPassword, verifyResetToken } from "../controllers/authController.js";
import { validateBody } from "../middleware/validate.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyResetTokenSchema } from "../utils/schemas.js";
import { getLoginHistoryApi, deleteLoginHistoryEntry } from "../controllers/authController.js";
import LoginHistory from "../models/LoginHistory.js";
import { authLimiter, otpLimiter } from "../middleware/rateLimiters.js";



const router = express.Router();

const ownerLoginPath = `/${process.env.OWNER_LOGIN_PATH}`;

router.get(ownerLoginPath, authController.renderOwnerLogin);
router.post(ownerLoginPath, authLimiter, validateBody(loginSchema), authController.ownerLogin);

router.get("/owner-dashboard", isOwner, authController.ownerDashboard);
router.get("/api/owner/login-history", isOwner, getLoginHistoryApi);
router.delete("/api/owner/login-history/:id", isOwner, deleteLoginHistoryEntry); 
 

router.get("/register", isLoggedOut, authController.renderRegister);
router.post("/register", authLimiter, validateBody(registerSchema), wrapAsync(authController.register));

router.get("/login", isLoggedOut, authController.renderLogin);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);

router.post("/forgot-password", otpLimiter, validateBody(forgotPasswordSchema), wrapAsync(forgotPassword));
router.post("/reset-password", authLimiter, validateBody(resetPasswordSchema), wrapAsync(resetPassword));
router.post("/verify-reset-token", otpLimiter, validateBody(verifyResetTokenSchema), wrapAsync(verifyResetToken));

router.get("/auth/google", passport.authenticate("user-google", { scope: ["profile", "email"] }));

router.get("/api/auth/google/callback", wrapAsync(authController.googleCallback));

router.post("/logout", authController.logout);

export default router;