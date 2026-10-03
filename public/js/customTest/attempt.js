/* /public/js/customTest/attempt.js
   Custom Practice Paper — attempt runtime.
   Supports single overall timer AND sectional timer (exam-pattern mode).
*/

const TTL_MS = 24 * 60 * 60 * 1000; // 24 ghante

(function () {
    "use strict";

    const TIER = document.querySelector('[data-tier]')?.dataset.tier || "free";
    const PAPER_KEY = "wue:customPaper:list";
    const RESULT_KEY_PREFIX = "wue:customPaper:result:";
    const DEFAULT_SUBJECT_MINUTES = 20;

    const dataEl = document.getElementById("attemptPageData");
    const pageData = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};
    const paperId = pageData.paperId;
    const returnUrl = pageData.returnUrl || "/custom-test";

    const ALLOW_KEY = "wue:attemptAllowed:" + paperId;
function isAllowed() {
    try { return sessionStorage.getItem(ALLOW_KEY) === "1"; } catch (_) { return false; }
}
function clearAllowed() {
    try { sessionStorage.removeItem(ALLOW_KEY); } catch (_) {}
}

    const $ = (sel) => document.querySelector(sel);
    const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch (_) {} };

    // ---------------- Sectional state (module scope) ----------------
    let sections = [];
    let currentSectionIndex = 0;
    let sectionTimeLeft = {};
    let sectionDone = {};
    let HAS_SUBJECT_TABS = false;
    let subjectsOrder = [];

    function buildSections(subjectTimeList, subjectsOrderList) {
        const built = [];
        const used = new Set();

        (subjectTimeList || []).forEach((entry) => {
            const matched = (entry.subjects || []).filter((s) => subjectsOrderList.includes(s) && !used.has(s));
            if (!matched.length) return;
            const mins = Number(entry.duration) > 0 ? Number(entry.duration) : DEFAULT_SUBJECT_MINUTES;
            built.push({ subjects: matched, label: matched.join(" + "), durationMinutes: mins });
            matched.forEach((s) => used.add(s));
        });

        subjectsOrderList.forEach((s) => {
            if (!used.has(s)) {
                built.push({ subjects: [s], label: s, durationMinutes: DEFAULT_SUBJECT_MINUTES });
                used.add(s);
            }
        });

        return built;
    }

    function sectionIndexForSubject(subjectName) {
        const idx = sections.findIndex((sec) => sec.subjects.includes(subjectName));
        return idx === -1 ? 0 : idx;
    }

    async function loadPaper() {
        // Manual-wizard papers hamesha localStorage se (koi change nahi)
        if (!paperId.startsWith("ai_")) {
            return loadFromLocalList();
        }

        // AI papers: Free tier localStorage se; Pro/Pro Max DB se
        if (TIER === "free") {
            return loadFromLocalList();
        }

        try {
            const res = await fetch(`/api/custom-test/ai/paper/${encodeURIComponent(paperId)}`, { credentials: "same-origin" });
            const data = await res.json();
            if (data.success) {
                return {
                    id: data.paperId,
                    source: "ai",
                    config: {
                        exams: [data.paperName], subjects: [], topics: [],
                        questionCount: data.questions.length, timeLimit: data.timeLimit,
                        timeStrategy: "total", language: "English", mode: "ai",
                    },
                    questions: data.questions,
                };
            }
        } catch (_) {}
        return null; // expire ho chuka hai ya nahi mila
    }

    function loadFromLocalList() {
        try {
            const raw = localStorage.getItem(PAPER_KEY);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            const now = Date.now();

            const kept = list.filter((p) => !p.expiresAt || p.expiresAt > now);
            if (kept.length !== list.length) {
                try { localStorage.setItem(PAPER_KEY, JSON.stringify(kept)); } catch (_) {}
            }

            return kept.find((p) => p.id === paperId) || null;
        } catch (_) { return null; }
    }

    (async function boot() {
            if (!isAllowed()) { window.location.replace(returnUrl); return; }
    const paper = await loadPaper();
    icons();

    if (!paper || !Array.isArray(paper.questions) || !paper.questions.length) {
        const main = document.querySelector("main");
        if (main) {
            main.innerHTML = `
    <div class="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div class="w-full max-w-sm sm:max-w-md text-center bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-sm">
            <span class="mx-auto mb-4 sm:mb-5 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                <i data-lucide="clock-alert" class="h-6 w-6 sm:h-7 sm:w-7"></i>
            </span>
            <p class="text-base sm:text-lg font-bold text-slate-900 mb-2">This paper has expired</p>
            <p class="text-sm text-slate-500 leading-relaxed mb-6 max-w-xs mx-auto">
                Papers are kept for a limited time on your plan and are removed automatically afterwards. Generate a new one to keep practicing.
            </p>
            <a href="${returnUrl}" class="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition active:scale-[0.98]">
                <i data-lucide="plus" class="h-4 w-4"></i>
                Create a new paper
            </a>
        </div>
    </div>`;
        try { window.lucide && window.lucide.createIcons(); } catch (_) {}
        }
        document.getElementById("instructionsModal")?.remove();
        document.getElementById("sidebar")?.remove();
        document.getElementById("mobile-summary-bar")?.remove();
        return;
    }

    // Already submit ho chuka hai — back/forward se attempt page pe dobara na jaane do.
    // Pro Max ke liye exception: unhe reattempt karne dena hai, isliye unpe ye guard nahi lagega.
    const alreadyDone = !!localStorage.getItem(RESULT_KEY_PREFIX + paperId);
    if (alreadyDone && TIER !== "promax") {
        window.location.replace(returnUrl);
        return;
    }

    showInstructions(paper);
})();

