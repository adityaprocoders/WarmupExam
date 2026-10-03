(function () {
  "use strict";

  const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || "";
  const STORAGE_KEY = "customTest:wizardState:v1";
  const PAPER_KEY = "wue:customPaper:list";
  function getPaperTTL(tier) {
    if (tier === "pro") return 2 * 24 * 60 * 60 * 1000;   // 2 din
    if (tier === "promax") return 2 * 24 * 60 * 60 * 1000; // Pro+ ka paper bhi local hi hai — Pro jaisa hi rakh rahe
    return 24 * 60 * 60 * 1000;                            // free
  }
  const $ = (id) => document.getElementById(id);

  const wizardFlowEl = document.getElementById("wizard-flow");
  const TIER = wizardFlowEl?.dataset.tier || "free";
  const IS_PAID_TIER = TIER === "pro" || TIER === "promax";
  const FREE_MAX = 30;

  async function api(path, { method = "GET", body } = {}) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (method !== "GET") opts.headers["x-csrf-token"] = CSRF;
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.error && !data.message) throw new Error("Request failed: " + res.status);
  return data;
}

  function icons() {
    if (window.lucide) window.lucide.createIcons();
  }

  const state = {
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    categoryIconColor: null,
    exams: [],
    mode: null, 
    weakGroups: [],
weakSel: [], 
pattern: null,
topicSelections: {},
    subjects: [],
    subjectCounts: {},
    topics: [],
    topicGroups: [],
    difficultyMode: "mixed",
    difficulty: { easy: 25, medium: 50, hard: 25 },
    availability: { total: 0, byDifficulty: { easy: 0, medium: 0, hard: 0 } },
    questionCount: null,
    timeLimit: null,
    language: null,
    languages: ["English"],
  };

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function show(id) { $(id)?.classList.remove("hidden"); }
  function hide(id) { $(id)?.classList.add("hidden"); }

  /* =========================================================
     STEP-TAB WIZARD (left panel navigation)
     Only ONE step panel visible at a time — Back/Next moves
     between them. Right summary panel is untouched by this.
     ========================================================= */
 const BASE_STEPS = ["category", "exam", "mode"];
const MODE_STEPS = {
  custom:      ["subjects", "difficulty", "settings"],
  weakArea:    ["weakFocus", "difficulty", "settings"],
  examPattern: ["pattern", "difficulty", "settings"], 
};
const STEP_LABELS = {
  category: "Category", exam: "Exam", mode: "Mode", subjects: "Subjects",
  weakFocus: "Weak areas", pattern: "Pattern", difficulty: "Difficulty", settings: "Settings",
};
const STEP_PANELS = {
  category: "step-1", exam: "step-2", mode: "step-3", subjects: "step-4",
  difficulty: "step-5", settings: "step-6", weakFocus: "step-7", pattern: "step-8",
};
let STEPS = BASE_STEPS.slice();
let currentStepIndex = 0;
let maxUnlockedIndex = 0;

function rebuildSteps() { STEPS = [...BASE_STEPS, ...(MODE_STEPS[state.mode] || [])]; }
function unlock(key) {
  const i = STEPS.indexOf(key);
  if (i > -1) maxUnlockedIndex = Math.max(maxUnlockedIndex, i);
}

function stepValid(key) {
  switch (key) {
    case "category": return !!state.categoryId;
    case "exam": return state.exams.length > 0;
    case "mode": return !!state.mode;
    case "pattern": return !!state.pattern;
    case "subjects": return state.subjects.length > 0;
    case "weakFocus": return state.subjects.length > 0
    case "difficulty": {
  const diffTotal = state.difficulty.easy + state.difficulty.medium + state.difficulty.hard;
  if (state.mode === "examPattern") return diffTotal === 100;
  const countOk = !!state.questionCount && state.questionCount >= 1 && state.questionCount <= 200 &&
    (IS_PAID_TIER || state.questionCount <= FREE_MAX);
  return diffTotal === 100 && countOk;
}
    case "settings":
  if (state.mode === "examPattern") return !!state.language;
  return !!state.timeLimit && !!state.language;
  }
}

  function renderStepNav() {
    const nav = $("step-nav");
    if (!nav) return;
    nav.innerHTML = STEPS.map((key, i) => {
      const active = i === currentStepIndex;
      const completed = i < currentStepIndex && stepValid(key);
      const locked = i > maxUnlockedIndex;
      return `<button type="button" data-step-index="${i}"
          class="step-pill ${active ? "active" : ""} ${completed ? "completed" : ""} ${locked ? "locked" : ""}"
          ${locked ? "disabled" : ""}>
        <span class="step-pill-num">${completed ? '<i data-lucide="check" class="w-3 h-3"></i>' : i + 1}</span>
        <span class="step-pill-label">${STEP_LABELS[key]}</span>
      </button>`;
    }).join("");
    nav.querySelectorAll(".step-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.stepIndex);
        if (idx > maxUnlockedIndex) return;
        goToStep(idx);
      });
    });
    icons();
  }

