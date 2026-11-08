import express from "express";
import Listing from "../models/listing.js";
import Category from "../models/Category.js";
import Ebook from "../models/Ebook.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = (process.env.BASE_URL || "https://warmupexam.com").replace(/\/+$/, "");

// In categories ki listings sitemap mein kabhi nahi aayengi (category page bhi nahi)
const EXCLUDED_CATEGORY_SLUGS = ["ai-generated-system"];

const CACHE_TTL_MS = 60 * 60 * 1000;          // 1 ghanta
const STALE_RETRY_MS = 5 * 60 * 1000;         // DB fail ho to purana cache 5 min aur chalao
const MAX_URLS_PER_SITEMAP = 45000;           // Google limit 50,000 hai, safe margin

// Listing.language free-text hai. Yahan language -> hreflang code map hai.
// Nayi language add karni ho to bas yahan ek line jod do.
const LANGUAGE_CODES = {
    english: "en",
    hindi: "hi",
    bengali: "bn",
    bangla: "bn",
    tamil: "ta",
    telugu: "te",
    marathi: "mr",
    gujarati: "gu",
    kannada: "kn",
    malayalam: "ml",
    punjabi: "pa",
    urdu: "ur",
    odia: "or",
    oriya: "or",
    assamese: "as",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeXml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// Invalid / missing date par null deta hai (crash nahi karta)
function formatDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function urlEntry(loc, { lastmod, alternates = [] } = {}) {
    const date = formatDate(lastmod);
    const alternateLinks = alternates
        .map(
            (alt) =>
                `\n<xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}"/>`
        )
        .join("");

    return `<url>
<loc>${escapeXml(loc)}</loc>${date ? `\n<lastmod>${date}</lastmod>` : ""}${alternateLinks}
</url>`;
}

function maxDate(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return new Date(a) >= new Date(b) ? a : b;
}

function languageCode(language) {
    return LANGUAGE_CODES[String(language || "").trim().toLowerCase()] || null;
}

const testUrl = (slug) => `${BASE_URL}/test/${encodeURIComponent(slug)}`;

// Same exam + same title + alag language wali listings ka hreflang set banata hai.
// Rule showTest (listingController) jaisa hi hai: exact exam + exact title match.
// Returns: Map(listingSlug -> alternates[])
function buildAlternatesMap(listings) {
    const groups = new Map();

    for (const l of listings) {
        if (!l.exam || !l.title || !l.slug) continue;
        const key = `${l.exam}||${l.title}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
    }

    const result = new Map();

    for (const group of groups.values()) {
        // Deterministic order (slug se), taaki har baar same output aaye
        group.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

        // Har language ka sirf ek representative listing
        const byCode = new Map();
        for (const l of group) {
            const code = languageCode(l.language);
            if (!code) continue;                 // unknown language -> hreflang nahi
            if (!byCode.has(code)) byCode.set(code, l);
        }

        if (byCode.size < 2) continue;           // koi alternate language nahi

        const alternates = [];
        for (const [code, l] of byCode) {
            alternates.push({ hreflang: code, href: testUrl(l.slug) });
        }

        const defaultListing = byCode.get("en") || byCode.values().next().value;
        alternates.push({ hreflang: "x-default", href: testUrl(defaultListing.slug) });

        // Sirf representative listings ko alternates milte hain
        // (har page ko apna self-reference + baaki sab languages)
        for (const l of byCode.values()) {
            result.set(l.slug, alternates);
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Sitemap data build
// ---------------------------------------------------------------------------
async function buildEntries() {
    const entries = [];

    // ---- Static pages ----
    const staticPaths = [
        "/",
        "/aboutUs",
        "/contactUs",
        "/features",
        "/privacy-Policy",
        "/Terms-&-Conditions",
        "/ebooks",
        "/alltests",
        "/custom-test",
        "/pricing",
        "/skill-tests/typing-test",
        "/skill-tests/data-entry-test",
        "/skill-tests/calculation-test",
        "/categories",
        "/help",
    ];
    staticPaths.forEach((p) => entries.push(urlEntry(`${BASE_URL}${p}`)));

    // ---- Excluded categories (listings bhi bahar) ----
    const excluded = await Category.find({ slug: { $in: EXCLUDED_CATEGORY_SLUGS } })
        .select("_id")
        .lean();
    const excludedIds = excluded.map((c) => c._id);

    const listingFilter = { visibility: "public" };
    if (excludedIds.length) listingFilter.category = { $nin: excludedIds };

    const listings = await Listing.find(listingFilter)
        .select("slug updatedAt language exam title category")
        .lean();

    // ---- Categories (sirf jinki public listings hain) ----
    // lastmod = us category ki listings ka sabse naya updatedAt
    const categoryLastmod = new Map();
    for (const l of listings) {
        if (!l.category) continue;
        const id = String(l.category);
        categoryLastmod.set(id, maxDate(categoryLastmod.get(id), l.updatedAt));
    }

    if (categoryLastmod.size) {
        const categories = await Category.find({
            _id: { $in: [...categoryLastmod.keys()] },
            slug: { $nin: EXCLUDED_CATEGORY_SLUGS },
        })
            .select("slug")
            .lean();

        for (const c of categories) {
            if (!c.slug) continue;
            entries.push(
                urlEntry(`${BASE_URL}/categories/${encodeURIComponent(c.slug)}`, {
                    lastmod: categoryLastmod.get(String(c._id)),
                })
            );
        }
    }

    // ---- Listings (/test/:slug) with hreflang ----
    const alternatesMap = buildAlternatesMap(listings);
    for (const l of listings) {
        if (!l.slug) continue;
        entries.push(
            urlEntry(testUrl(l.slug), {
                lastmod: l.updatedAt,
                alternates: alternatesMap.get(l.slug) || [],
            })
        );
    }

    // ---- Ebooks ----
    const ebooks = await Ebook.find({ visibility: "public" }).select("slug updatedAt").lean();
    for (const e of ebooks) {
        if (!e.slug) continue;
        entries.push(
            urlEntry(`${BASE_URL}/ebooks/${encodeURIComponent(e.slug)}`, {
                lastmod: e.updatedAt,
            })
        );
    }

    return entries;
}

// ---------------------------------------------------------------------------
// Cache (in-memory, 1 ghanta) + stampede protection
// ---------------------------------------------------------------------------
let cache = null;       // { entries, expiresAt }
let building = null;    // in-flight promise

async function getEntries() {
    if (cache && cache.expiresAt > Date.now()) return cache.entries;

    if (!building) {
        building = buildEntries()
            .then((entries) => {
                cache = { entries, expiresAt: Date.now() + CACHE_TTL_MS };
                return entries;
            })
            .finally(() => {
                building = null;
            });
    }

    try {
        return await building;
    } catch (err) {
        if (cache) {
            // DB error: purana sitemap serve karo, thodi der baad dobara try
            console.error("Sitemap rebuild failed, serving stale cache:", err);
            cache.expiresAt = Date.now() + STALE_RETRY_MS;
            return cache.entries;
        }
        throw err;
    }
}

// ---------------------------------------------------------------------------
// XML wrappers
// ---------------------------------------------------------------------------
const URLSET_OPEN =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

const wrapUrlset = (items) => `${URLSET_OPEN}\n${items.join("\n")}\n</urlset>`;

function wrapIndex(pageCount) {
    const items = [];
    for (let i = 1; i <= pageCount; i++) {
        items.push(`<sitemap>\n<loc>${escapeXml(`${BASE_URL}/sitemap-${i}.xml`)}</loc>\n</sitemap>`);
    }
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</sitemapindex>`
    );
}

function sendXml(res, xml) {
    res.set("Cache-Control", "public, max-age=3600");
    res.type("application/xml").send(xml);
}

function sendError(res) {
    res.set("Cache-Control", "no-store");
    res.status(500)
        .type("application/xml")
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// /sitemap.xml -> normally single urlset; 45k se upar jaye to automatically sitemap index
router.get("/sitemap.xml", async (req, res) => {
    try {
        const entries = await getEntries();

        if (entries.length <= MAX_URLS_PER_SITEMAP) {
            return sendXml(res, wrapUrlset(entries));
        }

        const pageCount = Math.ceil(entries.length / MAX_URLS_PER_SITEMAP);
        return sendXml(res, wrapIndex(pageCount));
    } catch (err) {
        console.error("Sitemap generation error:", err);
        sendError(res);
    }
});

// /sitemap-1.xml, /sitemap-2.xml ... sirf tab exist karte hain jab index mode ho
router.get("/sitemap-:page.xml", async (req, res, next) => {
    if (!/^\d+$/.test(req.params.page)) return next();

    try {
        const entries = await getEntries();
        const page = Number(req.params.page);
        const start = (page - 1) * MAX_URLS_PER_SITEMAP;

        if (entries.length <= MAX_URLS_PER_SITEMAP || page < 1 || start >= entries.length) {
            return next();   // normal 404 handler
        }

        return sendXml(res, wrapUrlset(entries.slice(start, start + MAX_URLS_PER_SITEMAP)));
    } catch (err) {
        console.error("Sitemap page generation error:", err);
        sendError(res);
    }
});

export default router;