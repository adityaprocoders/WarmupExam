import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as attemptController from "../controllers/attemptController.js";

const router = express.Router();

router.get("/mock-test/:id/instructions", isLoggedIn, wrapAsync(attemptController.showInstructions));
router.get("/attempt/:id", isLoggedIn, wrapAsync(attemptController.showAttempt));
router.post("/api/attempt/:testId/submit", isLoggedIn, wrapAsync(attemptController.submitAttempt));
router.get("/attempt/:attemptId/analysis", isLoggedIn, wrapAsync(attemptController.showAnalysis));

export default router;