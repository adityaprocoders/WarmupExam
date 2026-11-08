// run: node scripts/verifyRandomReal.js [fileId] [--tests=3] [--qpt=5] [--subject=Math] [--diff=Easy,Medium] [--keep]
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

import Section from "../models/Section.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Question from "../models/Question.js";
import { randomCopyNode } from "../utils/randomCopy.js";
import { cascadeDeleteSection } from "../utils/deleteHelpers.js";

/* ---------- args ---------- */
const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split("=").slice(1).join("=") : d; };
const fileIdArg = args.find((a) => !a.startsWith("--"));
const KEEP = args.includes("--keep");
const K = parseInt(flag("tests", "3"), 10);
const QPT = parseInt(flag("qpt", "5"), 10);
const SUBJECT_ARG = flag("subject", "");
const DIFF_ARG = flag("diff", "");
const NAME = flag("name", "");

/* ---------- helpers ---------- */
let pass = 0, fail = 0;
const head = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 66 - t.length))}`);
const check = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✅" : "❌"} ${l} ${c ? "" : x}`); };
const norm = (s) => String(s ?? "").trim().toLowerCase();
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const col = (n) => mongoose.connection.db.collection(n);
const NAMES = ["questions", "tests", "testquestions", "files", "folders", "sections"];
const snap = async () => { const o = {}; for (const n of NAMES) o[n] = await col(n).countDocuments(); return o; };

async function loadQuestions(ids) {
    const m = new Map();
    for (const part of chunks(ids, 5000)) {
        const qs = await Question.find({ _id: { $in: part } }).select("difficulty status subject").lean();
        qs.forEach((q) => m.set(String(q._id), q));
    }
    return m;
}

