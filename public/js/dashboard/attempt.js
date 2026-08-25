const pageData = JSON.parse(document.getElementById('attemptPageData').textContent);

/* ================= DATA FROM SERVER ================= */
const testData = {
    id: pageData.testId,
    sessionId: pageData.sessionId,
    timeStrategy: pageData.timeStrategy,
    duration: pageData.duration,
    subjectTime: pageData.subjectTime
};

const returnUrl = pageData.returnUrl;
const HAS_SUBJECT_TABS = pageData.hasSubjectTabs;
const subjectsOrder = pageData.subjectsOrder;
const grouped = pageData.grouped;

let flatQuestions = [];
subjectsOrder.forEach((subj, sIdx) => {
    (grouped[subj] || []).forEach(q => flatQuestions.push({ ...q, subjectIndex: sIdx, sectionIndex: 0 }));
});

let currentIndex = 0;
let currentSectionIndex = 0;

let qState = flatQuestions.map(() => ({ status: 'notVisited', answer: null }));
let testSubmitted = false;

/* ================= MATH RENDERING (KaTeX) ================= */
function renderMath(container) {
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ],
            throwOnError: false
        });
    }
}

/* ================= FULLSCREEN ================= */
function enterFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;

    try {
        const result = req.call(el);

        if (result && typeof result.catch === 'function') {
            result.catch(() => {});
        }
    } catch (e) {
        // sync error bhi silently ignore karo
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) enterFullscreen();
    else document.exitFullscreen();
}
function bootFullscreen() {
    enterFullscreen();
    const armOnce = () => enterFullscreen();
    document.addEventListener('click', armOnce, { once: true });
    document.addEventListener('keydown', armOnce, { once: true });
    document.addEventListener('touchstart', armOnce, { once: true });
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fsToggleBtn');
    if (!btn) return;

    const iconName = document.fullscreenElement ? 'minimize' : 'maximize';

    const existingIcon = btn.querySelector('i, svg');
    if (existingIcon) {
        const freshIcon = document.createElement('i');
        freshIcon.setAttribute('data-lucide', iconName);
        freshIcon.className = existingIcon.getAttribute('class') || 'w-5 h-5 text-blue-600';
        existingIcon.replaceWith(freshIcon);
    }

    if (window.lucide) lucide.createIcons();
});

/* ================= SECTION GROUPING ================= */
let sections = [];

const DEFAULT_SUBJECT_MINUTES = 20;
const DEFAULT_TOTAL_MINUTES = 60;

function normalizeName(s) {
    return (s || '').toString().trim().toLowerCase();
}

function splitSubjectLabel(label) {
    return (label || '').toString()
        .split(/[+,&]/)
        .map(normalizeName)
        .filter(Boolean);
}

function buildSections() {
    const built = [];
    const usedSubjects = new Set();

    testData.subjectTime.forEach(entry => {
        const labelSubjects = splitSubjectLabel(entry.subject);
        const matchedSubjects = subjectsOrder.filter(s => labelSubjects.includes(normalizeName(s)) && !usedSubjects.has(s));
        if (matchedSubjects.length === 0) return;

        const mins = Number(entry.duration) > 0 ? Number(entry.duration) : NaN;
        const durationMinutes = Number.isNaN(mins) ? DEFAULT_SUBJECT_MINUTES : mins;
        if (Number.isNaN(mins)) {
            console.warn(`[ExamWarmUp] Invalid duration for subjectTime entry "${entry.subject}" — falling back to ${DEFAULT_SUBJECT_MINUTES} min.`);
        }

        built.push({
            subjects: matchedSubjects,
            label: matchedSubjects.join(' & '),
            durationMinutes
        });
        matchedSubjects.forEach(s => usedSubjects.add(s));
    });

    subjectsOrder.forEach(s => {
        if (!usedSubjects.has(s)) {
            console.warn(`[ExamWarmUp] No time configured for subject "${s}" — falling back to ${DEFAULT_SUBJECT_MINUTES} min.`);
            built.push({ subjects: [s], label: s, durationMinutes: DEFAULT_SUBJECT_MINUTES });
            usedSubjects.add(s);
        }
    });

    return built;
}

function sectionIndexForSubject(subjectName) {
    const idx = sections.findIndex(sec => sec.subjects.includes(subjectName));
    return idx === -1 ? 0 : idx;
}

function lockSectionsBefore(newIdx) {
    for (let i = 0; i < newIdx; i++) {
        if (!sectionDone[i]) {
            sectionDone[i] = true;
            sectionTimeLeft[i] = 0;
        }
    }
    updateSubjectTabsState();
}