function goToStep(index, opts) {
  const doScroll = !opts || opts.scroll !== false;
  currentStepIndex = Math.max(0, Math.min(index, STEPS.length - 1));
  const key = STEPS[currentStepIndex];
  Object.values(STEP_PANELS).forEach((id) => $(id)?.classList.add("hidden"));
  $(STEP_PANELS[key])?.classList.remove("hidden");
  if (key === "difficulty") toggleQuestionCountBlock();
  if (key === "settings") renderExamPatternTiming();
  updateStepButtons();
  renderStepNav();

  if (doScroll && wizardFlowEl && wizardFlowEl.getBoundingClientRect().top < 0) {
    wizardFlowEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

  function updateStepButtons() {
    const backBtn = $("wiz-back-btn");
    const nextBtn = $("wiz-next-btn");
    const genBtn = $("generate-paper-btn-inline");
    if (!backBtn || !nextBtn) return;

    backBtn.classList.toggle("invisible", currentStepIndex === 0);

    const isLast = currentStepIndex === STEPS.length - 1;

    // 👇 CHANGED: class-toggle ki jagah seedha inline style — koi CSS-order ambiguity nahi
    nextBtn.style.display = isLast ? "none" : "inline-flex";
    if (genBtn) genBtn.style.display = isLast ? "inline-flex" : "none";

    const valid = stepValid(STEPS[currentStepIndex]);
    nextBtn.disabled = !valid;
    nextBtn.classList.toggle("opacity-50", !valid);
    nextBtn.classList.toggle("cursor-not-allowed", !valid);

    if (genBtn) {
        genBtn.disabled = !valid;
        genBtn.classList.toggle("opacity-50", !valid);
        genBtn.classList.toggle("cursor-not-allowed", !valid);
    }
}

  function initStepNav() {
    $("wiz-back-btn")?.addEventListener("click", () => {
      if (currentStepIndex > 0) goToStep(currentStepIndex - 1);
    });
    $("wiz-next-btn")?.addEventListener("click", () => {
      if (!stepValid(STEPS[currentStepIndex])) return;
      maxUnlockedIndex = Math.max(maxUnlockedIndex, currentStepIndex + 1);
      goToStep(currentStepIndex + 1);
    });
    goToStep(0, { scroll: false });
  }

  /* Ek step ka data badalne par uske AAGE ke saare steps ka data + unlock reset karo
     (e.g. category badli to exam/mode/subjects sab reset, aur un steps ko dobara lock karo) */
 
     function resetFrom(step) {
  const lvl = { exam: 1, mode: 2, modeSteps: 3 }[step];
  if (!lvl) return;

  if (lvl <= 2) { state.mode = null; setModeUI(null); }
  state.subjects = []; state.topics = [];
  state.weakGroups = []; state.weakSel = [];
  state.pattern = null; state.topicSelections = {};
  state.questionCount = null; state.timeLimit = null; state.language = null;
  clearSettingsUI();
  rebuildSteps();

  maxUnlockedIndex = Math.min(maxUnlockedIndex, lvl);
  if (currentStepIndex > lvl) goToStep(lvl);
  updateSummary();
  validateReady();
}

function clearSettingsUI() {
  document.querySelectorAll(".count-btn, .time-btn").forEach((b) =>
    b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
  $("custom-count-input")?.classList.add("hidden");
  $("custom-time-input")?.classList.add("hidden");
}

  /* ---------------- 1. CATEGORY ---------------- */
  function initCategory() {
    document.querySelectorAll(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        document.querySelectorAll(".category-btn").forEach((b) => {
          b.classList.remove(b.dataset.onBorder, b.dataset.onBg, "ring-2", b.dataset.onRing);
          b.querySelector(".cat-check")?.classList.add("hidden");
          b.querySelector(".cat-name")?.classList.remove(b.dataset.onText);
        });
        btn.classList.add(btn.dataset.onBorder, btn.dataset.onBg, "ring-2", btn.dataset.onRing);
        btn.querySelector(".cat-check")?.classList.remove("hidden");
        btn.querySelector(".cat-check").style.display = "flex";
        btn.querySelector(".cat-name")?.classList.add(btn.dataset.onText);

        state.categoryId = btn.dataset.categoryId;
        state.categoryName = btn.dataset.categoryName;
        state.categoryIcon = btn.dataset.icon || "";
        state.categoryIconColor = btn.dataset.iconColor || "";
        resetFrom("exam");
        maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("exam"));
        examGridLoaded = false;
        loadExamGrid();
        persist();
      });
    });
  }
 

  /* ---------------- 2. EXAM (single-select, card grid) ---------------- */
  let examGridLoaded = false;

  function examInitials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("");
  }

  async function loadExamGrid() {
  if (!state.categoryId) return;
  const { exams } = await api(`/api/custom-test/exams?categoryId=${encodeURIComponent(state.categoryId)}`);
  renderExamGrid(exams);
  examGridLoaded = true;
}

  function renderExamGrid(exams) {
    const grid = $("exam-grid");
    const empty = $("exam-empty");
    if (!grid) return;

    if (!exams.length) {
      grid.innerHTML = "";
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");

    grid.innerHTML = exams.map((e) => {
      const selected = state.exams[0] === e;
      return `<button type="button" data-exam="${e}"
          class="exam-btn group relative flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all duration-150
            ${selected ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"}">
          <span class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-xs font-bold">
            ${examInitials(e)}
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-medium leading-tight truncate ${selected ? "text-indigo-700" : "text-slate-700"}">${e}</span>
          </span>
          <span class="exam-check ${selected ? "" : "hidden"} absolute top-2 right-2 w-4 h-4 rounded-full bg-white border border-indigo-400 items-center justify-center flex">
            <i data-lucide="check" class="w-2.5 h-2.5 text-indigo-700"></i>
          </span>
        </button>`;
    }).join("");

    grid.querySelectorAll(".exam-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectExam(btn.dataset.exam));
    });
    icons();
  }

  function selectExam(name) {
    // Single-select: purana exam hamesha replace hoga, push nahi
    state.exams = [name];
    resetFrom("mode");
    maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("mode"));
     if (examGridLoaded) loadExamGrid();
    validateReady();
    persist();
  }



   /* ---------------- 3. MODE ---------------- */
function setModeUI(mode) {
  document.querySelectorAll(".mode-btn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("border-indigo-400", on);
    b.classList.toggle("ring-2", on);
    b.classList.toggle("ring-indigo-100", on);
    const c = b.querySelector(".mode-check");
    if (c) { c.classList.toggle("hidden", !on); c.style.display = on ? "flex" : ""; }
  });
}

function initMode() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (btn.disabled) return;
      if (mode === "examPattern" && !IS_PAID_TIER) {
        window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
        return;
      }
      if (state.mode === mode) return;

      state.mode = mode;
      if (mode === "examPattern") state.topicSelections = {};
      setModeUI(mode);
      resetFrom("modeSteps");
      unlock(MODE_STEPS[mode][0]);

      $("available-label").textContent = "";
      document.querySelectorAll(".count-btn").forEach((b) => {
        b.disabled = false;
        b.classList.remove("opacity-40", "cursor-not-allowed");
      });

      if (mode === "custom") loadSubjects();
      else {
        loadLanguages();
        if (mode === "weakArea") loadWeakAreas(); else loadPatterns();
      }
      validateReady();
      persist();
    });
  });
}

