(function () {
    // ============= DOM REFERENCES =============
    const el = {
        operation: document.getElementById('ctOperation'),
        time: document.getElementById('ctTime'),
        timeCustom: document.getElementById('ctTimeCustom'),
        difficulty: document.getElementById('ctDifficulty'),
        generateBtn: document.getElementById('ctGenerateBtn'),

        testSection: document.getElementById('ctTestSection'),
        instructionText: document.getElementById('ctInstructionText'),
        timerDisplay: document.getElementById('ctTimerDisplay'),
        timerValue: document.getElementById('ctTimerValue'),

        question: document.getElementById('ctQuestion'),
        answerInput: document.getElementById('ctAnswerInput'),
        feedback: document.getElementById('ctFeedback'),

        results: document.getElementById('ctResults'),
        finalQpm: document.getElementById('ctFinalQpm'),
        finalAccuracy: document.getElementById('ctFinalAccuracy'),
        finalCorrect: document.getElementById('ctFinalCorrect'),
        finalWrong: document.getElementById('ctFinalWrong'),
        finalTimeUsed: document.getElementById('ctFinalTimeUsed'),
        tryAgainBtn: document.getElementById('ctTryAgainBtn'),
        resultChartCanvas: document.getElementById('ctResultChart'),
    };

    // ============= STATE =============
    let config = { operation: 'mixed', totalSeconds: 120, difficulty: 'medium' };
    let questions = [];
    let currentIndex = 0;

    let started = false;
    let finished = false;
    let remainingSeconds = 0;
    let timerInterval = null;

    let correctCount = 0;
    let wrongCount = 0;

    let chartData = [];
    let resultChart = null;
    let feedbackTimeout = null;

    // ============= HELPERS =============
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomFrom(arr) {
        return arr[randomInt(0, arr.length - 1)];
    }
    function formatTime(totalSec) {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // ============= SETTINGS UI =============
    el.time.addEventListener('change', () => {
        el.timeCustom.classList.toggle('hidden', el.time.value !== 'custom');
    });

    function readConfig() {
        const operation = el.operation.value;
        const difficulty = el.difficulty.value;
        let minutes = el.time.value === 'custom'
            ? parseInt(el.timeCustom.value || '2', 10)
            : parseInt(el.time.value, 10);
        if (!minutes || minutes < 1) minutes = 2;
        return { operation, difficulty, totalSeconds: minutes * 60 };
    }

    // ============= QUESTION GENERATORS =============
    function genAddition(difficulty) {
        const ranges = { easy: [1, 99], medium: [10, 999], hard: [100, 9999] };
        const [min, max] = ranges[difficulty];
        const a = randomInt(min, max);
        const b = randomInt(min, max);
        return { text: `${a} + ${b}`, answer: a + b };
    }

    function genSubtraction(difficulty) {
        const ranges = { easy: [1, 99], medium: [10, 999], hard: [100, 9999] };
        const [min, max] = ranges[difficulty];
        let a = randomInt(min, max);
        let b = randomInt(min, max);
        if (b > a) [a, b] = [b, a]; // always positive result
        return { text: `${a} - ${b}`, answer: a - b };
    }

    function genMultiplication(difficulty) {
        let a, b;
        if (difficulty === 'easy') {
            a = randomInt(2, 9); b = randomInt(2, 9);
        } else if (difficulty === 'hard') {
            a = randomInt(11, 99); b = randomInt(11, 99);
        } else {
            a = randomInt(10, 99); b = randomInt(2, 9);
        }
        return { text: `${a} × ${b}`, answer: a * b };
    }

    function genDivision(difficulty) {
        let divisor, quotient;
        if (difficulty === 'easy') {
            divisor = randomInt(2, 9); quotient = randomInt(2, 9);
        } else if (difficulty === 'hard') {
            divisor = randomInt(11, 40); quotient = randomInt(11, 40);
        } else {
            divisor = randomInt(2, 12); quotient = randomInt(10, 50);
        }
        const dividend = divisor * quotient; // always exact division
        return { text: `${dividend} ÷ ${divisor}`, answer: quotient };
    }

    function generateQuestion(operation, difficulty) {
        let op = operation;
        if (op === 'mixed') {
            op = randomFrom(['add', 'sub', 'mul', 'div']);
        }
        if (op === 'add') return genAddition(difficulty);
        if (op === 'sub') return genSubtraction(difficulty);
        if (op === 'mul') return genMultiplication(difficulty);
        return genDivision(difficulty);
    }

    function estimateQuestionCount(difficulty, totalSeconds) {
        const avgSecondsPerQ = { easy: 4, medium: 6, hard: 9 };
        const avg = avgSecondsPerQ[difficulty];
        return Math.ceil((totalSeconds / avg) * 1.5);
    }

    function fillQuestionPool(count) {
        for (let i = 0; i < count; i++) {
            questions.push(generateQuestion(config.operation, config.difficulty));
        }
    }

    function maybeAutoAppend() {
        if (questions.length - currentIndex < 5) {
            fillQuestionPool(20);
        }
    }

    // ============= RENDERING =============
    function renderCurrentQuestion() {
        const q = questions[currentIndex];
        if (!q) return;
        el.question.textContent = `${q.text} = ?`;
        el.answerInput.value = '';
        el.answerInput.focus();
    }

    function flashFeedback(correct) {
        clearTimeout(feedbackTimeout);
        el.feedback.textContent = correct ? '✓ Correct' : '✗ Incorrect';
        el.feedback.className = 'h-5 mt-2 text-sm font-semibold ' + (correct ? 'text-emerald-600' : 'text-red-500');
        feedbackTimeout = setTimeout(() => {
            el.feedback.textContent = '';
        }, 500);
    }

    // ============= SUBMIT =============
    function submitAnswer() {
        if (finished) return;
        const q = questions[currentIndex];
        const typed = el.answerInput.value.trim();

        if (typed === '') return; // don't submit empty

        const typedNum = parseInt(typed, 10);
        const correct = typedNum === q.answer;

        if (correct) correctCount++; else wrongCount++;
        flashFeedback(correct);

        currentIndex++;
        maybeAutoAppend();
        if (!finished) renderCurrentQuestion();
    }

    el.answerInput.addEventListener('input', onFirstKeystroke);
    el.answerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitAnswer();
        }
    });

    // ============= TIMER =============
    function primeTimerDisplay() {
        remainingSeconds = config.totalSeconds;
        el.timerDisplay.classList.remove('hidden');
        el.timerDisplay.classList.add('flex');
        el.timerValue.textContent = formatTime(remainingSeconds);
    }

    function onFirstKeystroke() {
        if (finished) return;
        if (!started) startTimer();
    }

    function startTimer() {
        started = true;
        el.instructionText.textContent = 'Keep solving…';

        timerInterval = setInterval(() => {
            remainingSeconds--;
            el.timerValue.textContent = formatTime(remainingSeconds);
            tickChart();
            if (remainingSeconds <= 0) {
                finishTest();
            }
        }, 1000);
    }

    function getElapsedSeconds() {
        return config.totalSeconds - remainingSeconds;
    }

    function tickChart() {
        const sec = getElapsedSeconds();
        if (sec % 2 === 0) {
            const elapsedMin = sec / 60;
            const qpm = elapsedMin > 0 ? Math.round(correctCount / elapsedMin) : 0;
            chartData.push({ second: sec, qpm });
        }
    }

    // ============= GENERATE =============
    function generateTest() {
        resetState();
        config = readConfig();

        el.generateBtn.disabled = true;
        el.testSection.classList.remove('hidden');
        el.instructionText.textContent = 'Loading questions…';

        questions = [];
        fillQuestionPool(estimateQuestionCount(config.difficulty, config.totalSeconds));

        primeTimerDisplay();
        el.instructionText.textContent = 'Solve as many as you can';
        el.generateBtn.disabled = false;

        renderCurrentQuestion();
    }

    el.generateBtn.addEventListener('click', generateTest);

    // ============= FINISH =============
    function finishTest() {
        finished = true;
        clearInterval(timerInterval);
        el.testSection.classList.add('hidden');
        setTimeout(showResults, 600);
    }

    function showResults() {
        el.results.classList.remove('hidden');

        const totalAnswered = correctCount + wrongCount;
        const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
        const timeUsedSec = config.totalSeconds - Math.max(remainingSeconds, 0);
        const qpm = Math.round(correctCount / (config.totalSeconds / 60));

        el.finalQpm.textContent = qpm;
        el.finalAccuracy.textContent = accuracy + '%';
        el.finalCorrect.textContent = correctCount;
        el.finalWrong.textContent = wrongCount;
        el.finalTimeUsed.textContent = formatTime(timeUsedSec);

        renderResultChart();
    }

    function renderResultChart() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded — skipping chart');
            return;
        }
        resultChart = new Chart(el.resultChartCanvas, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.second),
                datasets: [{
                    data: chartData.map(d => d.qpm),
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79,70,229,0.08)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3
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

    // ============= TRY AGAIN =============
    el.tryAgainBtn.addEventListener('click', () => {
        el.results.classList.add('hidden');
        generateTest();
    });

    // ============= RESET =============
    function resetState() {
        started = false;
        finished = false;
        currentIndex = 0;
        correctCount = 0;
        wrongCount = 0;
        chartData = [];
        clearInterval(timerInterval);
        clearTimeout(feedbackTimeout);
        if (resultChart) { resultChart.destroy(); resultChart = null; }
        el.results.classList.add('hidden');
        el.feedback.textContent = '';
    }

})();