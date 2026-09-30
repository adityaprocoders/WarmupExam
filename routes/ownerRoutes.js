import express from "express";
import {
    getDashboardStats,
    getChartData,
    getAllTestSeriesOwner,
    deleteTestSeries,
    getAllUsersOwner,
    toggleUserSubscription,   
    deleteUser,
    renderUserDetailPage,
    grantSubscription,
    saveUserPermissions,
    banUser, unbanUser,
    ownerResetUserPassword,
    getAllPaymentsOwner,
    getAllNotificationsOwner,
    getNotificationReach,
    searchUsersForNotification,
    createNotification,
    deleteNotification,      
    updateNotification,
     getCustomTestPricingOwner,
    updateCustomTestPricingOwner,
    grantCustomTestAccess,
    revokeCustomTestAccess,
     getExamPatternSummary,      
    saveExamPatternSummary,
    getListingMarksForExam,
    getCategoriesOwner,
    getAllExamPatternSummaries,
     deleteExamPatternSummary  
} from "../controllers/ownerController.js";
import { isOwner } from "../middleware/isLoggedIn.js";
import { getLoginHistory, deleteLoginHistory, deleteAllLoginHistory } from "../controllers/ownerController.js";


const router = express.Router();

router.use(["/api/owner", "/owner"], (req, res, next) => {
    res.locals.robots = "noindex, nofollow";
    next();
});

router.get("/api/owner/dashboard/stats", isOwner, getDashboardStats);
router.get("/api/owner/dashboard/charts", isOwner, getChartData);
router.get("/api/owner/testseries", isOwner, getAllTestSeriesOwner);
router.delete("/api/owner/testseries/:id", isOwner, deleteTestSeries);

router.get("/api/owner/categories", isOwner, getCategoriesOwner);
router.get("/api/owner/exam-pattern", isOwner, getExamPatternSummary);
router.put("/api/owner/exam-pattern", isOwner, saveExamPatternSummary);
router.get("/api/owner/listing-marks", isOwner, getListingMarksForExam);
router.get("/api/owner/exam-pattern/list", isOwner, getAllExamPatternSummaries);
router.delete("/api/owner/exam-pattern/:id", isOwner, deleteExamPatternSummary);


router.get("/api/owner/users", isOwner, getAllUsersOwner);
router.patch("/api/owner/users/:id/toggle", isOwner, toggleUserSubscription);  
router.delete("/api/owner/users/:id", isOwner, deleteUser);



router.get("/owner/users/:id", isOwner, renderUserDetailPage);
router.post("/api/owner/users/:id/grant-subscription", isOwner, grantSubscription);
router.patch("/api/owner/users/:id/permissions", isOwner, saveUserPermissions);
router.post("/api/owner/users/:id/ban", isOwner, banUser);
router.post("/api/owner/users/:id/unban", isOwner, unbanUser);
router.post("/api/owner/users/:id/reset-password", isOwner, ownerResetUserPassword);

router.get("/api/owner/payments", isOwner, getAllPaymentsOwner);


router.get("/api/owner/custom-test/pricing", isOwner, getCustomTestPricingOwner);
router.patch("/api/owner/custom-test/pricing", isOwner, updateCustomTestPricingOwner);
router.post("/api/owner/users/:id/custom-test/grant", isOwner, grantCustomTestAccess);
router.post("/api/owner/users/:id/custom-test/revoke", isOwner, revokeCustomTestAccess);

router.get("/api/owner/login-history", isOwner, getLoginHistory);
router.delete("/api/owner/login-history/:id", isOwner, deleteLoginHistory);
router.delete("/api/owner/login-history-all", isOwner, deleteAllLoginHistory);



router.get("/api/owner/notifications", isOwner, getAllNotificationsOwner);
router.get("/api/owner/notifications/reach", isOwner, getNotificationReach);
router.get("/api/owner/notifications/search-users", isOwner, searchUsersForNotification);
router.post("/api/owner/notifications", isOwner, createNotification);
router.delete("/api/owner/notifications/:id", isOwner, deleteNotification);   
router.patch("/api/owner/notifications/:id", isOwner, updateNotification);     


export default router;