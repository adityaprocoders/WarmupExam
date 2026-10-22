export const MAX_TIERS = 6;
export const MIN_TIERS = 2;

export const STRUCTURE_PRESETS = {
    tier:          ["Tier 1", "Tier 2"],
    part:          ["Part 1", "Part 2"],
    prelims_mains: ["Prelims", "Mains"],
    main_advanced: ["Main", "Advanced"],
    custom:        ["Part 1", "Part 2"]
};

function legacyConfig(listing) {
    return {
        marks: (listing && listing.marks) || [],
        rankPredictorData: (listing && listing.rankPredictorData) || []
    };
}

export function isMultiTier(listing) {
    return !!(listing && listing.examStructure === "multi" &&
        Array.isArray(listing.tiers) && listing.tiers.length >= MIN_TIERS);
}

export function getTierList(listing) {
    if (!isMultiTier(listing)) return [];
    return [...listing.tiers]
        .map(t => (t.toObject ? t.toObject() : t))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(t => ({ key: t.key, name: t.name, order: t.order || 0 }));
}

export function getDefaultTierKey(listing) {
    return getTierList(listing)[0]?.key || null;
}

export function resolveTierKey(listing, tierKey) {
    if (!isMultiTier(listing)) return null;
    const keys = getTierList(listing).map(t => t.key);
    return tierKey && keys.includes(tierKey) ? tierKey : keys[0];
}

export function resolveTestTier(listing, tierKey) {
    return resolveTierKey(listing, tierKey);
}

export function getTierConfig(listing, tierKey) {
    if (!isMultiTier(listing) || !tierKey) return legacyConfig(listing);
    const sorted = [...listing.tiers].sort((a, b) => (a.order || 0) - (b.order || 0));
    const idx = sorted.findIndex(t => t.key === tierKey);
    if (idx <= 0) return legacyConfig(listing);
    return {
        marks: sorted[idx].marks || [],
        rankPredictorData: sorted[idx].rankPredictorData || []
    };
}

export function getTierConfigForTest(listing, test) {
    return getTierConfig(listing, test && test.tier);
}

export function tierHasMarks(listing, tierKey) {
    return (getTierConfig(listing, tierKey).marks || []).length > 0;
}

export function buildTierTestFilter(listing, tierKey) {
    if (!isMultiTier(listing)) return {};
    const key = resolveTierKey(listing, tierKey);
    if (key === getDefaultTierKey(listing)) {
        return { $or: [{ tier: key }, { tier: null }] };
    }
    return { tier: key };
}

export function slugifyTierKey(name, fallback) {
    const base = String(name || "").trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return base || fallback;
}

export function cleanTiers(raw) {
    if (!raw) return [];
    const arr = (Array.isArray(raw) ? raw : Object.values(raw)).slice(0, MAX_TIERS);
    const used = new Set();

    const list = arr
        .filter(t => t && String(t.name || "").trim())
        .map((t, i) => {
            const name = String(t.name).trim();
            let key = String(t.key || "").trim() || slugifyTierKey(name, `part-${i + 1}`);
            let candidate = key, n = 2;
            while (used.has(candidate)) candidate = `${key}-${n++}`;
            key = candidate;
            used.add(key);

            const marksArr = Array.isArray(t.marks) ? t.marks : Object.values(t.marks || {});
            const marks = marksArr
                .filter(m => m && String(m.subject || "").trim())
                .map(m => ({
                    subject: String(m.subject).trim(),
                    positiveMarks: Number(m.positiveMarks) || 0,
                    negativeMarks: Number(m.negativeMarks) || 0,
                    qualifyingOnly: m.qualifyingOnly === true || m.qualifyingOnly === "true"
                }));

            const rankArr = Array.isArray(t.rankPredictorData) ? t.rankPredictorData : Object.values(t.rankPredictorData || {});
            const rankPredictorData = rankArr
                .filter(r => r && r.marks !== "" && r.rank !== "" && r.marks !== undefined && r.rank !== undefined)
                .map(r => ({ marks: Number(r.marks), rank: Number(r.rank) }))
                .filter(r => !Number.isNaN(r.marks) && !Number.isNaN(r.rank));

            return { key, name, order: i, marks, rankPredictorData };
        });

    if (list.length > 0) { list[0].marks = []; list[0].rankPredictorData = []; }
    return list;
}