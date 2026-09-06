import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { renderLiveTestPage, renderLiveTestLeaderboard } from "../controllers/liveTestController.js";

const router = express.Router();

router.get("/series/:slug/live-test", isLoggedIn, wrapAsync(renderLiveTestPage));
router.get("/series/:slug/live-test/leaderboard", isLoggedIn, wrapAsync(renderLiveTestLeaderboard));

export default router;