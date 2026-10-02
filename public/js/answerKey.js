/* Shared Answer Key PDF (direct download). Used by the custom-test and test-series analysis pages. */
(function () {
  "use strict";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const STATUS_LABEL = { correct: "CORRECT", wrong: "INCORRECT", skipped: "SKIPPED" };
  // output:"html" avoids the hidden MathML copy that html2canvas would otherwise draw twice
  const KATEX_OPTS = {
    output: "html",
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ],
    throwOnError: false,
  };

  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s) => esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const letter = (i) => String.fromCharCode(65 + i);
  const fmtScore = (n) => (n === null || n === undefined || isNaN(n) ? "0" : String(Math.round(n * 1000) / 1000));

  function formatDate(ts) {
    const d = new Date(ts);
    if (!ts || isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return (parts.length ? parts.slice(0, 2).map((p) => p[0]).join("") : "S").toUpperCase();
  }

  function tag(cls, icon, text) {
    return text && text !== "-" ? `<span class="ak-tag ${cls}"><i class="fas ${icon}"></i> ${esc(text)}</span>` : "";
  }

  function diffTag(level) {
    if (!level) return "";
    const k = String(level).toLowerCase();
    const cls = ["easy", "medium", "hard"].includes(k) ? `ak-diff-${k}` : "ak-diff-other";
    return `<span class="ak-tag ${cls}"><i class="fas fa-gauge-high"></i> ${esc(String(level).toUpperCase())}</span>`;
  }

  function imgTag(cls, src) {
    // crossorigin is required so html2canvas can draw Cloudinary images into the canvas
    return `<img class="${cls}" src="${escAttr(src)}" alt="" crossorigin="anonymous" />`;
  }

  function optionRows(q, indexes) {
    return indexes.map((i) => {
      const idx = Number(i);
      const opt = (q.options || [])[idx];
      const text = opt === undefined || opt === null ? "" : (typeof opt === "string" ? opt : (opt.text || ""));
      const img = opt && typeof opt === "object" && opt.image ? imgTag("ak-opt-img", opt.image) : "";
      const lt = isNaN(idx) ? "" : `<span class="ak-ans-letter">${letter(idx)}.</span> `;
      return `<div class="ak-ans-row">${lt}${esc(text)}${img}</div>`;
    }).join("");
  }

  // Only two fields per question: Your Option + Correct Option
  function answers(q) {
    const yourState = q.status === "skipped" ? "skip" : (q.status === "correct" ? "ok" : "bad");
    let yourHtml, correctHtml;

    if (q.numericAnswer !== null && q.numericAnswer !== undefined) {
      const u = q.userNumericAnswer;
      const noAns = u === null || u === undefined || u === "";
      yourHtml = `<div class="ak-ans-row">${noAns ? "Not attempted" : esc(String(u))}</div>`;
      correctHtml = `<div class="ak-ans-row">${esc(String(q.numericAnswer))}</div>`;
    } else {
      const picked = q.selectedOptions || [];
      yourHtml = picked.length ? optionRows(q, picked) : `<div class="ak-ans-row">Not attempted</div>`;
      correctHtml = optionRows(q, q.correctAnswers || []) || `<div class="ak-ans-row">-</div>`;
    }

    return `
      <div class="ak-answers">
        <div class="ak-ans ak-your-${yourState}"><p class="ak-ans-label">Your Option</p>${yourHtml}</div>
        <div class="ak-ans ak-ans-correct"><p class="ak-ans-label">Correct Option</p>${correctHtml}</div>
      </div>`;
  }

  function questionCard(q) {
    const st = STATUS_LABEL[q.status] ? q.status : "skipped";
    return `
      <div class="ak-q ak-block">
        <div class="ak-q-head">
          <span class="ak-q-no">QUESTION ${esc(q.order)}</span>
          <span class="ak-q-status ak-st-${st}">${STATUS_LABEL[st]}</span>
        </div>
        <div class="ak-tags">
          ${tag("ak-tag-subject", "fa-book", q.subject)}
          ${tag("ak-tag-topic", "fa-bookmark", q.topic)}
          ${tag("ak-tag-topic", "fa-tags", q.subtopic)}
          ${diffTag(q.difficulty)}
        </div>
        ${q.questionText ? `<p class="ak-qtext">${esc(q.questionText)}</p>` : ""}
        ${q.questionImage ? imgTag("ak-qimg", q.questionImage) : ""}
        ${answers(q)}
        ${q.solutionText ? `<div class="ak-sol"><b>Solution:</b> ${esc(q.solutionText)}</div>` : ""}
        ${q.solutionImage ? imgTag("ak-sol-img", q.solutionImage) : ""}
      </div>`;
  }

  function buildHtml(cfg) {
    const h = cfg.header || {};
    const s = cfg.stats || {};
    const when = formatDate(h.attemptedOn);
    const name = h.userName || "Student";

    const stats = [
      { cls: "score", label: "Total Score", icon: "fa-trophy", value: `${fmtScore(s.score)}<small>/ ${esc(s.totalMarks)}</small>` },
      { cls: "acc", label: "Accuracy", icon: "fa-bullseye", value: `${esc(s.accuracy ?? 0)}%` },
      { cls: "ok", label: "Correct", icon: "fa-circle-check", value: esc(s.correct ?? 0) },
      { cls: "bad", label: "Wrong", icon: "fa-circle-xmark", value: esc(s.wrong ?? 0) },
      { cls: "skip", label: "Unattempted", icon: "fa-circle-minus", value: esc(s.unattempted ?? 0) },
      { cls: "time", label: "Time Taken", icon: "fa-clock", value: esc(formatDuration(s.timeTakenSeconds)) },
    ];

    // Group questions by subject, keeping first-appearance order
    const groups = [];
    const pos = new Map();
    (cfg.questions || []).forEach((q) => {
      const key = q.subject && q.subject !== "-" ? q.subject : "General";
      if (!pos.has(key)) { pos.set(key, groups.length); groups.push({ name: key, items: [] }); }
      groups[pos.get(key)].items.push(q);
    });

    return `
      <div class="ak-block">
        <div class="ak-head">
          <div class="ak-logo"><i class="fas fa-clipboard-list"></i></div>
          <div>
            <div class="ak-title-row">
              <h1 class="ak-title">${esc(h.title || "Answer Key")}</h1>
              <span class="ak-badge">Answer Key</span>
            </div>
            <div class="ak-meta">
              ${when ? `<span><i class="fas fa-calendar"></i>Attempted on ${esc(when)}</span>` : ""}
              ${h.durationMinutes ? `<span><i class="fas fa-clock"></i>Duration: <b>${esc(h.durationMinutes)} Minutes</b></span>` : ""}
              <span class="ak-done"><i class="fas fa-circle-check"></i>Status: <b>Completed</b></span>
            </div>
          </div>
        </div>

        <div class="ak-user">
          <div class="ak-avatar">${esc(initials(name))}</div>
          <div>
            <p class="ak-user-name">${esc(name)}</p>
            ${h.subline ? `<p class="ak-user-sub">${esc(h.subline)}</p>` : ""}
            ${when ? `<p class="ak-user-sub">Attempted on ${esc(when)}</p>` : ""}
          </div>
        </div>

        <div class="ak-stats">
          ${stats.map((x) => `
            <div class="ak-stat ${x.cls}">
              <div class="ak-stat-top"><span>${x.label}</span><i class="fas ${x.icon}"></i></div>
              <div class="ak-stat-val">${x.value}</div>
            </div>`).join("")}
        </div>
      </div>

      ${groups.map((g) => `
        <div class="ak-block ak-subject-wrap"><div class="ak-subject">${esc(g.name)}</div></div>
        ${g.items.map(questionCard).join("")}`).join("")}

      <div class="ak-block ak-foot">Generated on ${esc(formatDate(Date.now()))} &bull; WarmupExam</div>`;
  }

    // SVG logo -> PNG (jsPDF SVG nahi leta)
  function loadLogo(src, px) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = c.height = px;
          c.getContext("2d").drawImage(img, 0, 0, px, px);
          resolve(c.toDataURL("image/png"));
        } catch (_) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    return Promise.all(imgs.map((im) => (im.complete ? null : new Promise((res) => {
      im.onload = im.onerror = res;
      setTimeout(res, 8000);
    }))));
  }

  // Each block (header, subject heading, question card) is captured on its own and placed on A4 pages,
  // so cards never split across pages and the canvas never gets too large.
  async function renderPdf(root, fileName, onProgress) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 10, GAP = 3;
    const usableW = pageW - 2 * M;
    const bottom = pageH - M - 6;           // keep 6mm for the page number
    const blocks = Array.from(root.querySelectorAll(":scope > .ak-block"));
    let y = M;

    for (let i = 0; i < blocks.length; i++) {
      const el = blocks[i];
      const ratio = usableW / el.offsetWidth;
      let w = usableW;
      let h = el.offsetHeight * ratio;
      if (h > bottom - M) { const k = (bottom - M) / h; w *= k; h = bottom - M; }   // taller than a page: shrink to fit

      // keep a subject heading together with the first question under it
      const nextH = el.classList.contains("ak-subject-wrap") && blocks[i + 1] ? blocks[i + 1].offsetHeight * ratio : 0;
      if (y > M && y + h + nextH > bottom) { doc.addPage(); y = M; }

      const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", M + (usableW - w) / 2, y, w, h);
      canvas.width = canvas.height = 0;
      y += h + GAP;
      onProgress(i + 1, blocks.length);
    }

        const logo = await loadLogo("/images/logo.svg", 400);

    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);

      // Watermark: logo + WarmupExam (halka, content ke upar)
      doc.setGState(new doc.GState({ opacity: 0.08 }));
      if (logo) doc.addImage(logo, "PNG", pageW / 2 - 35, pageH / 2 - 55, 70, 70);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(42);
      doc.setTextColor(67, 24, 255);
      doc.text("WarmupExam", pageW / 2, pageH / 2 + 35, { align: "center" });
      doc.setGState(new doc.GState({ opacity: 1 }));

      // Page number
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150);
      if (logo) doc.addImage(logo, "PNG", M, pageH - 9.5, 4.5, 4.5);