async function loadLanguages() {
  try {
    const { languages } = await api(`/api/custom-test/subjects?exams=${encodeURIComponent(state.exams.join("|"))}`);
    state.languages = languages && languages.length ? languages : ["English"];
  } catch (_) { state.languages = ["English"]; }
  renderLanguages();
}

/* ---------------- WEAK AREAS ---------------- */
function weakColor(acc) {
  if (acc < 40) return { dot: "bg-rose-500", txt: "text-rose-600", bar: "bg-rose-500" };
  if (acc < 55) return { dot: "bg-orange-500", txt: "text-orange-600", bar: "bg-orange-500" };
  return { dot: "bg-amber-400", txt: "text-amber-600", bar: "bg-amber-400" };
}
const isWeakSel = (s, t) => state.weakSel.some((x) => x.s === s && x.t === t);

async function loadWeakAreas() {
  try {
    const d = await api(`/api/custom-test/weak-areas?exams=${encodeURIComponent(state.exams.join("|"))}`);
    state.weakGroups = d.error ? [] : (d.groups || []);
  } catch (_) { state.weakGroups = []; }
  renderWeakAreas();
  validateReady();
}

function syncWeakState() {
  state.subjects = [...new Set(state.weakSel.map((x) => x.s))];
  state.topics = state.weakSel.map((x) => x.t);
  if (state.subjects.length) loadAvailability();
  renderWeakAreas();
  updateSummary();
  validateReady();
  persist();
}

