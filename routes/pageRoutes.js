import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import * as pageController from "../controllers/pageController.js";
import { redirectIfLoggedIn } from "../middleware/redirectIfLoggedIn.js";
import Listing from "../models/listing.js";   

const router = express.Router();

router.get("/", redirectIfLoggedIn, wrapAsync(pageController.home));
router.get("/aboutUs", pageController.aboutUs);
router.get("/contactUs", pageController.contactUs);
router.get("/Terms-&-Conditions", pageController.termsOfUse);
router.get("/privacy-Policy", pageController.privacyPolicy);
router.get("/features", pageController.features);
router.get("/help", pageController.help);





export default router;