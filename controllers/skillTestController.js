import Section from "../models/Section.js";
import { SITE, ALL_TOOLS, skillContent } from "../utils/skillPageContent.js";

async function getBatchContext(req) {
    if (!req.user || req.user.role === "owner") return { listing: null, sections: [] };

    if (typeof req.user.populate === "function") {
        await req.user.populate([
            { path: "enrolledListings.listing" },
            { path: "lastAccessedBatch" }
        ]);
    }

    const listing = req.user.lastAccessedBatch
        || (req.user.enrolledListings && req.user.enrolledListings[0]?.listing)
        || null;

    const sections = listing
        ? await Section.find({ listing: listing._id }).sort({ createdAt: 1 })
        : [];

    return { listing, sections };
}

// JSON-LD ko <script> ke andar safe rakhne ke liye
function safeJson(data) {
    return JSON.stringify(data)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}

// Page ke liye content + related tools + structured data (SEO)
function buildPageExtras(key, seoData) {
    const skill = skillContent[key];
    const relatedTools = ALL_TOOLS.filter(t => t.key !== key);

    const jsonLd = safeJson([
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: skill.schemaName,
            url: seoData.canonicalUrl,
            description: seoData.description,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires JavaScript",
            inLanguage: skill.langCodes,
            isAccessibleForFree: true,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            publisher: { "@type": "Organization", name: "WarmupExam", url: SITE }
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
                { "@type": "ListItem", position: 2, name: skill.name, item: seoData.canonicalUrl }
            ]
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: skill.faqs.map(f => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a }
            }))
        }
    ]);

    return { skill, relatedTools, jsonLd };
}

async function renderSkillTest(req, res, renderPath, includePath, seoData, key) {
    const page = { ...seoData, ...buildPageExtras(key, seoData) };

    if (req.user && req.user.role !== "owner") {
        const { listing, sections } = await getBatchContext(req);

        if (listing) {
            // user ke paas batch access hai -> dashboard ke andar open karo
            return res.render("dashboard/skillTestWrapper", {
                layout: "layouts/dashboard",
                skillView: includePath,
                listing,
                sections,
                currentSection: null,
                ...page
            });
        }
    }

    // bina batch wale user (login ho ya na ho) -> normal page
    res.render(renderPath, page);
}

export const typingTest = (req, res) => renderSkillTest(req, res, "pages/skill/typingTest", "../pages/skill/typingTest", {
    title: "Typing Speed Test Online Free - Check Your WPM | WarmupExam",
    description:
        "Free online typing test in English & Hindi. Check your typing speed (WPM) and accuracy instantly. Choose time, word count & difficulty — no signup needed.",
    keywords:
        "typing test, typing speed test, WPM test, online typing test free, Hindi typing test, English typing test, typing test 2 minutes, typing practice",
    canonicalUrl: "https://warmupexam.com/skill-tests/typing-test"
}, "typing");

export const dataEntryTest = (req, res) => renderSkillTest(req, res, "pages/skill/dataEntryTest", "../pages/skill/dataEntryTest", {
    title: "Data Entry Speed Test Online Free | WarmupExam",
    description:
        "Free data entry test to check your typing speed and accuracy for numbers, codes & tables. Practice online instantly — no signup or download required.",
    keywords:
        "data entry test, data entry speed test online, data entry practice test free, data entry typing test, numeric data entry test",
    canonicalUrl: "https://warmupexam.com/skill-tests/data-entry-test"
}, "dataEntry");

export const calculationTest = (req, res) => renderSkillTest(req, res, "pages/skill/calculationTest", "../pages/skill/calculationTest", {
    title: "Mental Math Calculation Speed Test Free | WarmupExam",
    description:
        "Practice mental calculation speed for free — addition, subtraction, multiplication & division. Instant results with accuracy & questions-per-minute score.",
    keywords:
        "calculation test, mental math test, calculation speed test online, mental calculation practice, arithmetic speed test, quick maths test",
    canonicalUrl: "https://warmupexam.com/skill-tests/calculation-test"
}, "calculation");