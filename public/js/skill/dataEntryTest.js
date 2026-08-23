(function () {
    // ============= DOM REFERENCES =============
    const el = {
        dataType: document.getElementById('deDataType'),
        time: document.getElementById('deTime'),
        timeCustom: document.getElementById('deTimeCustom'),
        difficulty: document.getElementById('deDifficulty'),
        generateBtn: document.getElementById('deGenerateBtn'),

        testSection: document.getElementById('deTestSection'),
        instructionText: document.getElementById('deInstructionText'),
        timerDisplay: document.getElementById('deTimerDisplay'),
        timerValue: document.getElementById('deTimerValue'),

        singleMode: document.getElementById('deSingleMode'),
        referenceValue: document.getElementById('deReferenceValue'),
        singleInput: document.getElementById('deSingleInput'),

        tableMode: document.getElementById('deTableMode'),
        referenceTable: document.getElementById('deReferenceTable'),
        inputTable: document.getElementById('deInputTable'),

        results: document.getElementById('deResults'),
        finalEpm: document.getElementById('deFinalEpm'),
        finalAccuracy: document.getElementById('deFinalAccuracy'),
        finalCorrect: document.getElementById('deFinalCorrect'),
        finalErrors: document.getElementById('deFinalErrors'),
        finalTimeUsed: document.getElementById('deFinalTimeUsed'),
        tryAgainBtn: document.getElementById('deTryAgainBtn'),
        resultChartCanvas: document.getElementById('deResultChart'),
    };

    // ============= STATE =============
    let config = { dataType: 'numbers', totalSeconds: 120, difficulty: 'medium' };
    let entries = [];        // pool of pre-generated entries
    let currentIndex = 0;

    let started = false;
    let finished = false;
    let remainingSeconds = 0;
    let timerInterval = null;

    let correctFields = 0;
    let incorrectFields = 0;
    let correctEntries = 0;
    let attemptedEntries = 0;

    let chartData = [];
    let resultChart = null;

    // ============= NAME / DATA POOLS (table mode) =============
   const NAME_POOL = [
    'Rahul Kumar', 'Priya Singh', 'Amit Sharma', 'Sneha Patel', 'Vikas Yadav',
    'Anjali Gupta', 'Rohit Verma', 'Pooja Mishra', 'Suresh Reddy', 'Kavita Joshi',
    'Manoj Tiwari', 'Neha Agarwal', 'Deepak Chauhan', 'Ritu Malhotra', 'Sanjay Nair',
    'Meena Kapoor', 'Ashok Pandey', 'Divya Rao', 'Rajesh Singh', 'Swati Bansal',

    'Aakash Kumar', 'Akash Singh', 'Arjun Sharma', 'Aditya Verma', 'Ankit Gupta',
    'Ayush Singh', 'Abhishek Kumar', 'Aman Yadav', 'Anurag Mishra', 'Ravi Kumar',
    'Rakesh Singh', 'Ramesh Patel', 'Rohit Sharma', 'Vivek Kumar', 'Vishal Gupta',
    'Varun Singh', 'Karan Sharma', 'Kunal Verma', 'Nikhil Kumar', 'Nitin Singh',
    'Mohit Sharma', 'Manish Kumar', 'Pankaj Gupta', 'Prakash Singh', 'Raj Kumar',
    'Ravi Sharma', 'Sachin Kumar', 'Saurabh Singh', 'Shubham Kumar', 'Shivam Yadav',
    'Sumit Kumar', 'Sunil Sharma', 'Tarun Singh', 'Umesh Kumar', 'Varun Gupta',
    'Harish Kumar', 'Gaurav Singh', 'Gaurav Sharma', 'Yash Kumar', 'Yash Singh',
    'Riya Sharma', 'Simran Kaur', 'Shreya Singh', 'Sneha Sharma', 'Neha Singh',
    'Nisha Kumari', 'Kajal Sharma', 'Komal Singh', 'Muskan Kumari', 'Preeti Sharma',
    'Priyanka Singh', 'Pallavi Gupta', 'Rashmi Kumari', 'Sakshi Singh', 'Shivani Sharma',
    'Swati Singh', 'Tanvi Sharma', 'Tanya Singh', 'Aarti Kumari', 'Poonam Devi',
    'Monika Sharma', 'Nandini Singh', 'Payal Gupta', 'Sonam Kumari', 'Isha Sharma',
    'Ishita Singh', 'Kriti Sharma', 'Mansi Gupta', 'Radhika Singh', 'Shruti Sharma'
];

const ID_PREFIXES = [
    'STU', 'ORD', 'INV', 'TXN', 'PRD',
    'EMP', 'CUS', 'IDP', 'ESP', 'CSE',
    'USR', 'ACC', 'REF', 'REG', 'APP',
    'ADM', 'DOC', 'PAY', 'TRX', 'MEM',
    'CLI', 'PRO', 'SUB', 'REC', 'REQ',
    'TKT', 'LOG', 'JOB', 'TASK', 'CASE',
    'ITEM', 'SALE', 'BUY', 'BILL', 'SHIP',
    'BOOK', 'EXM', 'TEST', 'QST', 'ANS'
];

const ADDRESS_STREETS = [
    'MG Road',
    'Park Street',
    'Ring Road',
    'Station Road',
    'Main Road',
    'Civil Lines',
    'Model Town',
    'Nehru Nagar',
    'Gandhi Chowk',
    'Main Bazaar',
    'Lake View Road',
    'Boring Road',
    'Rajendra Nagar',
    'Ashok Nagar',
    'Shastri Nagar',
    'Indira Nagar',
    'Laxmi Nagar',
    'Patel Nagar',
    'Gandhi Nagar',
    'Jawahar Nagar',
    'Subhash Nagar',
    'Vivek Vihar',
    'Tilak Nagar',
    'Krishna Nagar',
    'Shanti Nagar',
    'Vijay Nagar',
    'Ravi Nagar',
    'Prem Nagar',
    'Adarsh Nagar',
    'Saket',
    'Janakpuri',
    'Dwarka',
    'Rohini',
    'Karol Bagh',
    'Lajpat Nagar',
    'Rajouri Garden',
    'Kankarbagh',
    'Fraser Road',
    'Bailey Road',
    'Exhibition Road',
    'Dak Bunglow Road',
    'Patna Road',
    'College Road',
    'Hospital Road',
    'Market Road',
    'Temple Road',
    'Station Market',
    'Ganga Nagar',
    'Nehru Road',
    'Tagore Road',
    'Vivekananda Road',
    'Sardar Patel Road',
    'Mahatma Gandhi Road',
    'Ambedkar Nagar',
    'Bharat Nagar',
    'Shivaji Nagar',
    'Chhatrapati Nagar',
    'Ganesh Nagar',
    'Hanuman Nagar',
    'Saraswati Nagar',
    'Durga Nagar',
    'Shiv Mandir Road',
    'Railway Colony',
    'Police Line Road',
    'Court Road',
    'University Road',
    'College Street',
    'Bus Stand Road',
    'Industrial Area',
    'Green Park',
    'New Friends Colony',
    'Shakti Nagar',
    'Surya Nagar',
    'Krishna Colony',
    'Shiv Colony',
    'Prem Vihar',
    'Anand Vihar'
];

function generateFakeAddress() {
    const houseNo = randomInt(1, 999);
    const street = randomFrom(ADDRESS_STREETS);
    const sector = randomInt(1, 40);
    const block = randomLetters(1);
    return `${houseNo}, ${street}, Sector-${sector}, Block-${block}`;
}

    // ============= HELPERS =============
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomFrom(arr) {
        return arr[randomInt(0, arr.length - 1)];
    }
    function randomDigits(length) {
        let s = '';
        for (let i = 0; i < length; i++) s += randomInt(0, 9);
        return s;
    }
    function randomLetters(length) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '';
        for (let i = 0; i < length; i++) s += letters[randomInt(0, 25)];
        return s;
    }
    function formatTime(totalSec) {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ============= SETTINGS UI =============
    el.time.addEventListener('change', () => {
        el.timeCustom.classList.toggle('hidden', el.time.value !== 'custom');
    });

    function readConfig() {
        const dataType = el.dataType.value;
        const difficulty = el.difficulty.value;
        let minutes = el.time.value === 'custom'
            ? parseInt(el.timeCustom.value || '2', 10)
            : parseInt(el.time.value, 10);
        if (!minutes || minutes < 1) minutes = 2;
        return { dataType, difficulty, totalSeconds: minutes * 60 };
    }

    // ============= ENTRY GENERATORS =============
    function genNumberEntry(difficulty) {
        const len = difficulty === 'easy' ? randomInt(4, 5)
            : difficulty === 'hard' ? randomInt(8, 10)
            : randomInt(6, 7);
        return { fields: [{ label: null, value: randomDigits(len) }] };
    }

    function genCodeEntry(difficulty) {
        let value;
        if (difficulty === 'easy') {
            value = `${randomLetters(2)}${randomDigits(3)}`;
        } else if (difficulty === 'hard') {
            value = `${randomLetters(3)}-${new Date().getFullYear()}-${randomDigits(5)}${randomFrom(['X', 'Y', 'Z'])}`;
        } else {
            value = `${randomFrom(ID_PREFIXES)}-${randomLetters(1)}${randomDigits(4)}`;
        }
        return { fields: [{ label: null, value }] };
    }

   function genTableEntry(difficulty) {
    const name = randomFrom(NAME_POOL);
    const id = `${randomFrom(ID_PREFIXES)}-${randomLetters(1)}${randomDigits(4)}`;
    const address = generateFakeAddress();
    const amountNum = difficulty === 'hard' ? randomInt(1000, 99999) : randomInt(100, 9999);
    const amountValue = amountNum.toLocaleString('en-IN');
    const amountDisplay = `₹${amountValue}`;
    const d = randomInt(1, 28).toString().padStart(2, '0');
    const m = randomInt(1, 12).toString().padStart(2, '0');
    const y = randomInt(2024, 2026);
    const date = `${d}/${m}/${y}`;

    return {
        fields: [
            { label: 'Name', value: name },
            { label: 'ID/Code', value: id },
            { label: 'Address', value: address },
            { label: 'Amount', value: amountValue, display: amountDisplay },
            { label: 'Date', value: date }
        ]
    };
}

    function generateEntry(dataType, difficulty) {
        if (dataType === 'numbers') return genNumberEntry(difficulty);
        if (dataType === 'codes') return genCodeEntry(difficulty);
        return genTableEntry(difficulty);
    }

    // Estimate how many entries needed for the chosen time, plus buffer.
    // Auto-appends more as the pool runs low (same pattern as typing test word pool).
    function estimateEntryCount(dataType, difficulty, totalSeconds) {
        const avgSecondsPerEntry = {
            numbers: { easy: 3, medium: 4, hard: 5 },
            codes: { easy: 4, medium: 5, hard: 6 },
            table: { easy: 12, medium: 15, hard: 20 }
        };
        const avg = avgSecondsPerEntry[dataType][difficulty];
        return Math.ceil((totalSeconds / avg) * 1.5); // 1.5x buffer
    }

    function fillEntryPool(count) {
        for (let i = 0; i < count; i++) {
            entries.push(generateEntry(config.dataType, config.difficulty));
        }
    }

    function maybeAutoAppend() {
        if (entries.length - currentIndex < 5) {
            fillEntryPool(20);
        }
    }

    // ============= RENDERING =============
    function isTableMode() {
        return config.dataType === 'table';
    }

    function renderCurrentEntry() {
        const entry = entries[currentIndex];
        if (!entry) return;

        if (isTableMode()) {
            el.singleMode.classList.add('hidden');
            el.tableMode.classList.remove('hidden');
            renderTableEntry(entry);
        } else {
            el.tableMode.classList.add('hidden');
            el.singleMode.classList.remove('hidden');
            el.referenceValue.textContent = entry.fields[0].value;
            el.singleInput.value = '';
            el.singleInput.className = 'w-full text-center text-2xl font-mono tracking-widest px-4 py-3 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-indigo-400 transition';
            el.singleInput.focus();
        }
    }

    function renderTableEntry(entry) {
        // Reference side
        el.referenceTable.innerHTML = entry.fields.map(f => `
    <div class="flex justify-between px-4 py-3 border-b border-slate-100 last:border-b-0 bg-white">
        <span class="text-xs font-semibold text-slate-400">${escapeHtml(f.label)}</span>
        <span class="text-sm font-mono font-semibold text-slate-800">${escapeHtml(f.display || f.value)}</span>
    </div>
`).join('');

        // Input side
        el.inputTable.innerHTML = entry.fields.map((f, i) => `
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-indigo-100 last:border-b-0">
                <label class="text-xs font-semibold text-slate-500 w-24 shrink-0">${escapeHtml(f.label)}</label>
                <input type="text" data-field-idx="${i}" autocomplete="off" spellcheck="false"
                    class="de-field-input flex-1 text-sm font-mono px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 transition" />
            </div>
        `).join('');

        const inputs = el.inputTable.querySelectorAll('.de-field-input');
        inputs.forEach((input, i) => {
            input.addEventListener('input', onFirstKeystroke);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i === inputs.length - 1) {
                        submitEntry();
                    } else {
                        inputs[i + 1].focus();
                    }
                }
            });
        });
        if (inputs[0]) inputs[0].focus();
    }

    // ============= SUBMIT / SCORING =============
    function submitEntry() {
        if (finished) return;
        const entry = entries[currentIndex];
        let allCorrect = true;

        if (isTableMode()) {
            const inputs = el.inputTable.querySelectorAll('.de-field-input');
            entry.fields.forEach((f, i) => {
                const typed = (inputs[i] ? inputs[i].value : '').trim();
                const correct = typed === f.value;
                if (correct) correctFields++; else { incorrectFields++; allCorrect = false; }
            });
        } else {
            const typed = el.singleInput.value.trim();
            const correct = typed === entry.fields[0].value;
            if (correct) correctFields++; else { incorrectFields++; allCorrect = false; }
        }

        attemptedEntries++;
        if (allCorrect) correctEntries++;

        currentIndex++;
        maybeAutoAppend();
        if (!finished) renderCurrentEntry();
    }

    // Single-field mode: Enter submits
    el.singleInput.addEventListener('input', onFirstKeystroke);
    el.singleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitEntry();
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
        el.instructionText.textContent = 'Keep entering…';

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
            const epm = elapsedMin > 0 ? Math.round(correctEntries / elapsedMin) : 0;
            chartData.push({ second: sec, epm });
        }
    }

    // ============= GENERATE =============
    function generateTest() {
        resetState();
        config = readConfig();

        el.generateBtn.disabled = true;
        el.testSection.classList.remove('hidden');
        el.instructionText.textContent = 'Loading entries…';

        entries = [];
        fillEntryPool(estimateEntryCount(config.dataType, config.difficulty, config.totalSeconds));

        primeTimerDisplay();
        el.instructionText.textContent = 'Start entering the data shown';
        el.generateBtn.disabled = false;

        renderCurrentEntry();
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

        const totalFields = correctFields + incorrectFields;
        const accuracy = totalFields > 0 ? Math.round((correctFields / totalFields) * 100) : 0;
        const timeUsedSec = config.totalSeconds - Math.max(remainingSeconds, 0);
        const epm = Math.round(correctEntries / (config.totalSeconds / 60));

        el.finalEpm.textContent = epm;
        el.finalAccuracy.textContent = accuracy + '%';
        el.finalCorrect.textContent = correctEntries;
        el.finalErrors.textContent = incorrectFields;
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
                    data: chartData.map(d => d.epm),
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
        correctFields = 0;
        incorrectFields = 0;
        correctEntries = 0;
        attemptedEntries = 0;
        chartData = [];
        clearInterval(timerInterval);
        if (resultChart) { resultChart.destroy(); resultChart = null; }
        el.results.classList.add('hidden');
    }

})();