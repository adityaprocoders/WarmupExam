import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import { checkSeriesAccess } from "../middleware/checkEnrollmentAccess.js";
import * as dailyWarmupController from "../controllers/dailyWarmupController.js";

const router = express.Router();

router.get(
    "/series/:slug/daily-warmup",
    isLoggedIn,
    checkSeriesAccess,
    wrapAsync(dailyWarmupController.renderDailyWarmupPage)
);

 
router.get(
    "/series/:slug/daily-warmup/leaderboard",
    isLoggedIn,
    checkSeriesAccess,
    wrapAsync(dailyWarmupController.renderWarmupLeaderboard)
);

export default router;