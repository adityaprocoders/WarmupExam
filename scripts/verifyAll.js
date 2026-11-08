// run: node scripts/verifyAll.js
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const scripts = ["verifyCopyAll.js", "verifyRandomNew.js", "verifyRandomReal.js", "verifyExtra.js"];

let totalPass = 0, totalFail = 0, crashed = 0;
const rows = [];

for (const s of scripts) {
    console.log(`\n▶ ${s} chal rahi hai...`);
    const r = spawnSync(process.execPath, [path.join("scripts", s)], { cwd: root, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
    const out = (r.stdout || "") + (r.stderr || "");
    const m = [...out.matchAll(/✅\s+(\d+)\s+❌\s+(\d+)/g)].pop();
    const bad = out.split("\n").filter((l) => l.includes("❌") && !/✅\s+\d+\s+❌\s+\d+/.test(l));

    if (!m) {
        crashed++;
        rows.push({ script: s, pass: "-", fail: "-", status: "CRASH" });
        console.log(out.split("\n").slice(-25).join("\n"));
        continue;
    }
    const p = +m[1], f = +m[2];
    totalPass += p; totalFail += f;
    rows.push({ script: s, pass: p, fail: f, status: f === 0 ? "OK" : "FAIL" });
    if (bad.length) { console.log("  Fail lines:"); bad.forEach((l) => console.log("  " + l.trim())); }
}

console.log("\n━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.table(rows);
console.log(`  Total: ✅ ${totalPass}   ❌ ${totalFail}   crash: ${crashed}`);
console.log(totalFail === 0 && crashed === 0 ? "  🎉 SAB SAHI" : "  ⚠️ Upar fail/crash wali lines dekho");
process.exit(totalFail === 0 && crashed === 0 ? 0 : 1);