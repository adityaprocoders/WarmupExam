import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { sendContactMessage } from "../controllers/contactController.js";

const router = express.Router();

router.post("/contact", wrapAsync(sendContactMessage));

export default router;