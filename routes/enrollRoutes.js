import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import * as enrollController from "../controllers/enrollController.js";

const router = express.Router();

router.post("/enroll/:listingId", isLoggedIn, wrapAsync(enrollController.enrollListing));

export default router;