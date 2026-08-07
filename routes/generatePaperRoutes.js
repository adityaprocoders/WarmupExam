import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn, isOwner } from "../middleware/isLoggedIn.js";
import * as generatePaperController from "../controllers/generatePaperController.js";

const router = express.Router();

router.get("/generate-paper/new", isLoggedIn, isOwner, wrapAsync(generatePaperController.renderGeneratePaper));
router.get("/api/listing/:id/question-bank-stats", isLoggedIn, isOwner, wrapAsync(generatePaperController.getQuestionBankStats));
router.get("/api/listing/:id/question-filters", isLoggedIn, isOwner, wrapAsync(generatePaperController.getQuestionFilters));
router.get("/api/listing/:id/question-count", isLoggedIn, isOwner, wrapAsync(generatePaperController.getQuestionCount));
router.get("/api/listing/:id/subjects", isLoggedIn, isOwner, wrapAsync(generatePaperController.getListingSubjects));
router.get("/api/listing/:id/languages", isLoggedIn, isOwner, wrapAsync(generatePaperController.getListingLanguages));
router.post("/api/generate-paper", isLoggedIn, isOwner, wrapAsync(generatePaperController.generatePaper));

export default router;