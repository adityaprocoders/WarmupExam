import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { sendContactMessage } from "../controllers/contactController.js";
import { contactLimiter } from "../middleware/rateLimiters.js";


const router = express.Router();


router.post("/contact", contactLimiter, wrapAsync(sendContactMessage));


export default router;