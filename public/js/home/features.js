
 
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
      a: "Yes, you can start free. Free test series are open to every logged-in user, and your first mock needs no card. The Custom Paper Generator is free too. Premium test series are paid, and the price is shown on each series card."
    },
    {
      q: "Does the mock actually apply negative marking?",
      a: "Yes. Positive and negative marks are set per subject for each series and applied automatically to every question, so your score follows the real exam's marking scheme."
    },
    {
      q: "Can I attempt on my phone?",
      a: "Yes. The exam screen, with its timer, question palette and fullscreen mode, works on phone, tablet and laptop. For a full-length mock we recommend a laptop or tablet for screen space."
    },
    {
      q: "How does AI Analysis work?",
      a: "After every mock, it analyses your score, accuracy, speed, strong and weak topics, and expected rank, then gives personalised suggestions on what to improve."
    },
    {
      q: "What happens if my internet drops mid-test?",
      a: "Your answers are saved each time you press Save & Next or Mark for Review, so a short drop won't erase your progress. The timer keeps running on our server, so try to stay on a stable connection."
    },
    {
      q: "How is the rank predicted?",
      a: "It uses your accuracy and speed trend across your last 5 mocks in that exam category, compared with other test-takers. Treat it as a direction, not a guaranteed result."
    },
    {
      q: "Can I practice only weak topics?",
      a: "Yes. Every wrong answer is tagged by topic, and you get a Daily Warmup, revision tests built from your incorrect, skipped or marked questions, and topic-wise practice tests."
    },
    {
      q: "How do Live Tests work?",
      a: "Live Tests follow the real exam pattern, timing and marking. Each one stays open for 24 hours, and you get instant analysis, a leaderboard and your rank."
    },
    {
      q: "How long do I get access after enrolling?",
      a: "Each test series stays open for the number of days shown on its card, counted from enrollment. After you enroll, the card shows \"Access valid until\" with your exact date."
    },
    {
      q: "Can I get a refund if it's not for me?",
      a: "Yes. Every paid test series has a 7-day money-back guarantee from the purchase date. Write to us through Contact Us and it's processed within 3 to 5 working days."
    },
    {
      q: "My payment failed but money was deducted. What now?",
      a: "Contact us through Contact Us with your payment reference and we will look into it."
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


