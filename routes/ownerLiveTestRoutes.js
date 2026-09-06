import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as ctrl from "../controllers/ownerLiveTestController.js";

const router = express.Router();

router.get("/owner/live-test/dashboard-stats", isLoggedIn, isOwner, wrapAsync(ctrl.getDashboardStats));
router.get("/owner/live-test/categories", isLoggedIn, isOwner, wrapAsync(ctrl.getCategories));
router.get("/owner/live-test/exams", isLoggedIn, isOwner, wrapAsync(ctrl.getExamsByCategory));
router.get("/owner/live-test/sources", isLoggedIn, isOwner, wrapAsync(ctrl.getSourcesForExam));
router.get("/owner/live-test/sources/unique-count", isLoggedIn, isOwner, wrapAsync(ctrl.getUniqueQuestionCount));

// 👇 NAYE — filter-builder rows ke liye
router.get("/owner/live-test/subjects", isLoggedIn, isOwner, wrapAsync(ctrl.getSubjectsForExam));
router.get("/owner/live-test/question-filters", isLoggedIn, isOwner, wrapAsync(ctrl.getQuestionFiltersForExam));

router.get("/owner/live-test/config/:exam", isLoggedIn, isOwner, wrapAsync(ctrl.getConfigByExam));
router.post("/owner/live-test/config", isLoggedIn, isOwner, wrapAsync(ctrl.saveConfig));
router.delete("/owner/live-test/config/:exam", isLoggedIn, isOwner, wrapAsync(ctrl.deleteConfig));
router.get("/owner/live-test/leaderboard/:exam", isLoggedIn, isOwner, wrapAsync(ctrl.getLiveTestLeaderboardForOwner));

export default router;