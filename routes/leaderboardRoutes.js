import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as leaderboardController from "../controllers/leaderboardController.js";
import { checkSeriesAccess } from "../middleware/checkEnrollmentAccess.js";

const router = express.Router();

router.get("/series/:slug/leaderboard", isLoggedIn, checkSeriesAccess, wrapAsync(leaderboardController.getLeaderboard));

// Frontend JS is API ko call karke table-rows fill karega
router.get("/api/series/:slug/leaderboard-data", isLoggedIn, checkSeriesAccess, wrapAsync(leaderboardController.getLeaderboardData));

export default router;