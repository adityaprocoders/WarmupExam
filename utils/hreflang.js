// Single source of truth for hreflang (sitemap + page <head> dono yahin se).
const BASE_URL = (process.env.BASE_URL || "https://warmupexam.com").replace(/\/+$/, "");

// Listing.language free-text hai. Nayi language add karni ho to bas ek line jod do.
export const LANGUAGE_CODES = {
    english: "en", hindi: "hi", bengali: "bn", bangla: "bn", tamil: "ta",
    telugu: "te", marathi: "mr", gujarati: "gu", kannada: "kn", malayalam: "ml",
    punjabi: "pa", urdu: "ur", odia: "or", oriya: "or", assamese: "as",
};

export function languageCode(language) {
    return LANGUAGE_CODES[String(language || "").trim().toLowerCase()] || null;
}

export const testUrl = (slug) => `${BASE_URL}/test/${encodeURIComponent(slug)}`;

// Same exam + same title + alag language => ek hreflang set.
// Returns: Map(listingSlug -> [{ hreflang, href }])
export function buildAlternatesMap(listings) {
    const groups = new Map();
    for (const l of listings) {
        if (!l.exam || !l.title || !l.slug) continue;
        const key = `${l.exam}||${l.title}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(l);
    }

    const result = new Map();
    for (const group of groups.values()) {
        group.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

        const byCode = new Map(); // har language ka ek representative
        for (const l of group) {
            const code = languageCode(l.language);
            if (!code) continue;
            if (!byCode.has(code)) byCode.set(code, l);
        }
        if (byCode.size < 2) continue;

        const alternates = [];
        for (const [code, l] of byCode) alternates.push({ hreflang: code, href: testUrl(l.slug) });
        const def = byCode.get("en") || byCode.values().next().value;
        alternates.push({ hreflang: "x-default", href: testUrl(def.slug) });

        for (const l of byCode.values()) result.set(l.slug, alternates);
    }
    return result;
}