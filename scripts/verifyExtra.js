// run: node scripts/verifyExtra.js
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
import { randomCopyNode } from "../utils/randomCopy.js";
import { cascadeDeleteSection } from "../utils/deleteHelpers.js";
import { bulkCopyItems } from "../controllers/copyPasteController.js";

let pass = 0, fail = 0;
const head = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 66 - t.length))}`);
const check = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✅" : "❌"} ${l} ${c ? "" : x}`); };
const col = (n) => mongoose.connection.db.collection(n);
const uniq = () => crypto.randomBytes(16).toString("hex");
const SUBJ = "__EX_SUBJ__";
const NAMES = ["questions", "tests", "testquestions", "files", "folders", "sections", "listings"];
const snap = async () => { const o = {}; for (const n of NAMES) o[n] = await col(n).countDocuments(); return o; };
const fakeRes = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const callBulk = async (body) => { const r = fakeRes(); await bulkCopyItems({ body }, r); return r; };

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected:", mongoose.connection.name);

    const sampleListing = await col("listings").findOne({});
    const sampleQ = await col("questions").findOne({});
    if (!sampleListing || !sampleQ) throw new Error("DB me kam se kam 1 listing aur 1 question chahiye (sample ke liye).");

    const before = await snap();
    const tmpListings = [];

    const mkListing = async () => {
        const { _id, ...rest } = sampleListing;
        const r = await col("listings").insertOne({
            ...rest, title: "__RSTEST__ " + uniq().slice(0, 6), slug: "rs-" + uniq().slice(0, 10),
            examStructure: "single", tiers: [],
            marks: [{ subject: SUBJ, positiveMarks: 2, negativeMarks: 0.5, qualifyingOnly: false }]
        });
        tmpListings.push(r.insertedId);
        return r.insertedId;
    };
    const mkQ = async () => {
        const { _id, ...rest } = sampleQ;
        const r = await col("questions").insertOne({ ...rest, difficulty: "Easy", status: "Active", contentHash: uniq(), __rs: true });
        return r.insertedId;
    };
    const mkSection = (listing, title) => Section.create({ title, icon: "fa-solid fa-book", unit: "Tests", listing });

    try {
        head("0) Setup: 2 series, source section (folder Math, file FX 3 tests, file FY 3 tests alag language)");
        const L1 = await mkListing();
        const L2 = await mkListing();
        const src = await mkSection(L1, "__RSTEST__ Src");
        const secL2 = await mkSection(L2, "__RSTEST__ DstL2");
        const Math_ = await Folder.create({ title: "Math", slug: "rs-" + uniq().slice(0, 6), listing: L1, section: src._id, parentType: "section", parentId: null });
        const mkFile = (title) => File.create({ title, slug: "rs-" + uniq().slice(0, 6), listing: L1, section: src._id, parentType: "folder", parentId: Math_._id, fileUrl: "https://example.com/d.pdf", fileType: "pdf", size: 1 });
        const FX = await mkFile("FX");
        const FY = await mkFile("FY");

        const q = []; for (let i = 0; i < 13; i++) q.push(await mkQ());
        const mkTest = async (title, fileId, qIds, multi = false) => {
            const t = await Test.create({
                title, listing: L1, section: src._id, parentType: "file", parentId: fileId,
                totalQuestions: qIds.length, totalMarks: qIds.length * 2, duration: 30,
                languageMode: multi ? "multiple" : "single", languages: multi ? ["English", "Hindi"] : ["English"],
                showLanguage: "all", visibility: "public"
            });
            let o = 1;
            for (const id of qIds) await TestQuestion.create({ test: t._id, question: id, order: o++, subject: SUBJ, topic: "t", subTopic: "s", positiveMarks: 2, negativeMarks: 0.5 });
            return t;
        };
        await mkTest("Xa", FX._id, q.slice(0, 3));
        await mkTest("Xb", FX._id, q.slice(3, 6));
        await mkTest("Xc", FX._id, q.slice(6, 9));
        await mkTest("Ya", FY._id, q.slice(0, 5));
        await mkTest("Yb", FY._id, q.slice(5, 10));
        await mkTest("Yc", FY._id, q.slice(10, 13), true);   // alag language setup (multi)

        /* ---------- LG) alag language group ---------- */
        head("LG) File me alag language setup: sabse bada group, baaki skip + note");
        const ctx = { notes: [] };
        const cfg = { questionsPerTest: 3, numTests: 1, subject: SUBJ, testName: "LG", difficulty: { mode: "none" }, tier: null };
        const nf = await randomCopyNode("file", FY._id, L2, secL2._id, "section", null, cfg, ctx);
        const lgTests = await Test.find({ parentType: "file", parentId: nf._id }).lean();
        check("1 test bana", lgTests.length === 1, `(${lgTests.length}) notes=${JSON.stringify(ctx.notes)}`);
        check("naya test English-only group se (single)", lgTests[0] && lgTests[0].languageMode === "single" && lgTests[0].languages.join() === "English", JSON.stringify(lgTests[0] && lgTests[0].languages));
        check("skip hue test ka note aaya", ctx.notes.some((n) => n.includes("alag thi")), JSON.stringify(ctx.notes));

        /* ---------- B1) section -> 2 series ---------- */
        head("B1) Bulk: ek section ko 2 series me ek saath copy");
        let r = await callBulk({ items: [{ type: "section", id: String(src._id) }], destListingIds: [String(L1), String(L2)], includeTests: true });
        check("copied=2, failed=0", r.statusCode === 200 && r.body.copied === 2 && r.body.failed === 0, JSON.stringify(r.body));
        check("L1 me ab 2 section (source + copy)", (await Section.countDocuments({ listing: L1, title: "__RSTEST__ Src" })) === 2);
        check("L2 me 1 section copy", (await Section.countDocuments({ listing: L2, title: "__RSTEST__ Src" })) === 1);

        /* ---------- B2) mixed folder + file ---------- */
        head("B2) Bulk: folder + file ek saath ek section me");
        r = await callBulk({
            items: [{ type: "folder", id: String(Math_._id) }, { type: "file", id: String(FX._id) }],
            destListingIds: [String(L2)], destSectionId: String(secL2._id), destParentType: "section", destParentId: null, includeTests: true
        });
        check("copied=2, failed=0", r.statusCode === 200 && r.body.copied === 2 && r.body.failed === 0, JSON.stringify(r.body));
        check("secL2 me folder Math 1", (await Folder.countDocuments({ section: secL2._id, parentType: "section", parentId: null, title: "Math" })) === 1);
        check("secL2 me file FX 1", (await File.countDocuments({ section: secL2._id, parentType: "section", parentId: null, title: "FX" })) === 1);

        /* ---------- B3-B4) validation ---------- */
        head("B3) Bulk validation (400)");
        r = await callBulk({ items: [{ type: "test", id: String(new mongoose.Types.ObjectId()) }], destListingIds: [String(L2)], destSectionId: String(secL2._id), includeTests: false });
        check("sirf test + without tests -> 400", r.statusCode === 400, `(${r.statusCode})`);
        r = await callBulk({ items: [{ type: "folder", id: String(Math_._id) }], destListingIds: [String(L2)], destSectionId: String(secL2._id), destParentType: "file", destParentId: String(FX._id), includeTests: true });
        check("folder ko file ke andar -> 400", r.statusCode === 400, `(${r.statusCode})`);
        r = await callBulk({ items: [{ type: "folder", id: String(Math_._id) }], destListingIds: [String(L2)], includeTests: true });
        check("destSectionId nahi -> 400", r.statusCode === 400, `(${r.statusCode})`);
        r = await callBulk({ items: [], destListingIds: [String(L2)] });
        check("items khaali -> 400", r.statusCode === 400);
        r = await callBulk({ items: [{ type: "file", id: String(FX._id) }], destListingIds: [String(L2)], destSectionId: String(secL2._id), includeTests: true, randomConfig: { questionsPerTest: 3, numTests: 0, subject: SUBJ } });
        check("random config galat (numTests 0) -> 400", r.statusCode === 400, `(${r.statusCode})`);

        /* ---------- B5) random via bulk ---------- */
        head("B5) Bulk + random");
        r = await callBulk({
            items: [{ type: "file", id: String(FX._id) }], destListingIds: [String(L2)],
            destSectionId: String(secL2._id), destParentType: "section", destParentId: null, includeTests: true,
            randomConfig: { questionsPerTest: 3, numTests: 2, subject: SUBJ, testName: "BR", difficulty: { mode: "none" }, tier: null }
        });
        check("copied=1, failed=0, notes khaali", r.statusCode === 200 && r.body.copied === 1 && r.body.failed === 0 && r.body.notes.length === 0, JSON.stringify(r.body));
        const files = await File.find({ section: secL2._id, parentType: "section", parentId: null, title: "FX" }).sort({ createdAt: -1 }).limit(1).lean();
        const rt = files[0] ? await Test.find({ parentType: "file", parentId: files[0]._id }).lean() : [];
        check("naye FX me 2 random tests (9 questions, 3-3)", rt.length === 2 && rt.every((t) => t.totalQuestions === 3 && t.totalMarks === 6), JSON.stringify(rt.map((t) => [t.title, t.totalQuestions, t.totalMarks])));

        /* ---------- B7) missing source ---------- */
        head("B7) Source nahi mila: failed ginna");
        r = await callBulk({ items: [{ type: "test", id: String(new mongoose.Types.ObjectId()) }], destListingIds: [String(L2)], destSectionId: String(secL2._id), destParentType: "section", destParentId: null, includeTests: true });
        check("copied=0, failed=1", r.statusCode === 200 && r.body.copied === 0 && r.body.failed === 1, JSON.stringify(r.body));

        head("G) Source untouched");
        check("FX ke 3 tests", (await Test.countDocuments({ parentType: "file", parentId: FX._id })) === 3);
        check("FY ke 3 tests", (await Test.countDocuments({ parentType: "file", parentId: FY._id })) === 3);
    } catch (e) {
        fail++; console.error("\n❌ SCRIPT ERROR:", e);
    } finally {
        head("CLEANUP");
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
    console.log(fail === 0 ? "  🎉 Extra checks sab sahi" : "  ⚠️ Upar ❌ wali lines dekho");
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });