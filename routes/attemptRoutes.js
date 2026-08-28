import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as attemptController from "../controllers/attemptController.js";
import { checkTestAccess } from "../middleware/checkTestAccess.js";
import { submitReport } from "../controllers/questionReportController.js";


const router = express.Router();

router.get("/mock-test/:id/instructions", isLoggedIn,  checkTestAccess, wrapAsync(attemptController.showInstructions));
router.get("/attempt/:id", isLoggedIn,  checkTestAccess, wrapAsync(attemptController.showAttempt));
router.post("/api/attempt/:testId/submit", isLoggedIn,  checkTestAccess, wrapAsync(attemptController.submitAttempt));
router.get("/attempt/:attemptId/analysis", isLoggedIn, wrapAsync(attemptController.showAnalysis));

router.post("/api/questions/:questionId/report", isLoggedIn, wrapAsync(submitReport));

export default router;