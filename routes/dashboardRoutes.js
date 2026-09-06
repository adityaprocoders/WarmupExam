import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import { checkSeriesAccess } from "../middleware/checkEnrollmentAccess.js";
import * as dashboardController from "../controllers/dashboardController.js";
import { showWeakAreas } from "../controllers/weakAreaController.js";
import { validateBody } from "../middleware/validate.js";
import { createSectionSchema, createFolderSchema } from "../utils/schemas.js";
import { getMyNotifications, markNotificationsSeen, clearMyNotifications } from "../controllers/notificationController.js";
import { showDailyWarmupSummary } from "../controllers/dailyWarmupController.js";

const router = express.Router();

router.get("/series/:slug", isLoggedIn, checkSeriesAccess, wrapAsync(dashboardController.showSeries));

router.post(
    "/series/:slug/section",
    isLoggedIn,
    isOwner,
    validateBody(createSectionSchema),
    wrapAsync(dashboardController.createSection)
);

router.put("/section/:id", isLoggedIn, isOwner, wrapAsync(dashboardController.updateSection));

router.delete("/section/:id", isLoggedIn, isOwner, wrapAsync(dashboardController.deleteSection));

router.get("/series/:slug/weak-areas", isLoggedIn, checkSeriesAccess, wrapAsync(showWeakAreas));

 
router.get("/series/:slug/daily-warmup", isLoggedIn, showDailyWarmupSummary);

// router.get("/series/:slug/section/:sectionId/leaderboard", isLoggedIn, wrapAsync(dashboardController.showSectionLeaderboard));
// router.put("/section/:id/toggle-leaderboard", isLoggedIn, isOwner, wrapAsync(dashboardController.toggleSectionLeaderboard));


router.post(
    "/folders",
    isLoggedIn,
    isOwner,
    validateBody(createFolderSchema),
    wrapAsync(dashboardController.createFolder)
);

router.get("/folder/:id", isLoggedIn, wrapAsync(dashboardController.showFolder));
router.get("/file/:id", isLoggedIn, wrapAsync(dashboardController.showFile));


router.get("/series/:slug/export-attempts", isLoggedIn, checkSeriesAccess, wrapAsync(dashboardController.exportAllAttempts));

router.put(
    "/series/:slug/stats-visibility",
    isLoggedIn,
    isOwner,
    wrapAsync(dashboardController.updateStatsVisibility)
);


router.get("/api/notifications/mine", isLoggedIn, getMyNotifications);
router.post("/api/notifications/mark-seen", isLoggedIn, markNotificationsSeen);
router.post("/api/notifications/clear-all", isLoggedIn, clearMyNotifications);

export default router;