function renderSubjectTabs() {
    const bar = document.getElementById('subjectTabs');
    if (!HAS_SUBJECT_TABS || sections.length === 0) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        bar.innerHTML = '';
        return;
    }
    bar.classList.remove('hidden');
    bar.classList.add('flex');
    bar.innerHTML = '';
    sections.forEach((sec, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.sectionTab = idx;
        btn.className = 'subject-tab whitespace-nowrap px-4 py-2.5 text-sm font-bold border-b-2 border-transparent text-gray-400 hover:text-indigo-500 active:scale-95 transition';
        btn.textContent = sec.label;
        btn.addEventListener('click', () => switchSection(idx));
        bar.appendChild(btn);
    });
}

/* ================= TIMER ================= */
let timerInterval = null;
let sectionTimeLeft = {};
let sectionDone = {};

function initSectionTimers() {
    sections.forEach((sec, idx) => {
        sectionTimeLeft[idx] = sec.durationMinutes * 60;
    });
}

function initTimer() {
    if (!HAS_SUBJECT_TABS) {
        document.getElementById('timerLabel').textContent = 'TEST TIME';
        if (!window.__totalSecondsSet) {
            const totalMins = Number(testData.duration) > 0 ? Number(testData.duration) : NaN;
            if (Number.isNaN(totalMins)) {
                console.warn(`[ExamWarmUp] No valid total duration configured on this test — falling back to ${DEFAULT_TOTAL_MINUTES} min. Check test.duration.`);
                window.totalSeconds = DEFAULT_TOTAL_MINUTES * 60;
            } else {
                window.totalSeconds = totalMins * 60;
            }
            window.__totalSecondsSet = true;
        }
    } else {
        const sec = sections[currentSectionIndex];
        document.getElementById('timerLabel').textContent = sec.label.toUpperCase() + ' SECTION TIME';
    }
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}

function tick() {
    if (!HAS_SUBJECT_TABS) {
        window.totalSeconds--;
        if (window.totalSeconds <= 0) {
            window.totalSeconds = 0;
            updateTimerDisplay();
            clearInterval(timerInterval);
            autoSubmit();
            return;
        }
    } else {
        sectionTimeLeft[currentSectionIndex]--;
        if (sectionTimeLeft[currentSectionIndex] <= 0) {
            sectionTimeLeft[currentSectionIndex] = 0;
            sectionDone[currentSectionIndex] = true;
            updateSubjectTabsState();
            clearInterval(timerInterval);
            goToNextIncompleteSection();
            return;
        }
    }
    updateTimerDisplay();
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
    if (nextIdx === -1) {
        autoSubmit();
    } else {
        switchSection(nextIdx, true);
    }
}

const TIMER_WARNING_THRESHOLD = 60;

function updateTimerDisplay() {
    let secs = !HAS_SUBJECT_TABS
        ? window.totalSeconds
        : sectionTimeLeft[currentSectionIndex];

    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');

    const labelEl = document.getElementById('timerLabel');
    const displayEl = document.getElementById('timerDisplay');

    displayEl.textContent = `${m}:${s}`;

    const isWarning = secs <= TIMER_WARNING_THRESHOLD;

    labelEl.classList.toggle('text-orange-500', isWarning);
    labelEl.classList.toggle('text-slate-500', !isWarning);

    displayEl.classList.toggle('text-orange-600', isWarning);
    displayEl.classList.toggle('text-slate-800', !isWarning);
}

