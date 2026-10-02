(function () {
    "use strict";

    const PAPER_LIST_KEY = "wue:customPaper:list";
    const RESULT_KEY_PREFIX = "wue:customPaper:result:";
    const HISTORY_KEY = "wue:customPaper:history";
    const BASE = window.location.pathname.startsWith("/dashboard") ? "/dashboard" : "";
    const PAGE_TIER = document.querySelector("section[data-tier]")?.dataset.tier || "free";
    const IS_PAID_TIER = PAGE_TIER === "pro" || PAGE_TIER === "promax";

async function loadPapers() {
    let localList = [];
    try {
        const raw = localStorage.getItem(PAPER_LIST_KEY);
        localList = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(localList)) localList = [];
        const now = Date.now();
        const kept = localList.filter((p) => !p.expiresAt || p.expiresAt > now);
        if (kept.length !== localList.length) {
            try { localStorage.setItem(PAPER_LIST_KEY, JSON.stringify(kept)); } catch (_) {}
        }
        localList = kept;
    } catch (_) { localList = []; }

    // Pro/Pro Max: AI-generated papers ab localStorage mein save nahi hote —
    // wo DB mein hain. Yahan se fetch karke local (manual-wizard) papers ke
    // saath merge karte hain.
    if (PAGE_TIER === "pro" || PAGE_TIER === "promax") {
        try {
            const res = await fetch("/api/custom-test/ai/papers", { credentials: "same-origin" });
            const data = await res.json();
            if (data.success && Array.isArray(data.papers)) {
                const localIds = new Set(localList.map((p) => p.id));
                data.papers.forEach((p) => { if (!localIds.has(p.id)) localList.push(p); });
            }
        } catch (_) {}
    }

    return localList;
}

    function hasResult(paperId) {
        return !!localStorage.getItem(RESULT_KEY_PREFIX + paperId);
    }

     const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || "";
     const HISTORY_TTL = PAGE_TIER === "promax" ? 2 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

// Resolves true when the server confirms the delete (free tier has nothing on the server)
async function serverDelete(url) {
    if (!IS_PAID_TIER) return true;
    try {
        const res = await fetch(url, { method: "DELETE", credentials: "same-origin", headers: { "x-csrf-token": CSRF } });
        const data = await res.json().catch(() => ({}));
        return res.ok && data.success !== false;
    } catch (_) { return false; }
}

function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message, "error");
    else window.alert(message);
}

function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (_) {}
}

function parseDoneDate(str) {
    const t = Date.parse(String(str || "").replace("Sept", "Sep"));
    return isNaN(t) ? null : t;
}

function loadHistory() {
    let list;
    try { list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch (_) { list = []; }
    if (!Array.isArray(list)) list = [];

    const now = Date.now();
    let changed = false;
    const kept = [];

    list.forEach((p) => {
        // purani entries me savedAt nahi hota: completedOn se nikalo, warna abhi ka time
        if (!p.savedAt) { p.savedAt = parseDoneDate(p.completedOn) || now; changed = true; }
        if (now - p.savedAt > HISTORY_TTL) {
            try { localStorage.removeItem(RESULT_KEY_PREFIX + p.paperId); } catch (_) {}
            changed = true;
            return;
        }
        kept.push(p);
    });

    if (changed) saveHistory(kept);
    return kept;
}

/* ---------- ANALYSIS ONLY ---------- */
function removeLocalAnalysis(paperId) {
    try { localStorage.removeItem(RESULT_KEY_PREFIX + paperId); } catch (_) {}
    saveHistory(loadHistory().filter((p) => p.paperId !== paperId));
}

async function deleteAnalysis(paperId) {
    const ok = await serverDelete(`/api/custom-test/attempt/${encodeURIComponent(paperId)}`);
    if (!ok) return false;
    removeLocalAnalysis(paperId);
    document.dispatchEvent(new Event("wue:custom-data-changed"));   // NEW
    return true;
}

function removeAllLocalAnalyses() {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(RESULT_KEY_PREFIX)) localStorage.removeItem(k);
        }
    } catch (_) {}
    try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
}

async function deleteAllAnalyses() {
    if (!(await serverDelete("/api/custom-test/attempts"))) return false;
    removeAllLocalAnalyses();
    document.dispatchEvent(new Event("wue:custom-data-changed"));   // NEW
    return true;
}

/* ---------- TEST (+ its analysis) ---------- */
function removeLocalPaper(paperId) {
    try { sessionStorage.removeItem("wue:attemptAllowed:" + paperId); } catch (_) {}
    try {
        const raw = localStorage.getItem(PAPER_LIST_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
            localStorage.setItem(PAPER_LIST_KEY, JSON.stringify(list.filter((p) => p.id !== paperId)));
        }
    } catch (_) {}
}

