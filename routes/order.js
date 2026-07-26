const express = require("express");
const router = express.Router();
const TestSeries = require("../models/testSeries");
const { isLoggedIn } = require("../middleware");

router.get("/order-summary/:testId", isLoggedIn, async (req, res) => {
    const { testId } = req.params;
    const listing = await TestSeries.findById(testId);
    if (!listing) return res.redirect("/alltests");
    res.render("order/summary", { listing });
});

module.exports = router;