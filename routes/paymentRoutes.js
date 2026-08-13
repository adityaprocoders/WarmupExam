import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as paymentController from "../controllers/paymentController.js";
import { validateBody } from "../middleware/validate.js";
import { applyCouponSchema, createOrderSchema, verifyPaymentSchema } from "../utils/schemas.js";
import { paymentLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.get("/order-summary/:listingId", isLoggedIn, wrapAsync(paymentController.showOrderSummary));

router.post(
    "/apply-coupon",
    isLoggedIn,
    paymentLimiter, 
    validateBody(applyCouponSchema),
    wrapAsync(paymentController.applyCoupon)
);

router.post(
    "/create-order",
    isLoggedIn,
     paymentLimiter, 
    validateBody(createOrderSchema),
    wrapAsync(paymentController.createOrder)
);

router.post(
    "/verify-payment",
    isLoggedIn,
     paymentLimiter, 
    validateBody(verifyPaymentSchema),
    wrapAsync(paymentController.verifyPayment)
);

export default router;