function renderWeakAreas() {
  const box = $("weak-list");
  if (!box) return;
  $("weak-empty")?.classList.toggle("hidden", state.weakGroups.length > 0);

  box.innerHTML = state.weakGroups.map((g, gi) => {
    const allOn = g.topics.every((t) => isWeakSel(g.subject, t.name));
    return `<div class="rounded-xl border border-slate-200 p-3">
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm font-semibold text-slate-900">${g.subject}
          <span class="text-xs font-normal text-slate-400">· ${g.topics.length} weak topic${g.topics.length > 1 ? "s" : ""}</span></p>
        <button type="button" data-weak-subject="${gi}" class="text-xs font-medium text-indigo-600">${allOn ? "Clear" : "Select all"}</button>
      </div>
      <div class="space-y-1.5">
        ${g.topics.map((t, ti) => {
          const on = isWeakSel(g.subject, t.name);
          const c = weakColor(t.accuracy);
          return `<button type="button" data-weak-topic="${gi}:${ti}"
              class="w-full text-left rounded-lg border px-3 py-2 transition-colors ${on ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}">
            <div class="flex items-center justify-between gap-2 text-sm">
              <span class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full ${c.dot} shrink-0"></span>
                <span class="truncate text-slate-700">${t.name}</span>
              </span>
              <span class="shrink-0 text-xs"><b class="${c.txt}">${t.accuracy}%</b> <span class="text-slate-400">(${t.attempted} Q)</span></span>
            </div>
            <div class="mt-1.5 h-1.5 rounded-full bg-slate-100"><div class="weak-bar h-1.5 rounded-full ${c.bar}" data-w="${t.accuracy}"></div></div>
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");

  box.querySelectorAll(".weak-bar").forEach((el) => { el.style.width = el.dataset.w + "%"; });

  box.querySelectorAll("[data-weak-topic]").forEach((b) => b.addEventListener("click", () => {
    const [gi, ti] = b.dataset.weakTopic.split(":").map(Number);
    const g = state.weakGroups[gi]; const t = g.topics[ti];
    if (isWeakSel(g.subject, t.name)) state.weakSel = state.weakSel.filter((x) => !(x.s === g.subject && x.t === t.name));
    else state.weakSel.push({ s: g.subject, t: t.name });
    syncWeakState();
  }));

  box.querySelectorAll("[data-weak-subject]").forEach((b) => b.addEventListener("click", () => {
    const g = state.weakGroups[Number(b.dataset.weakSubject)];
    const allOn = g.topics.every((t) => isWeakSel(g.subject, t.name));
    state.weakSel = state.weakSel.filter((x) => x.s !== g.subject);
    if (!allOn) g.topics.forEach((t) => state.weakSel.push({ s: g.subject, t: t.name }));
    syncWeakState();
  }));
}

/* ---------------- EXAM PATTERN ---------------- */
async function loadPatterns() {
  try {
    const d = await api(`/api/custom-test/patterns?exams=${encodeURIComponent(state.exams.join("|"))}&categoryId=${encodeURIComponent(state.categoryId)}`);
    state.pattern = d.pattern || null;
  } catch (_) { state.pattern = null; }

  if (!state.topicSelections) state.topicSelections = {};

  if (state.pattern) {
    state.subjects = state.pattern.rows.map((r) => r.subject);
    state.subjectCounts = {};
    state.pattern.rows.forEach((r) => { state.subjectCounts[r.subject] = r.questions; });
    state.questionCount = state.pattern.rows.reduce((s, r) => s + (r.questions || 0), 0);
    state.timeLimit = state.pattern.timeStrategy === "sectional"
      ? (state.pattern.sectionTime || []).reduce((s, st) => s + (Number(st.duration) || 0), 0)
      : (state.pattern.totalDuration || 60);
  } else {
    state.subjects = [];
    state.subjectCounts = {};
    state.questionCount = null;
    state.timeLimit = null;
  }

  renderPatterns();
  updateSummary();
  validateReady();
  persist();
}

function escAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPatterns() {
  $("pattern-empty")?.classList.toggle("hidden", !!state.pattern);
  const box = $("pattern-list");
  if (!box) return;

  if (!state.pattern) { box.innerHTML = ""; return; }

  box.innerHTML = state.pattern.rows.map((r, idx) => {
    const sel = state.topicSelections[r.subject] || [];
    const badgeText = sel.length ? `${sel.length} selected` : "Auto Selected";
    const badgeCls = sel.length ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600";
    return `<div class="border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" data-toggle-subject="${idx}" class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <i data-lucide="book-open" class="w-4 h-4"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 truncate">${r.subject}</p>
            <p class="text-xs text-slate-400">${r.questions} Questions &middot; ${r.positiveMarks} Marks</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span id="patternBadge-${idx}" class="text-xs font-semibold px-2.5 py-1 rounded-full ${badgeCls}">${badgeText}</span>
          <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 pattern-chevron-${idx} transition-transform"></i>
        </div>
      </button>
      <div id="subjectTopics-${idx}" class="hidden border-t border-slate-100 p-4"></div>
    </div>`;
  }).join("");

  icons();

  box.querySelectorAll("[data-toggle-subject]").forEach((btn) => {
    btn.addEventListener("click", () => toggleSubjectExpand(Number(btn.dataset.toggleSubject)));
  });
}

async function toggleSubjectExpand(idx) {
  const panel = $(`subjectTopics-${idx}`);
  const chevron = document.querySelector(`.pattern-chevron-${idx}`);
  if (!panel) return;

  const isOpen = !panel.classList.contains("hidden");
  if (isOpen) {
    panel.classList.add("hidden");
    chevron?.classList.remove("rotate-90");
    return;
  }
  panel.classList.remove("hidden");
  chevron?.classList.add("rotate-90");
  icons();

  if (panel.dataset.loaded === "true") return;
  panel.innerHTML = `<p class="text-xs text-slate-400">Loading topics...</p>`;

  const subject = state.pattern.rows[idx].subject;
  try {
    const d = await api(`/api/custom-test/topics?exams=${encodeURIComponent(state.exams.join("|"))}&subjects=${encodeURIComponent(subject)}`);
    const group = (d.groups || [])[0];
    const topics = group ? group.topics : [];

    if (!topics.length) {
      panel.innerHTML = `<p class="text-xs text-slate-400">No topic tags are available for this subject.</p>`;
    } else {
      const selected = state.topicSelections[subject] || [];
      panel.innerHTML = `<div class="flex flex-wrap gap-2">` + topics.map((t) => {
        const on = selected.includes(t.name);
        return `<label class="topic-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${on ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-indigo-300"}">
          <input type="checkbox" class="hidden pattern-topic-check" data-subject="${escAttr(subject)}" value="${escAttr(t.name)}" ${on ? "checked" : ""} />
          <span>${t.name} <span class="text-slate-400">${t.count}</span></span>
        </label>`;
      }).join("") + `</div>`;

      panel.querySelectorAll(".pattern-topic-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          const subj = cb.dataset.subject;
          const chip = cb.closest(".topic-chip");
          chip.classList.toggle("border-indigo-400", cb.checked);
          chip.classList.toggle("bg-indigo-50", cb.checked);
          chip.classList.toggle("text-indigo-700", cb.checked);

          const list = new Set(state.topicSelections[subj] || []);
          if (cb.checked) list.add(cb.value); else list.delete(cb.value);
          state.topicSelections[subj] = Array.from(list);

          const rowIdx = state.pattern.rows.findIndex((r) => r.subject === subj);
          const badge = $(`patternBadge-${rowIdx}`);
          if (badge) {
            const n = state.topicSelections[subj].length;
            badge.textContent = n ? `${n} selected` : "Auto Selected";
            badge.className = `text-xs font-semibold px-2.5 py-1 rounded-full ${n ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`;
          }
          persist();
        });
      });
    }
    panel.dataset.loaded = "true";
  } catch (_) {
    panel.innerHTML = `<p class="text-xs text-rose-500">Failed to load topics.</p>`;
  }
}

  /* ---------------- 4. SUBJECTS ---------------- */
  async function loadSubjects() {
    const { subjects, languages } = await api(
      `/api/custom-test/subjects?exams=${encodeURIComponent(state.exams.join("|"))}`
    );
    const tg = $("topic-groups");
if (tg) tg.innerHTML = "";
    state.languages = languages && languages.length ? languages : ["English"];
    state.subjectCounts = {};
    subjects.forEach((s) => (state.subjectCounts[s.name] = s.count));

    const list = $("subject-list");
    if (!subjects.length) {
      list.innerHTML = "";
      $("subject-empty").classList.remove("hidden");
    } else {
      $("subject-empty").classList.add("hidden");
      list.innerHTML = subjects
        .map(
          (s) => `<label class="subject-item flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm cursor-pointer hover:border-indigo-300">
            <span class="flex items-center gap-2 min-w-0">
              <input type="checkbox" class="subject-check w-4 h-4 rounded text-indigo-600" value="${s.name}" />
              <span class="truncate text-slate-700">${s.name}</span>
            </span>
            <span class="text-xs text-slate-400 shrink-0">${s.count} Q</span>
          </label>`
        )
        .join("");
      list.querySelectorAll(".subject-check").forEach((cb) => cb.addEventListener("change", onSubjectToggle));
    }
    renderLanguages();
  }

  function onSubjectToggle() {
    state.subjects = Array.from(document.querySelectorAll(".subject-check:checked")).map((c) => c.value);
    if (state.subjects.length) {
      loadTopics();
      loadAvailability();
    } else {
      state.topics = [];
      $("topic-groups").innerHTML = "";
    }
    updateSummary();
    validateReady();
    persist();
  }

  function initSelectAllSubjects() {
    $("select-all-subjects")?.addEventListener("click", () => {
      const boxes = document.querySelectorAll(".subject-check");
      const allChecked = Array.from(boxes).every((b) => b.checked);
      boxes.forEach((b) => (b.checked = !allChecked));
      onSubjectToggle();
    });
  }

  /* ---------------- 5. TOPICS ---------------- */
  async function loadTopics() {
    if (!state.subjects.length) return;
    const { groups } = await api(
      `/api/custom-test/topics?exams=${encodeURIComponent(state.exams.join("|"))}&subjects=${encodeURIComponent(state.subjects.join("|"))}`
    );
    state.topicGroups = groups;
    const container = $("topic-groups");
    if (!groups.length) {
      container.innerHTML = `<p class="text-sm text-slate-400">No topic tags are available for this selection; questions will be drawn from the entire subject.</p>`;
      return;
    }
    container.innerHTML = groups
      .map(
        (g) => `<div>
          <p class="text-xs font-semibold text-slate-500 mb-2">${g.subject}</p>
          <div class="flex flex-wrap gap-2">
            ${g.topics
              .map(
                (t) => `<label class="topic-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" class="topic-check hidden" value="${t.name}" />
                  <span>${t.name} <span class="text-slate-400">${t.count}</span></span>
                </label>`
              )
              .join("")}
          </div>
        </div>`
      )
      .join("");

    container.querySelectorAll(".topic-check").forEach((cb) =>
      cb.addEventListener("change", () => {
        cb.closest(".topic-chip").classList.toggle("border-indigo-400", cb.checked);
        cb.closest(".topic-chip").classList.toggle("bg-indigo-50", cb.checked);
        cb.closest(".topic-chip").classList.toggle("text-indigo-700", cb.checked);
        state.topics = Array.from(document.querySelectorAll(".topic-check:checked")).map((c) => c.value);
        loadAvailability();
        updateSummary();
        persist();
      })
    );
  }

  function initClearTopics() {
    $("clear-topics")?.addEventListener("click", () => {
      document.querySelectorAll(".topic-check").forEach((cb) => {
        cb.checked = false;
        cb.dispatchEvent(new Event("change"));
      });
    });
  }

  /* ---------------- 6. DIFFICULTY ---------------- */
  const QUICK_DIFF_PRESETS = {
    easy:   { easy: 100, medium: 0,   hard: 0 },
    medium: { easy: 0,   medium: 100, hard: 0 },
    hard:   { easy: 0,   medium: 0,   hard: 100 },
    mixed:  { easy: 25,  medium: 50,  hard: 25 },
  };

  function setDiffTab(tab) {
    const quickTab = $("diff-tab-quick");
    const customTab = $("diff-tab-custom");
    const quickPanel = $("diff-panel-quick");
    const customPanel = $("diff-panel-custom");
    if (!quickTab || !customTab) return;

    if (tab === "custom") {
      quickTab.classList.remove("bg-white", "text-indigo-700", "shadow-sm");
      quickTab.classList.add("text-slate-500");
      customTab.classList.add("bg-white", "text-indigo-700", "shadow-sm");
      customTab.classList.remove("text-slate-500");
      quickPanel.classList.add("hidden");
      customPanel.classList.remove("hidden");
    } else {
      customTab.classList.remove("bg-white", "text-indigo-700", "shadow-sm");
      customTab.classList.add("text-slate-500");
      quickTab.classList.add("bg-white", "text-indigo-700", "shadow-sm");
      quickTab.classList.remove("text-slate-500");
      customPanel.classList.add("hidden");
      quickPanel.classList.remove("hidden");
    }
  }

  function selectQuickDiff(key) {
    document.querySelectorAll(".diff-quick-btn").forEach((b) => {
      b.classList.remove("border-indigo-400", "ring-2", "ring-indigo-100", "bg-indigo-50/40");
      const check = b.querySelector(".diff-quick-check");
      if (check) {
        check.classList.add("hidden");
        check.style.display = "";
      }
    });
    const btn = document.querySelector(`.diff-quick-btn[data-quick="${key}"]`);
    if (!btn) return;
    btn.classList.add("border-indigo-400", "ring-2", "ring-indigo-100");
    const activeCheck = btn.querySelector(".diff-quick-check");
    if (activeCheck) {
      activeCheck.classList.remove("hidden");
      activeCheck.style.display = "flex";
    }

    state.difficultyMode = key;
    state.difficulty = { ...QUICK_DIFF_PRESETS[key] };
    updateSummary();
    validateReady();
    persist();
  }

  function initDifficulty() {
    $("diff-tab-quick")?.addEventListener("click", () => {
      setDiffTab("quick");
      persist();
    });

    $("diff-tab-custom")?.addEventListener("click", () => {
      if (!IS_PAID_TIER) {
        window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
        return;
      }
      state.difficultyMode = "custom";
      setDiffTab("custom");
      persist();
    });

    document.querySelectorAll(".diff-quick-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectQuickDiff(btn.dataset.quick));
    });

    document.querySelectorAll(".diff-slider").forEach((slider) => {
      slider.addEventListener("input", () => {
        state.difficulty[slider.dataset.level] = Number(slider.value);
        document.querySelector(`[data-pct="${slider.dataset.level}"]`).textContent = slider.value + "%";
        recomputeDifficultyTotal();
      });
    });
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const presets = {
          balanced: { easy: 25, medium: 50, hard: 25 },
          easy: { easy: 50, medium: 30, hard: 20 },
          hard: { easy: 20, medium: 30, hard: 50 },
        };
        const p = presets[btn.dataset.preset];
        state.difficulty = { ...p };
        Object.keys(p).forEach((level) => {
          document.querySelector(`.diff-slider[data-level="${level}"]`).value = p[level];
          document.querySelector(`[data-pct="${level}"]`).textContent = p[level] + "%";
        });
        recomputeDifficultyTotal();
      });
    });

    setDiffTab("quick");
    selectQuickDiff("mixed");
  }

  function recomputeDifficultyTotal() {
    const total = state.difficulty.easy + state.difficulty.medium + state.difficulty.hard;
    $("diff-total").textContent = total + "%";
    $("diff-warning").classList.toggle("hidden", total === 100);
    updateSummary();
    validateReady();
    persist();
  }

  function toggleQuestionCountBlock() {
  const block = $("question-count-block");
  if (!block) return;
  if (state.mode === "examPattern") {
    block.classList.add("hidden");
  } else {
    block.classList.remove("hidden");
  }
}

