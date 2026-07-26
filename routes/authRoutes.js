import express from "express";
import passport from "../config/passport.js";
import wrapAsync from "../utils/wrapAsync.js";
import { isOwner, isLoggedOut } from "../middleware/isLoggedIn.js";
import * as authController from "../controllers/authController.js";
import { forgotPassword, resetPassword } from "../controllers/authController.js";
import { validateBody } from "../middleware/validate.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../utils/schemas.js";

const router = express.Router();

router.get("/owner-login", authController.renderOwnerLogin);
router.post("/owner-login", validateBody(loginSchema), authController.ownerLogin);
router.get("/owner-dashboard", isOwner, authController.ownerDashboard);

router.get("/register", isLoggedOut, authController.renderRegister);
router.post("/register", validateBody(registerSchema), wrapAsync(authController.register));

router.get("/login", isLoggedOut, authController.renderLogin);
router.post("/login", validateBody(loginSchema), authController.login);

router.post("/forgot-password", validateBody(forgotPasswordSchema), wrapAsync(forgotPassword));
router.post("/reset-password", validateBody(resetPasswordSchema), wrapAsync(resetPassword));

router.get("/auth/google", passport.authenticate("user-google", { scope: ["profile", "email"] }));

router.get("/api/auth/google/callback", authController.googleCallback);

router.post("/logout", authController.logout);

export default router;