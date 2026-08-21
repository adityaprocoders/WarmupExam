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



// ✅ Sitemap route (static + dynamic dono)
router.get("/sitemap.xml", async (req, res) => {
    res.header("Content-Type", "application/xml");

    const staticPages = [
        "",
        "aboutUs",
        "contactUs",
        "features",
        "privacy-Policy",
        "Terms-&amp;-Conditions",
        "ebooks"
    ];

    // ✅ Sirf public tests fetch karo (private wale sitemap me nahi jaane chahiye)
    const listings = await Listing.find({ visibility: "public" }).select("slug").lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    staticPages.forEach(page => {
        xml += `
    <url>
        <loc>https://warmupexam.com/${page}</loc>
        <changefreq>weekly</changefreq>
        <priority>${page === "" ? "1.0" : "0.7"}</priority>
    </url>`;
    });

    listings.forEach(listing => {
        xml += `
    <url>
        <loc>https://warmupexam.com/series/${listing.slug}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
    });

    xml += `\n</urlset>`;

    res.send(xml);
});

export default router;