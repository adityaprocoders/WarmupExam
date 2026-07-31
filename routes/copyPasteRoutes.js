import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as copyPasteController from "../controllers/copyPasteController.js";

const router = express.Router();

router.get("/api/search-series", isLoggedIn, isOwner, wrapAsync(copyPasteController.searchSeries));
router.get("/api/series/:slug/tree", isLoggedIn, isOwner, wrapAsync(copyPasteController.getSeriesTree));
router.post("/api/paste-item", isLoggedIn, isOwner, wrapAsync(copyPasteController.pasteItem));
router.post("/api/bulk-copy-sections", isLoggedIn, isOwner, wrapAsync(copyPasteController.bulkCopySections));

export default router;