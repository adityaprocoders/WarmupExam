import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import { isOwnerUser } from "../utils/authHelpers.js";
import * as couponController from "../controllers/couponController.js";
import { validateBody } from "../middleware/validate.js";
import { createCouponSchema } from "../utils/schemas.js";

const router = express.Router();

// Sirf owner hi access kar sake
function isOwnerOnly(req, res, next) {
    if (!isOwnerUser(req)) {
        return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
}

router.get("/admin/coupons", isLoggedIn, isOwnerOnly, wrapAsync(couponController.listCoupons));

router.post(
    "/admin/coupons",
    isLoggedIn,
    isOwnerOnly,
    validateBody(createCouponSchema),
    wrapAsync(couponController.createCoupon)
);

router.patch("/admin/coupons/:id/toggle", isLoggedIn, isOwnerOnly, wrapAsync(couponController.toggleCoupon));

router.delete("/admin/coupons/:id", isLoggedIn, isOwnerOnly, wrapAsync(couponController.deleteCoupon));

export default router;