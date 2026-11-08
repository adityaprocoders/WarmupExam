// utils/randomCopy.js
// "Share with tests -> Random": folder/file structure same, file ke andar ke tests ki jagah random tests.
// copyNode ko ye file chhedti nahi, sirf use karti hai.
import crypto from "crypto";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Question from "../models/Question.js";
import Listing from "../models/listing.js"; 
import { copyNode } from "./copyHelpers.js";
import { getTierConfig } from "./tierHelper.js";

const MAX_TESTS = 200;
const MAX_QPT = 500;
const DIFFS = ["Easy", "Medium", "Hard"];
const CHUNK = 5000;

const tick = (cb, n = 1) => { if (typeof cb === "function" && n > 0) cb(n); };
const norm = (s) => String(s ?? "").trim().toLowerCase();

function chunks(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function mostCommon(values) {
    const m = new Map();
    let best = null, bestCount = 0;
    for (const v of values) {
        const c = (m.get(v) || 0) + 1;
        m.set(v, c);
        if (c > bestCount) { bestCount = c; best = v; }
    }
    return best;
}

/* ---------------- config validate ---------------- */
export function normalizeRandomConfig(raw) {
    if (!raw || typeof raw !== "object") return { error: "Random settings missing." };

    const qpt = parseInt(raw.questionsPerTest, 10);
    if (!Number.isInteger(qpt) || qpt < 1 || qpt > MAX_QPT) {
        return { error: `Questions per test 1 se ${MAX_QPT} ke beech hona chahiye.` };
    }

    const k = parseInt(raw.numTests ?? (Array.isArray(raw.tests) ? raw.tests.length : NaN), 10);
    if (!Number.isInteger(k) || k < 1 || k > MAX_TESTS) {
        return { error: `Number of tests 1 se ${MAX_TESTS} ke beech hona chahiye.` };
    }

    const subject = String(raw.subject ?? "").trim();
    if (!subject) return { error: "Subject chunna zaroori hai." };

    const testName = String(raw.testName ?? "").trim().slice(0, 100);
        const language = String(raw.language ?? "").trim().slice(0, 50);


    let difficulty = { mode: "none" };
    const d = raw.difficulty;
    if (d && d.mode === "percent") {
        const e = parseInt(d.easy || 0, 10), m = parseInt(d.medium || 0, 10), h = parseInt(d.hard || 0, 10);
        if ([e, m, h].some((x) => !Number.isInteger(x) || x < 0 || x > 100)) {
            return { error: "Difficulty percentage 0 se 100 ke beech hona chahiye." };
        }
        if (e + m + h !== 100) return { error: "Difficulty percentage ka total 100 hona chahiye." };
        difficulty = { mode: "percent", easy: e, medium: m, hard: h };
    } else if (d && d.mode === "select") {
        const levels = [...new Set((Array.isArray(d.levels) ? d.levels : []).filter((x) => DIFFS.includes(x)))];
        if (levels.length) difficulty = { mode: "select", levels };
    } else if (Array.isArray(raw.tests) && raw.tests[0] && Array.isArray(raw.tests[0].difficulties)) {
        // purana format (cached browser JS ke liye)
        const levels = [...new Set(raw.tests[0].difficulties.filter((x) => DIFFS.includes(x)))];
        if (levels.length) difficulty = { mode: "select", levels };
    }

    const tier = String(raw.tier ?? "").trim() || null;
    return { config: { questionsPerTest: qpt, numTests: k, subject, testName, language, difficulty, tier } };
}


/* ---------------- progress total ---------------- */
// Max count (jitne tests maange). Asli kam bane to controller ka setAtLeast % theek kar deta hai.
export async function countRandomUnits(type, id, cfg) {
        const K = cfg.numTests;
    if (type === "test") return 1;
    if (type === "file") return 1 + K;

    if (type === "folder") {
        let n = 1 + (await Test.countDocuments({ parentType: "folder", parentId: id }));
        for (const f of await Folder.find({ parentType: "folder", parentId: id }).select("_id")) n += await countRandomUnits("folder", f._id, cfg);
        for (const f of await File.find({ parentType: "folder", parentId: id }).select("_id")) n += await countRandomUnits("file", f._id, cfg);
        return n;
    }

    if (type === "section") {
        const sec = await Section.findById(id).select("listing");
        if (!sec) return 0;
        const root = { listing: sec.listing, section: sec._id, parentType: "section", parentId: null };
        let n = 1 + (await Test.countDocuments(root));
        for (const f of await Folder.find(root).select("_id")) n += await countRandomUnits("folder", f._id, cfg);
        for (const f of await File.find(root).select("_id")) n += await countRandomUnits("file", f._id, cfg);
        return n;
    }
    return 0;
}

/* ---------------- file ka question pool ---------------- */
function candidateGroups(srcTests, language) {
    // same language setup wale tests ek group
    const groups = new Map();
    for (const t of srcTests) {
        const key = `${t.languageMode}|${(t.languages || []).map(norm).sort().join(",")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }
    let list = [...groups.values()];

    // language chuni ho to pehle wahi groups jinme wo language ho
    const lang = norm(language);
    if (lang && lang !== "all") {
        const withLang = list.filter((g) => (g[0].languages || []).some((l) => norm(l) === lang));
        if (withLang.length) list = withLang;
    }
    return list;
}

async function poolOfGroup(group) {
    const testIds = group.map((t) => t._id);
    const mappings = await TestQuestion.find({ test: { $in: testIds } })
        .select("question subject topic subTopic section").lean();

    // duplicate question ek hi baar
    const byQ = new Map();
    for (const m of mappings) {
        const k = String(m.question);
        if (!byQ.has(k)) byQ.set(k, m);
    }

    const qMap = new Map();
    for (const part of chunks([...byQ.keys()], CHUNK)) {
        const qs = await Question.find({ _id: { $in: part } })
            .select("difficulty status subject topic subTopic section").lean();
        qs.forEach((q) => qMap.set(String(q._id), q));
    }

    const pool = [];
    for (const [qid, m] of byQ) {
        const q = qMap.get(qid);
        if (!q || q.status === "Disabled") continue;
        pool.push({
            question: m.question,
            subject: String(m.subject || q.subject || "").trim(),
            topic: m.topic || q.topic || "",
            subTopic: m.subTopic || q.subTopic || "",
            section: m.section || q.section || "",
            difficulty: q.difficulty || "Medium"
        });
    }
    return pool;
}

// file ke tests me se sabse bada language-group ka pool (source ka subject dekha nahi jata)
async function buildFilePool(fileId, language) {
    const srcTests = await Test.find({ parentType: "file", parentId: fileId })
        .select("title languageMode languages tier visibility duration totalQuestions").lean();
    if (srcTests.length === 0) return null;

    let best = null;
    for (const group of candidateGroups(srcTests, language)) {
        const pool = await poolOfGroup(group);
        if (!best || pool.length > best.pool.length || (pool.length === best.pool.length && group.length > best.group.length)) {
            best = { group, pool };
        }
    }
    return best ? { group: best.group, pool: best.pool, skipped: srcTests.length - best.group.length } : null;
}

async function getDestListing(id, ctx) {
    const k = String(id);
    if (!ctx.listings.has(k)) {
        ctx.listings.set(k, await Listing.findById(id).select("marks tiers examStructure").lean());
    }
    return ctx.listings.get(k);
}


// n questions ko Easy/Medium/Hard me % ke hisaab se baanto (largest remainder)
function allocate(n, e, m, h) {
    const exact = [(n * e) / 100, (n * m) / 100, (n * h) / 100];
    const base = exact.map(Math.floor);
    let left = n - base.reduce((a, b) => a + b, 0);
    const order = [0, 1, 2].sort((a, b) => (exact[b] - base[b]) - (exact[a] - base[a]));
    for (let i = 0; left > 0; i = (i + 1) % 3) { base[order[i]]++; left--; }
    return { Easy: base[0], Medium: base[1], Hard: base[2] };
}

// pool (pehle se shuffled) me se n questions: pehle difficulty preference, phir baaki random.
// "used" me jo question aa chuke wo kabhi dobara nahi aate (file ke andar no duplicate).
function takeQuestions(pool, used, n, diff) {
    const picked = new Set();
    const chosen = [];
    let matched = true;

    const take = (pred, max) => {
        let got = 0;
        for (const p of pool) {
            if (chosen.length >= n || got >= max) break;
            const id = String(p.question);
            if (used.has(id) || picked.has(id) || !pred(p)) continue;
            picked.add(id);
            chosen.push(p);
            got++;
        }
        return got;
    };

    if (diff && diff.mode === "percent") {
        const want = allocate(n, diff.easy, diff.medium, diff.hard);
        for (const d of DIFFS) {
            const got = take((p) => p.difficulty === d, want[d]);
            if (got < want[d]) matched = false;
        }
    } else if (diff && diff.mode === "select") {
        const set = new Set(diff.levels);
        take((p) => set.has(p.difficulty), n);
        if (chosen.length < n) matched = false;
    }

    if (chosen.length < n) take(() => true, n - chosen.length);   // baaki same subject se random
    return { chosen, matched };
}


/* ---------------- ek file ke andar random tests ---------------- */
async function createRandomTestsForFile(srcFileId, newFile, destListingId, destSectionId, cfg, ctx, pathLabel) {
    const built = await buildFilePool(srcFileId, cfg.language);
    if (!built) return; // file me koi test nahi, random ka matlab nahi

    const { group, pool, skipped } = built;
    const destListing = await getDestListing(destListingId, ctx);

    const first = group[0];
    const tier = cfg.tier || null;   // owner ne popup me jo tier chuna (single-structure me null)
    const visibility = first.visibility === "public" ? "public" : "private";
    // show language: chuni hui language test ki languages me ho (aur multi-language test ho) to wahi, warna "all"
    let showLanguage = "all";
    let langMissing = false;
    const wantLang = norm(cfg.language);
    if (wantLang && wantLang !== "all") {
        const multi = norm(first.languageMode).startsWith("multi") || (first.languages || []).length > 1;
        const matchedLang = (first.languages || []).find((l) => norm(l) === wantLang);
        if (multi && matchedLang) showLanguage = matchedLang;
        else if (multi) langMissing = true;
    }

    const sumQ = group.reduce((s, t) => s + (t.totalQuestions || 0), 0);
    const sumDur = group.reduce((s, t) => s + (t.duration || 0), 0);
    const minPerQ = sumQ > 0 ? sumDur / sumQ : 0;

    const marksCfg = destListing ? (getTierConfig(destListing, tier).marks || []) : [];
    const mc = marksCfg.find((s) => norm(s.subject) === norm(cfg.subject)) || null;
    const pos = mc ? Number(mc.positiveMarks) || 0 : 0;
    const neg = mc ? Number(mc.negativeMarks) || 0 : 0;
    const qualifying = mc ? !!mc.qualifyingOnly : false;

    const path = pathLabel ? `${pathLabel} > ${newFile.title}` : newFile.title;
    const baseName = cfg.testName || `${newFile.title} - Random`;
    const per = cfg.questionsPerTest;

    // file ke saare unique questions (ek question ek hi baar). Source ka subject matter nahi karta,
    // naye tests me subject = jo owner ne destination se chuna.
    const matching = pool;
    const target = Math.min(cfg.numTests, Math.floor(matching.length / per));

    if (skipped > 0) {
        ctx.notes.push(`${path}: ${skipped} test ki language setting alag thi, isliye unke questions pool me nahi liye gaye`);
    }

    if (target === 0) {
        ctx.notes.push(`${path}: koi test nahi bana (file me ${matching.length} unique questions hain, ek test ke liye ${per} chahiye)`);
        return;
    }

    shuffle(matching);
    const used = new Set();
    let created = 0;
    let unmatched = 0;

    for (let i = 0; i < target; i++) {
        const { chosen, matched } = takeQuestions(matching, used, per, cfg.difficulty);
        if (chosen.length < per) break;   // safety: adhoora test kabhi nahi
        shuffle(chosen);

        const duration = minPerQ > 0 ? Math.max(1, Math.round(minPerQ * chosen.length)) : (first.duration || 60);

        let newTest = null;
        try {
            newTest = await Test.create({
                title: `${baseName} ${String(created + 1).padStart(2, "0")}`,
                listing: destListingId,
                section: destSectionId,
                parentType: "file",
                parentId: newFile._id,
                timeStrategy: "total",
                duration,
                subjectTime: [],
                totalQuestions: chosen.length,
                totalMarks: pos * chosen.length,
                languageMode: first.languageMode,
                languages: first.languages,
                showLanguage,
                visibility,
                tier
            });

            const docs = chosen.map((p, idx) => ({
                test: newTest._id,
                question: p.question,
                order: idx + 1,
                subject: cfg.subject,
                topic: p.topic,
                subTopic: p.subTopic,
                section: p.section,
                positiveMarks: pos,
                negativeMarks: neg,
                qualifyingOnly: qualifying
            }));
            for (const part of chunks(docs, 1000)) await TestQuestion.insertMany(part);

            chosen.forEach((p) => used.add(String(p.question)));
            created++;
            if (!matched) unmatched++;
            tick(ctx.onProgress);
        } catch (err) {
            console.error("Random test create error:", err);
            if (newTest) {
                try {
                    await TestQuestion.deleteMany({ test: newTest._id });
                    await Test.findByIdAndDelete(newTest._id);
                } catch (e) { /* ignore */ }
            }
            ctx.notes.push(`${path}: ek random test nahi ban paya (${err.message})`);
        }
    }

    if (created < cfg.numTests) {
        ctx.notes.push(`${path}: ${cfg.numTests} tests maange, ${created} bane (file me ${matching.length} unique questions the, har test ke liye ${per} chahiye)`);
    }
    if (unmatched > 0) {
        ctx.notes.push(`${path}: ${unmatched} test me difficulty poori match nahi hui, baaki questions random bhare gaye`);
    }

        if (langMissing && created > 0) {
        ctx.notes.push(`${path}: language "${cfg.language}" in tests me nahi mili, "All" set hui`);
    }
}

/* ---------------- main: structure copy + random tests ---------------- */
export async function randomCopyNode(sourceType, sourceId, destListingId, destSectionId, destParentType, destParentId, cfg, ctx, pathLabel = "") {
    ctx = ctx || {};
    if (!ctx.notes) ctx.notes = [];
    if (!ctx.listings) ctx.listings = new Map();

    // Akela test / folder-section ke direct tests: same-to-same
    if (sourceType === "test") {
        return copyNode("test", sourceId, destListingId, destSectionId, destParentType, destParentId, null, pathLabel, [], true, ctx.onProgress);
    }

    if (sourceType === "file") {
        // includeTests=false: sirf file banegi, uske purane tests nahi
        const newFile = await copyNode("file", sourceId, destListingId, destSectionId, destParentType, destParentId, null, pathLabel, [], false, ctx.onProgress);
        if (!newFile) return null;
        await createRandomTestsForFile(sourceId, newFile, destListingId, destSectionId, cfg, ctx, pathLabel);
        return newFile;
    }

    if (sourceType === "folder") {
        const oldFolder = await Folder.findById(sourceId);
        if (!oldFolder) { console.warn(`⚠️ Folder ${sourceId} not found`); return null; }

        // create se PEHLE snapshot (same folder me paste karne par loop nahi)
        const childFolders = await Folder.find({ parentType: "folder", parentId: oldFolder._id }).select("_id");
        const childFiles = await File.find({ parentType: "folder", parentId: oldFolder._id }).select("_id");
        const childTests = await Test.find({ parentType: "folder", parentId: oldFolder._id }).select("_id");

        const newFolder = await Folder.create({
            title: oldFolder.title,
            slug: `${oldFolder.slug}-${crypto.randomBytes(4).toString("hex")}`,
            icon: oldFolder.icon,
            listing: destListingId,
            section: destSectionId,
            parentType: destParentType,
            parentId: destParentId
        });
        tick(ctx.onProgress);

        const nextPath = `${pathLabel ? pathLabel + " > " : ""}${oldFolder.title}`;

        for (const f of childFolders) await randomCopyNode("folder", f._id, destListingId, destSectionId, "folder", newFolder._id, cfg, ctx, nextPath);
        for (const f of childFiles) await randomCopyNode("file", f._id, destListingId, destSectionId, "folder", newFolder._id, cfg, ctx, nextPath);
        for (const t of childTests) await randomCopyNode("test", t._id, destListingId, destSectionId, "folder", newFolder._id, cfg, ctx, nextPath);

        return newFolder;
    }

    if (sourceType === "section") {
        const oldSection = await Section.findById(sourceId);
        if (!oldSection) { console.warn(`⚠️ Section ${sourceId} not found`); return null; }

        const root = { listing: oldSection.listing, section: oldSection._id, parentType: "section", parentId: null };
        const rootFolders = await Folder.find(root).select("_id");
        const rootFiles = await File.find(root).select("_id");
        const rootTests = await Test.find(root).select("_id");

        const lastSec = await Section.findOne({ listing: destListingId }).sort({ order: -1 }).select("order").lean();
        const newSection = await Section.create({
            title: oldSection.title,
            icon: oldSection.icon,
            unit: oldSection.unit,
            showInStatsFilter: oldSection.showInStatsFilter,
            order: lastSec && Number.isFinite(lastSec.order) ? lastSec.order + 1 : 0,
            listing: destListingId
        });
        tick(ctx.onProgress);

        const nextPath = `${pathLabel ? pathLabel + " > " : ""}${oldSection.title}`;

        for (const f of rootFolders) await randomCopyNode("folder", f._id, destListingId, newSection._id, "section", null, cfg, ctx, nextPath);
        for (const f of rootFiles) await randomCopyNode("file", f._id, destListingId, newSection._id, "section", null, cfg, ctx, nextPath);
        for (const t of rootTests) await randomCopyNode("test", t._id, destListingId, newSection._id, "section", null, cfg, ctx, nextPath);

        return newSection;
    }

    return null;
}