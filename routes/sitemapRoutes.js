import express from "express";
import Listing from "../models/listing.js";
import Category from "../models/Category.js";
import Ebook from "../models/Ebook.js";   // 👈 NAYA IMPORT

const router = express.Router();

function escapeXml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function urlEntry(loc, { changefreq = "weekly", priority = "0.7", lastmod } = {}) {
    return `<url>
<loc>${escapeXml(loc)}</loc>${lastmod ? `\n<lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>` : ""}
<changefreq>${changefreq}</changefreq>
<priority>${priority}</priority>
</url>`;
}

router.get("/sitemap.xml", async (req, res) => {
    try {
        res.set("Cache-Control", "public, max-age=3600");   // 👈 NAYA — 1 hour cache

        const baseUrl = "https://warmupexam.com";
        const now = new Date();   // 👈 NAYA — static pages ke lastmod ke liye
        const urls = [];

        // ---------- Static pages ----------
        urls.push(urlEntry(`${baseUrl}/`, { priority: "1.0", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/aboutUs`, { priority: "0.6", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/contactUs`, { priority: "0.6", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/features`, { priority: "0.6", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/privacy-Policy`, { priority: "0.3", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/Terms-&-Conditions`, { priority: "0.3", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/ebooks`, { priority: "0.7", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/alltests`, { priority: "0.9", lastmod: now }));
        urls.push(urlEntry(`${baseUrl}/categories`, { priority: "0.8", lastmod: now }));

        // ---------- Categories (dynamic) ----------
        const categories = await Category.find({}).select("slug updatedAt").lean();
        categories.forEach((c) => {
            urls.push(
                urlEntry(`${baseUrl}/categories/${c.slug}`, {
                    priority: "0.8",
                    lastmod: c.updatedAt,
                })
            );
        });

        // ---------- Public listings (dynamic) ----------
        const listings = await Listing.find({ visibility: "public" })
            .select("_id updatedAt")
            .lean();
        listings.forEach((l) => {
            urls.push(
                urlEntry(`${baseUrl}/test/${l._id}`, {
                    priority: "0.8",
                    lastmod: l.updatedAt,
                })
            );
        });

        // ---------- Public E-Books / Short Notes / PYQ / Handwritten Notes (dynamic) ----------
        // 👇 POORA NAYA BLOCK
        const ebooks = await Ebook.find({ visibility: "public" })
            .select("slug updatedAt")
            .lean();
        ebooks.forEach((e) => {
            urls.push(
                urlEntry(`${baseUrl}/ebooks/${e.slug}`, {
                    priority: "0.7",
                    lastmod: e.updatedAt,
                })
            );
        });

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

        res.header("Content-Type", "application/xml");
        res.send(xml);
    } catch (err) {
        console.error("Sitemap generation error:", err);
        res.header("Content-Type", "application/xml");
        res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
    }
});

export default router;