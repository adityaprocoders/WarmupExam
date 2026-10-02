(function () {
  "use strict";

    const { paperId, returnUrl, userName } = JSON.parse(document.getElementById("analysisPageData").textContent);
  const TIER = document.querySelector("[data-tier]")?.dataset.tier || "free";
  const RESULT_KEY = "wue:customPaper:result:" + paperId;
  const $ = (id) => document.getElementById(id);

  let currentFilter = "all";
  let solutions = [];
  let currentResult = null;
  let reportState = { questionId: null, reason: null };

  const STATUS_META = {
    correct: { label: "Correct", color: "#05CD99" },
    wrong: { label: "Incorrect", color: "#D32F2F" },
    skipped: { label: "Skipped", color: "#FF9E2C" },
  };

  /* ---------------- HELPERS ---------------- */
  function fmt(n) { return (n ?? 0).toLocaleString("en-IN"); }
  function formatScore(n) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return (Math.round(n * 1000) / 1000).toString();
  }
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.innerText = str ?? "";
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function pct(part, total) { return total > 0 ? Math.round((part / total) * 100) : 0; }
  function isNum(v) { return typeof v === "number" && !isNaN(v); }
  function formatTime(sec) {
    sec = Math.max(0, Number(sec) || 0);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (x) => String(x).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  /* ---------------- LOAD RESULT (custom logic, unchanged) ---------------- */
  async function loadResult() {
    try {
      const raw = localStorage.getItem(RESULT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    if (TIER === "pro" || TIER === "promax") {
      try {
        const res = await fetch(`/api/custom-test/attempt/${paperId}/analysis`, { credentials: "same-origin" });
        if (res.ok) {
          const data = await res.json();
          if (data.success) return data;
        }
      } catch (_) {}
    }
    return null;
  }

  /* ---------------- NORMALISE perQuestion -> solutions[] ---------------- */
  function buildSolutions(result) {
    return result.perQuestion.map((s, i) => {
      const status = !s.answered ? "skipped" : s.isCorrect ? "correct" : "wrong";
      const selected = Array.isArray(s.selected)
        ? s.selected
        : (s.selected === null || s.selected === undefined ? [] : [s.selected]);
      return {
        order: (s.index ?? i) + 1,
        status,
        subject: s.subject || "-",
        topic: s.topic || "",
        subtopic: s.subtopic || "",
        difficulty: s.difficulty || "",
        type: s.type || "",
        questionId: s.questionId || s._id || "",
        questionText: s.questionText || "",
        questionImage: s.questionImage || "",
        options: s.options || [],
        correctAnswers: s.correctAnswers || [],
        selectedOptions: selected,
        numericAnswer: s.numericAnswer,
        userNumericAnswer: s.numericValue,
        solutionText: s.solutionText || (s.solution && s.solution.text) || "",
solutionImage: s.solutionImage || (s.solution && s.solution.image) || "",
        // optional fields (agar tumhare result me ho to use honge)
        visited: s.visited,
        marked: !!(s.marked || s.markedForReview),
        marksAwarded: isNum(s.marksAwarded) ? s.marksAwarded : (isNum(s.marks) ? s.marks : null),
        negative: isNum(s.negativeMarks) ? s.negativeMarks : null,
      };
    });
  }

  /* ---------------- SECTION BREAKDOWN (bySubject + perQuestion) ---------------- */
  function buildSectionBreakdown(result, sols) {
    const scheme = result.markingScheme || null; // optional: { correct: 4, wrong: -1 }
    return Object.entries(result.bySubject).map(([subject, s]) => {
      const qs = sols.filter((q) => q.subject === subject);
      const answered = (s.correct || 0) + (s.wrong || 0);
      const skipped = s.skipped || 0;

      const notVisited = qs.some((q) => q.visited === false)
        ? qs.filter((q) => q.visited === false && q.status === "skipped").length
        : 0;
      const notAnswered = Math.max(0, skipped - notVisited);
      const marked = qs.filter((q) => q.marked).length;

      let marks = null, negativeMarks = null;
      if (qs.length && qs.every((q) => q.marksAwarded !== null)) {
        marks = qs.reduce((a, q) => a + q.marksAwarded, 0);
        negativeMarks = qs.reduce((a, q) => a + (q.negative !== null ? Math.abs(q.negative) : (q.marksAwarded < 0 ? Math.abs(q.marksAwarded) : 0)), 0);
      } else if (isNum(s.marks)) {
        marks = s.marks;
        negativeMarks = isNum(s.negativeMarks) ? s.negativeMarks : null;
      } else if (scheme && isNum(scheme.correct) && isNum(scheme.wrong)) {
        marks = (s.correct || 0) * scheme.correct + (s.wrong || 0) * scheme.wrong;
        negativeMarks = (s.wrong || 0) * Math.abs(scheme.wrong);
      }

      return {
        section: subject, questions: s.total || 0, answered, notAnswered, marked, notVisited, marks, negativeMarks,
      };
    });
  }

  /* ---------------- TOPIC BREAKDOWN ---------------- */
  function buildTopicBreakdown(result) {
    return Object.entries(result.bySubject).map(([subject, s]) => {
      const attempted = (s.correct || 0) + (s.wrong || 0);
      return {
        subject, attempted, correct: s.correct || 0, wrong: s.wrong || 0,
        accuracy: attempted ? Math.round((s.correct / attempted) * 100) : 0,
      };
    });
  }

  /* ---------------- RENDER: TOP CARDS ---------------- */
  function renderTop(result) {
    $("an-score").innerText = formatScore(result.score);
    $("an-total-marks").innerText = result.totalMarks;
    const scorePct = result.totalMarks > 0 ? Math.max(0, Math.min(100, (result.score / result.totalMarks) * 100)) : 0;
    $("bar-score").style.width = scorePct + "%";

    $("an-attempt").innerText = result.attempted;
    $("an-total-qs").innerText = result.totalQuestions;
    $("bar-attempt").style.width = pct(result.attempted, result.totalQuestions) + "%";

    $("an-time").innerText = formatTime(result.timeTakenSeconds);

    $("an-accuracy").innerText = result.accuracy;
    $("bar-accuracy").style.width = Math.min(100, result.accuracy) + "%";

    // Comparison: sirf "Your Accuracy" (avg / top10 custom me available nahi -> N/A, HTML me already set)
    $("cmp-your").innerText = result.accuracy + "%";
    $("cmp-your-bar").style.width = Math.min(100, result.accuracy) + "%";
  }

  /* ---------------- RENDER: SECTION TABLE ---------------- */
  function cell(v) { return v === null || v === undefined ? "-" : formatScore(v); }

  function renderSectionBreakdown(sections) {
    const tbody = $("section-summary-body");
    if (!sections.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-400 py-6 text-xs">No data available.</td></tr>';
      return;
    }

    const sum = (k) => sections.reduce((a, s) => a + (s[k] || 0), 0);
    const hasMarks = sections.every((s) => s.marks !== null);
    const hasNeg = sections.every((s) => s.negativeMarks !== null);

    const rowsHtml = sections.map((s) => `
      <tr class="border-t border-gray-50">
        <td class="px-4 py-3 text-gray-700 font-semibold">${escapeHtml(s.section || "-")}</td>
        <td class="px-4 py-3 text-center text-gray-700">${fmt(s.questions)}</td>
        <td class="px-4 py-3 text-center text-[#05CD99] font-bold">${fmt(s.answered)}</td>
        <td class="px-4 py-3 text-center text-[#D32F2F] font-bold">${fmt(s.notAnswered)}</td>
        <td class="px-4 py-3 text-center text-[#4318FF] font-bold">${fmt(s.marked)}</td>
        <td class="px-4 py-3 text-center text-gray-400">${fmt(s.notVisited)}</td>
        <td class="px-4 py-3 text-center text-gray-800 font-bold">${cell(s.marks)}</td>
        <td class="px-4 py-3 text-center text-[#D32F2F] font-bold">${cell(s.negativeMarks)}</td>
      </tr>`).join("");

    const totalRow = `
      <tr class="border-t border-gray-200 bg-gray-50 font-extrabold">
        <td class="px-4 py-3 text-gray-900">Total</td>
        <td class="px-4 py-3 text-center text-gray-900">${fmt(sum("questions"))}</td>
        <td class="px-4 py-3 text-center text-[#05CD99]">${fmt(sum("answered"))}</td>
        <td class="px-4 py-3 text-center text-[#D32F2F]">${fmt(sum("notAnswered"))}</td>
        <td class="px-4 py-3 text-center text-[#4318FF]">${fmt(sum("marked"))}</td>
        <td class="px-4 py-3 text-center text-gray-500">${fmt(sum("notVisited"))}</td>
        <td class="px-4 py-3 text-center text-gray-900">${hasMarks ? formatScore(sum("marks")) : "-"}</td>
        <td class="px-4 py-3 text-center text-[#D32F2F]">${hasNeg ? formatScore(sum("negativeMarks")) : "-"}</td>
      </tr>`;

    tbody.innerHTML = rowsHtml + totalRow;
  }

  /* ---------------- RENDER: TOPIC STRENGTH ---------------- */
  function renderTopicStrength(topics) {
    const container = $("topic-strength-list");
    if (!topics.length) {
      container.innerHTML = '<p class="text-xs text-center text-gray-400 py-10">No data available. Complete a test first.</p>';
      return;
    }
    container.innerHTML = topics.map((t) => {
      const correctPct = t.attempted > 0 ? (t.correct / t.attempted) * 100 : 0;
      const wrongPct = t.attempted > 0 ? (t.wrong / t.attempted) * 100 : 0;
      return `
        <div class="space-y-2 pb-6 border-b border-gray-50 last:border-0 last:pb-0">
          <span class="text-xs font-extrabold text-[#4318FF] uppercase tracking-wide">${escapeHtml(t.subject)}</span>
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-gray-800">${t.attempted} Questions Attempted</span>
            <span class="text-xs font-bold whitespace-nowrap">
              <span class="text-[#05CD99]">CORRECT: ${t.correct}</span>
              <span class="text-[#D32F2F] ml-2">WRONG: ${t.wrong}</span>
            </span>
          </div>
          <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
            <div class="h-full bg-[#05CD99]" style="width:${correctPct}%"></div>
            <div class="h-full bg-[#D32F2F]" style="width:${wrongPct}%"></div>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-gray-400 font-semibold">ACCURACY: ${t.accuracy}%</span>
            <span class="text-gray-400 font-semibold">${t.attempted === 0 ? "NOT ATTEMPTED" : "SECTIONAL PERFORMANCE"}</span>
          </div>
        </div>`;
    }).join("");
  }

  /* ---------------- RENDER: CHART ---------------- */
  function renderChart(result) {
    const canvas = $("chartTimeAnalysis");
    if (typeof Chart === "undefined" || !canvas) return;
    const skippedN = Math.max(0, result.totalQuestions - result.attempted);

    if (window.analysisChartInstance) window.analysisChartInstance.destroy();
    window.analysisChartInstance = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Skipped", "Correct", "Wrong"],
        datasets: [{
          data: [skippedN, result.correct, result.wrong],
          backgroundColor: ["#CBD5E1", "#05CD99", "#D32F2F"],
          borderWidth: 0,
        }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { position: "bottom" } } },
    });
  }

  /* ---------------- MATH ---------------- */
  function renderMath() {
    if (typeof renderMathInElement === "function") {
      document.querySelectorAll(".katex-content").forEach((el) => {
        renderMathInElement(el, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      });
    } else {
      setTimeout(renderMath, 200);
    }
  }

  /* ---------------- SOLUTIONS ---------------- */
  function optionLabel(idx) { return String.fromCharCode(65 + idx); }

  function typeIcon(type) {
    const t = String(type || "").toLowerCase();
    if (t === "integer") return "fa-hashtag";
    if (t === "multiple") return "fa-square-check";
    return "fa-circle-dot";
  }

  function buildMetaBadge(icon, color, text) {
    if (!text) return "";
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style="background:${color}1A; color:${color}">
      <i class="fas ${icon}"></i> ${escapeHtml(text)}</span>`;
  }

  function buildDifficultyBadge(level) {
    if (!level) return "";
    const color = { easy: "#05CD99", medium: "#FF9E2C", hard: "#D32F2F" }[String(level).toLowerCase()] || "#64748B";
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase" style="background:${color}1A; color:${color}">
      <i class="fas fa-gauge-high"></i> ${escapeHtml(level)}</span>`;
  }

  function buildOptionsHtml(sol) {
    if (sol.numericAnswer !== null && sol.numericAnswer !== undefined) {
      const user = sol.userNumericAnswer;
      const noAns = user === null || user === undefined || user === "";
      const isRight = !noAns && Number(user) === Number(sol.numericAnswer);
      return `
        <div class="px-4 py-3 rounded-lg border border-[#05CD99] bg-green-50 text-sm font-bold text-gray-800 katex-content">
          Correct Answer: ${escapeHtml(sol.numericAnswer)}
        </div>
        <div class="px-4 py-3 rounded-lg border ${noAns ? "border-gray-200 text-gray-500" : (isRight ? "border-[#05CD99] bg-green-50 text-gray-800" : "border-[#D32F2F] bg-red-50 text-gray-800")} text-sm font-bold katex-content">
          Your Answer: ${noAns ? "Not Attempted" : escapeHtml(user)}
        </div>`;
    }

    return (sol.options || []).map((opt, idx) => {
      const isCorrect = (sol.correctAnswers || []).includes(idx);
      const isSelected = (sol.selectedOptions || []).includes(idx);
      let cls = "border-gray-200 text-gray-600";
      if (isCorrect) cls = "border-[#05CD99] bg-green-50 text-gray-800 font-bold";
      else if (isSelected) cls = "border-[#D32F2F] bg-red-50 text-gray-800 font-bold";

      const optText = typeof opt === "string" ? opt : (opt.text || "");
      const optImage = typeof opt === "object" ? opt.image : null;

      return `
        <div class="sol-option-box px-4 py-3 rounded-lg border text-sm katex-content ${cls}">
          ${optImage ? `<img src="${escapeAttr(optImage)}" alt="option ${optionLabel(idx)}" class="max-w-full rounded-md mb-2" loading="lazy" />` : ""}
          ${optText ? `${optionLabel(idx)}. ${escapeHtml(optText)}` : `${optionLabel(idx)}.`}
        </div>`;
    }).join("");
  }

  function buildSolutionCard(sol) {
    const meta = STATUS_META[sol.status] || STATUS_META.skipped;
    return `
      <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" data-status="${sol.status}">
        <div class="flex justify-between items-start mb-3 gap-3">
          <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">QUESTION ${sol.order}</span>
          <span class="text-xs font-extrabold uppercase whitespace-nowrap" style="color:${meta.color}">${meta.label}</span>
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          ${buildMetaBadge("fa-book", "#4318FF", sol.subject)}
          ${buildMetaBadge("fa-bookmark", "#7C3AED", sol.topic)}
          ${buildDifficultyBadge(sol.difficulty)}
        </div>

        ${sol.questionText ? `<p class="text-sm font-semibold text-gray-800 mb-3 katex-content" style="white-space: pre-wrap;">${escapeHtml(sol.questionText)}</p>` : ""}
        ${sol.questionImage ? `
          <div class="mb-4 w-full flex justify-center bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
            <img src="${escapeAttr(sol.questionImage)}" alt="question image"
              class="zoomable-img w-full h-auto max-h-[320px] sm:max-h-[420px] object-contain cursor-zoom-in"
              data-full-src="${escapeAttr(sol.questionImage)}" loading="lazy" />
          </div>` : ""}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${buildOptionsHtml(sol)}</div>

        ${sol.solutionText ? `<div class="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mt-3 katex-content" style="white-space: pre-wrap;"><strong class="text-gray-700">Solution:</strong> ${escapeHtml(sol.solutionText)}</div>` : ""}
        ${sol.solutionImage ? `<img src="${escapeAttr(sol.solutionImage)}" alt="solution image" class="max-w-full rounded-lg mt-3 border border-gray-100" loading="lazy" />` : ""}

      </div>`;
  }

  function renderSolutions() {
    const list = $("solutions-list");
    const filtered = currentFilter === "all" ? solutions : solutions.filter((s) => s.status === currentFilter);
    list.innerHTML = filtered.length
      ? filtered.map(buildSolutionCard).join("")
      : '<p class="text-xs text-center text-gray-400 py-10">No questions in this filter.</p>';
    renderMath();
  }

  function filterSol(filter) {
    currentFilter = filter;
    document.querySelectorAll(".sol-filter-btn").forEach((btn) => {
      btn.className = btn.dataset.filter === filter
        ? "sol-filter-btn px-5 py-2 text-xs font-bold rounded-full bg-[#4318FF] text-white shadow-md transition-all cursor-pointer"
        : "sol-filter-btn px-5 py-2 text-xs font-bold rounded-full bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer";
    });
    renderSolutions();
  }

  /* ---------------- TABS / NAV ---------------- */
  function switchAnalysisTab(tab) {
    const on = "pb-4 font-bold text-sm text-[#4318FF] border-b-2 border-[#4318FF] transition-all cursor-pointer";
    const off = "pb-4 font-bold text-sm text-gray-400 border-b-2 border-transparent hover:text-gray-600 transition-all cursor-pointer";
    $("tab-overall").className = tab === "overall" ? on : off;
    $("tab-solutions").className = tab === "solutions" ? on : off;
    $("an-overall").classList.toggle("hidden", tab !== "overall");
    $("an-solutions").classList.toggle("hidden", tab !== "solutions");
    if (tab === "solutions") renderMath();
  }

  function goBack() { window.location.href = returnUrl || "/custom-test"; }

  /* ---------------- REPORT MODAL ---------------- */
  function showFlashMessage(msg, isError = false) {
    let el = $("inlineFlashMsg");
    if (!el) {
      el = document.createElement("div");
      el.id = "inlineFlashMsg";
      el.className = "fixed top-20 left-1/2 -translate-x-1/2 text-white px-5 py-3 rounded-xl shadow-lg z-[999] text-sm font-medium transition-opacity";
      document.body.appendChild(el);
    }
    el.style.background = isError ? "#D32F2F" : "#1e293b";
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = "0"; }, 4000);
  }

  const REASON_BASE = "report-reason-btn px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50";

  function openReportModal(questionId) {
    reportState = { questionId, reason: null };
    document.querySelectorAll(".report-reason-btn").forEach((b) => { b.className = REASON_BASE; });
    $("reportDescriptionWrap").classList.add("hidden");
    $("reportDescriptionInput").value = "";
    $("reportSubmitBtn").disabled = true;
    $("reportModalOverlay").classList.remove("hidden");
  }
  function closeReportModal() { $("reportModalOverlay").classList.add("hidden"); }

  function selectReportReason(reason, btnEl) {
    reportState.reason = reason;
    document.querySelectorAll(".report-reason-btn").forEach((b) => { b.className = REASON_BASE; });
    btnEl.className = "report-reason-btn px-3 py-2 rounded-xl text-xs font-bold border border-[#4318FF] bg-[#4318FF]/10 text-[#4318FF]";
    $("reportDescriptionWrap").classList.toggle("hidden", reason !== "Other");
    $("reportSubmitBtn").disabled = false;
  }

  async function submitReportRequest() {
    const { questionId, reason } = reportState;
    if (!questionId || !reason) return;
    const description = $("reportDescriptionInput").value.trim();
    const btn = $("reportSubmitBtn");
    const originalText = btn.innerText;
    btn.innerText = "Submitting...";
    btn.disabled = true;

    try {
      const res = await fetch(`/api/questions/${questionId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });
      const out = await res.json();
      closeReportModal();
      if (!out.success) showFlashMessage(out.message || "Failed to submit report.", true);
      else if (out.alreadyReported) showFlashMessage("You already reported this question.");
      else {
        showFlashMessage("Thanks for reporting! Our team will review this within 24-48 hours.");
        const b = document.querySelector(`[data-action="open-report-modal"][data-question-id="${questionId}"]`);
        if (b) {
          b.innerHTML = `<i class="fas fa-check"></i> Reported`;
          b.disabled = true;
          b.className = "flex items-center gap-2 bg-gray-100 border border-gray-200 text-gray-400 px-4 py-2 rounded-full text-xs font-bold cursor-not-allowed";
        }
      }
    } catch (err) {
      console.error("Report submit error:", err);
      showFlashMessage("Failed to submit report.", true);
      closeReportModal();
    } finally {
      btn.innerText = originalText;
    }
  }


    /* ---------------- DOWNLOAD ACCESS (Pro / Pro Max only) ---------------- */
    /* ---------------- DOWNLOAD ACCESS (Pro / Pro Max only) ---------------- */
  const CAN_DOWNLOAD = TIER === "pro" || TIER === "promax";

   function setupDownloadButton() {
    const btn = document.querySelector('[data-action="download-pdf"]');
    if (!btn || CAN_DOWNLOAD) return;
    btn.className = "no-print relative flex items-center gap-2 bg-gray-100 text-gray-400 px-5 py-2.5 rounded-xl font-bold cursor-not-allowed";
    btn.title = "Available for Pro and Pro Max users";
    btn.insertAdjacentHTML("beforeend",
      '<span class="ml-1 px-2 py-0.5 rounded-full bg-[#4318FF] text-white text-[10px] font-extrabold tracking-wide">PRO</span>');
  }

    /* ---------------- ANSWER KEY (direct PDF download) ---------------- */
  function downloadAnswerKeyPdf(btn) {
    if (!CAN_DOWNLOAD) {
      showFlashMessage("Answer Key download is a Pro feature. Taking you to the plans...", true);
      setTimeout(() => { window.location.href = "/pricing?from=" + encodeURIComponent(window.location.pathname); }, 1200);
      return;
    }
    const r = currentResult;
    if (!r || !solutions.length || !window.AnswerKey) {
      showFlashMessage("Unable to generate the PDF right now. Please refresh the page and try again.", true);
      return;
    }

    const cfg = r.config || {};
    const exams = Array.isArray(cfg.exams) ? cfg.exams.filter(Boolean).join(", ") : "";
    const title = exams || r.title || "Custom Paper";
    const subjects = (Array.isArray(cfg.subjects) && cfg.subjects.length) ? cfg.subjects
      : (Array.isArray(r.subjects) && r.subjects.length) ? r.subjects
      : Object.keys(r.bySubject || {});
    const kind = String(paperId).startsWith("ai_") ? "AI Premium Paper" : "Custom Paper";
    const durMin = r.timeLimitSeconds ? Math.round(r.timeLimitSeconds / 60) : (Number(cfg.timeLimit) || 0);

    window.AnswerKey.download({
      button: btn,
      onError: (msg) => showFlashMessage(msg, true),
      header: {
        title,
        subline: kind + (subjects.length ? " \u2022 " + subjects.join(", ") : ""),
        userName: userName || "Student",
        attemptedOn: r.submittedAt || r.generatedAt,
        durationMinutes: durMin,
      },
      stats: {
        score: r.score, totalMarks: r.totalMarks, accuracy: r.accuracy,
        correct: r.correct, wrong: r.wrong,
        unattempted: Math.max(0, r.totalQuestions - r.attempted),
        timeTakenSeconds: r.timeTakenSeconds,
      },
      questions: solutions,
    });
  }


  /* ---------------- EVENTS ---------------- */
  document.addEventListener("click", function (e) {
    const img = e.target.closest(".zoomable-img");
    if (img && img.dataset.fullSrc) {
      window.open(img.dataset.fullSrc, "_blank", "noopener,noreferrer");
      return;
    }
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "switch-tab") switchAnalysisTab(el.dataset.tab);
    else if (action === "go-back") goBack();
    else if (action === "filter-sol") filterSol(el.dataset.filter);
    else if (action === "download-pdf") downloadAnswerKeyPdf(el);
    else if (action === "open-report-modal") openReportModal(el.dataset.questionId);
    else if (action === "close-report-modal") closeReportModal();
    else if (action === "select-report-reason") selectReportReason(el.dataset.reason, el);
    else if (action === "submit-report-btn") submitReportRequest();
  });

  /* ---------------- BOOT ---------------- */
  (async function boot() {
    const result = await loadResult();

    if (!result) {
      showToast("Result not found for this paper. Please attempt the test first.", "error");
      window.location.href = returnUrl || "/custom-test";
      return;
    }
    if (!result.perQuestion || !result.bySubject) {
     showToast("This result is in an old format. Please attempt the test again.", "error");
      try { localStorage.removeItem(RESULT_KEY); } catch (_) {}
      window.location.href = returnUrl || "/custom-test";
      return;
    }

    solutions = buildSolutions(result);
        currentResult = result;

    renderTop(result);
    renderSectionBreakdown(buildSectionBreakdown(result, solutions));
    renderTopicStrength(buildTopicBreakdown(result));
    renderChart(result);
    renderSolutions();
    renderMath();
  })();
})();