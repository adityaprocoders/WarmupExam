(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const overlay = $("syllabusModalOverlay");
  if (!overlay) return;

  const examNameEl = $("syExamName");
  const infoEl = $("syInfo");
  const tabsEl = $("syTabs");
  const loadingEl = $("syLoading");
  const rowsEl = $("syRows");
  const addRowBtn = $("syAddRowBtn");
  const errorEl = $("syError");
  const saveBtn = $("sySaveBtn");

  const MAX_ROWS = 30;
  const STRUCTURE_LABELS = {
    tier: "Tier wise",
    part: "Part wise",
    prelims_mains: "Prelims / Mains wise",
    main_advanced: "Main / Advanced wise",
    custom: "Custom"
  };

  let state = { category: "", exam: "", examStructure: "single", structureType: "", parts: [], active: 0 };

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function emptyRow() { return { subject: "", topics: "" }; }
  function toast(msg, type) {
    if (typeof showToast === "function") showToast(msg, type);
    else alert(msg);
  }
  function showError(msg) {
    errorEl.textContent = msg || "";
    errorEl.classList.toggle("hidden", !msg);
  }

  // ---------- Card button state (green = content added) ----------
  function setBtnState(btn, has) {
    btn.dataset.hasSyllabus = has ? "1" : "0";
    btn.className = "addContentBtn w-full text-center border-2 text-sm font-semibold py-2 rounded-lg " +
      (has ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
           : "border-gray-200 text-gray-600 hover:bg-gray-50");
    btn.innerHTML = has
      ? '<i class="fa-solid fa-circle-check mr-1"></i> Content Added'
      : '<i class="fa-solid fa-table-list mr-1"></i> Add Content';
  }
  function updateCards(has) {
    document.querySelectorAll(".addContentBtn").forEach((btn) => {
      if (btn.dataset.category === state.category && btn.dataset.exam === state.exam) {
        setBtnState(btn, has);
      }
    });
  }

  // ---------- Open / Close ----------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".addContentBtn");
    if (!btn) return;
    e.preventDefault();
    openModal(btn.dataset.category, btn.dataset.exam);
  });

  function closeModal() { overlay.classList.add("hidden"); }
  $("syCloseBtn")?.addEventListener("click", closeModal);
  $("syCancelBtn")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeModal();
  });

  async function openModal(category, exam) {
    state = { category, exam, examStructure: "single", structureType: "", parts: [], active: 0 };
    examNameEl.textContent = exam;
    infoEl.textContent = "";
    tabsEl.innerHTML = "";
    tabsEl.classList.add("hidden");
    rowsEl.innerHTML = "";
    addRowBtn.classList.add("hidden");
    saveBtn.disabled = true;
    showError("");
    loadingEl.textContent = "Loading...";
    loadingEl.classList.remove("hidden");
    overlay.classList.remove("hidden");

    try {
      const res = await fetch(
        `/api/owner/exam-syllabus?category=${encodeURIComponent(category)}&exam=${encodeURIComponent(exam)}`
      );
      const data = await res.json();
      if (!data.success) {
        loadingEl.textContent = data.message || "Failed to load.";
        return;
      }
      state.examStructure = data.examStructure;
      state.structureType = data.structureType || "";
      state.parts = data.parts.map((p) => ({
        key: p.key,
        name: p.name,
        rows: (p.rows || []).map((r) => ({ subject: r.subject || "", topics: r.topics || "" }))
      }));
      state.parts.forEach((p) => { if (!p.rows.length) p.rows.push(emptyRow()); });

      loadingEl.classList.add("hidden");
      renderTabs();
      renderRows();
      saveBtn.disabled = false;
    } catch (err) {
      loadingEl.textContent = "Something went wrong. Please try again.";
    }
  }

  // ---------- Render ----------
  function renderTabs() {
    if (state.examStructure !== "multi") {
      tabsEl.classList.add("hidden");
      tabsEl.innerHTML = "";
      infoEl.textContent = "Default (single exam) - one syllabus table.";
      return;
    }
    infoEl.textContent =
      (STRUCTURE_LABELS[state.structureType] || "Multi-part") +
      " - add the syllabus for each part using the tabs.";
    tabsEl.classList.remove("hidden");
    tabsEl.innerHTML = state.parts.map((p, i) => {
      const filled = p.rows.some((r) => r.subject.trim() || r.topics.trim());
      const active = i === state.active;
      return `<button type="button" data-tab="${i}"
        class="px-4 py-2 rounded-lg text-sm font-semibold border-2 ${active
          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"}">
        ${esc(p.name)}${filled ? ' <i class="fa-solid fa-circle-check text-green-500 ml-1"></i>' : ""}
      </button>`;
    }).join("");
  }

  function renderRows() {
    const part = state.parts[state.active];
    rowsEl.innerHTML = part.rows.map((r, i) => `
      <div class="grid grid-cols-1 md:grid-cols-[14rem_1fr_auto] gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50/60">
        <input type="text" data-idx="${i}" data-field="subject" maxlength="80" value="${esc(r.subject)}"
          placeholder="Subject (e.g. Mathematics)"
          class="w-full p-2.5 border rounded-lg bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
        <textarea data-idx="${i}" data-field="topics" rows="3" maxlength="1500"
          placeholder="Topics & subtopics (comma separated or one per line)"
          class="w-full p-2.5 border rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500">${esc(r.topics)}</textarea>
        <button type="button" data-remove="${i}" title="Remove"
          class="self-start px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100">✕</button>
      </div>`).join("");
    addRowBtn.classList.remove("hidden");
    addRowBtn.disabled = part.rows.length >= MAX_ROWS;
  }

  // ---------- Events ----------
  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    state.active = Number(b.dataset.tab);
    renderTabs();
    renderRows();
  });

  rowsEl.addEventListener("input", (e) => {
    const el = e.target;
    const field = el.dataset.field;
    const idx = Number(el.dataset.idx);
    if (!field || Number.isNaN(idx)) return;
    state.parts[state.active].rows[idx][field] = el.value;
  });

  rowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const rows = state.parts[state.active].rows;
    rows.splice(Number(btn.dataset.remove), 1);
    if (!rows.length) rows.push(emptyRow());
    renderRows();
    renderTabs();
  });

  addRowBtn.addEventListener("click", () => {
    const rows = state.parts[state.active].rows;
    if (rows.length >= MAX_ROWS) return;
    rows.push(emptyRow());
    renderRows();
    renderTabs();
    const inputs = rowsEl.querySelectorAll('input[data-field="subject"]');
    inputs[inputs.length - 1]?.focus();
  });

  // ---------- Save ----------
  saveBtn.addEventListener("click", async () => {
    showError("");

    for (const p of state.parts) {
      for (const r of p.rows) {
        if (!r.subject.trim() && r.topics.trim()) {
          showError((p.name ? p.name + ": " : "") + "Subject name is required for every row.");
          return;
        }
      }
    }

    const oldText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const res = await fetch("/api/owner/exam-syllabus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: state.category, exam: state.exam, parts: state.parts })
      });
      const data = await res.json();
      if (!data.success) {
        showError(data.message || "Failed to save.");
        return;
      }
      updateCards(!!data.hasSyllabus);
      toast(data.message || "Saved.", "success");
      closeModal();
    } catch (err) {
      showError("Something went wrong. Please try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldText;
    }
  });
})();