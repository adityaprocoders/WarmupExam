import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isOwner } from "../middleware/isLoggedIn.js";
import * as ebookController from "../controllers/ebookController.js";
import { uploadEbook } from "../middleware/upload.js";
import { doubleCsrfProtection } from "../config/csrf.js";

const router = express.Router();

// Public
router.get("/ebooks", wrapAsync(ebookController.list));
router.get("/ebooks/:slug", wrapAsync(ebookController.view));
router.get("/ebooks/:slug/download", wrapAsync(ebookController.download));

// 🔒 Owner only
router.get("/ebooks-manage/new", isOwner, wrapAsync(ebookController.renderNewEbook));

router.post(
    "/owner/ebooks",
    isOwner,
    uploadEbook.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "ebookFile", maxCount: 1 }
    ]),
    doubleCsrfProtection,
    wrapAsync(ebookController.createEbook)
);

router.get("/ebooks-manage/:id/edit", isOwner, wrapAsync(ebookController.renderEditEbook));

router.put(
    "/owner/ebooks/:id",
    isOwner,
    uploadEbook.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "ebookFile", maxCount: 1 }
    ]),
    doubleCsrfProtection,
    wrapAsync(ebookController.updateEbook)
);

router.delete("/owner/ebooks/:id", isOwner, doubleCsrfProtection, wrapAsync(ebookController.deleteEbook));

export default router;