// run: node scripts/verifyCopyAll.js
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import crypto from "crypto";

import Section from "../models/Section.js";
import Folder from "../models/Folder.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import { copyNode } from "../utils/copyHelpers.js";
import { randomCopyNode } from "../utils/randomCopy.js";
import { cascadeDeleteSection } from "../utils/deleteHelpers.js";
import { pasteItem, getRandomSubjects, searchSeries } from "../controllers/copyPasteController.js";

let pass = 0, fail = 0;
const head = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 66 - t.length))}`);
const check = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✅" : "❌"} ${l} ${c ? "" : x}`); };
const col = (n) => mongoose.connection.db.collection(n);
const uniq = () => crypto.randomBytes(16).toString("hex");
const SUBJ = "__CP_SUBJ__";
const NAMES = ["questions", "tests", "testquestions", "files", "folders", "sections", "listings"];
const snap = async () => { const o = {}; for (const n of NAMES) o[n] = await col(n).countDocuments(); return o; };
const fakeRes = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const only = (arr, v) => arr.length === 1 && arr[0] === v;

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected:", mongoose.connection.name);

    const sampleListing = await col("listings").findOne({});
    const sampleQ = await col("questions").findOne({});
    if (!sampleListing || !sampleQ) throw new Error("DB me kam se kam 1 listing aur 1 question chahiye (sample ke liye).");

    const before = await snap();
    const tmpListings = [];
    const sections = [];

    const mkListing = async (extra) => {
        const { _id, ...rest } = sampleListing;
        const r = await col("listings").insertOne({ ...rest, title: "__RSTEST__ " + uniq().slice(0, 6), slug: "rs-" + uniq().slice(0, 10), ...extra });
        tmpListings.push(r.insertedId);
        return r.insertedId;
    };
    const mkQ = async () => {
        const { _id, ...rest } = sampleQ;
        const r = await col("questions").insertOne({ ...rest, difficulty: "Easy", status: "Active", contentHash: uniq(), __rs: true });
        return r.insertedId;
    };
    const mkSection = async (listing, title = "__RSTEST__ Sec") => {
        const s = await Section.create({ title, icon: "fa-solid fa-book", unit: "Tests", listing });
        sections.push(s._id);
        return s;
    };
    const testsOf = async (secId) => { const m = {}; (await Test.find({ section: secId }).lean()).forEach((t) => { m[t.title] = t; }); return m; };
    const marksInfo = async (t) => {
        const maps = await TestQuestion.find({ test: t._id }).lean();
        return { n: maps.length, pos: [...new Set(maps.map((m) => m.positiveMarks))], neg: [...new Set(maps.map((m) => m.negativeMarks))], qual: [...new Set(maps.map((m) => !!m.qualifyingOnly))], subj: [...new Set(maps.map((m) => m.subject))] };
    };

    try {
        /* ---------- 0) Setup ---------- */
        head("0) Setup: L1 (single, marks 2/0.5) aur L2 (multi: Tier1 1/0.25, Tier2 3/1 qualifying)");
        const L1 = await mkListing({ examStructure: "single", tiers: [], marks: [{ subject: SUBJ, positiveMarks: 2, negativeMarks: 0.5, qualifyingOnly: false }] });
        const t1marks = [{ subject: SUBJ, positiveMarks: 1, negativeMarks: 0.25, qualifyingOnly: false }];
        const L2 = await mkListing({
            examStructure: "multi", marks: t1marks,
            tiers: [
                { key: "t1", name: "Tier 1", order: 1, marks: t1marks },
                { key: "t2", name: "Tier 2", order: 2, marks: [{ subject: SUBJ, positiveMarks: 3, negativeMarks: 1, qualifyingOnly: true }] }
            ]
        });

        const src = await mkSection(L1, "__RSTEST__ Src");
        const Math_ = await Folder.create({ title: "Math", slug: "rs-" + uniq().slice(0, 6), listing: L1, section: src._id, parentType: "section", parentId: null });
        const X = await File.create({ title: "Sets", slug: "rs-" + uniq().slice(0, 6), listing: L1, section: src._id, parentType: "folder", parentId: Math_._id, fileUrl: "https://example.com/d.pdf", fileType: "pdf", size: 1 });

        const q = []; for (let i = 0; i < 6; i++) q.push(await mkQ());
        const mkTest = async (title, parentType, parentId, qIds, tier, lowerFirst = false) => {
            const t = await Test.create({
                title, listing: L1, section: src._id, parentType, parentId, tier,
                totalQuestions: qIds.length, totalMarks: qIds.length * 2, duration: 30,
                languageMode: "single", languages: ["English"], showLanguage: "all", visibility: "public"
            });
            let o = 1;
            for (const id of qIds) {
                await TestQuestion.create({ test: t._id, question: id, order: o, subject: (lowerFirst && o === 1) ? SUBJ.toLowerCase() : SUBJ, topic: "t", subTopic: "s", positiveMarks: 2, negativeMarks: 0.5 });
                o++;
            }
            return t;
        };
        const Tt2 = await mkTest("Tt2", "file", X._id, q.slice(0, 3), "t2", true);   // pehla mapping lowercase subject
        await mkTest("Tbad", "file", X._id, q.slice(3, 6), "zzz");                    // destination me na wala tier
        const Tnone = await mkTest("Tnone", "file", X._id, q.slice(0, 6), undefined);
        await mkTest("DirectT", "folder", Math_._id, q.slice(0, 1), undefined);

        /* ---------- A) section -> multi-tier L2 ---------- */
        head("A) Section copy -> multi-tier series (tier + marks + qualifying + order)");
        const A1 = await copyNode("section", src._id, L2, null, "section", null);
        sections.push(A1._id);
        check("section bana, naam same", A1.title === "__RSTEST__ Src");
        check("section order = 0 (L2 me pehla section)", A1.order === 0, `(order=${A1.order})`);
        check("Math folder, Sets file, 4 tests copy hue",
            (await Folder.countDocuments({ section: A1._id })) === 1 && (await File.countDocuments({ section: A1._id })) === 1 && (await Test.countDocuments({ section: A1._id })) === 4);
        const tA = await testsOf(A1._id);
        let mi = await marksInfo(tA.Tt2);
        check("Tt2: tier t2 rahi", tA.Tt2.tier === "t2", `(${tA.Tt2.tier})`);
        check("Tt2: marks +3 / -1, qualifyingOnly true (lowercase subject wala bhi)", only(mi.pos, 3) && only(mi.neg, 1) && only(mi.qual, true), JSON.stringify(mi));
        check("Tt2: totalMarks = 9", tA.Tt2.totalMarks === 9, `(${tA.Tt2.totalMarks})`);
        mi = await marksInfo(tA.Tbad);
        check("Tbad: tier destination ke pehle tier (t1) par aayi", tA.Tbad.tier === "t1", `(${tA.Tbad.tier})`);
        check("Tbad: marks +1 / -0.25, qualifying false", only(mi.pos, 1) && only(mi.neg, 0.25) && only(mi.qual, false), JSON.stringify(mi));
        check("Tnone: tier t1, totalMarks 6", tA.Tnone.tier === "t1" && tA.Tnone.totalMarks === 6, `(${tA.Tnone.tier}, ${tA.Tnone.totalMarks})`);
        check("DirectT: tier t1", tA.DirectT.tier === "t1");

        const A2 = await copyNode("section", src._id, L2, null, "section", null);
        sections.push(A2._id);
        check("doosri copy ka section order = 1", A2.order === 1, `(order=${A2.order})`);

        /* ---------- B) section -> single L1 ---------- */
        head("B) Section copy -> single-structure series");
        const B1 = await copyNode("section", src._id, L1, null, "section", null);
        sections.push(B1._id);
        const tB = await testsOf(B1._id);
        mi = await marksInfo(tB.Tt2);
        check("Tt2: tier null (single series), marks +2 / -0.5", tB.Tt2.tier == null && only(mi.pos, 2) && only(mi.neg, 0.5) && only(mi.qual, false), `(${tB.Tt2.tier} ${JSON.stringify(mi)})`);
        check("Tt2: totalMarks = 6", tB.Tt2.totalMarks === 6, `(${tB.Tt2.totalMarks})`);

        /* ---------- C) without tests ---------- */
        head("C) Without tests copy");
        const C1 = await copyNode("section", src._id, L1, null, "section", null, null, "", [], false);
        sections.push(C1._id);
        check("folder aur file bane", (await Folder.countDocuments({ section: C1._id })) === 1 && (await File.countDocuments({ section: C1._id })) === 1);
        check("ek bhi test nahi bana", (await Test.countDocuments({ section: C1._id })) === 0);
        check("akela test + without tests => null", (await copyNode("test", Tnone._id, L1, src._id, "file", X._id, null, "", [], false)) === null);

        /* ---------- G) source untouched ---------- */
        head("G) Source untouched (A-C ke baad)");
        check("Sets ke 3 tests", (await Test.countDocuments({ parentType: "file", parentId: X._id })) === 3);
        check("source section me 1 folder, 1 file, 4 tests",
            (await Folder.countDocuments({ section: src._id })) === 1 && (await File.countDocuments({ section: src._id })) === 1 && (await Test.countDocuments({ section: src._id })) === 4);
        check("naya Question ek bhi nahi bana", (await col("questions").countDocuments()) === before.questions + 6);

        /* ---------- D) test ko file me paste ---------- */
        head("D) Test ko file ke andar paste");
        const D1 = await copyNode("test", Tnone._id, L1, src._id, "file", X._id);
        check("test copy hua, parent file", !!D1 && String(D1.parentId) === String(X._id) && D1.parentType === "file");
        check("file me ab 4 tests", (await Test.countDocuments({ parentType: "file", parentId: X._id })) === 4);

        /* ---------- E) folder ko apne andar paste ---------- */
        head("E) Folder ko usi folder ke andar paste (loop nahi banna chahiye)");
        const E1 = await copyNode("folder", Math_._id, L1, src._id, "folder", Math_._id);
        check("copy bani", !!E1 && String(E1.parentId) === String(Math_._id));
        check("original folder me ek hi child folder", (await Folder.countDocuments({ parentType: "folder", parentId: Math_._id })) === 1);
        check("copy ke andar koi folder nahi (infinite nahi)", (await Folder.countDocuments({ parentType: "folder", parentId: E1._id })) === 0);
        check("copy ke andar file + direct test aaye", (await File.countDocuments({ parentType: "folder", parentId: E1._id })) === 1 && (await Test.countDocuments({ parentType: "folder", parentId: E1._id })) === 1);

        /* ---------- F) random + tier ---------- */
        head("F) Random copy me tier + marks");
        const secD = await mkSection(L2, "__RSTEST__ RndL2");
        const cfg = (tier) => ({ questionsPerTest: 3, numTests: 2, subject: SUBJ, testName: "R", difficulty: { mode: "none" }, tier });
        const ctx1 = { notes: [] };
        const nf1 = await randomCopyNode("file", X._id, L2, secD._id, "section", null, cfg("t2"), ctx1);
        const rt1 = await Test.find({ parentType: "file", parentId: nf1._id }).lean();
        check("L2 me 2 tests bane", rt1.length === 2, `(${rt1.length}) notes=${JSON.stringify(ctx1.notes)}`);
        for (const t of rt1) {
            const m = await marksInfo(t);
            check(`${t.title}: tier t2, +3/-1, qualifying, subject sahi, totalMarks 9`,
                t.tier === "t2" && only(m.pos, 3) && only(m.neg, 1) && only(m.qual, true) && only(m.subj, SUBJ) && t.totalMarks === 9, JSON.stringify({ tier: t.tier, m, tm: t.totalMarks }));
        }
        const secE = await mkSection(L1, "__RSTEST__ RndL1");
        const nf2 = await randomCopyNode("file", X._id, L1, secE._id, "section", null, cfg(null), { notes: [] });
        const rt2 = await Test.find({ parentType: "file", parentId: nf2._id }).lean();
        check("L1 me 2 tests bane", rt2.length === 2, `(${rt2.length})`);
        for (const t of rt2) {
            const m = await marksInfo(t);
            check(`${t.title}: tier null, +2/-0.5, totalMarks 6`, t.tier == null && only(m.pos, 2) && only(m.neg, 0.5) && t.totalMarks === 6, JSON.stringify({ tier: t.tier, m, tm: t.totalMarks }));
        }

        /* ---------- H) controller: pasteItem validation ---------- */
        head("H) pasteItem validation (controller)");
        const callPaste = async (body) => { const r = fakeRes(); await pasteItem({ body }, r); return r; };
        let r = await callPaste({ sourceType: "bogus", sourceId: String(Tnone._id), destListingId: String(L1) });
        check("galat sourceType -> 400", r.statusCode === 400);
        r = await callPaste({ sourceType: "test", sourceId: "abc", destListingId: String(L1), destSectionId: String(src._id) });
        check("galat ObjectId -> 400 (500 nahi)", r.statusCode === 400, `(${r.statusCode})`);
        r = await callPaste({ sourceType: "test", sourceId: String(Tnone._id), destListingId: String(L1) });
        check("destSectionId nahi -> 400", r.statusCode === 400);
        r = await callPaste({ sourceType: "test", sourceId: String(Tnone._id), destListingId: String(L1), destSectionId: String(secD._id) });
        check("section dusri series ka -> 400", r.statusCode === 400);
        r = await callPaste({ sourceType: "folder", sourceId: String(Math_._id), destListingId: String(L1), destSectionId: String(src._id), destParentType: "file", destParentId: String(X._id) });
        check("folder ko file ke andar paste -> 400", r.statusCode === 400);
        r = await callPaste({ sourceType: "test", sourceId: String(Tnone._id), destListingId: String(L1), destSectionId: String(src._id), destParentType: "section", destParentId: null });
        check("sahi paste -> success", r.statusCode === 200 && r.body && r.body.success === true, JSON.stringify(r.body));

        /* ---------- I) controller: getRandomSubjects + searchSeries ---------- */
        head("I) getRandomSubjects aur searchSeries (controller)");
        const callSubj = async (destListingIds) => { const rs = fakeRes(); await getRandomSubjects({ body: { items: [{ type: "file", id: String(X._id) }], destListingIds } }, rs); return rs; };
        r = await callSubj([String(L2)]);
        check("multi-tier: 2 tiers (t1, t2)", r.statusCode === 200 && r.body.tiers && r.body.tiers.map((t) => t.key).join() === "t1,t2", JSON.stringify(r.body));
        check("har tier me sirf destination ka subject, 6 questions",
            r.body.tiers.every((t) => t.subjects.length === 1 && t.subjects[0].name === SUBJ && t.subjects[0].available === 6));
        r = await callSubj([String(L1)]);
        check("single series: tiers khaali, subject 1", r.statusCode === 200 && r.body.tiers.length === 0 && r.body.subjects.length === 1 && r.body.subjects[0].name === SUBJ, JSON.stringify(r.body));
        r = await callSubj([String(L1), String(L2)]);
        check("single + multi saath -> 400", r.statusCode === 400, `(${r.statusCode})`);
        r = await callSubj([]);
        check("destination chuna nahi: shuruaati check pass", r.statusCode === 200 && r.body.subjects.length === 1);

        let threw = false, sr = fakeRes();
        try { await searchSeries({ query: { keyword: "(" } }, sr); } catch (e) { threw = true; }
        check('keyword "(" par crash nahi', !threw && Array.isArray(sr.body));
    } catch (e) {
        fail++; console.error("\n❌ SCRIPT ERROR:", e);
    } finally {
        head("CLEANUP");
        for (const id of sections) { try { await cascadeDeleteSection(id); } catch { } }
        const left = await Section.find({ title: /__RSTEST__/ }).select("_id");
        for (const s of left) { try { await cascadeDeleteSection(s._id); } catch { } }
        for (const id of tmpListings) { await col("listings").deleteOne({ _id: id }); }
        await col("questions").deleteMany({ __rs: true });
        const after = await snap();
        let leaked = false;
        for (const n of NAMES) {
            if (after[n] > before[n]) { leaked = true; console.log(`  ❌ ${n}: ${before[n]} -> ${after[n]} (script ka data bacha)`); }
            else if (after[n] < before[n]) console.log(`  ℹ️ ${n}: ${before[n]} -> ${after[n]} (kam hua: app ka cron/UI delete ho sakta hai)`);
        }
        check("script ka koi data leftover nahi", !leaked);
    }
    console.log(`\n  ✅ ${pass}   ❌ ${fail}`);
    console.log(fail === 0 ? "  🎉 Copy/paste sab sahi" : "  ⚠️ Upar ❌ wali lines dekho");
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });