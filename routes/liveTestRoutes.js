import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { checkSeriesAccess } from "../middleware/checkEnrollmentAccess.js";
import { renderLiveTestPage, renderLiveTestLeaderboard } from "../controllers/liveTestController.js";

const router = express.Router();

router.get("/series/:slug/live-test", isLoggedIn, checkSeriesAccess, wrapAsync(renderLiveTestPage));
router.get("/series/:slug/live-test/leaderboard", isLoggedIn, checkSeriesAccess, wrapAsync(renderLiveTestLeaderboard));

export default router;