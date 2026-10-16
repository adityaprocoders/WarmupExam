// utils/locationPath.js

// Test ke parentType/parentId se upar chal ke folder/file names ka path banata hai
// (Section tak — Section khud path me nahi aata, uska naam alag se dikhta hai)
export async function buildTestLocationPath(test, Folder, File) {
    const path = [];
    let type = test.parentType;
    let id = test.parentId;

    // Safety: infinite loop na ho jaye kabhi galat data ki wajah se
    let guard = 0;

    while ((type === "folder" || type === "file") && id && guard < 20) {
        guard++;

        if (type === "folder") {
            const folder = await Folder.findById(id).select("title parentType parentId");
            if (!folder) break;
            path.unshift(folder.title);
            type = folder.parentType;
            id = folder.parentId;
        } else {
            const file = await File.findById(id).select("title parentType parentId");
            if (!file) break;
            path.unshift(file.title);
            type = file.parentType;
            id = file.parentId;
        }
    }

    return path;
}

// ---------------------------------------------------------------------------
// Premium color system — dashboard (Recent Activity) aur PDF dono yahi use karte hain.
// Har color ke 3 shade: main (dot / bar), soft (halka background), text (padhne layak gehra rang)
// ---------------------------------------------------------------------------

// Fixed colors — inko random pool me kabhi nahi daalna
export const LIVE_COLOR    = { main: "#EF4444", soft: "#FEE2E2", text: "#B91C1C" }; // red
export const WARMUP_COLOR  = { main: "#F59E0B", soft: "#FEF3C7", text: "#B45309" }; // yellow / amber
export const DEFAULT_COLOR = { main: "#64748B", soft: "#F1F5F9", text: "#334155" }; // slate (section ke bina tests)

// Random pool — red / yellow / pink / orange jaan-boojh kar nahi hain (fixed colors se confuse hote)
const SECTION_PALETTE = [
    { main: "#6366F1", soft: "#E0E7FF", text: "#4338CA" }, // indigo
    { main: "#10B981", soft: "#D1FAE5", text: "#047857" }, // emerald
    { main: "#8B5CF6", soft: "#EDE9FE", text: "#6D28D9" }, // violet
    { main: "#06B6D4", soft: "#CFFAFE", text: "#0E7490" }, // cyan
    { main: "#3B82F6", soft: "#DBEAFE", text: "#1D4ED8" }, // blue
    { main: "#14B8A6", soft: "#CCFBF1", text: "#0F766E" }, // teal
    { main: "#D946EF", soft: "#FAE8FF", text: "#A21CAF" }  // fuchsia
];

// String -> number (seed)
function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Seed se repeatable random generator
function mulberry32(seed) {
    let a = seed;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Listing ke sections ko "random-looking but stable" colors deta hai:
// - listing id seed hai, isliye har student ko har baar same color dikhta hai
// - jab tak 7 se kam sections hain, koi color repeat nahi hota
// `sections` wahi order me do jisme dashboard me dikhte hain (createdAt ascending)
export function buildSectionColorMap(sections, listingId) {
    const rand = mulberry32(hashString(String(listingId)));
    const shuffled = [...SECTION_PALETTE];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const map = {};
    (sections || []).forEach((sec, idx) => {
        map[String(sec._id)] = shuffled[idx % shuffled.length];
    });
    return map;
}