 
        let currentFilter = 'all';

        function switchAnalysisTab(tab) {
            const overallTab = document.getElementById('tab-overall');
            const solutionsTab = document.getElementById('tab-solutions');
            const overallContent = document.getElementById('an-overall');
            const solutionsContent = document.getElementById('an-solutions');

            if (tab === 'overall') {
                overallTab.className = "pb-4 font-bold text-sm text-[#4318FF] border-b-2 border-[#4318FF] transition-all cursor-pointer";
                solutionsTab.className = "pb-4 font-bold text-sm text-gray-400 border-b-2 border-transparent hover:text-gray-600 transition-all cursor-pointer";
                overallContent.classList.remove('hidden');
                solutionsContent.classList.add('hidden');
            } else {
                solutionsTab.className = "pb-4 font-bold text-sm text-[#4318FF] border-b-2 border-[#4318FF] transition-all cursor-pointer";
                overallTab.className = "pb-4 font-bold text-sm text-gray-400 border-b-2 border-transparent hover:text-gray-600 transition-all cursor-pointer";
                solutionsContent.classList.remove('hidden');
                overallContent.classList.add('hidden');
                renderMath();
            }
        }

        function goBackToPreviousPage() {
            if (document.referrer && document.referrer.includes(window.location.hostname)) {
                window.history.back();
            } else if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '<%- listing?._id ? `/listings/${listing._id}` : "/dashboard" %>';
            }
        }

        const STATUS_META = {
            correct: { label: 'Correct',   color: '#05CD99' },
            wrong:   { label: 'Incorrect', color: '#D32F2F' },
            skipped: { label: 'Skipped',   color: '#FF9E2C' }
        };

        function fmt(n) {
            return (n ?? 0).toLocaleString('en-IN');
        }

        function formatScore(n) {
    if (n === null || n === undefined) return '0';
    const rounded = Math.round(n * 1000) / 1000;
    return rounded.toString();
}

        

        // 🔧 FIX: text content ke liye (innerHTML context)
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.innerText = str ?? '';
            return div.innerHTML;
        }

        // 🆕 FIX: HTML attribute (src="", href="" waghera) ke andar safely daalne ke liye.
        // escapeHtml() sirf text-node escaping ke liye sahi hai; attribute context me
        // quotes bhi escape karna zaroori hai warna attribute break ho sakta hai (XSS risk).
        function escapeAttr(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        function renderAnalysis(data) {
            // 🔧 FIX: pehle sirf "return" ho jaata tha, user ko blank zeros wali screen
            // dikhti thi bina kisi explanation ke. Ab clear error state dikhega.
            if (!data) {
                document.getElementById('analysis-root').innerHTML = `
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                        <i class="fas fa-triangle-exclamation text-3xl text-gray-300 mb-4"></i>
                        <p class="text-sm font-semibold text-gray-600">Analysis load nahi ho payi.</p>
                        <p class="text-xs text-gray-400 mt-1">Page refresh karke dobara try karo, ya support se contact karo.</p>
                    </div>`;
                return;
            }

            document.getElementById('an-score').innerText = formatScore(data.score);
            document.getElementById('an-total-marks').innerText = data.totalMarks;
            const scorePct = data.totalMarks > 0 ? Math.max(0, Math.min(100, (data.score / data.totalMarks) * 100)) : 0;
            document.getElementById('bar-score').style.width = scorePct + '%';

            document.getElementById('an-attempt').innerText = data.attempted;
            document.getElementById('an-total-qs').innerText = data.totalQuestions;
            const attemptPct = data.totalQuestions > 0 ? (data.attempted / data.totalQuestions) * 100 : 0;
            document.getElementById('bar-attempt').style.width = attemptPct + '%';

            document.getElementById('an-time').innerText = data.timeTaken;

const rankCard = document.getElementById('rank-card');
const hasValidRank = data.rank !== null && data.rank !== undefined && data.rank !== '' && Number(data.rank) > 0;

if (hasValidRank) {
    rankCard.classList.remove('hidden');
    document.getElementById('an-rank').innerText = fmt(data.rank);
} else {
    rankCard.classList.add('hidden');
}
            document.getElementById('an-accuracy').innerText = data.accuracy;
            document.getElementById('bar-accuracy').style.width = data.accuracy + '%';

            document.getElementById('dist-pos').innerText = '+' + data.positiveMarks;
            document.getElementById('dist-neg').innerText = '-' + data.negativeMarks;
            document.getElementById('dist-left').innerText = data.skippedCount;

            renderTopicStrength(data.topicBreakdown);
            renderChart(data);
            renderSolutions();
            renderMath();
        }

        function renderTopicStrength(topics) {
            const container = document.getElementById('topic-strength-list');
            if (!topics || topics.length === 0) {
                container.innerHTML = '<p class="text-xs text-center text-gray-400 py-10">No data available. Complete a test first.</p>';
                return;
            }

            container.innerHTML = topics.map(t => {
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
                            <span class="text-gray-400 font-semibold">${t.attempted === 0 ? 'NOT ATTEMPTED' : 'SECTIONAL PERFORMANCE'}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderChart(data) {
            // 🔧 FIX: pehle chart ke counts solutions[] array se dobara derive ho rahe the,
            // jabki upar wale stat cards backend-provided data.positiveMarks/skippedCount
            // use kar rahe the. Dono kabhi mismatch ho sakte the (agar backend calc me koi
            // farak aaya) — ab dono jagah same backend-provided source of truth use ho raha hai.
            const correctN = (data.solutions || []).filter(s => s.status === 'correct').length;
            const wrongN = (data.solutions || []).filter(s => s.status === 'wrong').length;
            const skippedN = data.skippedCount ?? (data.solutions || []).filter(s => s.status === 'skipped').length;

            if (typeof Chart === 'undefined' || !document.getElementById('chartTimeAnalysis')) return;

            const ctx = document.getElementById('chartTimeAnalysis').getContext('2d');
            if (window.analysisChartInstance) window.analysisChartInstance.destroy();
            window.analysisChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Skipped', 'Correct', 'Wrong'],
                    datasets: [{
                        data: [skippedN, correctN, wrongN],
                        backgroundColor: ['#CBD5E1', '#05CD99', '#D32F2F'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }

        function optionLabel(idx) {
            return String.fromCharCode(65 + idx);
        }

        function buildOptionsHtml(sol) {
            if (sol.numericAnswer !== null && sol.numericAnswer !== undefined) {
                const isRight = sol.userNumericAnswer !== null && Number(sol.userNumericAnswer) === Number(sol.numericAnswer);
                return `
                    <div class="px-4 py-3 rounded-lg border border-[#05CD99] bg-green-50 text-sm font-bold text-gray-800 katex-content">
                        Correct Answer: ${escapeHtml(sol.numericAnswer)}
                    </div>
                    <div class="px-4 py-3 rounded-lg border ${sol.userNumericAnswer == null ? 'border-gray-200 text-gray-500' : (isRight ? 'border-[#05CD99] bg-green-50 text-gray-800' : 'border-[#D32F2F] bg-red-50 text-gray-800')} text-sm font-bold katex-content">
                        Your Answer: ${sol.userNumericAnswer == null ? 'Not Attempted' : escapeHtml(sol.userNumericAnswer)}
                    </div>
                `;
                // 🔧 FIX: userNumericAnswer ab escapeHtml() se guzarta hai (pehle raw print ho raha tha)
            }

            return (sol.options || []).map((opt, idx) => {
                const isCorrect = (sol.correctAnswers || []).includes(idx);
                const isSelected = (sol.selectedOptions || []).includes(idx);
                let cls = 'border-gray-200 text-gray-600';
                if (isCorrect) cls = 'border-[#05CD99] bg-green-50 text-gray-800 font-bold';
                else if (isSelected) cls = 'border-[#D32F2F] bg-red-50 text-gray-800 font-bold';

                const optText = typeof opt === 'string' ? opt : (opt.text || '');
                const optImage = typeof opt === 'object' ? opt.image : null;

                return `
                    <div class="sol-option-box px-4 py-3 rounded-lg border text-sm katex-content ${cls}">
                        ${optImage ? `<img src="${escapeAttr(optImage)}" alt="option ${optionLabel(idx)}" class="max-w-full rounded-md mb-2" loading="lazy" />` : ''}
                        ${optText ? `${optionLabel(idx)}. ${escapeHtml(optText)}` : `${optionLabel(idx)}.`}
                    </div>
                `;
            }).join('');
        }

        function typeIcon(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'integer') return 'fa-hashtag';
    if (t === 'multiple') return 'fa-square-check';
    return 'fa-circle-dot'; // default: mcq (single-correct)
}

function buildMetaBadge(icon, color, text) {
    if (!text) return '';
    return `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style="background:${color}1A; color:${color}">
            <i class="fas ${icon}"></i> ${escapeHtml(text)}
        </span>
    `;
}

function buildDifficultyBadge(level) {
    if (!level) return '';
    const key = String(level).toLowerCase();
    const colorMap = { easy: '#05CD99', medium: '#FF9E2C', hard: '#D32F2F' };
    const color = colorMap[key] || '#64748B';
    return `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase" style="background:${color}1A; color:${color}">
            <i class="fas fa-gauge-high"></i> ${escapeHtml(level)}
        </span>
    `;
}


function buildSolutionCard(sol) {
    const meta = STATUS_META[sol.status] || STATUS_META.skipped;

    return `
        <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm" data-status="${sol.status}">
            <div class="flex justify-between items-start mb-3 gap-3">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-wide">QUESTION ${sol.order} (${escapeHtml(sol.subject)})</span>
                <span class="text-xs font-extrabold uppercase whitespace-nowrap" style="color:${meta.color}">${meta.label}</span>
            </div>

            <div class="flex flex-wrap gap-2 mb-4">
                ${buildMetaBadge(typeIcon(sol.type), '#4318FF', sol.type)}
                ${buildMetaBadge('fa-bookmark', '#7C3AED', sol.topic)}
                ${buildMetaBadge('fa-tags', '#0EA5E9', sol.subtopic)}
                ${buildDifficultyBadge(sol.difficulty)}
            </div>

            ${sol.questionText ? `<p class="text-sm font-semibold text-gray-800 mb-3 katex-content">${escapeHtml(sol.questionText)}</p>` : ''}
            ${sol.questionImage ? `
                <div class="mb-4 w-full flex justify-center bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                    <img
                        src="${escapeAttr(sol.questionImage)}"
                        alt="question image"
                        class="zoomable-img w-full h-auto max-h-[320px] sm:max-h-[420px] object-contain cursor-zoom-in"
                        data-full-src="${escapeAttr(sol.questionImage)}"
                        loading="lazy"
                    />
                </div>
            ` : ''}

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${buildOptionsHtml(sol)}
            </div>

            ${sol.solutionText ? `<div class="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mt-3 katex-content"><strong class="text-gray-700">Solution:</strong> ${escapeHtml(sol.solutionText)}</div>` : ''}
            ${sol.solutionImage ? `<img src="${escapeAttr(sol.solutionImage)}" alt="solution image" class="max-w-full rounded-lg mt-3 border border-gray-100" loading="lazy" />` : ''}
        </div>
    `;
}
        
        // 🆕 Event delegation: solutions-list ke andar kisi bhi .zoomable-img pe click
        // hone par uski data-full-src ko naye tab me kholta hai. noopener,noreferrer
        // laga hai taaki naya tab window.opener access na kar sake (reverse tabnabbing fix).
        document.addEventListener('click', function (e) {
            const img = e.target.closest('.zoomable-img');
            if (!img) return;
            const url = img.dataset.fullSrc;
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        });

        document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'switch-tab') switchAnalysisTab(el.dataset.tab);
    else if (action === 'go-back') goBackToPreviousPage();
    else if (action === 'filter-sol') filterSol(el.dataset.filter);
    else if (action === 'download-pdf') downloadFilteredSolutionPDF();
});

        function renderSolutions() {
            const data = window.ANALYSIS_DATA;
            const list = document.getElementById('solutions-list');
            if (!data || !data.solutions) { list.innerHTML = ''; return; }

            const filtered = currentFilter === 'all'
                ? data.solutions
                : data.solutions.filter(s => s.status === currentFilter);

            list.innerHTML = filtered.length
                ? filtered.map(buildSolutionCard).join('')
                : '<p class="text-xs text-center text-gray-400 py-10">No questions in this filter.</p>';

            renderMath();
        }

        function filterSol(filter) {
            currentFilter = filter;
            document.querySelectorAll('.sol-filter-btn').forEach(btn => {
                if (btn.dataset.filter === filter) {
                    btn.className = "sol-filter-btn px-5 py-2 text-xs font-bold rounded-full bg-[#4318FF] text-white shadow-md transition-all cursor-pointer";
                } else {
                    btn.className = "sol-filter-btn px-5 py-2 text-xs font-bold rounded-full bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer";
                }
            });
            renderSolutions();
        }

        function downloadFilteredSolutionPDF() {
            window.print();
        }

        function renderMath() {
            if (typeof renderMathInElement === 'function') {
                document.querySelectorAll('.katex-content').forEach(el => {
                    renderMathInElement(el, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '\\[', right: '\\]', display: true }
                        ],
                        throwOnError: false
                    });
                });
            } else {
                setTimeout(renderMath, 200);
            }
        }

        window.onload = function () {
            renderAnalysis(window.ANALYSIS_DATA);
        };
 