document.addEventListener("DOMContentLoaded", () => {

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ===== Features grid ===== */
  const fCards = document.querySelectorAll("#features .grid > div");

  if (fCards.length) {
    fCards.forEach((c) => c.classList.remove("reveal"));

    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        const card = e.target;
        card.style.setProperty("--d", (i * 0.08) + "s");
        card.classList.add("in-view");
        setTimeout(() => card.classList.add("ready"), 1400 + i * 80);
        io.unobserve(card);
      });
    }, { threshold: 0.12 });

    fCards.forEach((c) => io.observe(c));

    if (fine) {
      fCards.forEach((card) => {
        card.addEventListener("pointermove", (ev) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--mx", (ev.clientX - r.left) + "px");
          card.style.setProperty("--my", (ev.clientY - r.top) + "px");
        });
      });
    }
  }

  /* ===== Journey cards ===== */
  const jCards = document.querySelectorAll(".journey-card");

  const jio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const card = e.target;
      card.classList.add("in-view");
      setTimeout(() => card.classList.add("ready"), 1300);
      jio.unobserve(card);
    });
  }, { threshold: 0.15 });

  jCards.forEach((card) => {
    jio.observe(card);
    if (!fine) return;

    card.addEventListener("pointermove", (ev) => {
      if (!card.classList.contains("ready")) return;
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--ry", (x * 8) + "deg");
      card.style.setProperty("--rx", (-y * 8) + "deg");
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

  /* ===== Comparison table ===== */
  const cmp = document.getElementById("compareTable");

  if (cmp) {
    cmp.classList.remove("reveal");
    const cells = Array.from(cmp.querySelectorAll(".cmp-grid > div"));

    // 3 cells = 1 row
    const rows = [];
    for (let i = 0; i < cells.length; i += 3) rows.push(cells.slice(i, i + 3));

    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        cell.style.setProperty("--rd", (0.25 + r * 0.09 + c * 0.04) + "s");
        if (c === 2 && r > 0) cell.classList.add("hl");
      });
    });

    if (fine) {
      rows.forEach((row) => {
        row.forEach((cell) => {
          cell.addEventListener("pointerenter", () => row.forEach((x) => x.classList.add("row-hover")));
          cell.addEventListener("pointerleave", () => row.forEach((x) => x.classList.remove("row-hover")));
        });
      });
    }

    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        cmp.classList.add("in-view");
        cio.unobserve(cmp);
      });
    }, { threshold: 0.15 });
    cio.observe(cmp);
  }

});



  /* ===== FAQ ===== */
  const faqBox = document.getElementById("faqList");

  if (faqBox) {
    const fio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add("in-view");
        setTimeout(() => el.classList.add("ready"), 1100);
        fio.unobserve(el);
      });
    }, { threshold: 0.1 });

    const prep = () => {
      Array.from(faqBox.children).forEach((el, i) => {
        if (el.dataset.faqAnim) return;
        el.dataset.faqAnim = "1";
        el.classList.remove("reveal");
        el.style.setProperty("--fd", (i * 0.07) + "s");
        fio.observe(el);
      });
    };

    prep();
    new MutationObserver(prep).observe(faqBox, { childList: true });
  }