function renderExamPatternTiming() {
  const editableBlock = $("time-limit-editable-block");
  const displayBlock = $("exam-pattern-timing-display");
  const displayContent = $("exam-pattern-timing-content");
  if (!editableBlock || !displayBlock) return;

  if (state.mode === "examPattern" && state.pattern) {
    editableBlock.classList.add("hidden");
    displayBlock.classList.remove("hidden");

    if (state.pattern.timeStrategy === "sectional" && (state.pattern.sectionTime || []).length) {
      displayContent.innerHTML = state.pattern.sectionTime.map((st) => `
        <div class="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
          <span class="text-sm font-medium text-slate-700">${st.subjects.join(" + ")}</span>
          <span class="font-bold text-indigo-600 text-sm">${st.duration} min</span>
        </div>`).join("");
    } else {
      displayContent.innerHTML = `
        <div class="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
          <span class="text-sm font-medium text-slate-700">Total Time</span>
          <span class="font-bold text-indigo-600 text-sm">${state.pattern.totalDuration || state.timeLimit} min</span>
        </div>`;
    }
  } else {
    editableBlock.classList.remove("hidden");
    displayBlock.classList.add("hidden");
  }
}


  /* ---------------- AVAILABILITY ---------------- */
  async function loadAvailability() {
    if (!state.exams.length || !state.subjects.length) return;
    const data = await api("/api/custom-test/availability", {
      method: "POST",
      body: { exams: state.exams, subjects: state.subjects, topics: state.topics },
    });
    state.availability = data;
    ["easy", "medium", "hard"].forEach((level) => {
      const span = document.querySelector(`[data-avail="${level}"]`);
      if (span) span.textContent = data.byDifficulty[level] + " avail";
    });
    $("available-label").textContent = data.total + " questions available";
    document.querySelectorAll(".count-btn[data-count]").forEach((btn) => {
  if (btn.dataset.count === "custom") return;
  const over = Number(btn.dataset.count) > data.total;
  btn.disabled = over;
  btn.classList.toggle("opacity-40", over);
  btn.classList.toggle("cursor-not-allowed", over);
});
    validateReady();
  }

  /* ---------------- 7. SETTINGS: count / time / language ---------------- */
  function initSettings() {
    document.querySelectorAll(".count-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.locked === "true" && !IS_PAID_TIER) {
          window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
          return;
        }
        document.querySelectorAll(".count-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
        btn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
        if (btn.dataset.count === "custom") {
          $("custom-count-input").classList.remove("hidden");
          $("custom-count-input").focus();
          state.questionCount = null;
        } else {
          $("custom-count-input").classList.add("hidden");
          state.questionCount = Number(btn.dataset.count);
        }
        checkCountWarning();
        updateSummary();
        validateReady();
        persist();
      });
    });

    $("custom-count-input")?.addEventListener("input", (e) => {
      state.questionCount = Number(e.target.value) || null;
      checkCountWarning();
      updateSummary();
      validateReady();
      persist();
    });

    document.querySelectorAll(".time-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.locked === "true" && !IS_PAID_TIER) {
          window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
          return;
        }
        document.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
        btn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
        if (btn.dataset.time === "custom") {
          $("custom-time-input").classList.remove("hidden");
          $("custom-time-input").focus();
          state.timeLimit = null;
        } else {
          $("custom-time-input")?.classList.add("hidden");
          state.timeLimit = btn.dataset.time;
        }
        updateSummary();
        validateReady();
        persist();
      });
    });

    $("custom-time-input")?.addEventListener("input", (e) => {
      state.timeLimit = e.target.value ? e.target.value : null;
      updateSummary();
      validateReady();
      persist();
    });
  }

  function checkCountWarning() {
    const w = $("count-warning");
    if (state.questionCount && state.availability.total && state.questionCount > state.availability.total) {
      w.textContent = `Only ${state.availability.total} questions are available, not ${state.questionCount}.`;
      w.classList.remove("hidden");
    } else if (state.questionCount && (state.questionCount < 1 || state.questionCount > 200)) {
      w.textContent = "Question count must be between 1 and 200.";
      w.classList.remove("hidden");
    } else {
      w.classList.add("hidden");
    }
  }

  function validity() {
    const diffTotal = state.difficulty.easy + state.difficulty.medium + state.difficulty.hard;
    if (!state.exams.length) return { ok: false, msg: "Please select an exam." };
if (state.mode === "custom" && !state.subjects.length) return { ok: false, msg: "Please select a subject." };
if (state.mode === "weakArea" && !state.subjects.length) return { ok: false, msg: "Please select a weak topic." };
if (state.mode === "examPattern") {
  if (!state.pattern) return { ok: false, msg: "No pattern is configured for this exam." };
  if (diffTotal !== 100) return { ok: false, msg: "Difficulty percentages must add up to 100%." };
  if (!state.language) return { ok: false, msg: "Please select a language." };
  return { ok: true, msg: "" };
}
if (diffTotal !== 100) return { ok: false, msg: "Difficulty percentages must add up to 100%." };
    const total = Number(state.questionCount);
    if (!total) return { ok: false, msg: "" };

    if (!IS_PAID_TIER && total > FREE_MAX)
      return { ok: false, msg: `The Free plan allows a maximum of ${FREE_MAX} questions.` };
    if (total < 1 || total > 200) return { ok: false, msg: "Question count must be between 1 and 200." };
    if (!state.timeLimit) return { ok: false, msg: "Please select a time limit." };
    if (!IS_PAID_TIER && Number(state.timeLimit) && !["10", "20", "30", "50"].includes(String(state.timeLimit)))
      return { ok: false, msg: "A custom time limit is available only on the Pro plan." };
    if (!state.language) return { ok: false, msg: "Please select a language." };

    return { ok: true, msg: "" };
  }

  function renderLanguages() {
    $("language-row").innerHTML = state.languages
      .map((l) => `<button type="button" data-lang="${l}" class="lang-btn px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-indigo-300">${l}</button>`)
      .join("");
    $("language-row").querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $("language-row").querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("border-indigo-400", "bg-indigo-50", "text-indigo-700"));
        btn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
        state.language = btn.dataset.lang;
        updateSummary();
        validateReady();
        persist();
      });
    });
  }

  /* ---------------- SUMMARY (right sidebar + mobile sheet) ---------------- */
  function updateSummary() {
    const total = state.questionCount || 0;
    const rows = [];

    if (state.categoryName) {
      rows.push({
        title: "Exam & mode",
        lines: [
          ["Category", state.categoryName],
          ["Exam", state.exams.join(", ") || "—"],
         ["Mode", { custom: "Practice", weakArea: "Weak area", examPattern: "Exam pattern" }[state.mode] || "—"],
        ],
      });
    }
    if (state.subjects.length) {
      rows.push({
        title: "Subjects & topics",
        lines: [
          ...state.subjects.map((s) => [s, state.mode === "weakArea" ? "Weak area" : (state.subjectCounts[s] || 0) + " Q"]),
          ["Topics", state.topics.length ? state.topics.length + " selected" : "All"],
        ],
      });
    }
    if (total && state.mode !== "examPattern") {
      rows.push({
        title: "Difficulty",
        lines: ["easy", "medium", "hard"].map((k) => [
          k[0].toUpperCase() + k.slice(1),
          `${state.difficulty[k]}% - ${Math.round((state.difficulty[k] / 100) * total)} Q`,
        ]),
      });
    }
    if (state.timeLimit || state.language) {
      rows.push({
        title: "Time & language",
        lines: [
          ["Time limit", state.timeLimit ? state.timeLimit + " minutes" : "—"],
          ["Language", state.language || "—"],
        ],
      });
    }

    const html = rows
      .map(
        (r) => `<div class="border-b border-slate-100 pb-3 last:border-0">
          <p class="text-xs font-semibold text-slate-700 mb-1.5">${r.title}</p>
          ${r.lines.map(([k, v]) => `<div class="flex items-center justify-between text-xs py-0.5"><span class="text-slate-400">${k}</span><span class="text-slate-700 font-medium">${v}</span></div>`).join("")}
        </div>`
      )
      .join("");

    $("summary-sections").innerHTML = html;
    $("mobile-summary-sections").innerHTML = html;
    $("summary-total-count").textContent = total;
    $("mobile-summary-count").textContent = total;
  }

  /* ---------------- VALIDATE + GENERATE ---------------- */
  function isReady() {
    const diffTotal = state.difficulty.easy + state.difficulty.medium + state.difficulty.hard;
    if (state.mode === "examPattern") {
      return !!(state.exams.length && state.pattern && diffTotal === 100 && state.language);
    }
    return (
      state.exams.length &&
      state.mode &&
      state.subjects.length &&
      (IS_PAID_TIER || state.questionCount <= FREE_MAX) &&
      diffTotal === 100 &&
      state.questionCount &&
      state.questionCount >= 1 &&
      state.questionCount <= 200 &&
      state.timeLimit &&
      state.language
    );
  }

  function validateReady() {
    const ready = isReady();
    ["generate-paper-btn", "generate-paper-btn-inline", "generate-paper-btn-mobile"].forEach((id) => {
      const btn = $(id);
      if (!btn) return;
      btn.disabled = !ready;
      btn.classList.toggle("opacity-50", !ready);
      btn.classList.toggle("cursor-not-allowed", !ready);
    });
    // Step-tab UI ko bhi har state-change par refresh karo
    updateStepButtons();
    renderStepNav();
  }

  // ---------------- SHORTFALL CONFIRM MODAL ----------------
  const shortfallModal = $("shortfall-modal");
  const shortfallMessage = $("shortfall-message");
  const shortfallCancelBtn = $("shortfall-cancel-btn");
  const shortfallGenerateBtn = $("shortfall-generate-btn");

  let pendingResult = null;

  function openShortfallModal(data, btn) {
    pendingResult = { data, btn };
    shortfallMessage.textContent =
      `You requested ${data.requested} questions, but only ${data.delivered} are available for this subject/topic. Do you want to generate the paper with these ${data.delivered} instead?`;
    shortfallModal.classList.remove("hidden");
    icons();
  }

  function closeShortfallModal() {
    shortfallModal.classList.add("hidden");
    pendingResult = null;
  }

  shortfallCancelBtn?.addEventListener("click", () => {
    if (pendingResult) {
      pendingResult.btn.disabled = false;
      pendingResult.btn.innerHTML = pendingResult.btn.dataset.originalHtml || pendingResult.btn.innerHTML;
    }
    closeShortfallModal();
  });

  shortfallGenerateBtn?.addEventListener("click", () => {
    if (pendingResult) finalizePaper(pendingResult.data, pendingResult.btn);
    closeShortfallModal();
  });

  // ---------------- GENERATE ----------------
  function finalizePaper(data, btn) {
    const paper = {
        id: data.paperId,
        source: "manual",
        createdAt: Date.now(),
        expiresAt: Date.now() + getPaperTTL(TIER),
        config: {
            exams: state.exams,
            subjects: state.subjects,
            topics: state.topics,
            difficulty: state.difficulty,
            questionCount: data.delivered,
            timeLimit: data.timeLimit,
            timeStrategy: data.timeStrategy || "total",
            subjectTime: data.subjectTime || [],
            language: state.language,
            mode: state.mode,
            categoryIcon: state.categoryIcon,
            categoryIconColor: state.categoryIconColor,
        },
        questions: data.questions,
    };

    try {
        const raw = localStorage.getItem(PAPER_KEY);
        let list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        const now = Date.now();
        list = list.filter((p) => !p.expiresAt || p.expiresAt > now);

        if (TIER === "promax") list.push(paper);
        else list = [paper];

        localStorage.setItem(PAPER_KEY, JSON.stringify(list));
    } catch (_) {
        showToast("Could not save paper (browser storage full). Please clear browser storage and try again.", "error");
        btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
        btn.disabled = false;
        return;
    }

    const BASE = window.location.pathname.startsWith("/dashboard") ? "/dashboard" : "";
    persist();
    window.location.href = `${BASE}/custom-test`;
}

  async function generate(btn) {
    const v = validity();
    if (!v.ok) { if (v.msg) showToast(v.msg, "error"); return; }

    const originalHtml = btn.innerHTML;
    btn.dataset.originalHtml = originalHtml;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Building paper...`;
    icons();

    try {
      const payload = {
  exams: state.exams,
  subjects: state.subjects,
  topics: state.topics,
  difficulty: state.difficulty,
  questionCount: Number(state.questionCount),
  timeLimit: Number(state.timeLimit) || 0,
  language: state.language,
  mode: state.mode,
  categoryId: state.categoryId,
  topicSelections: state.topicSelections,
};

      const data = await api("/api/custom-test/generate", { method: "POST", body: payload });

      if (!data.success) {
        if (data.error === "UPGRADE_REQUIRED") {
          window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname);
          return;
        }
        showToast(data.message || "Failed to generate paper.", "error");
        btn.innerHTML = originalHtml;
        btn.disabled = false;
        return;
      }

      if (data.shortfall) {
        openShortfallModal(data, btn);
        return;
      }

      finalizePaper(data, btn);
    } catch (err) {
      console.error("generate failed", err);
      showToast("Something went wrong. Please try again.", "error");
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  function initGenerateButtons() {
    ["generate-paper-btn", "generate-paper-btn-inline", "generate-paper-btn-mobile"].forEach((id) => {
      const btn = $(id);
      btn?.addEventListener("click", () => generate(btn));
    });
  }

  function initResetAndMobile() {
    $("reset-btn")?.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });
    $("mobile-summary-toggle")?.addEventListener("click", () => {
      $("mobile-summary-sheet").classList.toggle("hidden");
      $("mobile-summary-chevron").classList.toggle("rotate-180");
    });
    document.addEventListener("DOMContentLoaded", () => {
      $("mobile-summary-bar")?.classList.remove("hidden");
      $("summary-panel")?.style.setProperty("display", "flex");
    });
  }

  /* ---------------- RESTORE (page reload/navigate ke baad wapas fill karo) ---------------- */
  function restoreState() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) { saved = null; }
    if (!saved) return;

    Object.assign(state, saved);

    if (!IS_PAID_TIER && state.questionCount > FREE_MAX) state.questionCount = null;
if (state.mode === "weakArea" && wizardFlowEl?.dataset.canWeak !== "true") state.mode = null;
if (state.mode === "examPattern" && state.pattern) unlock("settings");
rebuildSteps();

    // 1. Category
    if (state.categoryId) {
      const catBtn = document.querySelector(`.category-btn[data-category-id="${state.categoryId}"]`);
      if (catBtn) {
        catBtn.classList.add(catBtn.dataset.onBorder, catBtn.dataset.onBg, "ring-2", catBtn.dataset.onRing);
        catBtn.querySelector(".cat-check")?.classList.remove("hidden");
        if (catBtn.querySelector(".cat-check")) catBtn.querySelector(".cat-check").style.display = "flex";
        catBtn.querySelector(".cat-name")?.classList.add(catBtn.dataset.onText);
      }
      maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("exam"));
    }

// 2. Exams
if (state.categoryId) loadExamGrid();
if (state.exams.length) {
  maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("mode"));
}

    // 3. Mode + subjects/topics (async chain — API se dobara list mangvani padti hai)
    if (state.mode && state.exams.length) {
  setModeUI(state.mode);
  unlock(MODE_STEPS[state.mode][0]);

      if (state.mode === "custom") {
        const savedSubjects = state.subjects.slice();
        const savedTopics = state.topics.slice();
        const savedLanguage = state.language;

        loadSubjects().then(() => {
          state.subjects = savedSubjects;
          document.querySelectorAll(".subject-check").forEach((cb) => {
            if (savedSubjects.includes(cb.value)) cb.checked = true;
          });
          if (savedLanguage) {
            document.querySelector(`.lang-btn[data-lang="${savedLanguage}"]`)
              ?.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
            state.language = savedLanguage;
          }

          if (savedSubjects.length) {
            maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("difficulty"));
            loadTopics().then(() => {
              state.topics = savedTopics;
              document.querySelectorAll(".topic-check").forEach((cb) => {
                if (savedTopics.includes(cb.value)) {
                  cb.checked = true;
                  cb.closest(".topic-chip").classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
                }
              });
              loadAvailability().then(() => {
                restoreDifficultyUI();
                restoreSettingsUI();
                if (state.timeLimit && state.language) maxUnlockedIndex = Math.max(maxUnlockedIndex, STEPS.indexOf("settings"));
                updateSummary();
                validateReady();
              });
            });
          }
        });
      } else {
  const loader = state.mode === "weakArea" ? loadWeakAreas : loadPatterns;
  Promise.all([loadLanguages(), loader()]).then(async () => {
    if (state.mode === "weakArea") {
      // jo topics ab weak nahi rahe unhe hata do
      state.weakSel = state.weakSel.filter((x) =>
        state.weakGroups.some((g) => g.subject === x.s && g.topics.some((t) => t.name === x.t)));
      state.subjects = [...new Set(state.weakSel.map((x) => x.s))];
      state.topics = state.weakSel.map((x) => x.t);
      renderWeakAreas();
      if (state.subjects.length) { unlock("difficulty"); await loadAvailability(); }
      restoreDifficultyUI();
    } else {
      renderPatterns();
    }
    restoreSettingsUI();
    if (state.language) {
      document.querySelector(`.lang-btn[data-lang="${state.language}"]`)
        ?.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
    }
    if (state.timeLimit && state.language) unlock("settings");
    if (state.mode === "examPattern" && state.pattern) unlock("settings");
    updateSummary(); validateReady();
  });
}
    }

    updateSummary();
    validateReady();
  }

  function restoreDifficultyUI() {
    if (state.difficultyMode === "custom" && IS_PAID_TIER) {
      setDiffTab("custom");
      document.querySelectorAll(".diff-slider").forEach((slider) => {
        slider.value = state.difficulty[slider.dataset.level];
        const pct = document.querySelector(`[data-pct="${slider.dataset.level}"]`);
        if (pct) pct.textContent = slider.value + "%";
      });
      recomputeDifficultyTotal();
    } else {
      setDiffTab("quick");
      selectQuickDiff(state.difficultyMode || "mixed");
    }
  }

  function restoreSettingsUI() {
    if (state.questionCount) {
      const matchBtn = document.querySelector(`.count-btn[data-count="${state.questionCount}"]`);
      if (matchBtn) {
        matchBtn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
      } else {
        document.querySelector('.count-btn[data-count="custom"]')
          ?.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
        const input = $("custom-count-input");
        if (input) { input.classList.remove("hidden"); input.value = state.questionCount; }
      }
    }
    if (state.timeLimit) {
      const matchTimeBtn = document.querySelector(`.time-btn[data-time="${state.timeLimit}"]`);
      if (matchTimeBtn) {
        matchTimeBtn.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
      } else {
        document.querySelector('.time-btn[data-time="custom"]')
          ?.classList.add("border-indigo-400", "bg-indigo-50", "text-indigo-700");
        const timeInput = $("custom-time-input");
        if (timeInput) { timeInput.classList.remove("hidden"); timeInput.value = state.timeLimit; }
      }
    }
    checkCountWarning();
  }

  /* ---------------- INIT ---------------- */
  function init() {
    initCategory();
    initMode();
    initSelectAllSubjects();
    initClearTopics();
    initDifficulty();
    initSettings();
    initGenerateButtons();
    initResetAndMobile();
    initStepNav();
    updateSummary();
    validateReady();
    icons();
    restoreState();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();