function pickCommonGroup(srcTests) {
    const groups = new Map();
    for (const t of srcTests) {
        const key = `${t.languageMode}|${(t.languages || []).map(norm).sort().join(",")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }
    let best = [];
    for (const g of groups.values()) if (g.length > best.length) best = g;
    return best;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected:", mongoose.connection.name);

    /* ===== 1) DB abhi ===== */
    head("1) DB abhi (random se PEHLE)");
    const before = await snap();
    for (const n of NAMES) console.log(`  ${n.padEnd(15)} ${before[n]}`);
    const byDiff = await col("questions").aggregate([{ $group: { _id: "$difficulty", n: { $sum: 1 } } }]).toArray();
    console.log("  questions difficulty:", byDiff.map((d) => `${d._id || "(none)"}=${d.n}`).join(", "));
    const byParent = await col("tests").aggregate([{ $group: { _id: "$parentType", n: { $sum: 1 } } }]).toArray();
    console.log("  tests parentType    :", byParent.map((d) => `${d._id}=${d.n}`).join(", "));

    /* ===== 2) File chuno ===== */
    head("2) Source file");
    let fileId = fileIdArg;
    if (!fileId) {
        const top = await col("tests").aggregate([
            { $match: { parentType: "file" } },
            { $group: { _id: "$parentId", n: { $sum: 1 } } },
            { $sort: { n: -1 } }, { $limit: 5 }
        ]).toArray();
        if (top.length === 0) throw new Error("DB me kisi file ke andar koi test nahi hai. Random ka test nahi ho sakta.");
        console.log("  Top files (tests ke hisaab se):");
        for (const t of top) {
            const f = await File.findById(t._id).select("title");
            console.log(`   - ${f ? f.title : "(missing)"}  id=${t._id}  tests=${t.n}`);
        }
        fileId = String(top[0]._id);
    }
    const srcFile = await File.findById(fileId);
    if (!srcFile) throw new Error("File nahi mili: " + fileId);
    console.log(`  Use ho rahi: "${srcFile.title}" (${fileId})`);

    const srcTests = await Test.find({ parentType: "file", parentId: fileId }).lean();
    console.log(`  File ke tests: ${srcTests.length}`);
    for (const t of srcTests) {
        const mc = await TestQuestion.countDocuments({ test: t._id });
        console.log(`   • ${t.title} | ${t.languageMode} ${JSON.stringify(t.languages)} | tier=${t.tier} | questions=${mc}`);
    }
    const origTestCount = srcTests.length;
    const origMapCount = await TestQuestion.countDocuments({ test: { $in: srcTests.map((t) => t._id) } });

    /* ===== 3) Pool (jaisa randomCopy banata hai) ===== */
    head("3) Question pool (is file ke tests se)");
    const group = pickCommonGroup(srcTests);
    const mappings = await TestQuestion.find({ test: { $in: group.map((t) => t._id) } }).select("question subject").lean();
    const byQ = new Map();
    for (const m of mappings) { const k = String(m.question); if (!byQ.has(k)) byQ.set(k, m); }
    const qMap = await loadQuestions([...byQ.keys()]);
    const pool = [];
    for (const [qid, m] of byQ) {
        const q = qMap.get(qid);
        if (!q || q.status === "Disabled") continue;
        pool.push({ id: qid, subject: String(m.subject || q.subject || "").trim(), difficulty: q.difficulty || "Medium" });
    }
    console.log(`  Total mappings: ${mappings.length} | unique questions (pool): ${pool.length}`);
    const stats = new Map();
    for (const p of pool) {
        const k = p.subject || "(blank)";
        if (!stats.has(k)) stats.set(k, { Easy: 0, Medium: 0, Hard: 0, total: 0 });
        const s = stats.get(k); s[p.difficulty] = (s[p.difficulty] || 0) + 1; s.total++;
    }
    for (const [k, s] of stats) console.log(`   subject "${k}": total ${s.total} (Easy ${s.Easy}, Medium ${s.Medium}, Hard ${s.Hard})`);

    let subject = SUBJECT_ARG;
    if (!subject) {
        const best = [...stats.entries()].filter(([k]) => k !== "(blank)").sort((a, b) => b[1].total - a[1].total)[0];
        if (!best) throw new Error("Pool me koi subject wala question nahi (mapping subject khaali hai).");
        subject = best[0];
    }
    const diffs = DIFF_ARG ? DIFF_ARG.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const diffSet = new Set(diffs);
    const matching = pool;   // naya logic: file ke saare unique questions, source subject se filter nahi
    const P = matching.length;
    const expTests = Math.min(K, Math.floor(P / QPT));
const expSizes = Array.from({ length: expTests }, () => QPT);
    console.log(`\n  RANDOM SETTINGS: ${K} tests x ${QPT} questions | subject "${subject}" | difficulty ${diffs.length ? diffs.join("+") : "sab"}`);
    console.log(`  Matching questions: ${P}  =>  expected tests: ${expTests}, sizes: [${expSizes.join(", ")}]`);

    /* ===== 4) Random copy chalao ===== */
    head("4) RANDOM COPY chal rahi hai");
    const tmpSection = await Section.create({ title: "__RNDREAL__ temp", icon: "fa-solid fa-book", unit: "Tests", listing: srcFile.listing });
    let newFile = null;
    let ticks = 0;
    const ctx = { notes: [], onProgress: (n = 1) => { ticks += n; } };
    const cfg = { questionsPerTest: QPT, numTests: K, subject, testName: NAME, difficulty: diffs.length ? { mode: "select", levels: diffs } : { mode: "none" } };
    try {
        const t0 = Date.now();
        newFile = await randomCopyNode("file", fileId, srcFile.listing, tmpSection._id, "section", null, cfg, ctx);
        console.log(`  Done in ${Date.now() - t0} ms | progress ticks: ${ticks}`);
        console.log("  Notes:", ctx.notes.length ? ctx.notes : "(koi nahi)");

        /* ===== 5) Kya bana ===== */
        head("5) Kya bana (operation-wise)");
        check("naya file bana", !!newFile);
        const newFileDoc = await File.findById(newFile._id).lean();
        check("naya file temp section me hai", String(newFileDoc.section) === String(tmpSection._id));
        console.log(`  📄 ${newFileDoc.title}`);

        const newTests = await Test.find({ parentType: "file", parentId: newFile._id }).sort({ createdAt: 1 }).lean();
        check(`tests bane = ${expTests}`, newTests.length === expTests, `(bane ${newTests.length})`);

        const origSets = [];
        for (const t of srcTests) origSets.push(new Set((await TestQuestion.find({ test: t._id }).select("question").lean()).map((m) => String(m.question))));

        const allUsed = new Set();
        const sizes = [];
        const poolIdSet = new Set(matching.map((p) => p.id));
        for (const t of newTests) {
            const maps = await TestQuestion.find({ test: t._id }).lean();
            const ids = maps.map((m) => String(m.question));
            sizes.push(ids.length);
            const qm = await loadQuestions(ids);
            const dcount = { Easy: 0, Medium: 0, Hard: 0 };
            ids.forEach((id) => { const d = (qm.get(id) || {}).difficulty || "Medium"; dcount[d] = (dcount[d] || 0) + 1; });
            const sumMarks = maps.reduce((s, m) => s + (m.positiveMarks || 0), 0);
            const subs = [...new Set(maps.map((m) => m.subject))];

            console.log(`\n  📝 ${t.title}`);
            console.log(`     questions=${ids.length} | difficulty: Easy ${dcount.Easy}, Medium ${dcount.Medium}, Hard ${dcount.Hard}`);
            console.log(`     subject=${JSON.stringify(subs)} | marks total=${t.totalMarks} (mapping sum=${sumMarks}) | +${maps[0]?.positiveMarks} / -${maps[0]?.negativeMarks}`);
            console.log(`     duration=${t.duration} min | tier=${t.tier} | lang=${t.languageMode} ${JSON.stringify(t.languages)} | showLanguage=${t.showLanguage} | visibility=${t.visibility}`);

            check(`${t.title}: size <= ${QPT}`, ids.length <= QPT);
            check(`${t.title}: ek test me question repeat nahi`, new Set(ids).size === ids.length);
            check(`${t.title}: sab questions pool ke matching set me se`, ids.every((id) => poolIdSet.has(id)));
            check(`${t.title}: subject sahi`, subs.length === 1 && norm(subs[0]) === norm(subject), `(${subs})`);
            check(`${t.title}: totalQuestions == mappings`, t.totalQuestions === ids.length, `(${t.totalQuestions} vs ${ids.length})`);
            check(`${t.title}: totalMarks == mappings ka sum`, t.totalMarks === sumMarks, `(${t.totalMarks} vs ${sumMarks})`);
            if (sumMarks === 0) console.log("     ⚠️ marks 0 hain: destination listing ke marks config me is subject ka entry nahi hai (copy ke baad bhi yahi hota).");
            const same = origSets.some((s) => s.size === ids.length && ids.every((id) => s.has(id)));
            console.log(`     original test jaisa same set? ${same ? "haan (allowed)" : "nahi"}`);

            ids.forEach((id) => allUsed.add(id));
        }
        const total = sizes.reduce((a, b) => a + b, 0);
        check("koi question 2 random tests me repeat nahi", allUsed.size === total, `(unique ${allUsed.size} vs total ${total})`);
        check(`sizes == expected [${expSizes.join(", ")}]`, JSON.stringify(sizes) === JSON.stringify(expSizes), `(mile [${sizes.join(", ")}])`);
        check("kam bane to note aaya", (newTests.length < K) === ctx.notes.some((n) => n.includes("maange")), `(notes=${ctx.notes.length})`);

                const baseNm = NAME || `${newFileDoc.title} - Random`;
        const gotNames = newTests.map((t) => t.title).sort();
        const wantNames = newTests.map((_, i) => `${baseNm} ${String(i + 1).padStart(2, "0")}`).sort();
        check("test names 01, 02... sequence me", JSON.stringify(gotNames) === JSON.stringify(wantNames), `(${gotNames.join(" | ")})`);

        /* ===== 6) Dedup / originals ===== */
        head("6) Dedup aur originals");
        const mid = await snap();
        check("naya Question ek bhi nahi bana (sirf link)", mid.questions === before.questions, `(${before.questions} -> ${mid.questions})`);
        const nowOrigTests = await Test.countDocuments({ parentType: "file", parentId: fileId });
        const nowOrigMaps = await TestQuestion.countDocuments({ test: { $in: srcTests.map((t) => t._id) } });
        check("original file ke tests badle nahi", nowOrigTests === origTestCount);
        check("original tests ke mappings badle nahi", nowOrigMaps === origMapCount);
    } catch (e) {
        fail++;
        console.error("\n❌ SCRIPT ERROR:", e);
    } finally {
        /* ===== 7) Cleanup ===== */
        head(KEEP ? "7) CLEANUP SKIP (--keep): temp section DB me rakha hai" : "7) CLEANUP (random copy delete)");
        if (!KEEP) {
            await cascadeDeleteSection(tmpSection._id);
            const left = await Section.find({ title: /__RNDREAL__/ }).select("_id");
            for (const s of left) { try { await cascadeDeleteSection(s._id); } catch {} }
        } else {
            console.log("  UI me dekhne ke baad us section ko manually delete kar dena: __RNDREAL__ temp");
        }
    }

    /* ===== 8) Final ===== */
    head("8) FINAL: DB pehle jaisa?");
    const after = await snap();
    if (!KEEP) {
        for (const n of NAMES) check(`${n}: ${before[n]} -> ${after[n]}`, after[n] === before[n]);
        const nowTests = await Test.countDocuments({ parentType: "file", parentId: fileId });
        check("original file ke tests abhi bhi wahi", nowTests === origTestCount);
        const stillQ = await Question.countDocuments();
        check("questions delete nahi hue (originals use kar rahe the)", stillQ === before.questions);
    } else {
        for (const n of NAMES) console.log(`  ${n.padEnd(15)} ${before[n]} -> ${after[n]}`);
    }

    console.log(`\n  ✅ ${pass}   ❌ ${fail}`);
    console.log(fail === 0 ? "  🎉 Random copy sab sahi" : "  ⚠️ Upar ❌ wali lines dekho");
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });