import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as ctrl from "../controllers/ownerDailyWarmupController.js";

const router = express.Router();

router.get("/owner/daily-warmup/dashboard-stats", isLoggedIn, isOwner, wrapAsync(ctrl.getDashboardStats));
router.get("/owner/daily-warmup/categories", isLoggedIn, isOwner, wrapAsync(ctrl.getCategories));
router.get("/owner/daily-warmup/exams", isLoggedIn, isOwner, wrapAsync(ctrl.getExamsByCategory));
router.get("/owner/daily-warmup/sources", isLoggedIn, isOwner, wrapAsync(ctrl.getSourcesForExam));
router.get("/owner/daily-warmup/sources/unique-count", isLoggedIn, isOwner, wrapAsync(ctrl.getUniqueQuestionCount));
router.get("/owner/daily-warmup/config/:exam", isLoggedIn, isOwner, wrapAsync(ctrl.getConfigByExam));
router.post("/owner/daily-warmup/config", isLoggedIn, isOwner, wrapAsync(ctrl.saveConfig));
router.delete("/owner/daily-warmup/config/:exam", isLoggedIn, isOwner, wrapAsync(ctrl.deleteConfig));

export default router;