import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import { validateBody } from "../middleware/validate.js";
import { createContentBlockSchema, attachContentBlocksSchema } from "../utils/schemas.js";
import * as contentBlockController from "../controllers/contentBlockController.js";

const router = express.Router();

// ---------- Content Library: Edit / Delete (show.ejs modal se hit hote hain) ----------
router.put(
    "/owner/content-library/:id",
    isLoggedIn,
    isOwner,
    validateBody(createContentBlockSchema),
    wrapAsync(contentBlockController.updateBlock)
);

router.delete(
    "/owner/content-library/:id",
    isLoggedIn,
    isOwner,
    wrapAsync(contentBlockController.deleteBlock)
);

// ---------- Attach Blocks to a Test Series (existing library blocks select) ----------
router.put(
    "/tests/:id/attach-content",
    isLoggedIn,
    isOwner,
    validateBody(attachContentBlocksSchema),
    wrapAsync(contentBlockController.attachBlocks)
);

// ---------- Create a block + attach directly from the listing page popup ----------
router.post(
    "/tests/:id/create-and-attach-block",
    isLoggedIn,
    isOwner,
    validateBody(createContentBlockSchema),
    wrapAsync(contentBlockController.createAndAttachBlock)
);

// ---------- Detach a block from just this listing (block stays in library) ----------
router.put(
    "/tests/:id/detach-block/:blockId",
    isLoggedIn,
    isOwner,
    wrapAsync(contentBlockController.detachBlock)
);

// ---------- Copy a block to multiple listings (exam category + individual) ----------
router.post(
    "/content-blocks/:id/copy-to",
    isLoggedIn,
    isOwner,
    wrapAsync(contentBlockController.copyBlockToTargets)
);

export default router;