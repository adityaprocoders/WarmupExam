(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const modal = $("examPatternModalOverlay");
  if (!modal) return;

  const openBtn = $("openExamPatternModalBtn");
  const closeBtn = $("epCloseBtn");
  const cancelBtn = $("epCancelBtn");
  const saveBtn = $("epSaveBtn");

  const categorySelect = $("epCategorySelect");
  const examSelect = $("epExamSelect");
  const marksSection = $("epMarksSection");
  const marksTableBody = $("epMarksTableBody");
  const timeSection = $("epTimeSection");
  const timeStrategySelect = $("epTimeStrategy");
  const timeDynamicContainer = $("epTimeDynamicContainer");

  let currentMarksRows = [];   // [{subject, positiveMarks, negativeMarks}] — Listing.marks se aaya
  let selectedSubjects = new Set();   // section-time tag builder ke liye
  let subjectTimeList = [];           // allocated groups
  let editingSubjectTimeIndex = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(str) { return escapeHtml(str); }

  // ---------- Open / Close ----------
  openBtn?.addEventListener("click", async () => {
    resetForm();
    modal.classList.remove("hidden");
    await loadCategories();
  });

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  function closeModal() { modal.classList.add("hidden"); }

  function resetForm() {
    categorySelect.innerHTML = `<option value="">Select category...</option>`;
    examSelect.innerHTML = `<option value="">Select category first...</option>`;
    examSelect.disabled = true;
    marksSection.classList.add("hidden");
    timeSection.classList.add("hidden");
    marksTableBody.innerHTML = "";
    currentMarksRows = [];
    selectedSubjects.clear();
    subjectTimeList = [];
    editingSubjectTimeIndex = null;
    timeStrategySelect.value = "total";
  }

  // ---------- Step 1: Categories ----------
  async function loadCategories() {
    try {
      const res = await fetch("/api/owner/categories");
      const data = await res.json();
      if (!data.success) return;
      categorySelect.innerHTML = `<option value="">Select category...</option>` +
        data.categories.map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join("");
    } catch (err) {
      console.error("Load categories failed:", err);
    }
  }

  categorySelect?.addEventListener("change", async () => {
    const categoryId = categorySelect.value;
    examSelect.innerHTML = `<option value="">Loading...</option>`;
    examSelect.disabled = true;
    marksSection.classList.add("hidden");
    timeSection.classList.add("hidden");

    if (!categoryId) {
      examSelect.innerHTML = `<option value="">Select category first...</option>`;
      return;
    }

    try {
      const res = await fetch(`/api/custom-test/exams?categoryId=${encodeURIComponent(categoryId)}`);
      const data = await res.json();
      const exams = data.exams || [];
      if (!exams.length) {
        examSelect.innerHTML = `<option value="">No exams found</option>`;
        return;
      }
      examSelect.innerHTML = `<option value="">Select exam...</option>` +
        exams.map(e => `<option value="${escapeAttr(e)}">${escapeHtml(e)}</option>`).join("");
      examSelect.disabled = false;
    } catch (err) {
      console.error("Load exams failed:", err);
      examSelect.innerHTML = `<option value="">Load failed</option>`;
    }
  });

  // ---------- Step 2: Exam select → auto marks + prefill existing ----------
  examSelect?.addEventListener("change", async () => {
    const categoryId = categorySelect.value;
    const exam = examSelect.value;

    selectedSubjects.clear();
    subjectTimeList = [];
    editingSubjectTimeIndex = null;

    if (!categoryId || !exam) {
      marksSection.classList.add("hidden");
      timeSection.classList.add("hidden");
      return;
    }

    // Listing.marks se subjects+marks auto-fetch
    try {
      const res = await fetch(`/api/owner/listing-marks?category=${encodeURIComponent(categoryId)}&exam=${encodeURIComponent(exam)}`);
      const data = await res.json();
      currentMarksRows = (data.success && Array.isArray(data.marks)) ? data.marks.map(m => ({
        subject: m.subject, positiveMarks: m.positiveMarks, negativeMarks: m.negativeMarks, questions: 0
      })) : [];
    } catch (err) {
      console.error("Load marks failed:", err);
      currentMarksRows = [];
    }

    // Agar pehle se ExamPatternSummary saved hai to usi ka data prefill karo (questions + timing)
    try {
      const res2 = await fetch(`/api/owner/exam-pattern?category=${encodeURIComponent(categoryId)}&exam=${encodeURIComponent(exam)}`);
      const data2 = await res2.json();
      if (data2.success && data2.data) {
        const doc = data2.data;
        (doc.rows || []).forEach(savedRow => {
          const match = currentMarksRows.find(r => r.subject === savedRow.subject);
          if (match) match.questions = savedRow.questions;
          else currentMarksRows.push({ ...savedRow });
        });

        timeStrategySelect.value = doc.timeStrategy === "sectional" ? "subject" : "total";
        renderTimeUI();

        if (doc.timeStrategy === "sectional") {
          subjectTimeList = (doc.sectionTime || []).map(st => ({
            subject: st.subjects.join(" + "),
            duration: st.duration
          }));
          renderSubjectTimeList();
        } else {
          const totalInput = $("epTotalTimeInput");
          if (totalInput) totalInput.value = doc.totalDuration || 60;
        }
      } else {
        timeStrategySelect.value = "total";
        renderTimeUI();
      }
    } catch (err) {
      console.warn("Load existing exam pattern failed:", err);
      renderTimeUI();
    }

    renderMarksTable();
    marksSection.classList.remove("hidden");
    timeSection.classList.remove("hidden");
  });

  // ---------- Marks table render (Questions editable, marks read-only) ----------
  function renderMarksTable() {
    if (!currentMarksRows.length) {
      marksTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-400 py-6 text-xs">No marks configuration found for this exam.</td></tr>`;
      return;
    }
    marksTableBody.innerHTML = currentMarksRows.map((r, idx) => `
      <tr class="border-t border-gray-50">
        <td class="px-4 py-2.5 font-semibold text-gray-800">${escapeHtml(r.subject)}</td>
        <td class="px-4 py-2.5 text-center">
          <input type="number" min="0" data-idx="${idx}" class="epQuestionsInput w-20 border rounded-lg px-2 py-1.5 text-sm text-center" value="${r.questions || ""}">
        </td>
        <td class="px-4 py-2.5 text-center text-gray-600">${r.positiveMarks}</td>
        <td class="px-4 py-2.5 text-center text-gray-600">${r.negativeMarks}</td>
      </tr>
    `).join("");

    marksTableBody.querySelectorAll(".epQuestionsInput").forEach(inp => {
      inp.addEventListener("input", () => {
        currentMarksRows[Number(inp.dataset.idx)].questions = Number(inp.value) || 0;
      });
    });
  }

  // ---------- Time Strategy UI — bilkul Test Builder jaisa (tag + dropdown + Add Subject Time) ----------
  timeStrategySelect?.addEventListener("change", renderTimeUI);

  function getSubjectOptionsHtml() {
    if (!currentMarksRows.length) return `<option value="">No subjects</option>`;
    return currentMarksRows.map(r => `<option value="${escapeAttr(r.subject)}">${escapeHtml(r.subject)}</option>`).join("");
  }

  function renderTimeUI() {
    const strategy = timeStrategySelect.value;

    if (strategy === "total") {
      timeDynamicContainer.innerHTML = `
        <div>
          <label class="block text-sm font-bold mb-2">Total Time (in minutes)</label>
          <input type="number" id="epTotalTimeInput" placeholder="e.g. 120" class="w-full md:w-48 p-3 border rounded-lg" value="60">
        </div>`;
      selectedSubjects.clear();
    } else {
      editingSubjectTimeIndex = null;
      timeDynamicContainer.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold mb-2">Section</label>
            <div id="epTagContainer" class="min-h-[50px] p-2 border bg-white rounded-xl flex flex-wrap gap-2 mb-2"></div>
            <select id="epSubjectDropdown" class="w-full p-3 border rounded-xl">
              <option value="" disabled selected>Choose a subject</option>
              ${getSubjectOptionsHtml()}
            </select>
          </div>
          <div>
            <label class="block text-sm font-bold mb-2">Time (in minutes)</label>
            <input type="number" id="epSubTime" class="w-full p-3 border rounded-lg" placeholder="Enter minutes">
            <button type="button" id="epAddSubjectTimeBtn" class="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Add Subject Time</button>
          </div>
        </div>
        <div id="epAddedList" class="mt-6 pt-4 border-t border-gray-200"><h3 class="text-sm font-bold mb-2">Allocated Times:</h3></div>`;

      $("epSubjectDropdown")?.addEventListener("change", addTag);
      $("epAddSubjectTimeBtn")?.addEventListener("click", addSubjectTime);
      renderSubjectTimeList();
    }
  }

  function addTag() {
    const d = $("epSubjectDropdown");
    if (d.value && !selectedSubjects.has(d.value)) {
      selectedSubjects.add(d.value);
      renderTags();
    }
    d.value = "";
  }

  function renderTags() {
    const c = $("epTagContainer");
    if (!c) return;
    c.innerHTML = "";
    selectedSubjects.forEach(s => {
      c.innerHTML += `<span class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">${escapeHtml(s)} <button type="button" data-subject="${escapeAttr(s)}" class="epRemoveTagBtn hover:text-red-200 font-bold">✕</button></span>`;
    });
    c.querySelectorAll(".epRemoveTagBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedSubjects.delete(btn.dataset.subject);
        renderTags();
      });
    });
  }

  function addSubjectTime() {
    const t = $("epSubTime").value;
    if (selectedSubjects.size > 0 && t) {
      const subjectLabel = Array.from(selectedSubjects).join(" + ");
      const newEntry = { subject: subjectLabel, duration: Number(t) };

      if (editingSubjectTimeIndex !== null) {
        subjectTimeList[editingSubjectTimeIndex] = newEntry;
        editingSubjectTimeIndex = null;
        resetAddSubjectTimeButton();
      } else {
        subjectTimeList.push(newEntry);
      }

      renderSubjectTimeList();
      selectedSubjects.clear();
      renderTags();
      $("epSubTime").value = "";
    }
  }

  function renderSubjectTimeList() {
    const addedList = $("epAddedList");
    if (!addedList) return;

    addedList.innerHTML = '<h3 class="text-sm font-bold mb-2">Allocated Times:</h3>';

    subjectTimeList.forEach((st, index) => {
      addedList.innerHTML += `
        <div class="flex justify-between items-center p-3 mb-2 bg-white border border-indigo-100 rounded-lg">
          <span class="text-sm font-medium">${escapeHtml(st.subject)}</span>
          <div class="flex items-center gap-3">
            <span class="font-bold text-indigo-600">${st.duration} mins</span>
            <button type="button" data-index="${index}" class="epEditTimeBtn text-gray-400 hover:text-indigo-600">
              <i class="fa-solid fa-pen text-xs"></i>
            </button>
            <button type="button" data-index="${index}" class="epRemoveTimeBtn text-gray-400 hover:text-red-500">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        </div>`;
    });

    addedList.querySelectorAll(".epEditTimeBtn").forEach(btn => {
      btn.addEventListener("click", () => editSubjectTime(Number(btn.dataset.index)));
    });
    addedList.querySelectorAll(".epRemoveTimeBtn").forEach(btn => {
      btn.addEventListener("click", () => removeSubjectTime(Number(btn.dataset.index)));
    });
  }

  function editSubjectTime(index) {
    const entry = subjectTimeList[index];
    if (!entry) return;
    editingSubjectTimeIndex = index;
    selectedSubjects.clear();
    entry.subject.split(" + ").forEach(s => selectedSubjects.add(s.trim()));
    renderTags();
    $("epSubTime").value = entry.duration;
    const btn = $("epAddSubjectTimeBtn");
    if (btn) btn.innerText = "Update Subject Time";
  }

  function removeSubjectTime(index) {
    subjectTimeList.splice(index, 1);
    if (editingSubjectTimeIndex === index) {
      editingSubjectTimeIndex = null;
      resetAddSubjectTimeButton();
      selectedSubjects.clear();
      renderTags();
      $("epSubTime").value = "";
    } else if (editingSubjectTimeIndex !== null && index < editingSubjectTimeIndex) {
      editingSubjectTimeIndex--;
    }
    renderSubjectTimeList();
  }

  function resetAddSubjectTimeButton() {
    const btn = $("epAddSubjectTimeBtn");
    if (btn) btn.innerText = "Add Subject Time";
  }

  // ---------- Save ----------
  saveBtn?.addEventListener("click", async () => {
    const category = categorySelect.value;
    const exam = examSelect.value;

    if (!category || !exam) {
       showToast("Please select both a Category and an Exam.", "error");
      return;
    }
    if (!currentMarksRows.length) {
      showToast("No subjects/marks found for this exam.", "error");
      return;
    }

    const rows = currentMarksRows.map(r => ({
      subject: r.subject,
      questions: Number(r.questions) || 0,
      positiveMarks: r.positiveMarks,
      negativeMarks: r.negativeMarks
    }));

    const strategy = timeStrategySelect.value;
    const payload = { category, exam, rows, timeStrategy: strategy === "subject" ? "sectional" : "total" };

    if (strategy === "total") {
      payload.totalDuration = Number($("epTotalTimeInput")?.value) || 60;
    } else {
      if (!subjectTimeList.length) {
        showToast("Please add at least one time-group for sectional timing.", "error");
        return;
      }
      payload.sectionTime = subjectTimeList.map(st => ({
        subjects: st.subject.split(" + ").map(s => s.trim()),
        duration: st.duration
      }));
    }

    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";

    try {
      const res = await fetch("/api/owner/exam-pattern", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
      } else {
         showToast(data.message || "Failed to save.", "error");
      }
    } catch (err) {
      console.error("Save exam pattern error:", err);
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });







    // ==========================================================
  // MANAGE EXAM PATTERN — list + edit + delete
  // ==========================================================
  const manageModal = $("examPatternManageModalOverlay");
  const manageBtn = $("openManageExamPatternBtn");
  const epmCloseBtn = $("epmCloseBtn");
  const epmCategoryFilter = $("epmCategoryFilter");
  const epmGrid = $("epmGrid");
  const epmEmptyMsg = $("epmEmptyMsg");

  manageBtn?.addEventListener("click", async () => {
    manageModal.classList.remove("hidden");
    await loadManageCategories();
    await loadPatternsList();
  });

  epmCloseBtn?.addEventListener("click", () => manageModal.classList.add("hidden"));
  manageModal?.addEventListener("click", (e) => {
    if (e.target === manageModal) manageModal.classList.add("hidden");
  });

  async function loadManageCategories() {
    try {
      const res = await fetch("/api/owner/categories");
      const data = await res.json();
      if (!data.success) return;
      epmCategoryFilter.innerHTML = `<option value="">All Categories</option>` +
        data.categories.map(c => `<option value="${c._id}">${escapeHtml(c.name)}</option>`).join("");
    } catch (err) {
      console.error("Load categories (manage) failed:", err);
    }
  }

  epmCategoryFilter?.addEventListener("change", loadPatternsList);

  async function loadPatternsList() {
    epmGrid.innerHTML = `<p class="text-gray-400 text-sm col-span-full text-center py-8">Loading...</p>`;
    epmEmptyMsg.classList.add("hidden");

    try {
      const categoryId = epmCategoryFilter.value;
      const url = categoryId
        ? `/api/owner/exam-pattern/list?category=${encodeURIComponent(categoryId)}`
        : `/api/owner/exam-pattern/list`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.success || !data.patterns.length) {
        epmGrid.innerHTML = "";
        epmEmptyMsg.classList.remove("hidden");
        return;
      }

      epmGrid.innerHTML = data.patterns.map(patternCard).join("");
      attachPatternCardEvents();
    } catch (err) {
      console.error("Load patterns list failed:", err);
      epmGrid.innerHTML = `<p class="text-red-500 text-sm col-span-full text-center py-8">An error occurred while loading.</p>`;
    }
  }

  function patternCard(p) {
    const totalQuestions = (p.rows || []).reduce((sum, r) => sum + (r.questions || 0), 0);
    const subjectCount = (p.rows || []).length;
    const timingLabel = p.timeStrategy === "sectional"
      ? `${(p.sectionTime || []).length} time group${(p.sectionTime || []).length !== 1 ? "s" : ""}`
      : `${p.totalDuration || 0} min (total)`;

    return `
      <div class="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="min-w-0">
            <p class="font-bold text-gray-900 truncate">${escapeHtml(p.exam)}</p>
            <p class="text-xs text-gray-400 truncate">${escapeHtml(p.category?.name || "—")}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-3">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">${subjectCount} subjects</span>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">${totalQuestions} Qs</span>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">${timingLabel}</span>
        </div>
        <div class="flex gap-2">
          <button data-category="${p.category?._id || ""}" data-exam="${escapeAttr(p.exam)}"
            class="epmEditBtn flex-1 text-center border-2 border-indigo-600 text-indigo-600 text-sm font-semibold py-2 rounded-lg hover:bg-indigo-50">
            Edit
          </button>
          <button data-id="${p._id}"
            class="epmDeleteBtn flex-1 text-center bg-red-50 text-red-600 text-sm font-semibold py-2 rounded-lg hover:bg-red-100">
            Delete
          </button>
        </div>
      </div>`;
  }

  function attachPatternCardEvents() {
    epmGrid.querySelectorAll(".epmEditBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const categoryId = btn.dataset.category;
        const exam = btn.dataset.exam;
        manageModal.classList.add("hidden");

        // Add-modal khol ke us category+exam se prefill karo
        resetForm();
        modal.classList.remove("hidden");
        await loadCategories();
        categorySelect.value = categoryId;
        categorySelect.dispatchEvent(new Event("change"));

        // exams load hone ka wait karo, fir exam select karo
        const waitForExam = setInterval(() => {
          if (!examSelect.disabled && Array.from(examSelect.options).some(o => o.value === exam)) {
            clearInterval(waitForExam);
            examSelect.value = exam;
            examSelect.dispatchEvent(new Event("change"));
          }
        }, 150);
        setTimeout(() => clearInterval(waitForExam), 5000); // safety timeout
      });
    });

    epmGrid.querySelectorAll(".epmDeleteBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this exam pattern?")) return;
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          const res = await fetch(`/api/owner/exam-pattern/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            loadPatternsList();
          } else {
            showToast(data.message || "Failed to delete.", "error");
            btn.disabled = false;
          }
        } catch (err) {
          showToast("Something went wrong. Please try again.", "error");
          btn.disabled = false;
        }
      });
    });
  }

})();