/* ================= RENDER QUESTION ================= */
function renderQuestion() {
    if (flatQuestions.length === 0) return;

    const q = flatQuestions[currentIndex];
    const state = qState[currentIndex];

    if (state.status === 'notVisited') state.status = 'notAnswered';

    let qNo = currentIndex + 1;
    if (HAS_SUBJECT_TABS) {
        const sectionStart = flatQuestions.findIndex(fq => fq.sectionIndex === q.sectionIndex);
        qNo = currentIndex - sectionStart + 1;
    }
    document.getElementById('questionNoLabel').textContent = `Question No. ${qNo}`;

    const qTextEl = document.getElementById('questionText');
    qTextEl.textContent = q.question || '';
    renderMath(qTextEl);

    const qImageEl = document.getElementById('questionImage');
    if (q.questionImage) {
        qImageEl.src = q.questionImage;
        qImageEl.classList.remove('hidden');
    } else {
        qImageEl.classList.add('hidden');
        qImageEl.src = '';
    }

    const optsWrap = document.getElementById('optionsContainer');
    const intWrap = document.getElementById('integerContainer');

    if (q.type === 'integer') {
        intWrap.classList.remove('hidden');
        optsWrap.classList.add('hidden');
        document.getElementById('integerInput').value = state.answer ?? '';
    } else {
        intWrap.classList.add('hidden');
        optsWrap.classList.remove('hidden');
        optsWrap.innerHTML = '';

        const inputType = (q.type === 'multiple') ? 'checkbox' : 'radio';

        q.options.forEach((opt, idx) => {
            const selected = q.type === 'multiple'
                ? Array.isArray(state.answer) && state.answer.includes(idx)
                : state.answer === idx;

            const div = document.createElement('label');
            div.className = 'flex items-start gap-3 py-3 px-1 cursor-pointer hover:bg-slate-50 rounded-lg';
            div.innerHTML = `
                <input type="${inputType}" name="opt" class="w-4 h-4 accent-indigo-600 shrink-0 mt-1" ${selected ? 'checked' : ''}>
                <div class="flex-1">
                    <span class="text-sm opt-text"></span>
                    ${opt.image ? `<img src="${opt.image}" class="mt-2 max-w-[200px] rounded-lg border" alt="Option image">` : ''}
                </div>
            `;
            div.querySelector('.opt-text').textContent = opt.text || '';
            div.querySelector('input').addEventListener('change', () => selectOption(idx, q.type));
            optsWrap.appendChild(div);
        });

        renderMath(optsWrap);
    }

    document.getElementById('prevBtn').disabled = currentIndex === 0;

    if (HAS_SUBJECT_TABS) {
        document.querySelectorAll('.subject-tab').forEach((el, i) => {
            el.classList.toggle('text-indigo-600', i === q.sectionIndex);
            el.classList.toggle('border-indigo-600', i === q.sectionIndex);
            el.classList.toggle('text-gray-400', i !== q.sectionIndex);
        });
        updateSubjectTabsState();
    }

    renderPalette();
    updateCounts();
}

function selectOption(idx, type) {
    const state = qState[currentIndex];
    if (type === 'multiple') {
        if (!Array.isArray(state.answer)) state.answer = [];
        const pos = state.answer.indexOf(idx);
        if (pos > -1) state.answer.splice(pos, 1); else state.answer.push(idx);
    } else {
        state.answer = idx;
    }
    if (state.status !== 'markedAnswered') state.status = 'answered';
    renderQuestion();
}

function saveIntegerAnswer() {
    const state = qState[currentIndex];
    const val = document.getElementById('integerInput').value;
    state.answer = val === '' ? null : Number(val);
    state.status = (val === '') ? 'notAnswered' : 'answered';
    renderPalette();
    updateCounts();
}

/* ================= NAV ACTIONS ================= */
function saveAndNext() {
    goNext();
}

function markForReview() {
    const state = qState[currentIndex];
    state.status = (state.answer !== null && state.answer !== undefined && !(Array.isArray(state.answer) && state.answer.length === 0))
        ? 'markedAnswered' : 'markedNotAnswered';
    goNext();
}

function clearResponse() {
    qState[currentIndex].answer = null;
    qState[currentIndex].status = 'notAnswered';
    renderQuestion();
}

function goNext() {
    if (currentIndex < flatQuestions.length - 1) {
        currentIndex++;
        checkSectionSwitch();
        renderQuestion();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        checkSectionSwitch();
        renderQuestion();
    }
}

function checkSectionSwitch() {
    const newSection = flatQuestions[currentIndex].sectionIndex;
    if (newSection !== currentSectionIndex && HAS_SUBJECT_TABS) {
        if (newSection > currentSectionIndex) {
            lockSectionsBefore(newSection);
        }
        currentSectionIndex = newSection;
        initTimer();
    }
}

function switchSection(idx, isAutoSwitch) {
    if (!HAS_SUBJECT_TABS) return;

    if (!isAutoSwitch && sectionDone[idx]) {
        return;
    }

    if (!isAutoSwitch && idx > currentSectionIndex) {
        lockSectionsBefore(idx);
    }

    currentSectionIndex = idx;
    currentIndex = flatQuestions.findIndex(q => q.sectionIndex === idx);
    initTimer();
    renderQuestion();
}

function jumpToQuestion(i) {
    currentIndex = i;
    currentSectionIndex = flatQuestions[i].sectionIndex;
    renderQuestion();
}

