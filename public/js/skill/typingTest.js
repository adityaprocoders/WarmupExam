(function () {
    // ============= DOM REFERENCES =============
    const el = {
        language: document.getElementById('ttLanguage'),
        time: document.getElementById('ttTime'),
        timeCustom: document.getElementById('ttTimeCustom'),
        wordCount: document.getElementById('ttWordCount'),
        wordCountCustom: document.getElementById('ttWordCountCustom'),
        difficulty: document.getElementById('ttDifficulty'),
        generateBtn: document.getElementById('ttGenerateBtn'),

        testSection: document.getElementById('ttTestSection'),
        instructionText: document.getElementById('ttInstructionText'),
        timerDisplay: document.getElementById('ttTimerDisplay'),
        timerValue: document.getElementById('ttTimerValue'),

        boxWrapper: document.getElementById('ttBoxWrapper'),
        textBox: document.getElementById('ttTextBox'),
        hiddenInput: document.getElementById('ttHiddenInput'),
        focusOverlay: document.getElementById('ttFocusOverlay'),

        liveStats: document.getElementById('ttLiveStats'),
        statusBadge: document.getElementById('ttStatusBadge'),
        liveWpm: document.getElementById('ttLiveWpm'),
        liveChars: document.getElementById('ttLiveChars'),
        liveAccuracy: document.getElementById('ttLiveAccuracy'),
        liveErrors: document.getElementById('ttLiveErrors'),
        liveWords: document.getElementById('ttLiveWords'),
        progressPercent: document.getElementById('ttProgressPercent'),
        progressBar: document.getElementById('ttProgressBar'),
        liveChartCanvas: document.getElementById('ttLiveChart'),

        results: document.getElementById('ttResults'),
        finalWpm: document.getElementById('ttFinalWpm'),
        comparisonBadge: document.getElementById('ttComparisonBadge'),
        finalAccuracy: document.getElementById('ttFinalAccuracy'),
        finalChars: document.getElementById('ttFinalChars'),
        finalErrors: document.getElementById('ttFinalErrors'),
        finalWords: document.getElementById('ttFinalWords'),
        tryAgainBtn: document.getElementById('ttTryAgainBtn'),
        resultChartCanvas: document.getElementById('ttResultChart'),
         
    };

    // ============= STATE =============
    let wordPoolCache = {};
    let testWords = [];
    let config = { language: 'en', totalSeconds: 120, wordCount: 100, difficulty: 'medium' };

    let started = false;
    let finished = false;
    let remainingSeconds = 0;
    let timerInterval = null;

    let correctChars = 0;
    let incorrectChars = 0;
    let correctWords = 0;

    let chartData = [];
    let errorSeconds = new Set();
    let liveChart = null;
    let resultChart = null;

    // ============= HELPERS =============
    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function pickWords(pool, difficulty, count) {
        const source = pool[difficulty] || pool.medium;
        let result = [];
        while (result.length < count) {
            result = result.concat(shuffle(source));
        }
        return result.slice(0, count);
    }

    async function loadWordPool(language) {
        if (wordPoolCache[language]) return wordPoolCache[language];
        const res = await fetch(`/data/words-${language}.json`);
        const data = await res.json();
        wordPoolCache[language] = data;
        return data;
    }

    function formatTime(totalSec) {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ============= SETTINGS UI =============
    el.time.addEventListener('change', () => {
        el.timeCustom.classList.toggle('hidden', el.time.value !== 'custom');
    });
    el.wordCount.addEventListener('change', () => {
        el.wordCountCustom.classList.toggle('hidden', el.wordCount.value !== 'custom');
    });

    function readConfig() {
        const language = el.language.value;
        const difficulty = el.difficulty.value;

        let minutes = el.time.value === 'custom'
            ? parseInt(el.timeCustom.value || '2', 10)
            : parseInt(el.time.value, 10);
        if (!minutes || minutes < 1) minutes = 2;

        let wordCount = el.wordCount.value === 'custom'
            ? parseInt(el.wordCountCustom.value || '100', 10)
            : parseInt(el.wordCount.value, 10);
        if (!wordCount || wordCount < 10) wordCount = 100;

        return { language, difficulty, totalSeconds: minutes * 60, wordCount };
    }

    // ============= RENDERING TEST BOX =============
    function buildWordHTML(word, index) {
        const chars = word.split('').map(c => `<span class="tt-c text-slate-400">${escapeHtml(c)}</span>`).join('');
        return `<span class="tt-word inline-block mr-2" data-idx="${index}">${chars}</span>`;
    }

    function renderInitial() {
        el.textBox.innerHTML = testWords.map(buildWordHTML).join('');
    }

    function appendWordsToDOM(newWords, startIndex) {
        const html = newWords.map((w, i) => buildWordHTML(w, startIndex + i)).join('');
        el.textBox.insertAdjacentHTML('beforeend', html);
    }

    function maybeAutoAppend(currentWordIndex) {
        if (testWords.length - currentWordIndex < 15) {
            const pool = wordPoolCache[config.language];
            const more = pickWords(pool, config.difficulty, 30);
            const startIndex = testWords.length;
            testWords = testWords.concat(more);
            appendWordsToDOM(more, startIndex);
        }
    }

    // Character coloring:
    // - not yet reached: grey text
    // - correct typed: indigo background, dark text
    // - incorrect typed: red background, red text, underline
    // - current cursor position (next char to type, current word only): yellow background
    function updateRendering() {
        const typedSegments = el.hiddenInput.value.split(' ');
        const currentWordIndex = typedSegments.length - 1;

        correctChars = 0;
        incorrectChars = 0;
        correctWords = 0;

        const wordEls = el.textBox.querySelectorAll('.tt-word');
        let hadNewError = false;

        typedSegments.forEach((typed, wIdx) => {
            const wordEl = wordEls[wIdx];
            if (!wordEl) return;
            const target = testWords[wIdx] || '';
            const isCompleted = wIdx < currentWordIndex;
            const isCurrentWord = wIdx === currentWordIndex;

            // remove any extra chars added in a previous render beyond target length
            while (wordEl.children.length > target.length) {
                wordEl.removeChild(wordEl.lastChild);
            }
            // add extra chars if user typed more than the target word's length
            for (let i = wordEl.children.length; i < typed.length; i++) {
                const span = document.createElement('span');
                span.className = 'tt-c';
                span.textContent = typed[i];
                wordEl.appendChild(span);
            }

            const charSpans = wordEl.querySelectorAll('.tt-c');

            for (let i = 0; i < charSpans.length; i++) {
                const span = charSpans[i];
                const targetChar = target[i];
                const typedChar = typed[i];

                if (i < typed.length && i < target.length) {
                    // typed and within target length
                    const correct = typedChar === targetChar;
                    span.textContent = targetChar;
                    span.className = 'tt-c ' + (correct
    ? 'bg-indigo-100 text-slate-900 font-semibold rounded-sm'
    : 'bg-red-100 text-red-700 font-semibold underline decoration-red-400 rounded-sm');
                    if (correct) correctChars++; else { incorrectChars++; hadNewError = true; }
                } else if (i >= target.length) {
                    // extra typed chars beyond the target word (overtyped)
                    span.textContent = typedChar;
                    span.className = 'tt-c bg-red-100 text-red-700 font-semibold underline decoration-red-400 rounded-sm';
                    incorrectChars++; hadNewError = true;
                } else if (isCurrentWord && i === typed.length) {
                    // cursor position - next char to type
                    span.textContent = targetChar;
                    span.className = 'tt-c bg-yellow-200 text-slate-900 font-semibold rounded-sm';
                } else if (isCompleted) {
                    // word was skipped (space pressed) before finishing - mark remaining as missed
                    span.textContent = targetChar;
                    span.className = 'tt-c bg-red-50 text-red-500 font-medium underline decoration-red-200 rounded-sm';
                    incorrectChars++;
                } else {
                    // not yet reached
                    span.textContent = targetChar;
                    span.className = 'tt-c text-slate-400';
                }
            }

            if (isCompleted && typed === target) correctWords++;

            wordEl.classList.toggle('bg-indigo-50/40', isCurrentWord);
            wordEl.classList.toggle('rounded', isCurrentWord);
        });

        if (hadNewError) errorSeconds.add(getElapsedSeconds());

        const activeWordEl = wordEls[currentWordIndex];
        if (activeWordEl) {
            activeWordEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        maybeAutoAppend(currentWordIndex);
    }

    // ============= FOCUS HANDLING =============
    function showOverlay() {
        if (finished) return;
        el.focusOverlay.classList.remove('hidden');
        el.focusOverlay.classList.add('flex');
    }
    function hideOverlay() {
        el.focusOverlay.classList.add('hidden');
        el.focusOverlay.classList.remove('flex');
    }

    el.boxWrapper.addEventListener('click', () => {
        if (testWords.length && !finished) el.hiddenInput.focus();
    });
    el.hiddenInput.addEventListener('focus', hideOverlay);
    el.hiddenInput.addEventListener('blur', showOverlay);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && testWords.length && !finished) {
            e.preventDefault();
            el.hiddenInput.focus();
        }
    });

    el.hiddenInput.addEventListener('paste', (e) => e.preventDefault());

    // ============= TIMER =============
    function getElapsedSeconds() {
        return config.totalSeconds - remainingSeconds;
    }

    // Shows the full time immediately (static) - called right after generating a test
    function primeTimerDisplay() {
        remainingSeconds = config.totalSeconds;
        el.timerDisplay.classList.remove('hidden');
        el.timerDisplay.classList.add('flex');
        el.timerValue.textContent = formatTime(remainingSeconds);
    }

    // Actually starts the countdown - called on first keystroke
   function startTimer() {
    started = true;
    el.instructionText.textContent = 'Keep typing…';
    initLiveChart(); 

        timerInterval = setInterval(() => {
            remainingSeconds--;
            el.timerValue.textContent = formatTime(remainingSeconds);
            tickStats();
            if (remainingSeconds <= 0) {
                finishTest();
            }
        }, 1000);
    }

    function tickStats() {
        const elapsedMin = getElapsedSeconds() / 60;
        const wpm = elapsedMin > 0 ? Math.round(correctWords / elapsedMin) : 0;
        const totalTyped = correctChars + incorrectChars;
        const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;

        el.liveWpm.textContent = wpm;
        el.liveChars.textContent = totalTyped;
        el.liveAccuracy.textContent = accuracy + '%';
        el.liveErrors.textContent = incorrectChars;
        el.liveWords.textContent = correctWords;

        const progress = Math.min(100, Math.round((getElapsedSeconds() / config.totalSeconds) * 100));
        el.progressPercent.textContent = progress + '%';
        el.progressBar.style.width = progress + '%';

        const sec = getElapsedSeconds();
        if (sec % 2 === 0) {
            chartData.push({ second: sec, wpm });
            updateLiveChart();
        }
    }

    // ============= CHART =============
  function initLiveChart() {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded — skipping live chart');
        return;
    }
    liveChart = new Chart(el.liveChartCanvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79,70,229,0.08)',
                fill: true,
                tension: 0.35,
                pointRadius: 2,
                pointBackgroundColor: []
            }]
        },
        options: {
            animation: false,
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
            }
        }
    });
}

    function updateLiveChart() {
        if (!liveChart) return;
        liveChart.data.labels = chartData.map(d => d.second);
        liveChart.data.datasets[0].data = chartData.map(d => d.wpm);
        liveChart.data.datasets[0].pointBackgroundColor = chartData.map(d =>
            errorSeconds.has(d.second) ? '#ef4444' : '#4F46E5'
        );
        liveChart.update();
    }

    // ============= GENERATE =============
    async function generateTest() {
        resetState();
        config = readConfig();

        el.generateBtn.disabled = true;
        el.testSection.classList.remove('hidden');
        el.instructionText.textContent = 'Loading words…';

        const pool = await loadWordPool(config.language);
        testWords = pickWords(pool, config.difficulty, config.wordCount);

        renderInitial();
        primeTimerDisplay(); // show full time immediately, not counting down yet
        el.instructionText.textContent = 'Click the box below to start typing';
        el.generateBtn.disabled = false;

        el.hiddenInput.value = '';
        el.hiddenInput.disabled = false;
        showOverlay();
    }

    el.generateBtn.addEventListener('click', generateTest);

    // ============= INPUT HANDLING =============
    el.hiddenInput.addEventListener('input', () => {
        if (finished) return;
        if (!started) startTimer();

        el.hiddenInput.value = el.hiddenInput.value.replace(/ {2,}/g, ' ');

        updateRendering();
    });

    // ============= FINISH =============
    function finishTest() {
        finished = true;
        clearInterval(timerInterval);
        el.hiddenInput.disabled = true;
        hideOverlay();
        el.statusBadge.textContent = 'Finished';
        el.statusBadge.classList.replace('text-emerald-700', 'text-slate-500');
        el.statusBadge.classList.replace('bg-emerald-50', 'bg-slate-100');

        el.testSection.classList.add('hidden'); // hide typing box + timer entirely

        setTimeout(showResults, 600);
    }

    function showResults() {
        el.liveStats.classList.add('hidden');
        el.liveStats.classList.remove('grid');
        el.results.classList.remove('hidden');

        const totalTyped = correctChars + incorrectChars;
        const accuracy = totalTyped > 0 ? Math.round((correctChars / totalTyped) * 100) : 0;
        const finalWpm = Math.round(correctWords / (config.totalSeconds / 60));

        el.finalWpm.textContent = finalWpm;
        el.finalAccuracy.textContent = accuracy + '%';
        el.finalChars.textContent = totalTyped;
        el.finalErrors.textContent = incorrectChars;
        el.finalWords.textContent = correctWords;

        renderResultChart(); 
        renderComparison(finalWpm, accuracy);
    }

    function renderResultChart() {
        resultChart = new Chart(el.resultChartCanvas, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.second),
                datasets: [{
                    data: chartData.map(d => d.wpm),
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79,70,229,0.08)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointBackgroundColor: chartData.map(d => errorSeconds.has(d.second) ? '#ef4444' : '#4F46E5')
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
                }
            }
        });
    }

     
    function renderComparison(wpm, accuracy) {
        const key = `tt_last_${config.totalSeconds}_${config.difficulty}`;
        const prevRaw = localStorage.getItem(key);

        if (prevRaw) {
            const prev = JSON.parse(prevRaw);
            const delta = wpm - prev.wpm;
            el.comparisonBadge.classList.remove('hidden');
            if (delta > 0) {
                el.comparisonBadge.textContent = `▲ +${delta} WPM vs last`;
                el.comparisonBadge.className = 'inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700';
            } else if (delta < 0) {
                el.comparisonBadge.textContent = `▼ ${delta} WPM vs last`;
                el.comparisonBadge.className = 'inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600';
            } else {
                el.comparisonBadge.textContent = `— Same as last (${wpm} WPM)`;
                el.comparisonBadge.className = 'inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600';
            }
        }

        localStorage.setItem(key, JSON.stringify({ wpm, accuracy, date: Date.now() }));
    }

    // ============= TRY AGAIN =============
    el.tryAgainBtn.addEventListener('click', () => {
        el.results.classList.add('hidden');
        generateTest();
    });

    // ============= RESET =============
    function resetState() {
        started = false;
        finished = false;
        correctChars = 0;
        incorrectChars = 0;
        correctWords = 0;
        chartData = [];
        errorSeconds = new Set();
        clearInterval(timerInterval);
        if (liveChart) { liveChart.destroy(); liveChart = null; }
        if (resultChart) { resultChart.destroy(); resultChart = null; }
        el.results.classList.add('hidden');
        el.statusBadge.textContent = 'In Progress';
        el.statusBadge.className = 'text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full';
    }

    // ============= AUTO-GENERATE ON PAGE LOAD =============
    generateTest();

})();