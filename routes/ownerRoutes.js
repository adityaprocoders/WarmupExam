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
    toggleBanUser,
    ownerResetUserPassword,
    getAllPaymentsOwner
} from "../controllers/ownerController.js";
import { isOwner } from "../middleware/isLoggedIn.js";

const router = express.Router();

router.get("/api/owner/dashboard/stats", isOwner, getDashboardStats);
router.get("/api/owner/dashboard/charts", isOwner, getChartData);
router.get("/api/owner/testseries", isOwner, getAllTestSeriesOwner);
router.delete("/api/owner/testseries/:id", isOwner, deleteTestSeries);


router.get("/api/owner/users", isOwner, getAllUsersOwner);
router.patch("/api/owner/users/:id/toggle", isOwner, toggleUserSubscription);  
router.delete("/api/owner/users/:id", isOwner, deleteUser);



router.get("/owner/users/:id", isOwner, renderUserDetailPage);
router.post("/api/owner/users/:id/grant-subscription", isOwner, grantSubscription);
router.patch("/api/owner/users/:id/permissions", isOwner, saveUserPermissions);
router.patch("/api/owner/users/:id/ban", isOwner, toggleBanUser);
router.post("/api/owner/users/:id/reset-password", isOwner, ownerResetUserPassword);

router.get("/api/owner/payments", isOwner, getAllPaymentsOwner);

export default router;