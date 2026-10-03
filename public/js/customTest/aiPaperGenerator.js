(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch (_) {} };
    const BASE = window.location.pathname.startsWith("/dashboard") ? "/dashboard" : "";

    let currentStep = 1;
    const TOTAL_STEPS = 3;
        const TIER = window.CUSTOM_TEST_TIER || "free";

    const state = {
        sourceType: null,      // images | pdf | text
        files: [],
        pastedText: "",
        paperName: "",
        questionCount: null,
        timeLimit: null,
        mode: "extract",                        // extract | generate
        difficulty: { easy: 25, medium: 50, hard: 25 },
    };



        /* ---------------- MODE (Extract / Generate) ---------------- */
    const DIFF_PRESETS = {
        easy:   { easy: 100, medium: 0,   hard: 0 },
        medium: { easy: 0,   medium: 100, hard: 0 },
        hard:   { easy: 0,   medium: 0,   hard: 100 },
        mixed:  { easy: 25,  medium: 50,  hard: 25 },
    };
    
    const setTxt = (id, t) => { const el = $(id); if (el) el.textContent = t; };
    const diffTotal = () => state.difficulty.easy + state.difficulty.medium + state.difficulty.hard;

    const MODE_TEXT = {
        extract: {
            sub: "Select how you want to import your questions.",
            images: "Clear images of your questions (JPG, PNG, WEBP).",
            text: "Paste your questions directly.",
            placeholder: "Paste your questions here...",
            genTitle: "Ready to generate your paper",
            genDesc: "The AI will extract questions from your source, identify the answers, and generate solutions.",
            countHint: "Max questions depend on how many your source contains.",
        },
        generate: {
            sub: "Upload your chapter or notes. AI will study it and create new questions.",
            images: "Clear photos of your chapter / notes (JPG, PNG, WEBP).",
            text: "Paste your chapter or notes.",
            placeholder: "Paste your chapter text here...",
            genTitle: "Ready to create your paper",
            genDesc: "The AI will study your chapter, understand the key concepts, and create new exam-style questions.",
            countHint: "AI will create this many new questions from your chapter (within your plan limit).",
        },
    };

    function setMode(mode) {
        state.mode = mode;
        document.querySelectorAll("[data-mode-card]").forEach((c) => {
    const on = c.dataset.modeCard === mode;
    c.classList.toggle("is-active", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
});

        const t = MODE_TEXT[mode];
        setTxt("ai-src-sub", t.sub);
        setTxt("ai-src-images-desc", t.images);
        setTxt("ai-src-text-desc", t.text);
        setTxt("ai-gen-title", t.genTitle);
        setTxt("ai-gen-desc", t.genDesc);
        setTxt("ai-count-hint", t.countHint);
        $("ai-text-input")?.setAttribute("placeholder", t.placeholder);
        $("ai-tip-box")?.classList.toggle("hidden", mode === "generate");
        $("ai-difficulty-block")?.classList.toggle("hidden", mode !== "generate");
        $("ai-tip-box-generate")?.classList.toggle("hidden", mode !== "generate");
        $("ai-tip-box-generate")?.classList.toggle("flex", mode === "generate");
        validateStep();
    }

        function setDiffTab(tab) {
        const quick = tab === "quick";
        $("ai-diff-quick")?.classList.toggle("hidden", !quick);
        $("ai-diff-custom")?.classList.toggle("hidden", quick);
        [["ai-diff-tab-quick", quick], ["ai-diff-tab-custom", !quick]].forEach(([id, on]) => {
            const el = $(id);
            if (!el) return;
            el.classList.toggle("bg-white", on);
            el.classList.toggle("text-indigo-700", on);
            el.classList.toggle("shadow-sm", on);
            el.classList.toggle("text-slate-500", !on);
        });
    }

    function selectQuick(key) {
        document.querySelectorAll(".ai-diff-quick-btn").forEach((b) => {
            const on = b.dataset.quick === key;
            ["border-indigo-400", "ring-2", "ring-indigo-100"].forEach((k) => b.classList.toggle(k, on));
            const chk = b.querySelector(".ai-diff-quick-check");
            if (chk) { chk.classList.toggle("hidden", !on); chk.style.display = on ? "flex" : ""; }
        });
        state.difficulty = { ...DIFF_PRESETS[key] };
        validateStep();
        icons();
    }

    function syncSliders() {
        document.querySelectorAll(".ai-diff-slider").forEach((s) => {
            s.value = state.difficulty[s.dataset.level];
            const p = document.querySelector(`[data-ai-pct="${s.dataset.level}"]`);
            if (p) p.textContent = s.value + "%";
        });
        const tot = diffTotal();
        setTxt("ai-diff-total", tot + "%");
        $("ai-diff-warn")?.classList.toggle("hidden", tot === 100);
        validateStep();
    }

    document.querySelectorAll("[data-mode-card]").forEach((c) =>
        c.addEventListener("click", () => setMode(c.dataset.modeCard)));

    $("ai-diff-tab-quick")?.addEventListener("click", () => { setDiffTab("quick"); selectQuick("mixed"); });
    $("ai-diff-tab-custom")?.addEventListener("click", () => {
        if (TIER === "free") {
            window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
            return;
        }
        setDiffTab("custom");
        syncSliders();
    });

    document.querySelectorAll(".ai-diff-quick-btn").forEach((b) =>
        b.addEventListener("click", () => selectQuick(b.dataset.quick)));

    document.querySelectorAll(".ai-diff-slider").forEach((s) => s.addEventListener("input", () => {
        state.difficulty[s.dataset.level] = Number(s.value);
        const p = document.querySelector(`[data-ai-pct="${s.dataset.level}"]`);
        if (p) p.textContent = s.value + "%";
        const tot = diffTotal();
        setTxt("ai-diff-total", tot + "%");
        $("ai-diff-warn")?.classList.toggle("hidden", tot === 100);
        validateStep();
    }));

    const CUSTOM_PRESETS = {
        balanced: { easy: 25, medium: 50, hard: 25 },
        easy:     { easy: 50, medium: 30, hard: 20 },
        hard:     { easy: 20, medium: 30, hard: 50 },
    };
    
     document.querySelectorAll(".ai-preset-btn").forEach((b) => b.addEventListener("click", () => {
        state.difficulty = { ...CUSTOM_PRESETS[b.dataset.preset] };
        syncSliders();
    }));


    const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || "";

    // ---------------- PDF lock visual (Free tier) ----------------
    if (TIER === "free") {
        const pdfBtn = $("ai-pdf-source-btn");
        if (pdfBtn) {
            pdfBtn.classList.add("opacity-60");
            $("ai-pdf-lock-badge")?.classList.remove("hidden");
        }
    }

    // ---------------- Char counter on paste-text ----------------
    
    let maxChars = 5000;

    const textInput = $("ai-text-input");
    if (textInput) {
        textInput.setAttribute("maxlength", maxChars);
        const counter = document.createElement("p");
        counter.id = "ai-text-counter";
        counter.className = "text-[11px] text-slate-400 mt-1 text-right";
        counter.textContent = `0 / ${maxChars} characters`;
        textInput.insertAdjacentElement("afterend", counter);

        textInput.addEventListener("input", () => {
            counter.textContent = `${textInput.value.length} / ${maxChars} characters`;
            counter.classList.toggle("text-rose-500", textInput.value.length >= maxChars);
        });
    }

    // ---------------- Image count limit on file select ----------------
    let maxImages = 1;
    /* ---------------- INIT (page load par step 1 dikhao) ---------------- */
    function resetWizard() {
        currentStep = 1;
        state.sourceType = null;
        state.files = [];
        state.pastedText = "";
        state.paperName = "";
        state.questionCount = null;
        state.timeLimit = null;

        document.querySelectorAll(".ai-source-btn").forEach((b) => b.classList.remove("border-indigo-400", "ring-2", "ring-indigo-100", "bg-indigo-50/40"));
        document.querySelectorAll(".ai-count-btn, .ai-time-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
        $("ai-file-block")?.classList.add("hidden");
        $("ai-text-block")?.classList.add("hidden");
        $("ai-file-chosen")?.classList.add("hidden");
        $("ai-custom-count")?.classList.add("hidden");
        $("ai-custom-time")?.classList.add("hidden");
        if ($("ai-text-input")) $("ai-text-input").value = "";
        if ($("ai-paper-name")) $("ai-paper-name").value = "";
        $("ai-pre-generate")?.classList.remove("hidden");
        $("ai-processing")?.classList.add("hidden");
        goToStep(1);
    }

    /* ---------------- STEP NAV ---------------- */
    function goToStep(n) {
        currentStep = n;
        document.querySelectorAll(".ai-step-panel").forEach((p) => p.classList.add("hidden"));
        $(`ai-step-${n}`)?.classList.remove("hidden");

        document.querySelectorAll(".ai-step-pill").forEach((pill) => {
            const s = Number(pill.dataset.step);
            pill.classList.toggle("active", s === n);
            pill.classList.toggle("done", s < n);
        });

        $("ai-back-btn")?.classList.toggle("invisible", n === 1);

        const nextBtn = $("ai-next-btn");
        if (nextBtn) {
            if (n === TOTAL_STEPS) {
                nextBtn.style.display = "none";
            } else {
                nextBtn.style.display = "inline-flex";
            }
        }
        validateStep();
        icons();
    }

    function validateStep() {
        const nextBtn = $("ai-next-btn");
        if (!nextBtn) return;
        let valid = false;
        if (currentStep === 1) {
            valid = !!state.sourceType && (
                (state.sourceType === "text" && state.pastedText.trim().length > 0) ||
                (state.sourceType !== "text" && state.files.length > 0)
            );
                } else if (currentStep === 2) {
            valid = !!state.questionCount && !!state.timeLimit &&
                (state.mode !== "generate" || diffTotal() === 100);
        } else {
            valid = true;
        }
        nextBtn.disabled = !valid;
        nextBtn.classList.toggle("opacity-50", !valid);
        nextBtn.classList.toggle("cursor-not-allowed", !valid);
    }

    $("ai-back-btn")?.addEventListener("click", () => { if (currentStep > 1) goToStep(currentStep - 1); });
    $("ai-next-btn")?.addEventListener("click", () => { if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1); });

    /* ---------------- STEP 1: SOURCE ---------------- */
    document.querySelectorAll(".ai-source-btn").forEach((btn) => {
        btn.addEventListener("click", () => {

             if (btn.dataset.locked === "true") {
                showLimitModal(btn.dataset.lockMsg, quota && quota.resetAt);
                return;
            }

            if (btn.dataset.source === "pdf" && TIER === "free") {
                window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
                return;
            }

            document.querySelectorAll(".ai-source-btn").forEach((b) => b.classList.remove("border-indigo-400", "ring-2", "ring-indigo-100", "bg-indigo-50/40"));
            btn.classList.add("border-indigo-400", "ring-2", "ring-indigo-100", "bg-indigo-50/40");

            state.sourceType = btn.dataset.source;
            state.files = [];
            state.pastedText = "";

            $("ai-file-block")?.classList.toggle("hidden", state.sourceType === "text");
            $("ai-text-block")?.classList.toggle("hidden", state.sourceType !== "text");
            $("ai-file-chosen")?.classList.add("hidden");

            const input = $("ai-file-input");
            if (input) {
                input.value = "";
                input.multiple = state.sourceType === "images";
                input.accept = state.sourceType === "images" ? "image/*" : "application/pdf";
            }
            if ($("ai-file-label")) $("ai-file-label").textContent = state.sourceType === "images" ? "Click to choose image(s)" : "Click to choose PDF file";

            validateStep();
        });
    });

    $("ai-file-trigger")?.addEventListener("click", () => $("ai-file-input")?.click());
    $("ai-file-input")?.addEventListener("change", (e) => {
        let files = Array.from(e.target.files || []);
        if (state.sourceType === "images" && files.length > maxImages) {
            showToast(`Your plan allows a maximum of ${maxImages} image(s) per request.`, "error");
            files = files.slice(0, maxImages);
        }
        state.files = files;
        const chosen = $("ai-file-chosen");
        if (chosen) {
            if (state.files.length) {
                chosen.querySelector("span").textContent = state.files.map((f) => f.name).join(", ");
                chosen.classList.remove("hidden");
            } else {
                chosen.classList.add("hidden");
            }
        }
        validateStep();
    });

    $("ai-text-input")?.addEventListener("input", (e) => {
        state.pastedText = e.target.value;
        validateStep();
    });

    /* ---------------- STEP 2: COUNT / TIME ---------------- */
    document.querySelectorAll(".ai-count-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".ai-count-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
            btn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
            if (btn.dataset.count === "custom") {
                $("ai-custom-count")?.classList.remove("hidden");
                $("ai-custom-count")?.focus();
                state.questionCount = null;
            } else {
                $("ai-custom-count")?.classList.add("hidden");
                state.questionCount = Number(btn.dataset.count);
            }
            validateStep();
        });
    });
    $("ai-custom-count")?.addEventListener("input", (e) => {
        state.questionCount = Number(e.target.value) || null;
        validateStep();
    });

    document.querySelectorAll(".ai-time-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".ai-time-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
            btn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
            if (btn.dataset.time === "custom") {
                $("ai-custom-time")?.classList.remove("hidden");
                $("ai-custom-time")?.focus();
                state.timeLimit = null;
            } else {
                $("ai-custom-time")?.classList.add("hidden");
                state.timeLimit = Number(btn.dataset.time);
            }
            validateStep();
        });
    });
    $("ai-custom-time")?.addEventListener("input", (e) => {
        state.timeLimit = Number(e.target.value) || null;
        validateStep();
    });

    $("ai-paper-name")?.addEventListener("input", (e) => { state.paperName = e.target.value; });

    /* ---------------- STEP 3: PROCESSING ANIMATION ---------------- */
        const EXTRACT_STEPS = [
        "Extracting questions from document",
        "Detecting correct answers",
        "Generating solutions",
        "Identifying subject & topic",
        "Setting difficulty level",
        "Validating questions & checking duplicates",
    ];
    const GENERATE_STEPS = [
        "Reading your chapter",
        "Identifying key concepts & important points",
        "Designing questions in exam pattern",
        "Creating options & verifying answers",
        "Balancing difficulty & question types",
        "Validating questions & checking duplicates",
    ];
    let CHECKLIST_STEPS = EXTRACT_STEPS;

    function renderChecklist() {
        const box = $("ai-checklist");
        if (!box) return;
        box.innerHTML = CHECKLIST_STEPS.map((label, i) => `
            <div class="ai-check-row flex items-center gap-2.5" data-idx="${i}">
                <span class="ai-check-icon w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center shrink-0"></span>
                <div class="min-w-0">
                    <p class="ai-check-label text-xs font-medium text-slate-400">${label}</p>
                </div>
            </div>`).join("");
    }

    function setChecklistState(idx, status) {
        const row = document.querySelector(`.ai-check-row[data-idx="${idx}"]`);
        if (!row) return;
        const icon = row.querySelector(".ai-check-icon");
        const label = row.querySelector(".ai-check-label");
        if (status === "done") {
            icon.className = "ai-check-icon w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0";
            icon.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i>`;
            label.className = "ai-check-label text-xs font-medium text-slate-700";
        } else if (status === "active") {
            icon.className = "ai-check-icon w-5 h-5 rounded-full bg-indigo-100 border-2 border-indigo-500 flex items-center justify-center shrink-0 animate-pulse";
            label.className = "ai-check-label text-xs font-semibold text-indigo-600";
        }
        icons();
    }

    function setProgressRing(pct) {
        const ring = $("ai-progress-ring");
        if (!ring) return;
        const circumference = 264;
        const offset = circumference - (pct / 100) * circumference;
        ring.style.strokeDashoffset = offset;
    }

    $("ai-generate-trigger")?.addEventListener("click", runProcessingAnimation);
 
    let quota = null;

    function fmtReset(resetAt) {
        const d = resetAt ? new Date(resetAt) : (() => { const t = new Date(); t.setHours(24, 0, 0, 0); return t; })();
        return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
    }

    function showLimitModal(message, resetAt) {
        ensureLimitModal();
        $("ai-limit-modal-msg").textContent = message || "You've reached your daily limit.";
        $("ai-limit-modal-time").textContent = fmtReset(resetAt || (quota && quota.resetAt));
        $("ai-limit-modal")?.classList.remove("hidden");
        icons();
    }

    function applyLimits(l) {
        if (!l) return;
        maxChars = l.textCharsPerRequest;
        maxImages = l.imagesPerRequest;
        const ti = $("ai-text-input");
        if (ti) ti.setAttribute("maxlength", maxChars);
        const c = $("ai-text-counter");
        if (c && ti) c.textContent = `${ti.value.length} / ${maxChars} characters`;
    }

    function lockSource(source, tip, modalMsg) {
        document.querySelectorAll(`.ai-source-btn[data-source="${source}"]`).forEach((btn) => {
            btn.dataset.locked = "true";
            btn.dataset.lockMsg = modalMsg;
            btn.setAttribute("aria-disabled", "true");
            btn.title = tip;
            btn.classList.add("relative", "group", "opacity-50", "cursor-not-allowed");
            if (!btn.querySelector(".ai-lock-tip")) {
                const el = document.createElement("span");
                el.className = "ai-lock-tip pointer-events-none absolute -top-10 left-1/2 z-30 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-center text-[11px] font-medium text-white shadow-lg group-hover:block";
                el.textContent = tip;
                btn.appendChild(el);
            }
        });
    }

    function showBlockedScreen(d) {
        if ($("ai-blocked-screen")) return;
        const reason = d.locks.allReason === "questions"
            ? `You've generated ${d.questionsUsed} of ${d.questionsLimit} questions today.`
            : `You've used ${d.apiCallsUsed} of ${d.apiCallsLimit} AI requests today.`;
        const wrap = document.createElement("div");
        wrap.id = "ai-blocked-screen";
        wrap.className = "fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4";
        wrap.innerHTML = `
            <div class="w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 text-center shadow-2xl">
                <span class="mx-auto mb-4 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                    <i data-lucide="hourglass" class="h-6 w-6 sm:h-7 sm:w-7"></i>
                </span>
                <p class="text-base sm:text-lg font-bold text-slate-900 mb-2">Daily limit reached</p>
                <p class="text-sm text-slate-500 leading-relaxed mb-1">${reason}</p>
                <p class="text-sm font-semibold text-indigo-600 mb-6">Access resets on ${fmtReset(d.resetAt)}</p>
                <a href="${BASE}/custom-test" class="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98]">Back to Custom Test</a>
            </div>`;
        document.body.appendChild(wrap);
        icons();
    }

    async function applyQuotaState() {
        try {
            const res = await fetch("/api/custom-test/ai/usage", { credentials: "same-origin" });
            const data = await res.json();
            if (!data.success) return;
            quota = data;
            applyLimits(data.limits);

            if (data.locks.all) { showBlockedScreen(data); return; }

            const tip = `Daily limit reached · Resets ${fmtReset(data.resetAt)}`;
            if (data.locks.text) lockSource("text", tip, `You've used today's text limit (${data.textCharsUsed.toLocaleString()} / ${data.textCharsLimit.toLocaleString()} characters).`);
            if (data.locks.images) lockSource("images", tip, `You've used today's image limit (${data.imagesUsed} / ${data.imagesLimit}).`);
            if (data.locks.pdf) lockSource("pdf", tip, `You've used today's PDF limit (${data.pdfMBUsed} / ${data.pdfMBLimit} MB).`);
        } catch (_) {}
    }

    function ensureLimitModal() {
        if ($("ai-limit-modal")) return;
        const div = document.createElement("div");
        div.innerHTML = `
        <div id="ai-limit-modal" class="hidden fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center">
                <span class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                    <i data-lucide="hourglass" class="h-6 w-6"></i>
                </span>
                <p class="text-base font-bold text-slate-900 mb-2">Daily limit reached</p>
                <p id="ai-limit-modal-msg" class="text-sm text-slate-500 leading-relaxed mb-1"></p>
                <p class="text-sm font-semibold text-indigo-600 mb-6">Resets at <span id="ai-limit-modal-time"></span></p>
                <button type="button" id="ai-limit-modal-close" class="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition active:scale-[0.98]">Got it</button>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        $("ai-limit-modal-close")?.addEventListener("click", () => $("ai-limit-modal")?.classList.add("hidden"));
        icons();
    }

     

    function ensureErrorModal() {
        if ($("ai-error-modal")) return;
        const div = document.createElement("div");
        div.innerHTML = `
        <div id="ai-error-modal" class="hidden fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center">
                <span class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                    <i data-lucide="triangle-alert" class="h-6 w-6"></i>
                </span>
                <p class="text-base font-bold text-slate-900 mb-2">Something went wrong</p>
                <p id="ai-error-modal-msg" class="text-sm text-slate-500 leading-relaxed mb-6"></p>
                <button type="button" id="ai-error-modal-close" class="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition active:scale-[0.98]">Try again</button>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
        $("ai-error-modal-close")?.addEventListener("click", () => $("ai-error-modal")?.classList.add("hidden"));
        icons();
    }

    function showErrorModal(message) {
        ensureErrorModal();
        $("ai-error-modal-msg").textContent = message;
        $("ai-error-modal")?.classList.remove("hidden");
        icons();
    }


    async function runProcessingAnimation() {
                CHECKLIST_STEPS = state.mode === "generate" ? GENERATE_STEPS : EXTRACT_STEPS;
        $("ai-pre-generate")?.classList.add("hidden");
        $("ai-processing")?.classList.remove("hidden");
        renderChecklist();
        setProgressRing(0);

        let i = 0;
        const tick = setInterval(() => {
            if (i < CHECKLIST_STEPS.length - 1) {
                if (i > 0) setChecklistState(i - 1, "done");
                setChecklistState(i, "active");
                setProgressRing(Math.round((i / CHECKLIST_STEPS.length) * 90));
                i++;
            }
        }, 900);

        try {
            const formData = new FormData();
            formData.append("sourceType", state.sourceType);
            formData.append("questionCount", state.questionCount);
            formData.append("timeLimit", state.timeLimit);
            formData.append("paperName", state.paperName || "AI Generated Paper");
            formData.append("mode", state.mode);

            if (state.mode === "generate") formData.append("difficulty", JSON.stringify(state.difficulty));

            if (state.sourceType === "text") {
                formData.append("pastedText", state.pastedText);
            } else {
                state.files.forEach((f) => formData.append("files", f));
            }

            const res = await fetch("/api/custom-test/ai/generate", {
    method: "POST",
    headers: { "x-csrf-token": CSRF },
    body: formData,
});
            const data = await res.json();

            clearInterval(tick);
            setChecklistState(CHECKLIST_STEPS.length - 1, "done");
            setProgressRing(100);

                        if (!data.success) {
                clearInterval(tick);
                $("ai-pre-generate")?.classList.remove("hidden");
                $("ai-processing")?.classList.add("hidden");

                if (data.error === "LIMIT_EXCEEDED" && data.daily) {
                    showLimitModal(data.message, data.resetAt);
                    applyQuotaState();
                } else {
                    showErrorModal(data.message || "Failed to generate the paper.");
                }
                return;
            }

            if (TIER === "free") {
                const paper = {
                    id: data.paperId,
                    source: "ai",
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                    config: {
                        exams: [data.paperName], subjects: [], topics: [],
                        questionCount: data.delivered, timeLimit: data.timeLimit,
                        timeStrategy: "total", language: "English", mode: "ai",
                    },
                    questions: data.questions,
                };
                try {
                    localStorage.setItem("wue:customPaper:list", JSON.stringify([paper]));
                } catch (_) {}
            }
           

            setTimeout(() => { window.location.href = `${BASE}/custom-test`; }, 500);
        } catch (err) {
            clearInterval(tick);
            console.error(err);
            showToast("Something went wrong. Please try again.", "error");
            $("ai-pre-generate")?.classList.remove("hidden");
            $("ai-processing")?.classList.add("hidden");
        }
    }


 



     /* ---------------- BOOT ---------------- */
    resetWizard();
  setMode("extract");
  setDiffTab("quick");
  selectQuick("mixed");
  applyQuotaState();
})();