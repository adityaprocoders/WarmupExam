import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as leaderboardController from "../controllers/leaderboardController.js";

const router = express.Router();

// Page render karta hai (podium + table ka shell)
router.get("/series/:slug/leaderboard", isLoggedIn, wrapAsync(leaderboardController.getLeaderboard));

// Frontend JS is API ko call karke table-rows fill karega
router.get("/api/series/:slug/leaderboard-data", isLoggedIn, wrapAsync(leaderboardController.getLeaderboardData));

export default router;