function updateSubjectTabsState() {
    if (!HAS_SUBJECT_TABS) return;
    document.querySelectorAll('.subject-tab').forEach((el, i) => {
        el.disabled = !!sectionDone[i];
    });
}

/* ================= PALETTE ================= */
const statusColors = {
    notVisited: 'bg-white border text-gray-500',
    notAnswered: 'bg-red-500 text-white',
    answered: 'bg-green-500 text-white',
    markedNotAnswered: 'bg-indigo-600 text-white',
    markedAnswered: 'bg-indigo-600 text-white ring-2 ring-offset-1 ring-green-500'
};

function renderPalette() {
    const grids = [document.getElementById('paletteGrid'), document.getElementById('paletteGridMobile')];
    grids.forEach(grid => {
        if (!grid) return;
        grid.innerHTML = '';
        let localNo = 0;
        flatQuestions.forEach((q, i) => {
            if (HAS_SUBJECT_TABS && q.sectionIndex !== currentSectionIndex) return;
            localNo++;
            const displayNo = HAS_SUBJECT_TABS ? localNo : (i + 1);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `palette-btn w-9 h-9 rounded-lg text-xs font-bold active:scale-95 ${statusColors[qState[i].status]} ${i === currentIndex ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`;
            btn.textContent = displayNo;
            btn.onclick = () => jumpToQuestion(i);
            grid.appendChild(btn);
        });
    });
}

function updateCounts() {
    const counts = { answered: 0, notAnswered: 0, notVisited: 0, review: 0, markedAnswered: 0 };
    qState.forEach(s => {
        if (s.status === 'answered') counts.answered++;
        else if (s.status === 'notAnswered') counts.notAnswered++;
        else if (s.status === 'notVisited') counts.notVisited++;
        else if (s.status === 'markedNotAnswered') counts.review++;
        else if (s.status === 'markedAnswered') { counts.markedAnswered++; counts.answered++; }
    });
    ['cntAnswered','cntAnsweredM'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = counts.answered; });
    ['cntNotAnswered','cntNotAnsweredM'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = counts.notAnswered; });
    const nv = document.getElementById('cntNotVisited'); if (nv) nv.textContent = counts.notVisited;
    const rv = document.getElementById('cntReview'); if (rv) rv.textContent = counts.review;
    const ma = document.getElementById('cntMarkedAnswered'); if (ma) ma.textContent = counts.markedAnswered;
}

/* ================= MOBILE DRAWER ================= */
function toggleMobilePalette() {
    document.getElementById('mobilePaletteOverlay').classList.toggle('hidden');
    document.getElementById('mobilePaletteDrawer').classList.toggle('hidden');
    document.getElementById('mobilePaletteDrawer').classList.toggle('flex');
}

/* ================= SUBMIT ================= */
function tallyIndices(indices) {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0;
    indices.forEach(i => {
        const st = qState[i].status;
        if (st === 'answered' || st === 'markedAnswered') answered++;
        if (st === 'notAnswered') notAnswered++;
        if (st === 'notVisited') notVisited++;
        if (st === 'markedNotAnswered' || st === 'markedAnswered') marked++;
    });
    return { total: indices.length, answered, notAnswered, notVisited, marked };
}

function computeBreakdown() {
    if (!HAS_SUBJECT_TABS) {
        const all = flatQuestions.map((_, i) => i);
        return [{ label: 'All Questions', ...tallyIndices(all) }];
    }
    return sections.map((sec, idx) => {
        const indices = flatQuestions.reduce((arr, q, i) => {
            if (q.sectionIndex === idx) arr.push(i);
            return arr;
        }, []);
        return { label: sec.label, ...tallyIndices(indices) };
    });
}

function confirmSubmit() {
    const rows = computeBreakdown();
    const tbody = document.getElementById('submitBreakdownBody');
    tbody.innerHTML = '';

    const totals = { total: 0, answered: 0, notAnswered: 0, marked: 0, notVisited: 0 };
    rows.forEach(r => {
        totals.total += r.total; totals.answered += r.answered; totals.notAnswered += r.notAnswered;
        totals.marked += r.marked; totals.notVisited += r.notVisited;
        tbody.innerHTML += `
            <tr class="border-b">
                <td class="py-3 px-4 font-bold text-left">${r.label}</td>
                <td class="py-3 px-4 text-center">${r.total}</td>
                <td class="py-3 px-4 text-center text-green-600 font-bold">${r.answered}</td>
                <td class="py-3 px-4 text-center text-red-500 font-bold">${r.notAnswered}</td>
                <td class="py-3 px-4 text-center text-indigo-600 font-bold">${r.marked}</td>
                <td class="py-3 px-4 text-center text-gray-500">${r.notVisited}</td>
            </tr>`;
    });
    tbody.innerHTML += `
        <tr class="bg-gray-50 font-bold">
            <td class="py-3 px-4 text-left">Total</td>
            <td class="py-3 px-4 text-center">${totals.total}</td>
            <td class="py-3 px-4 text-center text-green-600">${totals.answered}</td>
            <td class="py-3 px-4 text-center text-red-500">${totals.notAnswered}</td>
            <td class="py-3 px-4 text-center text-indigo-600">${totals.marked}</td>
            <td class="py-3 px-4 text-center text-gray-500">${totals.notVisited}</td>
        </tr>`;

    document.getElementById('submitModal').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('submitModal').classList.add('hidden');
}

async function doSubmitTest(submitType = "manual") {
    if (testSubmitted) return;
    testSubmitted = true;
    clearInterval(timerInterval);
    document.getElementById('submitModal').classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen();

    const totalTimeSpent = HAS_SUBJECT_TABS
        ? sections.reduce((sum, sec, i) => sum + (sec.durationMinutes * 60 - sectionTimeLeft[i]), 0)
        : (testData.duration * 60 - (window.totalSeconds ?? 0));

    const payload = {
        answers: flatQuestions.map((q, i) => ({
            questionId: q._id,
            selectedOptions: Array.isArray(qState[i].answer)
                ? qState[i].answer
                : (typeof qState[i].answer === 'number' && q.type !== 'integer' ? [qState[i].answer] : []),
            numericAnswer: (q.type === 'integer') ? qState[i].answer : null,
            status: qState[i].status
        })),
        timeTaken: totalTimeSpent,
        submitType,
        sessionId: testData.sessionId
    };

    try {
        await fetch(`/api/attempt/${testData.id}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Submit save error:", err);
    }
    
    document.getElementById('autoSubmitToast').classList.add('hidden');
    document.getElementById('successModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function autoSubmit() {
    document.getElementById('autoSubmitToast').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => doSubmitTest("auto"), 1200);
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
    document.getElementById('autoSubmitToast').classList.add('hidden');
    window.location.replace(returnUrl);
}

/* ================= INIT ================= */
function init() {
    bootFullscreen();

    if (flatQuestions.length === 0) {
        document.getElementById('questionNoLabel').textContent = '';
        document.getElementById('questionText').textContent = 'No questions found for this test.';
        document.getElementById('timerLabel').textContent = '';
        document.getElementById('timerDisplay').textContent = '00:00';
        if (window.lucide) lucide.createIcons();
        return;
    }

    if (HAS_SUBJECT_TABS) {
        sections = buildSections();
        flatQuestions.forEach(q => {
            q.sectionIndex = sectionIndexForSubject(subjectsOrder[q.subjectIndex]);
        });

        const order = flatQuestions.map((_, i) => i);
        order.sort((a, b) => flatQuestions[a].sectionIndex - flatQuestions[b].sectionIndex);
        flatQuestions = order.map(i => flatQuestions[i]);
        qState = order.map(i => qState[i]);

        initSectionTimers();
        renderSubjectTabs();

        currentSectionIndex = 0;
        const firstQIdx = flatQuestions.findIndex(q => q.sectionIndex === 0);
        currentIndex = firstQIdx !== -1 ? firstQIdx : 0;
    }
    initTimer();
    renderQuestion();
    if (window.lucide) lucide.createIcons();
}
init();

// ---- CSP-safe event delegation for static onclick/oninput attributes ----
document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
        case 'toggle-fullscreen':
            toggleFullscreen();
            break;
        case 'toggle-mobile-palette':
            toggleMobilePalette();
            break;
        case 'mark-for-review':
            markForReview();
            break;
        case 'clear-response':
            clearResponse();
            break;
        case 'prev-question':
            prevQuestion();
            break;
        case 'save-and-next':
            saveAndNext();
            break;
        case 'confirm-submit':
            confirmSubmit();
            break;
        case 'close-submit-modal':
            closeSubmitModal();
            break;
        case 'submit-test-manual':
            doSubmitTest('manual');
            break;
        case 'close-success-modal':
            closeSuccessModal();
            break;
    }
});

document.addEventListener('input', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'save-integer-answer') {
        saveIntegerAnswer();
    }
});