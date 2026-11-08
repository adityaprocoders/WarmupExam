// run: node scripts/diagFile.js "General Studies 1"   (file ka naam ya id)
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import File from "../models/File.js";
import Test from "../models/Test.js";
import TestQuestion from "../models/TestQuestion.js";
import Question from "../models/Question.js";

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const arg = process.argv[2];
    if (!arg) throw new Error('File ka naam ya id do: node scripts/diagFile.js "General Studies 1"');
    const files = mongoose.isValidObjectId(arg) ? [await File.findById(arg)] : await File.find({ title: new RegExp(arg, "i") });

    for (const f of files.filter(Boolean)) {
        console.log(`\n📄 ${f.title} (${f._id})`);
        const tests = await Test.find({ parentType: "file", parentId: f._id }).lean();
        if (!tests.length) { console.log("  is file me koi test nahi"); continue; }

        const bySubject = new Map();
        const seen = new Set();
        let missing = 0, disabled = 0;
        for (const t of tests) {
            const maps = await TestQuestion.find({ test: t._id }).select("question subject").lean();
            console.log(`  • ${t.title} | ${t.languageMode} ${JSON.stringify(t.languages)} | questions=${maps.length}`);
            const qs = await Question.find({ _id: { $in: maps.map((m) => m.question) } }).select("subject status").lean();
            const qm = new Map(qs.map((q) => [String(q._id), q]));
            for (const m of maps) {
                const id = String(m.question);
                if (seen.has(id)) continue;
                seen.add(id);
                const q = qm.get(id);
                if (!q) { missing++; continue; }
                if (q.status === "Disabled") disabled++;
                const key = `mapping subject="${String(m.subject || "").trim()}"  |  question subject="${String(q.subject || "").trim()}"`;
                bySubject.set(key, (bySubject.get(key) || 0) + 1);
            }
        }
        console.log(`  unique questions: ${seen.size} | Question doc missing: ${missing} | Disabled: ${disabled}`);
        for (const [k, v] of bySubject) console.log(`   ${k}  ->  ${v}`);
    }
    await mongoose.connection.close();
}
main().catch(async (e) => { console.error(e); await mongoose.connection.close(); process.exit(1); });