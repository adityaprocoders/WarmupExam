import express from "express";
import { isOwner } from "../middleware/isLoggedIn.js";
import * as qb from "../controllers/questionBankController.js";

const router = express.Router();

router.get("/api/owner/question-bank/stats", isOwner, qb.getQuestionBankStats);
router.get("/api/owner/question-bank/filters", isOwner, qb.getFilterOptions);
router.get("/api/owner/question-bank/questions", isOwner, qb.getQuestions);
router.get("/api/owner/question-bank/questions/:id", isOwner, qb.getQuestionDetail);
router.post("/api/owner/question-bank/questions", isOwner, qb.createQuestion);
router.patch("/api/owner/question-bank/questions/:id", isOwner, qb.updateQuestion);
router.patch("/api/owner/question-bank/questions/:id/resolve", isOwner, qb.resolveQuestion);
router.patch("/api/owner/question-bank/questions/:id/disable", isOwner, qb.disableQuestion);
router.patch("/api/owner/question-bank/questions/:id/enable", isOwner, qb.enableQuestion);
router.delete("/api/owner/question-bank/questions/:id", isOwner, qb.deleteQuestion);
router.post("/api/owner/question-bank/questions/:id/duplicate", isOwner, qb.duplicateQuestion);

export default router;