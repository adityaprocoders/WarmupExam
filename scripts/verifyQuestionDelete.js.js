// run: node scripts/verifyQuestionDelete.js
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

import crypto from "crypto";
const uniqHash = () => crypto.randomBytes(32).toString("hex");

import Listing from "../models/listing.js";
import Section from "../models/Section.js";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import { copyNode } from "../utils/copyHelpers.js";
import { cascadeDeleteSection, cascadeDeleteTest } from "../utils/deleteHelpers.js";

let pass = 0, fail = 0;
const head = (t) => console.log(`\n━━━ ${t} ${"━".repeat(Math.max(0, 60 - t.length))}`);
const check = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "✅" : "❌"} ${l} ${c ? "" : x}`); };

const qCol = () => mongoose.connection.db.collection("questions");
const qExists = async (ids) => qCol().countDocuments({ _id: { $in: ids } });
const mapCount = (testId) => TestQuestion.countDocuments({ test: testId });

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected:", mongoose.connection.name);

    const listing = await Listing.findOne().select("_id");
    const sample = await qCol().findOne({});
    if (!listing || !sample) throw new Error("Listing ya question nahi mila");

    const qBefore = await qCol().countDocuments();
    const cloneIds = [];
    const created = [];

    try {
        // 2 clone questions (raw insert, schema validation nahi)
        for (let i = 0; i < 2; i++) {
            const { _id, ...rest } = sample;
            const r = await qCol().insertOne({ ...rest, contentHash: uniqHash(), __cptest: true });
            cloneIds.push(r.insertedId);
        }

        const S = await Section.create({ title: "__CPTEST__ QSec", icon: "fa-solid fa-book", unit: "Tests", listing: listing._id });
        created.push(S._id);

        const T1 = await Test.create({
            title: "__CPTEST__ T1", listing: listing._id, section: S._id,
            parentType: "section", parentId: null,
            totalQuestions: 2, totalMarks: 4, duration: 10,
            languageMode: "single", languages: ["English"], showLanguage: "all"
        });
        for (let i = 0; i < 2; i++) {
            await TestQuestion.create({
                test: T1._id, question: cloneIds[i], order: i + 1,
                subject: sample.subject, topic: sample.topic, subTopic: sample.subTopic,
                positiveMarks: 2, negativeMarks: 0
            });
        }

        head("1) Test copy: question SHARE hota hai, duplicate nahi");
        const T2 = await copyNode("test", T1._id, listing._id, S._id, "section", null, null, "", [], true);
        const T3 = await copyNode("test", T1._id, listing._id, S._id, "section", null, null, "", [], true);
        check("questions count same (clone nahi bane)", (await qCol().countDocuments()) === qBefore + 2);
        check("T2 ke 2 mappings", (await mapCount(T2._id)) === 2);

        head("2) Copy delete: question rehna chahiye (T1, T3 use kar rahe)");
        await cascadeDeleteTest(T2._id);
        check("T2 ke mappings gaye", (await mapCount(T2._id)) === 0);
        check("questions abhi bhi DB me", (await qExists(cloneIds)) === 2, `(mile ${await qExists(cloneIds)})`);
        check("T1 ke mappings safe", (await mapCount(T1._id)) === 2);

        head("3) Original delete: question rehna chahiye (T3 use kar raha)");
        await cascadeDeleteTest(T1._id);
        check("questions abhi bhi DB me", (await qExists(cloneIds)) === 2, `(mile ${await qExists(cloneIds)})`);
        check("T3 ke mappings safe", (await mapCount(T3._id)) === 2);

        head("4) Last user delete: question DB se hatna chahiye");
        await cascadeDeleteTest(T3._id);
        const left = await qExists(cloneIds);
        check("koi use nahi bacha, questions permanently delete", left === 0, `(${left} bache hain)`);

        head("5) Section delete: wahi rule");
        const T4 = await copyNode("test", T3._id, listing._id, S._id, "section", null, null, "", [], true).catch(() => null);
        // T3 delete ho chuka, isliye naya test banao
        const T5 = await Test.create({
            title: "__CPTEST__ T5", listing: listing._id, section: S._id, parentType: "section", parentId: null,
            totalQuestions: 1, totalMarks: 2, duration: 10, languageMode: "single", languages: ["English"], showLanguage: "all"
        });
        const q5 = await qCol().insertOne({ ...(({ _id, ...r }) => r)(sample), contentHash: uniqHash(), __cptest: true });
        cloneIds.push(q5.insertedId);
        await TestQuestion.create({ test: T5._id, question: q5.insertedId, order: 1, subject: sample.subject, topic: sample.topic, subTopic: sample.subTopic, positiveMarks: 2, negativeMarks: 0 });

        const S2 = await copyNode("section", S._id, listing._id, null, "section", null, null, "", [], true);
        created.push(S2._id);
        await cascadeDeleteSection(S._id);
        check("original section delete: question rehta hai (copy use kar rahi)", (await qExists([q5.insertedId])) === 1);
        await cascadeDeleteSection(S2._id);
        check("copy section bhi delete: question permanently gaya", (await qExists([q5.insertedId])) === 0);
    } catch (e) {
        fail++; console.error("❌ SCRIPT ERROR:", e);
    } finally {
        head("CLEANUP");
        await qCol().deleteMany({ __cptest: true });
        for (const id of created) { try { await cascadeDeleteSection(id); } catch {} }
        const tleft = await Test.find({ title: /__CPTEST__/ }).select("_id");
        for (const t of tleft) { try { await cascadeDeleteTest(t._id); } catch {} }
        await Section.deleteMany({ title: /__CPTEST__/ });
        const qAfter = await qCol().countDocuments();
        check(`questions count wapas ${qBefore}`, qAfter === qBefore, `(abhi ${qAfter})`);
    }

    head("SUMMARY");
    console.log(`  ✅ ${pass}   ❌ ${fail}`);
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });