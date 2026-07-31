import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isOwner } from "../middleware/isLoggedIn.js";
import * as listingController from "../controllers/listingController.js";
import { upload } from "../middleware/upload.js";
import { validateBody } from "../middleware/validate.js";
import { createListingSchema } from "../utils/schemas.js";
import { doubleCsrfProtection } from "../config/csrf.js";

const router = express.Router();

// Public — sabke liye
router.get("/alltests", wrapAsync(listingController.allTests));
router.get("/test/:id", wrapAsync(listingController.showTest));
router.get("/api/search-tests", wrapAsync(listingController.searchTests));
router.get("/api/exams", wrapAsync(listingController.getExams));
router.get("/api/exams/:exam/series", wrapAsync(listingController.getSeriesByExam));

// 🔒 Sirf Owner
router.post(
    "/alltests",
    isOwner,
    upload.single("image"),
     doubleCsrfProtection, 
    validateBody(createListingSchema, "listing"),
    wrapAsync(listingController.createTest)
);

router.delete("/test/:id", isOwner,  doubleCsrfProtection,  wrapAsync(listingController.deleteTest));
router.get("/tests/new", isOwner, wrapAsync(listingController.renderNewTest));
router.get("/tests/:id/edit", isOwner, wrapAsync(listingController.renderEditTest));

router.put(
    "/tests/:id",
    isOwner,
    upload.single("image"),
     doubleCsrfProtection, 
    validateBody(createListingSchema, "listing"),
    wrapAsync(listingController.updateTest)
);


// Footer Dynamic Data API Route
router.get("/api/footer-data", wrapAsync(listingController.getFooterData));

export default router;