// bfcache se wapas aane par (browser back) — agar already submit ho chuka hai to attempt page pe mat rehne do
window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (!isAllowed()) window.location.replace(returnUrl);
});

function showInstructions(paper) {
    const cfg = paper.config || {};
    const modal = document.getElementById("instructionsModal");
    if (!modal) { runAttempt(paper); return; }

    document.getElementById("instrTitle").textContent = (cfg.exams || []).join(", ") || "Custom Practice Paper";
    document.getElementById("instrTotalQ").textContent = paper.questions.length;
    const totalMarks = paper.questions.reduce((s, q) => s + (Number(q.marks) || 1), 0);
    document.getElementById("instrTotalMarks").textContent = totalMarks;
    const langEl = document.getElementById("instrLanguageValue");
if (langEl) langEl.textContent = cfg.language || paper.language || "English";

    const bySubject = {};
    paper.questions.forEach((q) => {
        const s = q.subject || "General";
        bySubject[s] = (bySubject[s] || 0) + 1;
    });
    const grid = document.getElementById("instrSubjectGrid");
    grid.innerHTML = Object.entries(bySubject).map(([subj, count]) => `
        <div class="border rounded-xl bg-gray-50 text-center p-4">
            <p class="text-[11px] text-gray-400 font-bold uppercase truncate">${subj}</p>
            <p class="text-lg font-bold text-slate-900 mt-1">${count} Questions</p>
        </div>`).join("");

    const timingContent = document.getElementById("instrTimingContent");
    if (cfg.timeStrategy === "sectional" && Array.isArray(cfg.subjectTime) && cfg.subjectTime.length) {
        timingContent.innerHTML = cfg.subjectTime.map((st) => `
            <div class="flex justify-between items-center p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <span class="text-sm font-medium">${(st.subjects || []).join(" + ")}</span>
                <span class="font-bold text-indigo-600 text-sm">${st.duration} mins</span>
            </div>`).join("");
    } else {
        timingContent.innerHTML = `
            <div class="flex justify-between items-center p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <span class="text-sm font-medium">Total Duration</span>
                <span class="font-bold text-indigo-600 text-sm">${cfg.timeLimit || "-"} mins</span>
            </div>`;
    }

    const cancelBtn = document.getElementById("instrCancelBtn");
    if (cancelBtn) {
        cancelBtn.setAttribute("href", returnUrl);
        cancelBtn.addEventListener("click", function (e) {
            e.preventDefault();
            clearAllowed();
            if (history.length > 1) history.back();
            else window.location.replace(returnUrl);
        });
    }

    const agreeBox = document.getElementById("instrAgree");
    const proceedBtn = document.getElementById("instrProceedBtn");
    agreeBox?.addEventListener("change", () => {
        proceedBtn.disabled = !agreeBox.checked;
        proceedBtn.classList.toggle("opacity-50", !agreeBox.checked);
        proceedBtn.classList.toggle("cursor-not-allowed", !agreeBox.checked);
    });

    document.addEventListener("click", function proceedHandler(e) {
        if (!e.target.closest('[data-action="instr-proceed"]')) return;
        if (proceedBtn.disabled) return;
        document.removeEventListener("click", proceedHandler);
        modal.remove();
        runAttempt(paper);
    });

    icons();
}

    function runAttempt(paper) {
        let questions = paper.questions;
        const total = questions.length;
        const lang = paper.config && paper.config.language;
        const cfg = paper.config || {};

        HAS_SUBJECT_TABS = cfg.timeStrategy === "sectional" && Array.isArray(cfg.subjectTime) && cfg.subjectTime.length > 0;

        let state = questions.map(() => ({
            visited: false, marked: false, selected: null, numericValue: null, sectionIndex: 0, saved: false,
        }));

        if (HAS_SUBJECT_TABS) {
            subjectsOrder = [];
            questions.forEach((q) => { if (!subjectsOrder.includes(q.subject)) subjectsOrder.push(q.subject); });

            sections = buildSections(cfg.subjectTime, subjectsOrder);
            questions.forEach((q, i) => { state[i].sectionIndex = sectionIndexForSubject(q.subject); });

            const order = questions.map((_, i) => i);
            order.sort((a, b) => state[a].sectionIndex - state[b].sectionIndex);
            questions = order.map((i) => questions[i]);
            state = order.map((i) => state[i]);

            sectionTimeLeft = {};
            sectionDone = {};
            sections.forEach((sec, idx) => { sectionTimeLeft[idx] = sec.durationMinutes * 60; });
            currentSectionIndex = 0;
        }

        let current = 0;
        let submitted = false;
        state[0].visited = true;

        // ---------------- DOM refs ----------------
        const questionNoLabel = $("#questionNoLabel");
        const questionTextEl = $("#questionText");
        const questionImageEl = $("#questionImage");
        const optionsContainer = $("#optionsContainer");
        const integerContainer = $("#integerContainer");
        const integerInput = $("#integerInput");
        const paletteGrid = $("#paletteGrid");
        const paletteGridMobile = $("#paletteGridMobile");
        const prevBtn = $("#prevBtn");
        const saveNextBtn = $("#saveNextBtn");
        const footerSubmitBtn = $("#footerSubmitBtn");
        const timerDisplay = $("#timerDisplay");
        const timerLabel = $("#timerLabel");
        const submitBreakdownBody = $("#submitBreakdownBody");
        const cntAnswered = $("#cntAnswered");
        const cntNotAnswered = $("#cntNotAnswered");
        const cntNotVisited = $("#cntNotVisited");
        const cntReview = $("#cntReview");
        const cntMarkedAnswered = $("#cntMarkedAnswered");
        const cntAnsweredM = $("#cntAnsweredM");
        const cntNotAnsweredM = $("#cntNotAnsweredM");

        function escapeHtml(s) {
            return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        }

        function getDisplay(q) {
            if (q.languageMode === "multiple" && Array.isArray(q.translations) && q.translations.length) {
                const t = q.translations.find((tt) => tt.lang === lang) || q.translations[0];
                if (t && (t.question || t.questionImage)) {
                    return {
                        question: t.question || "",
                        questionImage: t.questionImage || null,
                        options: (t.options && t.options.length) ? t.options : (q.options || []),
                    };
                }
            }
            return { question: q.question || "", questionImage: q.questionImage || null, options: q.options || [] };
        }

        function renderMath(el) {
            if (window.renderMathInElement) {
                try {
                    window.renderMathInElement(el, {
                        delimiters: [
                            { left: "$$", right: "$$", display: true },
                            { left: "$", right: "$", display: false },
                            { left: "\\(", right: "\\)", display: false },
                            { left: "\\[", right: "\\]", display: true },
                        ],
                        throwOnError: false,
                    });
                } catch (_) {}
            }
        }

        function hasAnswerFor(i) {
            const q = questions[i], st = state[i];
            if (q.type === "integer") return st.numericValue !== null && st.numericValue !== undefined && st.numericValue !== "";
            if (q.type === "multiple") return Array.isArray(st.selected) && st.selected.length > 0;
            return st.selected !== null && st.selected !== undefined;
        }

        function statusFor(i) {
            const st = state[i];
            const answered = hasAnswerFor(i);
            if (st.marked && answered) return "markedAnswered";
            if (st.marked) return "review";
            if (answered) return "answered";
            if (st.visited) return "notAnswered";
            return "notVisited";
        }

        // ---------------- RENDER QUESTION ----------------

                function updateNavButtons() {
            if (!saveNextBtn || !footerSubmitBtn) return;
            const isLast = current === total - 1;
            const showSubmit = isLast && state[current].saved;
            saveNextBtn.classList.toggle("hidden", showSubmit);
            footerSubmitBtn.classList.toggle("hidden", !showSubmit);
        }

        function renderQuestion() {
            const q = questions[current];
            const disp = getDisplay(q);

            let qNo = current + 1;
            let labelSuffix = ` of ${total}` + (q.subject ? ` • ${q.subject}` : "");
            if (HAS_SUBJECT_TABS) {
                const sectionStart = questions.findIndex((_, i) => state[i].sectionIndex === state[current].sectionIndex);
                qNo = current - sectionStart + 1;
                labelSuffix = ` (${sections[currentSectionIndex].label})`;
            }
            questionNoLabel.textContent = `Question ${qNo}${labelSuffix}` + (q.topic ? ` / ${q.topic}` : "");

            questionTextEl.textContent = disp.question;
            renderMath(questionTextEl);

            if (disp.questionImage) {
                questionImageEl.src = disp.questionImage;
                questionImageEl.classList.remove("hidden");
            } else {
                questionImageEl.classList.add("hidden");
                questionImageEl.removeAttribute("src");
            }

            const st = state[current];

            if (q.type === "integer") {
                optionsContainer.classList.add("hidden");
                integerContainer.classList.remove("hidden");
                integerInput.value = (st.numericValue !== null && st.numericValue !== undefined) ? st.numericValue : "";
            } else {
                integerContainer.classList.add("hidden");
                optionsContainer.classList.remove("hidden");
                const multi = q.type === "multiple";

                optionsContainer.innerHTML = "";
                (disp.options || []).forEach((opt, i) => {
                    const checked = multi
                        ? Array.isArray(st.selected) && st.selected.includes(i)
                        : st.selected === i;

                    const label = document.createElement("label");
                    label.className = `option-row flex items-start gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors mb-2 ${
                        checked ? "border-indigo-500 bg-indigo-50/60" : "border-slate-200 hover:border-indigo-300"
                    }`;

                    const input = document.createElement("input");
                    input.type = multi ? "checkbox" : "radio";
                    input.name = "opt-" + current;
                    input.dataset.index = String(i);
                    input.className = "mt-1 accent-indigo-600 shrink-0";
                    input.checked = checked;

                    const body = document.createElement("span");
                    body.className = "flex-1 min-w-0 break-words";

                    if (opt.text) {
                        const textSpan = document.createElement("span");
                        textSpan.className = "block text-sm text-slate-800 option-text";
                        textSpan.textContent = opt.text;
                        body.appendChild(textSpan);
                    }
                    if (opt.image) {
                        const img = document.createElement("img");
                        img.src = opt.image;
                        img.alt = "";
                        img.className = "mt-2 max-w-full sm:max-w-xs h-auto rounded-lg border";
                        body.appendChild(img);
                    }

                    label.appendChild(input);
                    label.appendChild(body);
                    optionsContainer.appendChild(label);
                });

                optionsContainer.querySelectorAll(".option-text").forEach(renderMath);
            }

            prevBtn.disabled = current === 0;
            updateNavButtons();
            if (HAS_SUBJECT_TABS) updateSubjectTabsState();
            updatePalette();
        }

        // ---------------- OPTION / INTEGER INPUT EVENTS ----------------
        optionsContainer.addEventListener("change", (e) => {
            const input = e.target.closest("input[data-index]");
            if (!input) return;
            const idx = Number(input.dataset.index);
            const q = questions[current];
            const st = state[current];
            st.saved = false;

            if (q.type === "multiple") {
                st.selected = st.selected || [];
                if (input.checked) {
                    if (!st.selected.includes(idx)) st.selected.push(idx);
                } else {
                    st.selected = st.selected.filter((x) => x !== idx);
                }
                if (!st.selected.length) st.selected = null;
            } else {
                st.selected = idx;
            }
            renderQuestion();
        });

        integerInput.addEventListener("input", (e) => {
            state[current].saved = false;
            state[current].numericValue = e.target.value === "" ? null : Number(e.target.value);
            updatePalette();
            updateNavButtons();
        });

        // ---------------- NAVIGATION ----------------
        function checkSectionSwitch() {
            if (!HAS_SUBJECT_TABS) return;
            const newSection = state[current].sectionIndex;
            if (newSection !== currentSectionIndex) {
                if (newSection > currentSectionIndex) lockSectionsBefore(newSection);
                currentSectionIndex = newSection;
                startTimerForCurrentContext();
            }
        }

        function goto(i) {
            if (i < 0 || i >= total) return;
            state[i].visited = true;
            current = i;
            checkSectionSwitch();
            renderQuestion();
            closeMobilePalette();
        }

        function saveAndNext() {
            if (current < total - 1) {
                goto(current + 1);
            } else {
                state[current].saved = true;
                renderQuestion();
            }
        }

        function markForReview() {
            state[current].marked = true;
            if (current < total - 1) {
                goto(current + 1);
            } else {
                state[current].saved = true;
                renderQuestion();
            }
        }

        function clearResponse() {
            const q = questions[current];
            state[current].saved = false;
            if (q.type === "integer") { state[current].numericValue = null; integerInput.value = ""; }
            else { state[current].selected = null; }
            renderQuestion();
        }

        // ---------------- SECTIONAL: tabs, lock, switch ----------------
        function renderSubjectTabs() {
            const bar = document.getElementById("subjectTabs");
            if (!bar) return;
            if (!HAS_SUBJECT_TABS || !sections.length) {
                bar.classList.add("hidden");
                bar.classList.remove("flex");
                bar.innerHTML = "";
                return;
            }
            bar.classList.remove("hidden");
            bar.classList.add("flex");
            bar.innerHTML = "";
            sections.forEach((sec, idx) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "subject-tab whitespace-nowrap px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-gray-400 hover:text-indigo-500 active:scale-95 transition";
                btn.textContent = sec.label;
                btn.addEventListener("click", () => switchSection(idx));
                bar.appendChild(btn);
            });
            updateSubjectTabsState();
        }

        function updateSubjectTabsState() {
            if (!HAS_SUBJECT_TABS) return;
            document.querySelectorAll(".subject-tab").forEach((el, i) => {
                el.disabled = !!sectionDone[i];
                el.classList.toggle("text-indigo-600", i === currentSectionIndex);
                el.classList.toggle("border-indigo-600", i === currentSectionIndex);
                el.classList.toggle("text-gray-400", i !== currentSectionIndex);
                el.classList.toggle("opacity-40", !!sectionDone[i]);
                el.classList.toggle("cursor-not-allowed", !!sectionDone[i]);
            });
        }

        function lockSectionsBefore(newIdx) {
            for (let i = 0; i < newIdx; i++) {
                if (!sectionDone[i]) { sectionDone[i] = true; sectionTimeLeft[i] = 0; }
            }
            updateSubjectTabsState();
        }

        function switchSection(idx, isAutoSwitch) {
            if (!HAS_SUBJECT_TABS) return;
            if (!isAutoSwitch && sectionDone[idx]) return;
            if (!isAutoSwitch && idx > currentSectionIndex) lockSectionsBefore(idx);

            currentSectionIndex = idx;
            let found = questions.findIndex((_, i) => state[i].sectionIndex === idx);
            current = found !== -1 ? found : 0;
            state[current].visited = true;
            startTimerForCurrentContext();
            renderQuestion();
        }

        function goToNextIncompleteSection() {
            let nextIdx = -1;
            for (let i = currentSectionIndex + 1; i < sections.length; i++) {
                if (!sectionDone[i]) { nextIdx = i; break; }
            }
            if (nextIdx === -1) {
                for (let i = 0; i < currentSectionIndex; i++) {
                    if (!sectionDone[i]) { nextIdx = i; break; }
                }
            }
            if (nextIdx === -1) autoSubmit();
            else switchSection(nextIdx, true);
        }

        // ---------------- PALETTE ----------------
        function paletteButtonHTML(i, displayNo) {
            const s = statusFor(i);
            const classes = {
                notVisited: "border-slate-300 text-slate-600 bg-white",
                notAnswered: "bg-red-500 text-white border-red-500",
                answered: "bg-green-500 text-white border-green-500",
                review: "bg-indigo-600 text-white border-indigo-600",
                markedAnswered: "bg-indigo-600 text-white border-indigo-600 ring-2 ring-green-400",
            }[s];
            const activeRing = i === current ? "ring-2 ring-offset-1 ring-blue-400" : "";
            return `<button type="button" class="palette-btn aspect-square rounded-lg border text-xs font-bold flex items-center justify-center ${classes} ${activeRing}" data-qidx="${i}">${displayNo}</button>`;
        }

        function updatePalette() {
            let html = "";
            let localNo = 0;
            questions.forEach((_, i) => {
                if (HAS_SUBJECT_TABS && state[i].sectionIndex !== currentSectionIndex) return;
                localNo++;
                const displayNo = HAS_SUBJECT_TABS ? localNo : i + 1;
                html += paletteButtonHTML(i, displayNo);
            });
            if (paletteGrid) paletteGrid.innerHTML = html;
            if (paletteGridMobile) paletteGridMobile.innerHTML = html;
            updateCounters();
        }

        function updateCounters() {
            let answered = 0, notAnswered = 0, notVisited = 0, review = 0, markedAnswered = 0;
            questions.forEach((_, i) => {
                const s = statusFor(i);
                if (s === "answered") answered++;
                else if (s === "notAnswered") notAnswered++;
                else if (s === "notVisited") notVisited++;
                else if (s === "review") review++;
                else if (s === "markedAnswered") markedAnswered++;
            });
            if (cntAnswered) cntAnswered.textContent = answered;
            if (cntNotAnswered) cntNotAnswered.textContent = notAnswered;
            if (cntNotVisited) cntNotVisited.textContent = notVisited;
            if (cntReview) cntReview.textContent = review;
            if (cntMarkedAnswered) cntMarkedAnswered.textContent = markedAnswered;
            if (cntAnsweredM) cntAnsweredM.textContent = answered;
            if (cntNotAnsweredM) cntNotAnsweredM.textContent = notAnswered;
        }

        [paletteGrid, paletteGridMobile].forEach((grid) => {
            grid && grid.addEventListener("click", (e) => {
                const btn = e.target.closest(".palette-btn");
                if (!btn) return;
                goto(Number(btn.dataset.qidx));
            });
        });

        // ---------------- MOBILE PALETTE DRAWER ----------------
        function openMobilePalette() {
            document.getElementById("mobilePaletteOverlay")?.classList.remove("hidden");
            const d = document.getElementById("mobilePaletteDrawer");
            d && d.classList.remove("hidden");
            d && d.classList.add("flex");
        }
        function closeMobilePalette() {
            document.getElementById("mobilePaletteOverlay")?.classList.add("hidden");
            document.getElementById("mobilePaletteDrawer")?.classList.add("hidden");
        }
        function toggleMobilePalette() {
            const overlay = document.getElementById("mobilePaletteOverlay");
            if (!overlay) return;
            overlay.classList.contains("hidden") ? openMobilePalette() : closeMobilePalette();
        }

        // ---------------- FULLSCREEN ----------------
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
                document.exitFullscreen?.();
            }
        }
        document.addEventListener("fullscreenchange", () => {
            const btn = document.getElementById("fsToggleBtn");
            if (!btn) return;
            const label = btn.querySelector("span");
            if (label) label.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
            btn.title = document.fullscreenElement ? "Exit Fullscreen" : "Enter Fullscreen";
        });

        // ---------------- MODALS ----------------
        function showModal(id) { document.getElementById(id)?.classList.remove("hidden"); }
        function hideModal(id) { document.getElementById(id)?.classList.add("hidden"); }

        function renderBreakdown() {
            const bySubject = {};
            questions.forEach((q, i) => {
                const subj = q.subject || "General";
                if (!bySubject[subj]) bySubject[subj] = { qs: 0, answered: 0, notAnswered: 0, marked: 0, notVisited: 0 };
                const s = statusFor(i);
                const b = bySubject[subj];
                b.qs++;
                if (s === "answered") b.answered++;
                else if (s === "notAnswered") b.notAnswered++;
                else if (s === "notVisited") b.notVisited++;
                else if (s === "review") b.marked++;
                else if (s === "markedAnswered") { b.marked++; b.answered++; }
            });

            submitBreakdownBody.innerHTML = Object.entries(bySubject).map(([subj, c]) => `
                <tr class="border-t">
                    <td class="py-2.5 px-4 font-medium text-slate-700">${escapeHtml(subj)}</td>
                    <td class="py-2.5 px-4 text-center">${c.qs}</td>
                    <td class="py-2.5 px-4 text-center text-green-600 font-semibold">${c.answered}</td>
                    <td class="py-2.5 px-4 text-center text-red-600 font-semibold">${c.notAnswered}</td>
                    <td class="py-2.5 px-4 text-center text-indigo-600 font-semibold">${c.marked}</td>
                    <td class="py-2.5 px-4 text-center text-slate-400">${c.notVisited}</td>
                </tr>`).join("");
        }

        function openSubmitModal() { renderBreakdown(); showModal("submitModal"); }
        function closeSubmitModalFn() { hideModal("submitModal"); }

        // ---------------- TIMER ----------------
        let secondsLeft = 0;
        let timeLimitSeconds = 0;
        let timerHandle = null;

        if (!HAS_SUBJECT_TABS) {
            const timeLimitMin = Number(cfg.timeLimit) || Math.max(10, Math.round(total * 0.75));
            secondsLeft = Math.max(60, Math.round(timeLimitMin * 60));
            timeLimitSeconds = secondsLeft;
        }

        function formatTime(s) {
            const m = Math.floor(s / 60), sec = s % 60;
            return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
        }

        function currentSecondsLeft() {
            return HAS_SUBJECT_TABS ? sectionTimeLeft[currentSectionIndex] : secondsLeft;
        }

        function updateTimerDisplay() {
            const secs = currentSecondsLeft();
            timerDisplay.textContent = formatTime(secs);
            timerDisplay.classList.toggle("text-red-600", secs <= 60);
            if (timerLabel) {
                timerLabel.textContent = HAS_SUBJECT_TABS
                    ? (sections[currentSectionIndex].label.toUpperCase() + " SECTION TIME")
                    : "TIME LEFT";
            }
        }

        function startTimerForCurrentContext() {
            if (timerHandle) clearInterval(timerHandle);
            updateTimerDisplay();
            timerHandle = setInterval(tick, 1000);
        }

        function tick() {
            if (HAS_SUBJECT_TABS) {
                sectionTimeLeft[currentSectionIndex]--;
                if (sectionTimeLeft[currentSectionIndex] <= 0) {
                    sectionTimeLeft[currentSectionIndex] = 0;
                    sectionDone[currentSectionIndex] = true;
                    updateSubjectTabsState();
                    clearInterval(timerHandle);
                    goToNextIncompleteSection();
                    return;
                }
            } else {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    secondsLeft = 0;
                    updateTimerDisplay();
                    clearInterval(timerHandle);
                    autoSubmit();
                    return;
                }
            }
            updateTimerDisplay();
        }

        // ---------------- SCORING ----------------
        function computeResult() {
            let score = 0, totalMarks = 0, attempted = 0, correct = 0, wrong = 0;
            const perQuestion = [];
            const bySubject = {};

            questions.forEach((q, i) => {
                const disp = getDisplay(q);
                const st = state[i];
                const pos = Number(q.marks) || 1;
                const neg = Number(q.negativeMarks) || 0;
                totalMarks += pos;
                const answered = hasAnswerFor(i);
                let isCorrect = false;

                if (answered) {
                    attempted++;
                    if (q.type === "integer") {
                        isCorrect = Math.abs(Number(st.numericValue) - Number(q.numericAnswer)) < 1e-6;
                    } else if (q.type === "multiple") {
                        const sel = (st.selected || []).slice().sort((a, b) => a - b);
                        const corr = (q.correctAnswers || []).slice().sort((a, b) => a - b);
                        isCorrect = sel.length === corr.length && sel.every((v, idx) => v === corr[idx]);
                    } else {
                        isCorrect = Array.isArray(q.correctAnswers) && q.correctAnswers.includes(st.selected);
                    }
                    if (isCorrect) { score += pos; correct++; }
                    else { score -= neg; wrong++; }
                }

                const subj = q.subject || "General";
                if (!bySubject[subj]) bySubject[subj] = { total: 0, correct: 0, wrong: 0, skipped: 0 };
                bySubject[subj].total++;
                if (!answered) bySubject[subj].skipped++;
                else if (isCorrect) bySubject[subj].correct++;
                else bySubject[subj].wrong++;

               perQuestion.push({
    index: i, questionId: q._id, subject: q.subject, topic: q.topic, difficulty: q.difficulty,
    type: q.type || "mcq",
    selected: st.selected, numericValue: st.numericValue,
    correctAnswers: q.correctAnswers, numericAnswer: q.numericAnswer,
    answered, isCorrect, marks: pos, negativeMarks: neg,
    questionText: disp.question,
    questionImage: disp.questionImage || null,
    options: disp.options || [],
    solutionText: (q.solution && (q.solution.text || q.solution.explanation)) || "",
    solutionImage: (q.solution && q.solution.image) || null,
});
            });

            const totalTimeSpent = HAS_SUBJECT_TABS
                ? sections.reduce((sum, sec, i) => sum + (sec.durationMinutes * 60 - (sectionTimeLeft[i] ?? sec.durationMinutes * 60)), 0)
                : Math.max(0, timeLimitSeconds - secondsLeft);

            const totalTimeLimitSeconds = HAS_SUBJECT_TABS
                ? sections.reduce((sum, sec) => sum + sec.durationMinutes * 60, 0)
                : timeLimitSeconds;

            return {
                paperId,
                language: lang || "English",
                generatedAt: paper.createdAt,
                submittedAt: Date.now(),
                score, totalMarks, totalQuestions: total,
                attempted, correct, wrong,
                accuracy: attempted ? Math.round((correct / attempted) * 1000) / 10 : 0,
                timeTakenSeconds: totalTimeSpent,
                timeLimitSeconds: totalTimeLimitSeconds,
                bySubject, perQuestion,
                config: paper.config,
            };
        }

        function finalizeSubmit() {
            closeSubmitModalFn();
            submitted = true;
            clearAllowed();
            clearInterval(timerHandle);
            const result = computeResult();
            try { localStorage.setItem(RESULT_KEY_PREFIX + paperId, JSON.stringify(result)); } catch (_) {}
            addToHistory(result);

            if (TIER === "pro" || TIER === "promax") {
                fetch(`/api/custom-test/attempt/${paperId}/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(result),
                }).catch((e) => console.error("Attempt DB save failed:", e));
            }

            showModal("successModal");
        }

        function autoSubmit() {
            if (submitted) return;
            submitted = true;
            clearAllowed();
            clearInterval(timerHandle);
            const result = computeResult();
            try { localStorage.setItem(RESULT_KEY_PREFIX + paperId, JSON.stringify(result)); } catch (_) {}
            addToHistory(result);

            if (TIER === "pro" || TIER === "promax") {
                fetch(`/api/custom-test/attempt/${paperId}/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(result),
                }).catch((e) => console.error("Attempt DB save failed:", e));
            }

            showModal("autoSubmitToast");
        }

        function addToHistory(result) {
            const HISTORY_KEY = "wue:customPaper:history";
            try {
                let list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
                if (!Array.isArray(list)) list = [];
                list = list.filter((p) => p.paperId !== paperId); // reattempt = purana entry hatao
                const cfg2 = paper.config || {};
                const scorePercent = result.totalMarks > 0
                    ? Math.max(0, Math.round((result.score / result.totalMarks) * 100))
                    : 0;
                                list.unshift({
                    paperId,
                    source: paper.source || (cfg2.mode === "ai" ? "ai" : "manual"),
                    exam: (cfg2.exams || []).join(", "),
                    topic: (cfg2.subjects || []).join(", "),
                    questionCount: result.totalQuestions,
                    scorePercent,
                    completedOn: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                });
                localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
            } catch (_) {}
        }

        // ---------------- BACK / EXIT GUARD ----------------
        let guardPushed = false;
        let leaving = false;

        function hasPreviousPage() {
            return history.length > 2;
        }

        function leaveToStart() {
            leaving = true;
            submitted = true;
            clearAllowed();
            if (guardPushed && hasPreviousPage()) {
                history.go(-2);
            } else {
                window.location.replace(returnUrl);
            }
        }

        try { history.pushState({ wuePaperGuard: true }, "", location.href); guardPushed = true; } catch (_) {}

        window.addEventListener("popstate", () => {
            if (leaving) return;
            if (submitted) {
                leaving = true;
                if (hasPreviousPage()) history.back();
                else window.location.replace(returnUrl);
                return;
            }
            try { history.pushState({ wuePaperGuard: true }, "", location.href); } catch (_) {}
            showModal("backConfirmModal");
        });

        window.addEventListener("beforeunload", (e) => {
            if (submitted) return;
            e.preventDefault();
            e.returnValue = "";
        });

        // ---------------- CLICK DISPATCH ----------------
        document.addEventListener("click", (e) => {
            if (e.target.closest('[data-action="prev-question"]')) { if (current > 0) goto(current - 1); return; }
            if (e.target.closest('[data-action="save-and-next"]')) { saveAndNext(); return; }
            if (e.target.closest('[data-action="mark-for-review"]')) { markForReview(); return; }
            if (e.target.closest('[data-action="clear-response"]')) { clearResponse(); return; }
            if (e.target.closest('[data-action="confirm-submit"]')) { openSubmitModal(); return; }
            if (e.target.closest('[data-action="close-submit-modal"]')) { closeSubmitModalFn(); return; }
            if (e.target.closest('[data-action="submit-test-manual"]')) { finalizeSubmit(); return; }
            if (e.target.closest('[data-action="close-success-modal"]')) { leaveToStart(); return; }
            if (e.target.closest('[data-action="continue-test"]')) { hideModal("backConfirmModal"); return; }
            if (e.target.closest('[data-action="exit-test"]')) { leaveToStart(); return; }
            if (e.target.closest('[data-action="toggle-fullscreen"]')) { toggleFullscreen(); return; }
            if (e.target.closest('[data-action="toggle-mobile-palette"]')) { toggleMobilePalette(); return; }
        });

        // ---------------- INIT ----------------
        if (HAS_SUBJECT_TABS) renderSubjectTabs();
        startTimerForCurrentContext();
        renderQuestion();
    }
})();