doc.text("warmupexam.com", M + (logo ? 6 : 0), pageH - 6);
      doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 6, { align: "right" });
    }
    doc.save(fileName + ".pdf");
  }

  async function download(cfg) {
    const btn = cfg.button || null;
    const fail = (m) => { if (cfg.onError) cfg.onError(m); };

    if (!window.jspdf || !window.html2canvas) { fail("PDF tools failed to load. Please refresh the page and try again."); return; }
    if (!cfg.questions || !cfg.questions.length) { fail("No questions found to export."); return; }

    const original = btn ? btn.innerHTML : "";
    if (btn) btn.disabled = true;

    const root = document.createElement("div");
    root.className = "ak-root ak-capture";
    root.innerHTML = buildHtml(cfg);
    document.body.appendChild(root);

    try {
      if (typeof renderMathInElement === "function") renderMathInElement(root, KATEX_OPTS);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await waitForImages(root);

      const fileName = String((cfg.header && cfg.header.title) || "Answer_Key")
        .replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") + "_Answer_Key";

      await renderPdf(root, fileName, (i, n) => {
        if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> GENERATING ${i}/${n}`;
      });
    } catch (err) {
      console.error("Answer key PDF error:", err);
      fail("Unable to generate the PDF. Please try again.");
    } finally {
      root.remove();
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
  }

  window.AnswerKey = { download };
})();