async function deletePaper(paperId) {
    // Analysis in DB (Pro / Pro Max)
    const jobs = [serverDelete(`/api/custom-test/attempt/${encodeURIComponent(paperId)}`)];
    // AI papers only: the paper and its embedded questions live in the DB.
    // Normal (cp_) papers are local only; the shared question bank is never touched.
    if (String(paperId).startsWith("ai_")) {
        jobs.push(serverDelete(`/api/custom-test/ai/paper/${encodeURIComponent(paperId)}`));
    }
    if ((await Promise.all(jobs)).includes(false)) return false;

        removeLocalAnalysis(paperId);
    removeLocalPaper(paperId);
    document.dispatchEvent(new Event("wue:custom-data-changed"));   // NEW
    return true;
}

async function deleteAllPapers() {
    const results = await Promise.all([
        serverDelete("/api/custom-test/attempts"),
        serverDelete("/api/custom-test/ai/papers"),
    ]);
    if (results.includes(false)) return false;

        removeAllLocalAnalyses();
    try { localStorage.removeItem(PAPER_LIST_KEY); } catch (_) {}
    document.dispatchEvent(new Event("wue:custom-data-changed"));   // NEW
    return true;
}

    function icons() { window.lucide && window.lucide.createIcons(); }


function showConfirmModal(message, opts = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById("confirmModal");
        const titleEl = document.getElementById("confirmModalTitle");
        const msgEl = document.getElementById("confirmModalMessage");
        const okBtn = document.getElementById("confirmModalOk");
        const cancelBtn = document.getElementById("confirmModalCancel");
        if (!modal || !msgEl || !okBtn || !cancelBtn) { resolve(window.confirm(message)); return; }

        // Move the modal to <body> so it is visible even when its parent section is hidden
        if (modal.parentElement !== document.body) document.body.appendChild(modal);

        if (titleEl) titleEl.textContent = opts.title || "Are you sure?";
        msgEl.textContent = message;
        okBtn.textContent = opts.confirmLabel || "Delete";
        modal.classList.remove("hidden");
        icons();

        function cleanup(result) {
            modal.classList.add("hidden");
            okBtn.removeEventListener("click", onOk);
            cancelBtn.removeEventListener("click", onCancel);
            resolve(result);
        }
        function onOk() { cleanup(true); }
        function onCancel() { cleanup(false); }

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
    });
}

function badgeHtml(paper) {
    if (paper?.source === "ai") {
        return `<span class="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white">
                    <i data-lucide="sparkles" class="w-3 h-3"></i> AI Premium
                </span>`;
    }
    return `<span class="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">Custom</span>`;
}

function buildActiveCardHtml(paper) {
    const submitted = hasResult(paper.id);
    const cfg = paper.config || {};
    const exam = (cfg.exams || []).join(", ") || "Custom Paper";
    const topic = (cfg.subjects || []).join(", ") || "";
    const initials = (cfg.exams && cfg.exams[0] ? cfg.exams[0] : "CP").slice(0, 2).toUpperCase();

    const iconVal = String(cfg.categoryIcon || "").trim();
    const isImage = /^(https?:)?\//.test(iconVal) || /\.(png|jpe?g|svg|webp)$/i.test(iconVal);
    const isFontIcon = /\b(fa-|bi-|ri-|material-icons)/.test(iconVal);
    const iconColorClass = cfg.categoryIconColor || "bg-indigo-50 text-indigo-600";

    let iconHtml;
    if (isImage && iconVal) {
        iconHtml = `<img src="${iconVal}" alt="" class="w-4.5 h-4.5 object-contain" />`;
    } else if (isFontIcon) {
        iconHtml = `<i class="${iconVal} text-[15px]"></i>`;
    } else if (iconVal) {
        iconHtml = `<i data-lucide="${iconVal}" class="w-4 h-4"></i>`;
    } else {
        iconHtml = `<span class="font-bold text-sm">${initials}</span>`;
    }

    const canReattempt = PAGE_TIER === "promax";
    const actionsHtml = submitted
        ? (canReattempt
            ? `<div class="mt-5 grid grid-cols-2 gap-3">
                 <button type="button" class="paper-action-btn paper-action-analysis w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition active:scale-[0.98]">
                     Analysis
                 </button>
                 <button type="button" class="paper-action-btn paper-action-reattempt w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition active:scale-[0.98]">
                     Reattempt
                 </button>
               </div>`
            : `<button type="button" class="paper-action-btn paper-action-analysis mt-5 w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition active:scale-[0.98]">
                   Analysis
               </button>`)
        : `<button type="button" class="paper-action-btn paper-action-start mt-5 w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition active:scale-[0.98]">
               Start Test
           </button>`;

    return `
        <div data-paper-id="${paper.id}" data-status="${submitted ? "submitted" : "pending"}"
            class="active-paper-card bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 w-full">
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 shrink-0 rounded-xl ${iconColorClass} grid place-items-center overflow-hidden">
                      ${iconHtml}
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-semibold text-slate-900 truncate">${exam}</p>
                        <p class="text-xs text-slate-500 truncate">${topic}</p>
                    </div>
                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                    ${badgeHtml(paper)}
                    <button type="button" class="paper-delete-btn w-7 h-7 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Delete this test" aria-label="Delete this test">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <div class="mt-5 flex items-center justify-between text-center">
                <div class="flex-1 flex flex-col items-center gap-1">
                    <i data-lucide="help-circle" class="w-4 h-4 text-slate-400"></i>
                    <p class="text-sm font-bold text-slate-900">${cfg.questionCount ?? "-"}</p>
                    <p class="text-[11px] text-slate-400 uppercase tracking-wide">Questions</p>
                </div>
                <div class="w-px h-10 bg-slate-100"></div>
                <div class="flex-1 flex flex-col items-center gap-1">
                    <i data-lucide="medal" class="w-4 h-4 text-slate-400"></i>
                    <p class="text-sm font-bold text-slate-900">${cfg.questionCount ?? "-"}</p>
                    <p class="text-[11px] text-slate-400 uppercase tracking-wide">Marks</p>
                </div>
                <div class="w-px h-10 bg-slate-100"></div>
                <div class="flex-1 flex flex-col items-center gap-1">
                    <i data-lucide="clock" class="w-4 h-4 text-amber-500"></i>
                    <p class="text-sm font-bold text-slate-900">${cfg.timeLimit ?? "-"}m</p>
                    <p class="text-[11px] text-slate-400 uppercase tracking-wide">Time</p>
                </div>
            </div>

            ${actionsHtml}
        </div>`;
}

