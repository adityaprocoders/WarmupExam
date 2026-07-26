import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as testBuilderController from "../controllers/testBuilderController.js";

const router = express.Router();

router.get("/test-builder/new", isLoggedIn, isOwner, wrapAsync(testBuilderController.renderTestBuilder));
router.get("/api/listing/:id/subjects", isLoggedIn, isOwner, wrapAsync(testBuilderController.getListingSubjects));
router.post("/api/test-builder", isLoggedIn, isOwner, wrapAsync(testBuilderController.createTestBuilder));
router.get("/api/test-builder/:id", isLoggedIn, isOwner, wrapAsync(testBuilderController.getTestBuilder));
router.put("/api/test-builder/:id", isLoggedIn, isOwner, wrapAsync(testBuilderController.updateTestBuilder));

export default router;