(function () {
    "use strict";

    const root = document.getElementById("ct-pro-dashboard");
    if (!root) return;

    const BASE = window.location.pathname.startsWith("/dashboard") ? "/dashboard" : "";
    const $ = (id) => document.getElementById(id);
    const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch (_) {} };
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmtShort = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const fmtFull = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    let chart = null;

    async function load() {
        const range = $("ctRangeSelect")?.value || "7";
        try {
            const res = await fetch(`/api/custom-test/dashboard-stats?limit=${encodeURIComponent(range)}`, { credentials: "same-origin" });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error("failed");
            render(data);
        } catch (_) {
            $("ctRecentList").innerHTML = `<p class="py-10 text-center text-sm text-slate-400">We couldn't load your performance right now. Please refresh the page.</p>`;
        }
    }

    function render(d) {
        $("ctStatTests").textContent = d.totals.testsAttempted;
        $("ctStatScore").textContent = d.totals.avgScore + "%";
        $("ctStatAccuracy").textContent = d.totals.accuracy + "%";
        $("ctStatStrong").textContent = d.totals.strongTopics;
        renderTrend(d.trend || []);
        renderRecent(d.recent || []);
        renderSuggestions(d);
        icons();
    }

    function renderTrend(points) {
        const canvas = $("ctTrendChart");
        const empty = $("ctTrendEmpty");
        if (chart) { chart.destroy(); chart = null; }

        const has = points.length > 0 && !!window.Chart;
        canvas.parentElement.classList.toggle("hidden", !has);
        empty.classList.toggle("hidden", has);
        if (!has) return;

        chart = new Chart(canvas.getContext("2d"), {
            type: "line",
            data: {
                labels: points.map((p) => fmtShort(p.date)),
                datasets: [{
                    label: "Accuracy",
                    data: points.map((p) => p.accuracy),
                    borderColor: "#4f46e5",
                    backgroundColor: "rgba(79, 70, 229, 0.10)",
                    fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#4f46e5",
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Accuracy: ${c.parsed.y}%` } } },
                scales: { y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => v + "%" } } },
            },
        });
    }

    function renderRecent(list) {
        const box = $("ctRecentList");
        if (!list.length) {
            box.innerHTML = `<p class="py-10 text-center text-sm text-slate-400">You haven't attempted any custom tests yet.</p>`;
            return;
        }
        box.innerHTML = list.map((r) => {
            const ai = r.source === "ai";
            const score = Math.round(r.score * 100) / 100;
            return `
            <div class="py-4 first:pt-0">
                <div class="mb-1.5 flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full ${ai ? "bg-fuchsia-500" : "bg-indigo-500"}"></span>
                    <span class="text-[10px] font-bold uppercase tracking-wide ${ai ? "text-fuchsia-600" : "text-indigo-600"}">${ai ? "AI Premium" : "Custom Test"}</span>
                </div>
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="truncate font-semibold text-slate-800">${esc(r.title)}</p>
                        ${r.subjects.length ? `<p class="mt-0.5 truncate text-xs text-slate-400">${esc(r.subjects.join(" \u2022 "))}</p>` : ""}
                        <p class="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><i data-lucide="calendar" class="h-3 w-3"></i>${fmtFull(r.date)}</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-3">
                        <div class="text-center">
                            <p class="text-sm font-bold ${score < 0 ? "text-red-500" : "text-green-600"}">${score}<span class="text-xs text-slate-300">/${r.totalMarks}</span></p>
                            <p class="text-[9px] uppercase tracking-wide text-slate-400">Marks</p>
                        </div>
                        <a href="${BASE}/custom-test/analysis/${encodeURIComponent(r.paperId)}" class="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100">Analysis</a>
                    </div>
                </div>
            </div>`;
        }).join("");
    }

      /* ---------- AI Suggestions (rule-based, no AI) ---------- */
    // Edit these numbers to change the study advice
    const PLAN_RULES = {
        critical: { below: 40, studyMin: 45, practiceQ: 20, retestDays: 2 },
        moderate: { studyMin: 30, practiceQ: 15, retestDays: 3 },
    };

    function whenLabel(i) { return i === 0 ? "Today" : i === 1 ? "Tomorrow" : `Day ${i + 1}`; }

    function planFor(t) {
        const rule = t.accuracy < PLAN_RULES.critical.below ? PLAN_RULES.critical : PLAN_RULES.moderate;
        const acc = (b) => (b && b.attempted >= 2 ? Math.round((b.correct / b.attempted) * 100) : null);
        const easyAcc = acc(t.diff?.easy);
        const hardAcc = acc(t.diff?.hard);

        let how;
        if (easyAcc !== null && easyAcc < 60) {
            how = "Your basics need work. Read the concept notes first, then solve easy questions.";
        } else if (hardAcc !== null && hardAcc < 40) {
            how = "Your basics look fine. Practice medium and hard questions to build depth.";
        } else if (t.skipped > 0 && t.skipped >= t.wrong) {
            how = "You skipped many questions here. Revise the key formulas and rules, then practice with a timer.";
        } else {
            how = "Review your mistakes in the analysis, then practice similar questions.";
        }
        return { studyMin: rule.studyMin, practiceQ: rule.practiceQ, retestDays: rule.retestDays, how };
    }

    function topicLabel(t) {
        const sub = t.subject && t.subject !== t.name ? ` <span class="font-normal text-slate-400">(${esc(t.subject)})</span>` : "";
        return `${esc(t.name)}${sub}`;
    }

    function buildInsights(d) {
        const lines = [];
        const n = d.totals.testsAttempted;
        lines.push(`You attempted ${n} test${n > 1 ? "s" : ""} with ${d.totals.accuracy}% average accuracy.`);

        const t = d.trend || [];
        if (t.length >= 2) {
            const last = t[t.length - 1].accuracy;
            const prev = t.slice(0, -1);
            const prevAvg = Math.round(prev.reduce((s, p) => s + p.accuracy, 0) / prev.length);
            const diff = last - prevAvg;
            lines.push(diff === 0
                ? `Your latest accuracy (${last}%) matches your earlier average.`
                : `Your latest accuracy is ${last}%, ${Math.abs(diff)} points ${diff > 0 ? "above" : "below"} your earlier average.`);
        }

        const subs = d.subjects || [];
        if (subs.length >= 2) {
            lines.push(`Weakest subject: ${subs[0].name} (${subs[0].accuracy}%).`);
            lines.push(`Strongest subject: ${subs[subs.length - 1].name} (${subs[subs.length - 1].accuracy}%).`);
        } else if (subs.length === 1) {
            lines.push(`Subject covered: ${subs[0].name} (${subs[0].accuracy}% accuracy).`);
        }

        const weak = d.weakTopics || [];
        if (weak.length) lines.push(`${weak.length} weak topic${weak.length > 1 ? "s" : ""} found. Start with ${weak[0].name}.`);
        const strong = d.strongTopics || [];
        if (strong.length) lines.push(`Strongest topic: ${strong[0].name} (${strong[0].accuracy}%).`);
        return lines;
    }

    function renderSuggestions(d) {
        const hasData = (d.totals?.testsAttempted || 0) > 0;
        const weak = d.weakTopics || [];

        const noData = `<p class="text-sm font-semibold text-slate-500">No data found</p>
            <p class="mt-0.5 text-xs text-slate-400">Attempt a custom test to unlock suggestions.</p>`;
        const noWeak = `<p class="text-sm text-slate-500">No weak topics found in your attempts. Keep practicing to stay sharp.</p>`;
        const cta = `<a href="${BASE}/custom-test/create" class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Create practice test</a>`;

        // ---- No data at all ----
        if (!hasData) {
            $("ctSugRevisionSub").textContent = "No data found";
            $("ctSugWeakSub").textContent = "No data found";
            $("ctSugInsightsSub").textContent = "No data found";
            $("ctSugRevisionBody").innerHTML = noData;
            $("ctSugWeakBody").innerHTML = noData;
            $("ctSugInsightsBody").innerHTML = noData;
            return;
        }

        // ---- Collapsed subtitles ----
        $("ctSugRevisionSub").textContent = weak.length ? `Start with ${weak[0].name}` : "No weak topics found";
        $("ctSugWeakSub").textContent = weak.length ? `Practice first: ${weak[0].name} (${weak[0].accuracy}%)` : "No weak topics found";
        const insights = buildInsights(d);
        $("ctSugInsightsSub").textContent = insights[0];

        // ---- Smart Revision Plan ----
        $("ctSugRevisionBody").innerHTML = weak.length
            ? `<div class="space-y-3">
                ${weak.slice(0, 3).map((t, i) => {
                    const p = planFor(t);
                    return `
                    <div class="rounded-xl border border-slate-100 bg-white p-3">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-bold uppercase tracking-wide text-indigo-600">${whenLabel(i)}</span>
                            <span class="text-[11px] text-slate-400">${t.accuracy}% &middot; ${t.correct}/${t.attempted} correct</span>
                        </div>
                        <p class="mt-1 text-sm font-semibold text-slate-800">${topicLabel(t)}</p>
                        <ul class="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600">
                            <li><b>Study:</b> ${p.studyMin} min. ${esc(p.how)}</li>
                            <li><b>Practice:</b> ${p.practiceQ} questions on this topic.</li>
                            <li><b>Re-test:</b> after ${p.retestDays} days to check your improvement.</li>
                        </ul>
                    </div>`;
                }).join("")}
               </div>${cta}`
            : noWeak;

        // ---- Weak Topic Practice (priority order) ----
        const related = weak.length ? weak.slice(1).filter((t) => t.subject === weak[0].subject) : [];
        $("ctSugWeakBody").innerHTML = weak.length
            ? `<p class="mb-2 text-xs text-slate-500">Practice <b class="text-slate-800">${esc(weak[0].name)}</b> first. It is your weakest topic.</p>
               <div class="space-y-2.5">
                ${weak.map((t, i) => `
                    <div>
                        <div class="flex items-center justify-between gap-2 text-xs">
                            <span class="truncate font-medium text-slate-700">${i + 1}. ${esc(t.name)}</span>
                            <span class="shrink-0 text-slate-400">${t.accuracy}% &middot; ${t.correct}/${t.attempted}${t.skipped ? ` &middot; ${t.skipped} skipped` : ""}</span>
                        </div>
                        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-rose-400" style="width:${t.accuracy}%"></div></div>
                    </div>`).join("")}
               </div>
               ${related.length ? `<p class="mt-3 text-xs text-slate-500">Also weak in <b>${esc(weak[0].subject)}</b>: ${related.map((t) => esc(t.name)).join(", ")}. Practice these next.</p>` : ""}
               ${cta}`
            : noWeak;

        // ---- Performance Insights ----
        $("ctSugInsightsBody").innerHTML = `<ul class="list-disc space-y-1.5 pl-4">${insights.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
    }

    root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-ct-suggest]");
        if (!btn) return;
        const key = btn.dataset.ctSuggest;
        const panel = root.querySelector(`[data-ct-suggest-panel="${key}"]`);
        const willOpen = panel.classList.contains("hidden");

        root.querySelectorAll("[data-ct-suggest-panel]").forEach((p) => p.classList.add("hidden"));
        root.querySelectorAll("[data-ct-suggest]").forEach((b) => b.lastElementChild?.classList.remove("rotate-90"));
        if (willOpen) {
            panel.classList.remove("hidden");
            btn.lastElementChild?.classList.add("rotate-90");
        }
    });

    $("ctRangeSelect")?.addEventListener("change", load);
    document.addEventListener("wue:custom-data-changed", load);   // refresh after any delete
    load();
})();