async function renderActive() {
    const slot = document.getElementById("active-paper-slot");
    const papers = await loadPapers();

    const delAllBtn = document.getElementById("clear-all-papers");
    if (delAllBtn) {
        const hasPapers = papers.length > 0;
        delAllBtn.classList.toggle("hidden", !hasPapers);
        delAllBtn.classList.toggle("inline-flex", hasPapers);
    }
        
    if (!papers.length) {
        slot.className = "";
        slot.innerHTML = `<div class="wiz-card text-center py-8 sm:py-10">
            <p class="text-sm font-semibold text-slate-900">No paper generated yet</p>
            <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Create a custom paper above to get a mock test with your chosen exam, topics, and difficulty.</p>
        </div>`;
        return;
    }

    slot.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
    slot.innerHTML = papers.map(buildActiveCardHtml).join("");
    icons();

    slot.querySelectorAll(".active-paper-card").forEach((card) => {
        const paperId = card.getAttribute("data-paper-id");
                card.querySelector(".paper-action-start")?.addEventListener("click", () => {
            try { sessionStorage.setItem("wue:attemptAllowed:" + paperId, "1"); } catch (_) {}
            window.location.href = `${BASE}/custom-test/attempt/${paperId}`;
        });
        card.querySelector(".paper-action-analysis")?.addEventListener("click", () => {
            window.location.href = `${BASE}/custom-test/analysis/${paperId}`;
        });
        card.querySelector(".paper-action-reattempt")?.addEventListener("click", () => {
            try { sessionStorage.setItem("wue:attemptAllowed:" + paperId, "1"); } catch (_) {}
            window.location.href = `${BASE}/custom-test/attempt/${paperId}`;
        });
    });
}

        function scoreTier(pct) {
        if (pct >= 70) return { badge: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" };
        if (pct >= 40) return { badge: "bg-amber-50 text-amber-600", bar: "bg-amber-500" };
        return { badge: "bg-rose-50 text-rose-600", bar: "bg-rose-500" };
    }

    function renderHistory() {
    const section = document.getElementById("your-papers-section");
    const grid = document.getElementById("papers-history-grid");
    const emptyMsg = document.getElementById("papers-history-empty");
    const list = loadHistory();

    const clearAllBtn = document.getElementById("clear-all-history");

    if (!list.length) {
        section?.classList.add("hidden");
        grid.innerHTML = "";
        emptyMsg.classList.add("hidden");
        clearAllBtn?.classList.add("hidden");
        return;
    }

    section?.classList.remove("hidden");
    emptyMsg.classList.add("hidden");
    clearAllBtn?.classList.remove("hidden");
    
        grid.innerHTML = list.map((p) => {
            const initials = (p.exam || "CP").slice(0, 2).toUpperCase();
            const t = scoreTier(p.scorePercent);
            return `
                <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:shadow-indigo-100 hover:-translate-y-1 transition-all duration-200 flex flex-col">
                    <div class="flex items-center justify-between mb-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-xs shadow-inner shrink-0">
                            ${initials}
                        </div>
                        <div class="flex items-center gap-1.5">
    <span class="text-[11px] font-extrabold px-2.5 py-1 rounded-full ${t.badge}">${p.scorePercent}%</span>
    <button type="button" class="history-delete-btn w-7 h-7 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" data-paper-id="${p.paperId}" title="Delete this analysis" aria-label="Delete this analysis">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
</div>
                    </div>

                    <p class="font-bold text-sm text-slate-900 leading-tight truncate">${p.exam}</p>
                    ${p.source === "ai"
                        ? `<span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white mt-1">
                               <i data-lucide="sparkles" class="w-2.5 h-2.5"></i> AI Premium
                           </span>`
                        : `<span class="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 mt-1">Custom</span>`}
                    <p class="text-xs text-slate-400 mt-1.5 truncate">${p.topic} &middot; ${p.questionCount}Q</p>

                    <div class="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-3 mb-2">
                        <div class="h-full rounded-full ${t.bar}" style="width:${p.scorePercent}%"></div>
                    </div>

                    <p class="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <i data-lucide="calendar" class="w-3 h-3"></i> ${p.completedOn}
                    </p>

                    <a href="${BASE}/custom-test/analysis/${p.paperId}"
                        class="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all duration-150">
                        Review <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                    </a>
                </div>`;
        }).join("");
    }
    icons();

    function goToCreatePaper() {
    window.location.href = `${BASE}/custom-test/create`;
}

    document.addEventListener("DOMContentLoaded", async function () {
    await renderActive();
    renderHistory();
        icons();
        document.getElementById("create-paper-btn")?.addEventListener("click", goToCreatePaper);
 

        // Your Papers: delete a single analysis (the test stays)
        document.getElementById("papers-history-grid")?.addEventListener("click", async (e) => {
            const btn = e.target.closest(".history-delete-btn");
            if (!btn) return;
            const ok = await showConfirmModal("This will permanently delete your attempt and its analysis. The test will remain available. This action cannot be undone.", { title: "Delete this analysis?", confirmLabel: "Delete analysis" });
            if (!ok) return;
            if (!(await deleteAnalysis(btn.dataset.paperId))) {
                notify("We couldn't delete this analysis. Please try again.");
                return;
            }
            renderHistory();
            await renderActive();
            icons();
        });

        // Your Papers: delete all analyses (tests stay)
        document.getElementById("clear-all-history")?.addEventListener("click", async () => {
            const ok = await showConfirmModal("This will permanently delete all your attempts and analyses. Your tests will remain available. This action cannot be undone.", { title: "Delete all analyses?", confirmLabel: "Delete all" });
            if (!ok) return;
            if (!(await deleteAllAnalyses())) {
                notify("We couldn't delete your analyses. Please try again.");
                return;
            }
            renderHistory();
            await renderActive();
            icons();
        });

        // Generated Paper: delete a single test (its analysis is deleted too)
        document.getElementById("active-paper-slot")?.addEventListener("click", async (e) => {
            const btn = e.target.closest(".paper-delete-btn");
            if (!btn) return;
            const paperId = btn.closest(".active-paper-card")?.dataset.paperId;
            if (!paperId) return;
            const ok = await showConfirmModal("This will permanently delete the test along with all of its attempts and analysis. This action cannot be undone.", { title: "Delete this test?", confirmLabel: "Delete test" });
            if (!ok) return;
            if (!(await deletePaper(paperId))) {
                notify("We couldn't delete this test. Please try again.");
                return;
            }
            renderHistory();
            await renderActive();
            icons();
        });

        // Generated Paper: delete all tests (all analyses are deleted too)
        document.getElementById("clear-all-papers")?.addEventListener("click", async () => {
            const ok = await showConfirmModal("This will permanently delete all your tests along with all of their attempts and analyses. This action cannot be undone.", { title: "Delete all tests?", confirmLabel: "Delete all" });
            if (!ok) return;
            if (!(await deleteAllPapers())) {
                notify("We couldn't delete your tests. Please try again.");
                return;
            }
            renderHistory();
            await renderActive();
            icons();
        });


        document.getElementById("history-view-all")?.addEventListener("click", (e) => {
            e.preventDefault();
            document.getElementById("your-papers-heading")?.scrollIntoView({ behavior: "smooth" });
        });
    });

        window.addEventListener("pageshow", function (e) {
        if (e.persisted) window.location.reload();
    });
})();