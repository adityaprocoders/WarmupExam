// run: node scripts/verifyRandomNew.js
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import crypto from "crypto";

import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import { randomCopyNode, normalizeRandomConfig } from "../utils/randomCopy.js";
import { cascadeDeleteSection } from "../utils/deleteHelpers.js";

let pass = 0, fail = 0;
const head = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 66 - t.length))}`);
const check = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✅" : "❌"} ${l} ${c ? "" : x}`); };
const col = (n) => mongoose.connection.db.collection(n);
const uniq = () => crypto.randomBytes(32).toString("hex");
const pad = (n) => String(n).padStart(2, "0");
const SUBJ = "__RS_SUBJ__";
const NAMES = ["questions", "tests", "testquestions", "files", "folders", "sections"];
const snap = async () => { const o = {}; for (const n of NAMES) o[n] = await col(n).countDocuments(); return o; };

const cfgOf = (numTests, qpt, difficulty = { mode: "none" }, testName = "Nimcet Set", subject = SUBJ) =>
    ({ questionsPerTest: qpt, numTests, subject, testName, difficulty });

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected:", mongoose.connection.name);
    const listing = await Listing.findOne().select("_id");
    const sample = await col("questions").findOne({});
    if (!listing || !sample) throw new Error("Listing ya question nahi mila");

    const before = await snap();
    const dstSections = [];
    let srcSection = null;

    const mkQ = async (i) => {
        const { _id, ...rest } = sample;
        const m = i % 10;
        const difficulty = m < 4 ? "Easy" : m < 7 ? "Medium" : "Hard";
        const r = await col("questions").insertOne({ ...rest, difficulty, status: "Active", contentHash: uniq(), __rs: true });
        return r.insertedId;
    };

    try {
        /* ---------- source: Math folder -> Sets (5 tests) + Relations (3 tests) ---------- */
        head("0) Source banao: Math / Sets (5 tests x 20) / Relations (3 tests x 20)");
        srcSection = await Section.create({ title: "__RSTEST__ Src", icon: "fa-solid fa-book", unit: "Tests", listing: listing._id });
        const Math_ = await Folder.create({ title: "Math", slug: "rs-" + uniq().slice(0, 6), listing: listing._id, section: srcSection._id, parentType: "section", parentId: null });
        const mkFile = (title) => File.create({ title, slug: "rs-" + uniq().slice(0, 6), listing: listing._id, section: srcSection._id, parentType: "folder", parentId: Math_._id, fileUrl: "https://example.com/d.pdf", fileType: "pdf", size: 1 });
        const Sets = await mkFile("Sets");
        const Rel = await mkFile("Relations");

        const mkTest = async (title, parentType, parentId, qIds) => {
            const t = await Test.create({
                title, listing: listing._id, section: srcSection._id, parentType, parentId,
                totalQuestions: qIds.length, totalMarks: qIds.length * 2, duration: 30,
                languageMode: "single", languages: ["English"], showLanguage: "all", visibility: "public"
            });
            let o = 1;
            for (const q of qIds) await TestQuestion.create({ test: t._id, question: q, order: o++, subject: SUBJ, topic: "t", subTopic: "s", positiveMarks: 2, negativeMarks: 0 });
            return t;
        };

        const sq = []; for (let i = 0; i < 90; i++) sq.push(await mkQ(i));      // Sets pool: 90 unique
        const rq = []; for (let i = 0; i < 50; i++) rq.push(await mkQ(i));      // Relations pool: 50 unique
        // Sets: T1..T4 alag 20-20, T5 = 10 naye + 10 purane (overlap) => unique 90
        await mkTest("S1", "file", Sets._id, sq.slice(0, 20));
        await mkTest("S2", "file", Sets._id, sq.slice(20, 40));
        await mkTest("S3", "file", Sets._id, sq.slice(40, 60));
        await mkTest("S4", "file", Sets._id, sq.slice(60, 80));
        await mkTest("S5", "file", Sets._id, [...sq.slice(80, 90), ...sq.slice(60, 70)]);
        // Relations: R3 me 10 overlap => unique 50
        await mkTest("R1", "file", Rel._id, rq.slice(0, 20));
        await mkTest("R2", "file", Rel._id, rq.slice(20, 40));
        await mkTest("R3", "file", Rel._id, [...rq.slice(40, 50), ...rq.slice(20, 30)]);
        await mkTest("DirectT", "folder", Math_._id, sq.slice(0, 5));          // folder ka direct test

        const SETS_POOL = new Set(sq.map(String));
        const REL_POOL = new Set(rq.map(String));

        /* ---------- helpers ---------- */
        const diffCount = async (ids) => {
            const qs = await col("questions").find({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } }).project({ difficulty: 1 }).toArray();
            const c = { Easy: 0, Medium: 0, Hard: 0 };
            qs.forEach((q) => c[q.difficulty]++);
            return c;
        };
        const run = async (cfg) => {
            const D = await Section.create({ title: "__RSTEST__ Dst", icon: "fa-solid fa-book", unit: "Tests", listing: listing._id });
            dstSections.push(D._id);
            const ctx = { notes: [] };
            const nf = await randomCopyNode("folder", Math_._id, listing._id, D._id, "section", null, cfg, ctx);
            return { nf, ctx };
        };
        const report = async (nf, name) => {
            const f = await File.findOne({ parentType: "folder", parentId: nf._id, title: name }).lean();
            if (!f) return null;
            const tests = await Test.find({ parentType: "file", parentId: f._id }).lean();
            tests.sort((a, b) => a.title.localeCompare(b.title));
            const rows = [];
            for (const t of tests) {
                const ids = (await TestQuestion.find({ test: t._id }).lean()).map((m) => String(m.question));
                rows.push({ t, ids, d: await diffCount(ids) });
            }
            return { f, rows };
        };
        const general = (label, rep, pool, N, base, expTests) => {
            check(`${label}: file bani (naam same)`, !!rep);
            if (!rep) return;
            check(`${label}: tests = ${expTests}`, rep.rows.length === expTests, `(${rep.rows.length})`);
            rep.rows.forEach((r, i) => {
                check(`${label} test ${i + 1}: naam "${base} ${pad(i + 1)}"`, r.t.title === `${base} ${pad(i + 1)}`, `(${r.t.title})`);
                check(`${label} test ${i + 1}: poore ${N} questions`, r.ids.length === N && r.t.totalQuestions === N, `(${r.ids.length})`);
                check(`${label} test ${i + 1}: test ke andar repeat nahi`, new Set(r.ids).size === r.ids.length);
                check(`${label} test ${i + 1}: sirf ${label} ke apne questions`, r.ids.every((id) => pool.has(id)));
            });
            const all = rep.rows.flatMap((r) => r.ids);
            check(`${label}: file ke tests ke beech koi question repeat nahi`, new Set(all).size === all.length);
        };
        const folderChecks = async (nf) => {
            const nfDoc = await Folder.findById(nf._id).lean();
            check("folder ka naam same (Math)", nfDoc.title === "Math");
            const direct = await Test.find({ parentType: "folder", parentId: nf._id }).lean();
            check("folder ka direct test same-to-same copy", direct.length === 1 && direct[0].title === "DirectT");
        };

        /* ---------- A) tumhara example: 2 tests x 20 ---------- */
        head("A) Math share: 2 tests x 20 questions, difficulty koi nahi");
        let r = await run(cfgOf(2, 20));
        await folderChecks(r.nf);
        general("Sets", await report(r.nf, "Sets"), SETS_POOL, 20, "Nimcet Set", 2);
        general("Relations", await report(r.nf, "Relations"), REL_POOL, 20, "Nimcet Set", 2);
        check("koi note nahi (2 maange 2 bane)", r.ctx.notes.length === 0, JSON.stringify(r.ctx.notes));

        /* ---------- B) bahut zyada tests maange ---------- */
        head("B) 200 tests maange: sirf poore bharne wale bante hain");
        r = await run(cfgOf(200, 20));
        general("Sets", await report(r.nf, "Sets"), SETS_POOL, 20, "Nimcet Set", 4);        // floor(90/20)
        general("Relations", await report(r.nf, "Relations"), REL_POOL, 20, "Nimcet Set", 2); // floor(50/20)
        check("kam bane to note aaya (dono file)", r.ctx.notes.filter((n) => n.includes("maange")).length === 2, JSON.stringify(r.ctx.notes));

        /* ---------- C) questions per test pool se zyada ---------- */
        head("C) 100 questions per test: pool kam, koi test nahi");
        r = await run(cfgOf(2, 100));
        const cs = await report(r.nf, "Sets"), cr = await report(r.nf, "Relations");
        check("Sets: file bani par 0 tests", !!cs && cs.rows.length === 0);
        check("Relations: file bani par 0 tests", !!cr && cr.rows.length === 0);
        check("dono ka note aaya", r.ctx.notes.length === 2, JSON.stringify(r.ctx.notes));

        /* ---------- D) difficulty select: Easy ---------- */
        head("D) Difficulty select Easy (preference, baaki random fill)");
        r = await run(cfgOf(2, 20, { mode: "select", levels: ["Easy"] }));
        let sRep = await report(r.nf, "Sets");
        general("Sets", sRep, SETS_POOL, 20, "Nimcet Set", 2);
        check("Sets test 1: sab 20 Easy", sRep.rows[0].d.Easy === 20, JSON.stringify(sRep.rows[0].d));
        check("Sets: Easy total = 36 (pool me jitne the sab)", sRep.rows[0].d.Easy + sRep.rows[1].d.Easy === 36);
        let rRep = await report(r.nf, "Relations");
        general("Relations", rRep, REL_POOL, 20, "Nimcet Set", 2);
        check("Relations: Easy total = 20 (pool me jitne the), baaki random fill", rRep.rows[0].d.Easy + rRep.rows[1].d.Easy === 20);

        /* ---------- E) difficulty percentage ---------- */
        head("E) Difficulty percentage 50 / 30 / 20");
        r = await run(cfgOf(2, 20, { mode: "percent", easy: 50, medium: 30, hard: 20 }));
        sRep = await report(r.nf, "Sets");
        general("Sets", sRep, SETS_POOL, 20, "Nimcet Set", 2);
        sRep.rows.forEach((x, i) => check(`Sets test ${i + 1}: Easy 10, Medium 6, Hard 4`, x.d.Easy === 10 && x.d.Medium === 6 && x.d.Hard === 4, JSON.stringify(x.d)));
        rRep = await report(r.nf, "Relations");
        general("Relations", rRep, REL_POOL, 20, "Nimcet Set", 2);
        rRep.rows.forEach((x, i) => check(`Relations test ${i + 1}: Easy 10, Medium 6, Hard 4`, x.d.Easy === 10 && x.d.Medium === 6 && x.d.Hard === 4, JSON.stringify(x.d)));

        /* ---------- F) validation ---------- */
        head("F) Config validation");
        const okc = (o) => normalizeRandomConfig(o);
        const base = { questionsPerTest: 20, numTests: 2, subject: SUBJ, testName: "x", difficulty: { mode: "none" } };
        check("200 tests ok", !okc({ ...base, numTests: 200 }).error);
        check("201 tests error", !!okc({ ...base, numTests: 201 }).error);
        check("501 questions error", !!okc({ ...base, questionsPerTest: 501 }).error);
        check("subject khaali error", !!okc({ ...base, subject: "" }).error);
        check("percent total 90 error", !!okc({ ...base, difficulty: { mode: "percent", easy: 40, medium: 30, hard: 20 } }).error);
        check("percent total 100 ok", !okc({ ...base, difficulty: { mode: "percent", easy: 40, medium: 30, hard: 30 } }).error);

        /* ---------- G) source untouched ---------- */
        head("G) Source tests untouched");
        check("Sets ke 5 tests", (await Test.countDocuments({ parentType: "file", parentId: Sets._id })) === 5);
        check("Relations ke 3 tests", (await Test.countDocuments({ parentType: "file", parentId: Rel._id })) === 3);
        check("naya Question ek bhi nahi bana", (await col("questions").countDocuments()) === before.questions + 140);
    } catch (e) {
        fail++; console.error("\n❌ SCRIPT ERROR:", e);
    } finally {
        head("CLEANUP");
        for (const id of dstSections) { try { await cascadeDeleteSection(id); } catch {} }
        if (srcSection) { try { await cascadeDeleteSection(srcSection._id); } catch {} }
        const left = await Section.find({ title: /__RSTEST__/ }).select("_id");
        for (const s of left) { try { await cascadeDeleteSection(s._id); } catch {} }
        await col("questions").deleteMany({ __rs: true });
        const after = await snap();
        let leaked = false;
        for (const n of NAMES) {
            if (after[n] > before[n]) { leaked = true; console.log(`  ❌ ${n}: ${before[n]} -> ${after[n]} (script ka data bacha)`); }
            else if (after[n] < before[n]) console.log(`  ℹ️ ${n}: ${before[n]} -> ${after[n]} (kam hua: script sirf apna data delete karti hai, ye app ke cron ya UI ka delete ho sakta hai)`);
        }
        const leftSec = await Section.countDocuments({ title: /__RSTEST__/ });
        const leftQ = await col("questions").countDocuments({ __rs: true });
        check("script ka koi data leftover nahi", !leaked && leftSec === 0 && leftQ === 0, `(sections=${leftSec}, questions=${leftQ})`);
    }
    console.log(`\n  ✅ ${pass}   ❌ ${fail}`);
    console.log(fail === 0 ? "  🎉 Random share sab sahi" : "  ⚠️ Upar ❌ wali lines dekho");
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });