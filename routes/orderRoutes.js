import express from "express";
import wrapAsync from "../utils/wrapAsync.js";
import { isLoggedIn } from "../middleware/isLoggedIn.js";
import Listing from "../models/listing.js";

const router = express.Router();

router.get("/order-summary/:testId", isLoggedIn, wrapAsync(async (req, res) => {
    const { testId } = req.params;
    const listing = await Listing.findById(testId);   // ← YAHAN fix: "TestSeries" ko "Listing" kiya
    if (!listing) return res.redirect("/alltests");
    res.render("order/summary", { listing });
}));

export default router;