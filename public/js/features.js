
 
lucide.createIcons();

/* ---------- Reveal on scroll ---------- */
const revealEls = document.querySelectorAll('.reveal');

if (revealEls.length > 0) {
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealIO.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => revealIO.observe(el));
}


/* ---------- Sticky mobile CTA on scroll ---------- */
const stickyCta = document.getElementById('stickyCta');

if (stickyCta) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 480) {
      stickyCta.classList.remove('translate-y-full');
    } else {
      stickyCta.classList.add('translate-y-full');
    }
  }, { passive: true });
}
 
/* ---------- Count-up stats ---------- */
const counters = document.querySelectorAll('.num-tick');
const countIO = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = Number(el.dataset.count);
    const dur = 1400;
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(eased * target).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    countIO.unobserve(el);
  });
}, { threshold: 0.5 });
counters.forEach(el => countIO.observe(el));

/* ---------- Hero OMR palette + timer ---------- */
const omrGrid = document.getElementById('omrGrid');

if (omrGrid) {
  const TOTAL_CELLS = 18;
  const cellState = Array(TOTAL_CELLS).fill('notVisited');
  const colors = {
    notVisited: 'bg-white/10 text-white/50',
    notAnswered: 'bg-bad text-white',
    answered: 'bg-good text-white',
    marked: 'bg-brand text-white'
  };

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cell = document.createElement('div');
    cell.className = 'omr-cell w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-mono-tab font-bold ' + colors.notVisited;
    cell.textContent = i + 1;
    omrGrid.appendChild(cell);
  }

  function updateCounts() {
    const answered = cellState.filter(s => s === 'answered' || s === 'marked').length;
    const pending = cellState.filter(s => s === 'notAnswered').length;
    document.getElementById('cntA').textContent = answered;
    document.getElementById('cntP').textContent = pending;
  }

  let omrIdx = 0;
  function stepOmr() {
    if (omrIdx >= TOTAL_CELLS) {
      omrIdx = 0; cellState.fill('notVisited'); updateCounts();
      [...omrGrid.children].forEach(c => {
        c.className = c.className.replace(/bg-\S+|text-\S+/g, '').trim() + ' omr-cell w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-mono-tab font-bold ' + colors.notVisited;
      });
      return;
    }
    const r = Math.random();
    const state = r < 0.72 ? 'answered' : (r < 0.9 ? 'marked' : 'notAnswered');
    cellState[omrIdx] = state;
    const cell = omrGrid.children[omrIdx];
    cell.className = 'omr-cell w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-mono-tab font-bold ' + colors[state];
    updateCounts();
    omrIdx++;
  }
  setInterval(stepOmr, 550);

  let omrSeconds = 42 * 60 + 18;
  const omrTimerEl = document.getElementById('omrTimer');
  setInterval(() => {
    omrSeconds--;
    if (omrSeconds < 0) omrSeconds = 42 * 60 + 18;
    const m = String(Math.floor(omrSeconds / 60)).padStart(2, '0');
    const s = String(omrSeconds % 60).padStart(2, '0');
    omrTimerEl.textContent = `${m}:${s}`;
  }, 1000);
}


/* ---------- FAQ accordion ---------- */
const faqList = document.getElementById('faqList');

if (faqList) {
  const faqData = [
    {
      q: "Is WarmUpExam free to use?",
      a: "Yes. Many mock tests are completely free. Premium plans unlock AI-powered analysis, custom mock generation and advanced reports."
    },
    {
      q: "Does the mock actually apply negative marking?",
      a: "Yes — exactly as configured for each subject in that series. Positive and negative marks are set once per subject at series level and applied automatically to every question, so your score reflects the real exam's marking scheme, not a rough estimate."
    },
    {
      q: "Can I attempt on my phone?",
      a: "Yes, the exam interface — timer, OMR palette, fullscreen mode — works on phone, tablet and laptop. For a full-length mock we'd still recommend a laptop or tablet, purely for screen space, but nothing is phone-restricted."
    },
    {
      q: "How does AI Analysis work?",
      a: "After every mock, our AI analyzes your score, accuracy, speed, weak topics, strong topics, expected rank and gives personalized improvement suggestions."
    },
    {
      q: "What happens if my internet drops mid-test?",
      a: "Your responses are saved every time you hit Save & Next or Mark for Review, so a brief drop won't wipe your progress. We do recommend a stable connection for the full duration, since the timer keeps running server-side."
    },
    {
      q: "How is the rank predicted?",
      a: "It's based on your accuracy and speed trend across your last 5 mocks in that exam category, compared against the overall attempt pool. Treat it as a directional signal for where you stand, not a guaranteed outcome."
    },
    {
      q: "Can I practice only weak topics?",
      a: "Absolutely. WarmUpExam automatically identifies your weak areas and creates focused practice tests."
    },
    {
      q: "Can I get a refund if it's not for me?",
      a: "Yes. Every paid batch carries a 7-day money-back guarantee from the date of purchase — no questions asked. Write to us from Contact Us and it's processed within 3–5 working days."
    },
    {
      q: "Do batches expire?",
      a: "A batch stays valid until the exam date it's built around, so you're not racing a subscription clock — just the actual exam."
    }
  ];

  faqData.forEach((item, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'reveal bg-white border border-ink/8 rounded-2xl overflow-hidden';
    wrap.innerHTML = `
      <button type="button" class="faq-trigger w-full flex items-center justify-between gap-4 text-left px-6 py-5 focus-ring" aria-expanded="false">
        <span class="font-semibold text-ink">${item.q}</span>
        <i data-lucide="plus" class="faq-icon w-5 h-5 text-brand shrink-0 transition-transform duration-300"></i>
      </button>
      <div class="accordion-content px-6">
        <p class="text-slate2 text-sm leading-relaxed pb-5">${item.a}</p>
      </div>
    `;
    faqList.appendChild(wrap);

    const trigger = wrap.querySelector('.faq-trigger');
    const content = wrap.querySelector('.accordion-content');
    const icon = wrap.querySelector('.faq-icon');

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      faqList.querySelectorAll('.accordion-content').forEach(c => c.style.maxHeight = null);
      faqList.querySelectorAll('.faq-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
      faqList.querySelectorAll('.faq-icon').forEach(ic => ic.style.transform = 'rotate(0deg)');

      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.style.transform = 'rotate(45deg)';
      }
    });
  });
}

lucide.createIcons();


