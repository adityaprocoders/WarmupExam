// READ-ONLY: aapke terminal me questions/tests ka data table me print karta hai. Kuch change nahi karta.
// Run: node scripts/printQuestionData.js        (LIMIT=100 node scripts/... se zyada rows)
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);


import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

import Question, { computeContentHash } from "../models/Question.js";
import TestQuestion from "../models/TestQuestion.js";
import Test from "../models/Test.js";

const LIMIT = Number(process.env.LIMIT || 50);
const short = (s, n = 45) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

// wrong options ka chhota signature: option badlega to ye 6 akshar badal jayenge
const optsSig = (q) => crypto.createHash("md5").update(JSON.stringify(
    q.languageMode === "multiple"
        ? (q.translations || []).map(t => (t.options || []).map(o => o.text))
        : (q.options || []).map(o => o.text)
)).digest("hex").slice(0, 6);

const solText = (q) => short(q.languageMode === "multiple" ? q.translations?.[0]?.solution?.text : q.solution?.text, 30);
const fullText = (q) => String(q.question || q.translations?.[0]?.question || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

const qText = (q) => short(q.question || q.translations?.[0]?.question, 200);

function correctText(q) {
    if (q.type === "integer") return String(q.numericAnswer);
    if (q.languageMode === "multiple") {
        return (q.translations || [])
            .map(t => (q.correctAnswers || []).map(i => short(t?.options?.[i]?.text, 20)).join(" | "))
            .join(" / ");
    }
    return (q.correctAnswers || []).map(i => short(q.options?.[i]?.text, 20)).join(" | ");
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected DB:", mongoose.connection.name, "| host:", mongoose.connection.host, "\n");

    const usedAgg = await TestQuestion.aggregate([{ $group: { _id: "$question", tests: { $addToSet: "$test" } } }]);
    const used = new Map(usedAgg.map(a => [String(a._id), a.tests.length]));

    const qs = await Question.find({}).sort({ createdAt: -1 }).lean();
    console.log(`Total questions: ${qs.length} | TestQuestion mappings: ${await TestQuestion.countDocuments()}\n`);

    console.log(`--- Latest ${LIMIT} questions ---`);
    console.table(qs.slice(0, LIMIT).map(q => ({
        id: String(q._id).slice(-6),
        question: short(q.question || q.translations?.[0]?.question),
        correct: correctText(q),
        lang: q.languageMode,
        storedHash: q.contentHash ? q.contentHash.slice(0, 8) : "MISSING",
        freshHash: computeContentHash(q).slice(0, 8),
        match: q.contentHash === computeContentHash(q) ? "ok" : "STALE",
        usedInTests: used.get(String(q._id)) || 0,
        status: q.status
    })));

    console.log("\n--- Edit check (solution / wrong options / text ka end): edit ke baad ye badalna chahiye ---");
    console.table(qs.slice(0, LIMIT).map(q => ({
        id: String(q._id).slice(-6),
        textEnd: fullText(q).slice(-22),
        solutionStart: solText(q),
        optionsSig: optsSig(q),
        hash: (q.contentHash || "MISSING").slice(0, 8),
        usedInTests: used.get(String(q._id)) || 0
    })));

    const byHash = new Map();
    for (const q of qs) { const h = computeContentHash(q); (byHash.get(h) || byHash.set(h, []).get(h)).push(q); }
    const dupHash = [...byHash.values()].filter(a => a.length > 1);
    console.log(`\n--- Duplicate groups (same text + same correct => ek hi hona chahiye): ${dupHash.length} ---`);
    dupHash.slice(0, 20).forEach(a => console.log(a.map(q => String(q._id).slice(-6)).join(", "), "|", short(qText(a[0]))));

    const byText = new Map();
    for (const q of qs) { const k = short(q.question || q.translations?.[0]?.question, 200).toLowerCase(); if (!k) continue; (byText.get(k) || byText.set(k, []).get(k)).push(q); }
    const sameText = [...byText.values()].filter(a => new Set(a.map(q => computeContentHash(q))).size > 1);
    console.log(`\n--- Same text, alag hash (check karo ki sach me alag hain: correct option alag?): ${sameText.length} ---`);
    sameText.slice(0, 20).forEach(a => console.log(short(qText(a[0])), "=>", a.map(q => `${String(q._id).slice(-6)}[${correctText(q)}]`).join("  ")));

    const shared = [...used.entries()].filter(([, n]) => n > 1).length;
    console.log(`\n--- Shared questions (1 se zyada tests me reuse): ${shared} ---`);

        // Tier / listing: shared question kis test, tier aur listing me use ho raha hai
    const allTests = await Test.find({}).select("title listing tier").lean();
    const tById = new Map(allTests.map(t => [String(t._id), t]));
    const qById = new Map(qs.map(q => [String(q._id), q]));
    const qTests = new Map();
    for (const m of await TestQuestion.find({}).select("test question").lean()) {
        const k = String(m.question);
        if (!qTests.has(k)) qTests.set(k, []);
        qTests.get(k).push(String(m.test));
    }
    console.log("\n--- Shared questions: kis test / tier / listing me use ho rahe hain ---");
    console.table([...qTests.entries()].filter(([, a]) => a.length > 1).map(([qid, a]) => ({
        id: qid.slice(-6),
        text: short(qById.get(qid)?.question || qById.get(qid)?.translations?.[0]?.question, 28),
        tests: a.map(t => tById.get(t)?.title || "?").join(" + "),
        tiers: a.map(t => tById.get(t)?.tier ?? "-").join(" / "),
        listings: new Set(a.map(t => String(tById.get(t)?.listing).slice(-6))).size
    })));
    console.log("\n--- Tests: listing aur tier ---");
    console.table(allTests.map(t => ({ id: String(t._id).slice(-6), title: short(t.title, 30), listing: String(t.listing).slice(-6), tier: t.tier ?? "-" })));
    
    const tqAgg = await TestQuestion.aggregate([{ $group: { _id: "$test", n: { $sum: 1 } } }]);
    const tmap = new Map(tqAgg.map(a => [String(a._id), a.n]));
    const tests = await Test.find({}).select("title totalQuestions").lean();
    console.log(`\n--- Tests (${tests.length}) ---`);
    console.table(tests.slice(0, LIMIT).map(t => ({
        id: String(t._id).slice(-6), title: short(t.title, 40),
        questionsMapped: tmap.get(String(t._id)) || 0, totalQuestionsField: t.totalQuestions ?? "-"
    })));
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());