import express from "express";
import Listing from "../models/listing.js";
import Category from "../models/Category.js";
import Ebook from "../models/Ebook.js";

const router = express.Router();

function escapeXml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function urlEntry(loc, { changefreq = "weekly", priority = "0.7", lastmod, alternates = [] } = {}) {
    const alternateLinks = alternates
        .map(
            (alt) =>
                `\n<xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}"/>`
        )
        .join("");

    return `<url>
<loc>${escapeXml(loc)}</loc>${lastmod ? `\n<lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>` : ""}
<changefreq>${changefreq}</changefreq>
<priority>${priority}</priority>${alternateLinks}
</url>`;
}

router.get("/sitemap.xml", async (req, res) => {
    try {
        res.set("Cache-Control", "public, max-age=3600");

        const baseUrl = "https://warmupexam.com";
        const urls = [];

        urls.push(urlEntry(`${baseUrl}/`, { priority: "1.0" }));
        urls.push(urlEntry(`${baseUrl}/aboutUs`, { priority: "0.6" }));
        urls.push(urlEntry(`${baseUrl}/contactUs`, { priority: "0.6" }));
        urls.push(urlEntry(`${baseUrl}/features`, { priority: "0.6" }));
        urls.push(urlEntry(`${baseUrl}/privacy-Policy`, { priority: "0.3" }));
        urls.push(urlEntry(`${baseUrl}/Terms-&-Conditions`, { priority: "0.3" }));
        urls.push(urlEntry(`${baseUrl}/ebooks`, { priority: "0.7" }));
        urls.push(urlEntry(`${baseUrl}/alltests`, { priority: "0.9" }));
        urls.push(urlEntry(`${baseUrl}/skill-tests/typing-test`, { priority: "0.8" }));
        urls.push(urlEntry(`${baseUrl}/skill-tests/data-entry-test`, { priority: "0.8" }));
        urls.push(urlEntry(`${baseUrl}/skill-tests/calculation-test`, { priority: "0.8" }));
        urls.push(urlEntry(`${baseUrl}/categories`, { priority: "0.8" }));
        urls.push(urlEntry(`${baseUrl}/help`, { priority: "0.6" }));

        const categories = await Category.find({}).select("slug updatedAt").lean();
        categories.forEach((c) => {
            urls.push(
                urlEntry(`${baseUrl}/categories/${c.slug}`, {
                    priority: "0.8",
                    lastmod: c.updatedAt,
                })
            );
        });

        const listings = await Listing.find({ visibility: "public" })
            .select("slug updatedAt language exam title")
            .lean();

        const listingsByExam = {};
        listings.forEach((l) => {
            if (!l.exam || !l.title) return;
            const key = `${l.exam}||${l.title}`;
            if (!listingsByExam[key]) listingsByExam[key] = [];
            listingsByExam[key].push(l);
        });

        listings.forEach((l) => {
            let alternates = [];
            if (l.exam && l.title) {
                const key = `${l.exam}||${l.title}`;
                const group = listingsByExam[key] || [];

                const pair = group.find(
                    (other) =>
                        other.slug !== l.slug &&
                        other.language &&
                        l.language &&
                        other.language !== l.language
                );

                if (pair) {
                    const hiListing = l.language === "Hindi" ? l : pair.language === "Hindi" ? pair : null;
                    const enListing = l.language === "English" ? l : pair.language === "English" ? pair : null;

                    if (hiListing) {
                        alternates.push({ hreflang: "hi", href: `${baseUrl}/test/${hiListing.slug}` });
                    }
                    if (enListing) {
                        alternates.push({ hreflang: "en", href: `${baseUrl}/test/${enListing.slug}` });
                    }
                    const defaultSlug = enListing ? enListing.slug : l.slug;
                    alternates.push({ hreflang: "x-default", href: `${baseUrl}/test/${defaultSlug}` });
                }
            }

            urls.push(
                urlEntry(`${baseUrl}/test/${l.slug}`, {
                    priority: "0.8",
                    lastmod: l.updatedAt,
                    alternates,
                })
            );
        });

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
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