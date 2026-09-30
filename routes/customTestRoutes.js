import express from "express";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { requireDashboardAccess } from "../middleware/requireDashboardAccess.js";
import multer from "multer";
import { generateAIPaper, getAIPaper, getAIUsage, listAIPapers } from "../controllers/aiPaperController.js";


const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 6 }, // 10MB/file, max 6 files
});


import {
    pricingPage,
    customTestLanding,
    customTestDashboard,
    customTestAttempt,
    customTestAnalysisPage,
    searchExams,
    getSubjects,
    getTopics,
    getAvailability,
    generatePaper,
    submitCustomPaperAttempt,
    getCustomPaperAnalysis,
    customTestUpgradePage,
    getCustomTestPricingPublic,
    getWeakAreas,
    getPatterns,
    deleteCustomPaperAttempt,     
    clearCustomPaperAttempts,
     aiGeneratorPage,
     manageplanPage, 
} from "../controllers/customTestController.js";

import { createCustomTestOrder, applyCustomTestCoupon, verifyCustomTestPayment, razorpayWebhook } from "../controllers/customTestPaymentController.js";

const router = express.Router();

// ---------------- FREE (public, guest allowed) ----------------
router.get("/custom-test", customTestDashboard);
router.get("/custom-test/create", isLoggedIn, customTestLanding);
router.get("/custom-test/attempt/:paperId", customTestAttempt);
router.get("/custom-test/analysis/:paperId", customTestAnalysisPage);

router.get("/pricing", pricingPage);
router.get("/api/custom-test/pricing", getCustomTestPricingPublic);
router.post("/api/custom-test/payment/apply-coupon", isLoggedIn, applyCustomTestCoupon);
router.get("/custom-test/upgrade", isLoggedIn, customTestUpgradePage);

// ---------------- PAID (login + kam se kam ek listing, dashboard shell ke andar) ----------------
router.get("/dashboard/custom-test", isLoggedIn, requireDashboardAccess, customTestDashboard);
router.get("/dashboard/custom-test/create", isLoggedIn, requireDashboardAccess, customTestLanding);
router.get("/dashboard/custom-test/attempt/:paperId", isLoggedIn, requireDashboardAccess, customTestAttempt);
router.get("/dashboard/custom-test/analysis/:paperId", isLoggedIn, requireDashboardAccess, customTestAnalysisPage);


router.delete("/api/custom-test/attempt/:paperId", isLoggedIn, deleteCustomPaperAttempt);
router.delete("/api/custom-test/attempts", isLoggedIn, clearCustomPaperAttempts);

// ---------------- Shared APIs — tier check internally (req.user se) ----------------
router.get("/api/custom-test/exams", searchExams);
router.get("/api/custom-test/subjects", getSubjects);
router.get("/api/custom-test/topics", getTopics);
router.get("/api/custom-test/weak-areas", getWeakAreas);
router.get("/api/custom-test/patterns", getPatterns);
router.post("/api/custom-test/availability", getAvailability);
router.post("/api/custom-test/generate", isLoggedIn, generatePaper);

router.post("/api/custom-test/attempt/:paperId/submit",  isLoggedIn, submitCustomPaperAttempt);
router.get("/api/custom-test/attempt/:paperId/analysis", isLoggedIn, getCustomPaperAnalysis);



router.post("/api/custom-test/payment/create-order", isLoggedIn, createCustomTestOrder);
router.post("/api/custom-test/payment/verify", isLoggedIn, verifyCustomTestPayment);
router.post("/api/custom-test/payment/webhook", razorpayWebhook);


// ---------------- AI Paper Generator (paid tiers only, internally checked) ----------------
router.post("/api/custom-test/ai/generate", isLoggedIn, upload.array("files", 6), generateAIPaper);
router.get("/api/custom-test/ai/usage", isLoggedIn, getAIUsage);
router.get("/custom-test/ai-generate", isLoggedIn, aiGeneratorPage);
router.get("/api/custom-test/ai/papers", isLoggedIn, listAIPapers);
router.get("/api/custom-test/ai/paper/:paperId", isLoggedIn, getAIPaper);
router.get("/dashboard/custom-test/ai-generate", isLoggedIn, requireDashboardAccess, aiGeneratorPage);

router.get("/custom-test/manage", isLoggedIn, manageplanPage);
router.get("/dashboard/custom-test/manage", isLoggedIn, requireDashboardAccess, manageplanPage);
 
 

export default router;

 