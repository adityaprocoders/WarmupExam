(function () {
    'use strict';

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    async function apiGet(url) {
        const res = await fetch(url);
        return res.json();
    }

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
            body: JSON.stringify(body)
        });
        return { ok: res.ok, data: await res.json() };
    }

    /* ================= STATE ================= */

    let selectedListingIds = new Set();
    let selectedDays = new Set();
    let currentConfigExam = null;
    let currentConfigCategory = null;

    let subjectsList = [];           // [{subject}] — selected sources ke hisaab se load hoti hai

    let criteriaRowCount = 0;
    let criteriaRowState = {};       // rowId -> { qsections:Set, topics:Set, subTopics:Set }

    let questionCountStrategy = 'all';
    let subjectQuestionCountList = [];
    let editingSubjectQuestionIndex = null;
    let timeStrategy = 'total';
let subjectTimeList = [];
let editingSubjectTimeIndex = null;

    /* ================= LIST VIEW ================= */

    async function loadDashboardStats() {
        const tbody = $('#wuTableBody');
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-8">Loading...</td></tr>`;

        const { stats, rows } = await apiGet('/owner/live-test/dashboard-stats');

        $('#wuStatTotalExams').textContent = stats.totalExams;
        $('#wuStatLiveNow').textContent = stats.liveNow;
        $('#wuStatUpcoming').textContent = stats.upcoming;
        $('#wuStatCompleted').textContent = stats.completedToday;
        $('#wuStatParticipants').textContent = stats.totalParticipants.toLocaleString('en-IN');

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-8">No exams configured yet.</td></tr>`;
            return;
        }

        const statusBadge = {
    live: '<span class="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold">LIVE</span>',
    upcoming: '<span class="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold">UPCOMING</span>',
    completed: '<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">COMPLETED</span>',
    not_scheduled: '<span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 text-xs font-bold">NOT SCHEDULED</span>'
};

        tbody.innerHTML = rows.map(r => `
            <tr class="border-b border-gray-50 hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold text-gray-800">${r.exam}<br><span class="text-xs text-gray-400 font-normal">${r.category}</span></td>
                <td class="px-4 py-3">${statusBadge[r.status]}</td>
                <td class="px-4 py-3 text-gray-500">${r.startTime}</td>
                <td class="px-4 py-3 text-gray-600">${r.questionCount}</td>
                <td class="px-4 py-3 text-gray-600">${r.participants.toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-gray-600">${r.avgScore}</td>
                <td class="px-4 py-3">
                    <button data-action="wu-view-leaderboard" data-exam="${r.exam}" class="text-indigo-600 text-xs font-semibold hover:underline">
                        <i class="fa-solid fa-trophy text-amber-400 mr-1"></i>View Leaderboard
                    </button>
                </td>
                <td class="px-4 py-3 text-right">
                    <button data-action="wu-edit-exam" data-exam="${r.exam}" data-category-name="${r.category}" class="text-indigo-600 text-xs font-semibold hover:underline mr-3">Edit</button>
                    <button data-action="wu-delete-exam" data-exam="${r.exam}" class="text-red-500 text-xs font-semibold hover:underline">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    /* ================= ADD MODAL ================= */

    async function openAddModal() {
        toggleHidden($('#addLiveTestModalOverlay'));
        const catSelect = $('#wuModalCategorySelect');
        catSelect.innerHTML = `<option value="">Select category...</option>`;

        const { categories } = await apiGet('/owner/live-test/categories');
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c._id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });

        const examSelect = $('#wuModalExamSelect');
        examSelect.innerHTML = `<option value="">Select category first...</option>`;
        examSelect.disabled = true;
        $('#wuModalOpenBtn').disabled = true;
    }

    async function onModalCategoryChange() {
        const categoryId = $('#wuModalCategorySelect').value;
        const examSelect = $('#wuModalExamSelect');

        examSelect.innerHTML = `<option value="">Loading...</option>`;
        examSelect.disabled = true;
        $('#wuModalOpenBtn').disabled = true;

        if (!categoryId) {
            examSelect.innerHTML = `<option value="">Select category first...</option>`;
            return;
        }

        const { exams } = await apiGet('/owner/live-test/exams?category=' + categoryId);
        examSelect.innerHTML = `<option value="">Select exam...</option>`;
        exams.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.name;
            opt.textContent = e.name + (e.configured ? ' ●' : '');
            if (e.configured) opt.style.color = '#16a34a';
            examSelect.appendChild(opt);
        });
        examSelect.disabled = false;
    }

    function onModalExamChange() {
        $('#wuModalOpenBtn').disabled = !$('#wuModalExamSelect').value;
    }

    /* ================= CONFIG VIEW — INIT ================= */

    async function openConfigView(categoryId, examName) {
        toggleHidden($('#addLiveTestModalOverlay'));
        $('#liveTestListView').classList.add('hidden');
        $('#liveTestConfigView').classList.remove('hidden');

        currentConfigExam = examName;
        currentConfigCategory = categoryId;
        selectedListingIds = new Set();
        selectedDays = new Set();
        criteriaRowCount = 0;
        criteriaRowState = {};
        subjectQuestionCountList = [];
        editingSubjectQuestionIndex = null;
        $('#ltCriteriaRowsContainer').innerHTML = '';
        subjectTimeList = [];
editingSubjectTimeIndex = null;

        $('#wuConfigExamLabel').textContent = examName;
        $('#wuSaveConfigBtn').dataset.exam = examName;
        $('#wuSaveConfigBtn').dataset.category = categoryId;

        const { sources } = await apiGet(`/owner/live-test/sources?category=${categoryId}&exam=${encodeURIComponent(examName)}`);
        const { config } = await apiGet(`/owner/live-test/config/${encodeURIComponent(examName)}`);

        renderSources(sources, config);
        await loadSubjectsForSelectedSources();

        if (config) {
            selectedDays = new Set(config.scheduledDays || []);
            $('#ltMaxRepeat').value = config.maxRepeat || 2;
            timeStrategy = config.timeStrategy === 'subject' ? 'subject' : 'total';
$('#ltTimeStrategy').value = timeStrategy;
subjectTimeList = timeStrategy === 'subject' ? (config.subjectTimes || []) : [];
handleTimeStrategyUI(timeStrategy === 'total' ? config.duration : null);
            $('#wuDiffEasy').value = config.difficultyDistribution.easy;
            $('#wuDiffMedium').value = config.difficultyDistribution.medium;
            $('#wuDiffHard').value = config.difficultyDistribution.hard;
            $('#ltStartTime').value = config.startTime || '06:00';
            updateStartTimeDisplay();
            const langVal = config.languageMode === 'both' ? 'both' : (config.languages[0] || 'English');
            const radio = $(`input[name="wuLanguage"][value="${langVal}"]`);
            if (radio) radio.checked = true;

            questionCountStrategy = config.totalQuestionsStrategy === 'subject' ? 'subject' : 'all';
            $('#ltQuestionCountStrategy').value = questionCountStrategy;
            subjectQuestionCountList = questionCountStrategy === 'subject' ? (config.subjectQuestionCounts || []) : [];
            handleQuestionCountUI(config.totalQuestionsStrategy === 'all' ? config.questionCount : null);

            // filter rows prefill
            (config.criteria || []).forEach(row => addCriteriaRow(row));
            if ((config.criteria || []).length === 0) addCriteriaRow();
        } else {
            $('#ltMaxRepeat').value = 2;
            timeStrategy = 'total';
$('#ltTimeStrategy').value = 'total';
subjectTimeList = [];
handleTimeStrategyUI();
            $('#wuDiffEasy').value = 30;
            $('#wuDiffMedium').value = 50;
            $('#wuDiffHard').value = 20;
            $('#ltStartTime').value = '06:00';
                        updateStartTimeDisplay();
            $(`input[name="wuLanguage"][value="English"]`).checked = true;

            questionCountStrategy = 'all';
            $('#ltQuestionCountStrategy').value = 'all';
            subjectQuestionCountList = [];
            handleQuestionCountUI();

            addCriteriaRow();
        }

        renderScheduledDays();
        updateDiffBar();
        await updateUniqueCount();
        updatePreview();
    }

    function renderSources(sources, config) {
        const container = $('#wuSourcesList');
        const preSelected = new Set((config?.includedListings || []).map(String));

        container.innerHTML = sources.map(s => {
            const checked = preSelected.has(String(s._id));
            if (checked) selectedListingIds.add(String(s._id));
            return `
                <label class="flex items-center justify-between text-sm cursor-pointer">
                    <span class="flex items-center gap-2">
                        <input type="checkbox" data-action="wu-source-checkbox" value="${s._id}" ${checked ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600">
                        ${s.title}
                    </span>
                    <span class="text-xs text-gray-400">${s.questionCount} Qs</span>
                </label>
            `;
        }).join('') || `<p class="text-xs text-gray-400">No test series found for this exam.</p>`;
    }

    async function loadSubjectsForSelectedSources() {
        const ids = Array.from(selectedListingIds);
        if (ids.length === 0) { subjectsList = []; refreshAllRowSubjectDropdowns(); return; }
        const { subjects } = await apiGet('/owner/live-test/subjects?listingIds=' + ids.join(','));
        subjectsList = subjects || [];
        refreshAllRowSubjectDropdowns();
    }

    function getSubjectOptionsHtml(selectedValue) {
        const placeholder = `<option value="" disabled ${!selectedValue ? 'selected' : ''}>Choose subject</option>`;
        if (subjectsList.length === 0) return placeholder + `<option value="">No subjects found</option>`;
        let html = placeholder + subjectsList.map(s => {
            const isSelected = (s === selectedValue) ? 'selected' : '';
            return `<option value="${s}" ${isSelected}>${s}</option>`;
        }).join('');
        // agar row ka current subject naye list me nahi hai (source badal gaya), phir bhi dikhao taaki data na ude
        if (selectedValue && !subjectsList.includes(selectedValue)) {
            html += `<option value="${selectedValue}" selected>${selectedValue} (not in current sources)</option>`;
        }
        return html;
    }

    function refreshAllRowSubjectDropdowns() {
        $all('#ltCriteriaRowsContainer [id^="critSubject_"]').forEach(sel => {
            const current = sel.value;
            sel.innerHTML = getSubjectOptionsHtml(current);
        });
        if (timeStrategy === 'subject' && $('#ltTimeSubjectCheckboxes')) {
            const currentlyChecked = new Set($all('#ltTimeSubjectCheckboxes input:checked').map(cb => cb.value));
            renderTimeSubjectCheckboxes(currentlyChecked);
        }
    }

    function renderScheduledDays() {
        $all('[data-action="lt-day-checkbox"]').forEach(cb => {
            cb.checked = selectedDays.has(cb.value);
        });
        const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        $('#ltDaySelectAll').checked = allDays.every(d => selectedDays.has(d));
    }

    async function updateUniqueCount() {
        const ids = Array.from(selectedListingIds);
        if (ids.length === 0) { $('#wuTotalUniqueCount').textContent = '0'; return; }
        const { count } = await apiGet('/owner/live-test/sources/unique-count?listingIds=' + ids.join(','));
        $('#wuTotalUniqueCount').textContent = count;
    }

    function updateDiffBar() {
        const easy = parseInt($('#wuDiffEasy').value, 10) || 0;
        const medium = parseInt($('#wuDiffMedium').value, 10) || 0;
        const hard = parseInt($('#wuDiffHard').value, 10) || 0;
        const total = easy + medium + hard;

        const bar = $('#wuDiffBar');
        bar.innerHTML = `
            <div class="bg-green-400 h-full" style="width:${easy}%"></div>
            <div class="bg-amber-400 h-full" style="width:${medium}%"></div>
            <div class="bg-red-400 h-full" style="width:${hard}%"></div>
        `;

        $('#wuDiffError').classList.toggle('hidden', total === 100);
    }

    /* ================= TOTAL QUESTIONS STRATEGY (All / Subject-wise) ================= */

    function handleQuestionCountUI(prefillTotal) {
        const container = $('#ltQuestionCountDynamicContainer');
        const strategy = $('#ltQuestionCountStrategy').value;
        questionCountStrategy = strategy;

        if (strategy === 'all') {
            container.innerHTML = `<input type="number" id="ltTotalQuestionCount" min="5" max="200" placeholder="e.g. 20" class="w-full border rounded-lg px-3 py-2 text-sm" value="${prefillTotal || ''}">`;
        } else {
            editingSubjectQuestionIndex = null;
            container.innerHTML = `
                <select id="ltQcSubjectDropdown" class="w-full border rounded-lg px-3 py-2 text-sm mb-2">
                    ${getSubjectOptionsHtml(null)}
                </select>
                <input type="number" id="ltQcCountInput" min="1" placeholder="No of questions" class="w-full border rounded-lg px-3 py-2 text-sm mb-2">
                <button type="button" id="ltAddQcBtn" data-action="lt-add-subject-question-count" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold py-2 rounded-lg text-sm mb-2">Add</button>
                <div id="ltQcList" class="space-y-1.5"></div>
            `;
            renderSubjectQuestionList();
        }
    }

    function renderSubjectQuestionList() {
        const list = $('#ltQcList');
        if (!list) return;
        list.innerHTML = subjectQuestionCountList.map((sq, index) => `
            <div class="flex justify-between items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                <span class="font-medium text-gray-700">${sq.subject}</span>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-indigo-600">${sq.count} Q</span>
                    <button type="button" data-action="lt-edit-subject-question-count" data-index="${index}" class="text-gray-400 hover:text-indigo-600">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button type="button" data-action="lt-remove-subject-question-count" data-index="${index}" class="text-gray-400 hover:text-red-500">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function addSubjectQuestionCount() {
        const subjectSel = $('#ltQcSubjectDropdown');
        const countInput = $('#ltQcCountInput');
        const subject = subjectSel.value;
        const count = Number(countInput.value);
        if (!subject || !count) return;

        const newEntry = { subject, count };
        if (editingSubjectQuestionIndex !== null) {
            subjectQuestionCountList[editingSubjectQuestionIndex] = newEntry;
            editingSubjectQuestionIndex = null;
            $('#ltAddQcBtn').textContent = 'Add';
        } else {
            subjectQuestionCountList.push(newEntry);
        }
        renderSubjectQuestionList();
        subjectSel.value = '';
        countInput.value = '';
        updatePreview();
    }

    function editSubjectQuestionCount(index) {
        const entry = subjectQuestionCountList[index];
        if (!entry) return;
        editingSubjectQuestionIndex = index;
        $('#ltQcSubjectDropdown').value = entry.subject;
        $('#ltQcCountInput').value = entry.count;
        $('#ltAddQcBtn').textContent = 'Update';
    }

    function removeSubjectQuestionCount(index) {
        subjectQuestionCountList.splice(index, 1);
        if (editingSubjectQuestionIndex === index) {
            editingSubjectQuestionIndex = null;
            $('#ltAddQcBtn').textContent = 'Add';
        } else if (editingSubjectQuestionIndex !== null && index < editingSubjectQuestionIndex) {
            editingSubjectQuestionIndex--;
        }
        renderSubjectQuestionList();
        updatePreview();
    }
    
    /* ================= TIME STRATEGY (Total / Subject-wise) ================= */

function handleTimeStrategyUI(prefillTotal) {
    const container = $('#ltTimeDynamicContainer');
    const strategy = $('#ltTimeStrategy').value;
    timeStrategy = strategy;

    if (strategy === 'total') {
        container.innerHTML = `
            <label class="block text-xs text-gray-500 mb-1">Total Duration (minutes)</label>
            <input type="number" id="ltTotalDuration" min="1" max="180" placeholder="e.g. 30" class="w-full border rounded-lg px-3 py-2 text-sm" value="${prefillTotal || ''}">
        `;
    } else {
        editingSubjectTimeIndex = null;
        container.innerHTML = `
            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Choose Subject(s)</label>
            <div id="ltTimeSubjectCheckboxes" class="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto border rounded-lg p-2"></div>
            <input type="number" id="ltTimeMinutesInput" min="1" placeholder="Minutes (same value un sab subjects ko milegi)" class="w-full border rounded-lg px-3 py-2 text-sm mb-2">
            <button type="button" id="ltAddTimeBtn" data-action="lt-add-subject-time" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold py-2 rounded-lg text-sm mb-2">Add</button>
            <div id="ltTimeList" class="space-y-1.5"></div>
        `;
        renderTimeSubjectCheckboxes();
        renderSubjectTimeList();
    }
    updatePreview();
}

function renderTimeSubjectCheckboxes(preSelected) {
    const container = $('#ltTimeSubjectCheckboxes');
    if (!container) return;
    const selected = preSelected || new Set();

    if (subjectsList.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400">No subjects found</p>`;
        return;
    }

    container.innerHTML = subjectsList.map(s => `
        <label class="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
            <input type="checkbox" data-action="lt-time-subject-checkbox" value="${s}" class="w-3.5 h-3.5" ${selected.has(s) ? 'checked' : ''}>
            ${s}
        </label>
    `).join('');
}

function renderSubjectTimeList() {
    const list = $('#ltTimeList');
    if (!list) return;
    list.innerHTML = subjectTimeList.map((st, index) => `
        <div class="flex justify-between items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
            <span class="font-medium text-gray-700">${st.subject}</span>
            <div class="flex items-center gap-2">
                <span class="font-bold text-indigo-600">${st.minutes} min</span>
                <button type="button" data-action="lt-edit-subject-time" data-index="${index}" class="text-gray-400 hover:text-indigo-600">
                    <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button type="button" data-action="lt-remove-subject-time" data-index="${index}" class="text-gray-400 hover:text-red-500">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addSubjectTime() {
    const checkedBoxes = $all('#ltTimeSubjectCheckboxes input[type="checkbox"]:checked');
    const minutesInput = $('#ltTimeMinutesInput');
    const selectedSubjects = checkedBoxes.map(cb => cb.value);
    const minutes = Number(minutesInput.value);

    if (selectedSubjects.length === 0 || !minutes) return;

    if (editingSubjectTimeIndex !== null) {
        subjectTimeList[editingSubjectTimeIndex] = { subject: selectedSubjects[0], minutes };
        editingSubjectTimeIndex = null;
        $('#ltAddTimeBtn').textContent = 'Add';
    } else {
        selectedSubjects.forEach(subject => {
            const existingIdx = subjectTimeList.findIndex(st => st.subject === subject);
            if (existingIdx !== -1) {
                subjectTimeList[existingIdx] = { subject, minutes };
            } else {
                subjectTimeList.push({ subject, minutes });
            }
        });
    }

    renderSubjectTimeList();
    renderTimeSubjectCheckboxes();
    minutesInput.value = '';
    updatePreview();
}

function editSubjectTime(index) {
    const entry = subjectTimeList[index];
    if (!entry) return;
    editingSubjectTimeIndex = index;
    renderTimeSubjectCheckboxes(new Set([entry.subject]));
    $('#ltTimeMinutesInput').value = entry.minutes;
    $('#ltAddTimeBtn').textContent = 'Update';
}

function removeSubjectTime(index) {
    subjectTimeList.splice(index, 1);
    if (editingSubjectTimeIndex === index) {
        editingSubjectTimeIndex = null;
        $('#ltAddTimeBtn').textContent = 'Add';
    } else if (editingSubjectTimeIndex !== null && index < editingSubjectTimeIndex) {
        editingSubjectTimeIndex--;
    }
    renderSubjectTimeList();
    updatePreview();
}


    /* ================= FILTER BUILDER ROWS ================= */

    function addCriteriaRow(prefill) {
        criteriaRowCount++;
        const rowId = criteriaRowCount;
        criteriaRowState[rowId] = {
    qsections: new Set(prefill?.section || []),
    topics: new Set(prefill?.topic || []),
    subTopics: new Set(prefill?.subTopic || []),
    difficulty: new Set(prefill?.difficulty || []),
    countMode: prefill?.countMode || 'topic'
};

        const container = $('#ltCriteriaRowsContainer');
        const row = document.createElement('div');
        row.id = `criteriaRow_${rowId}`;
        row.className = 'p-3 bg-gray-50 rounded-xl border border-gray-100';
        row.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-[repeat(16,minmax(0,1fr))] gap-2.5">

                <div class="md:col-span-3">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subject *</span>
                    <select id="critSubject_${rowId}" data-action="row-subject-change" data-row-id="${rowId}"
                        class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm outline-none">
                        ${getSubjectOptionsHtml(prefill?.subject || null)}
                    </select>
                </div>

                <div class="md:col-span-3">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Section</span>
                    <select id="qsectionDropdown_${rowId}" data-action="row-qsection-change" data-row-id="${rowId}"
                        class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm outline-none">
                        <option value="" disabled selected>Choose subject first</option>
                    </select>
                    <div id="qsectionTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
                </div>

                <div class="md:col-span-2">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Topic</span>
                    <select id="topicDropdown_${rowId}" data-action="row-topic-change" data-row-id="${rowId}"
                        class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm outline-none">
                        <option value="" disabled selected>—</option>
                    </select>
                    <div id="topicTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
                </div>

                <div class="md:col-span-2">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Sub-topic</span>
                    <select id="subTopicDropdown_${rowId}" data-action="row-subtopic-change" data-row-id="${rowId}"
                        class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm outline-none">
                        <option value="" disabled selected>—</option>
                    </select>
                    <div id="subTopicTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
                </div>

                                <div class="md:col-span-2">
                    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Difficulty</span>
                    <div class="flex gap-2 flex-wrap">
                        <label class="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                            <input type="checkbox" data-action="row-difficulty-checkbox" data-row-id="${rowId}" value="Easy" class="w-3 h-3" ${criteriaRowState[rowId].difficulty.has('Easy') ? 'checked' : ''}> Easy
                        </label>
                        <label class="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                            <input type="checkbox" data-action="row-difficulty-checkbox" data-row-id="${rowId}" value="Medium" class="w-3 h-3" ${criteriaRowState[rowId].difficulty.has('Medium') ? 'checked' : ''}> Medium
                        </label>
                        <label class="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                            <input type="checkbox" data-action="row-difficulty-checkbox" data-row-id="${rowId}" value="Hard" class="w-3 h-3" ${criteriaRowState[rowId].difficulty.has('Hard') ? 'checked' : ''}> Hard
                        </label>
                    </div>
                    <p class="text-[9px] text-gray-400 mt-1">Khali chhodo = koi bhi difficulty chalegi</p>
                </div>

                <div class="md:col-span-2">
    <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Count Mode</span>
    <select data-action="row-countmode-change" data-row-id="${rowId}"
        class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs sm:text-sm outline-none">
        <option value="topic" ${(prefill?.countMode || 'topic') === 'topic' ? 'selected' : ''}>Topic-wise (Min/Max)</option>
        <option value="subject" ${prefill?.countMode === 'subject' ? 'selected' : ''}>Subject-wise (No limit)</option>
    </select>
</div>



               <div class="md:col-span-2 flex gap-1" id="rowMinMax_${rowId}" style="${(prefill?.countMode === 'subject') ? 'display:none;' : ''}">
    <div class="flex-1">
        <span class="block text-[10px] font-bold text-gray-400 uppercase mb-1">Min Q</span>
        <input type="number" id="critMinCount_${rowId}" min="1" value="${prefill?.minCount || 1}"
            class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs sm:text-sm outline-none">
    </div>
    <div class="flex-1 flex items-end gap-1">
        <input type="number" id="critMaxCount_${rowId}" min="1" value="${prefill?.maxCount || 1}"
            class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs sm:text-sm outline-none">
        <button type="button" data-action="remove-criteria-row" data-row-id="${rowId}" class="text-gray-400 hover:text-red-500 shrink-0 pb-2">
            <i class="fa-solid fa-xmark"></i>
        </button>
    </div>
</div>

            </div>
        `;

        container.appendChild(row);
        renderRowTags(rowId, 'qsection');
        renderRowTags(rowId, 'topic');
        renderRowTags(rowId, 'subTopic');

        if (prefill) {
            refreshRowFilterOptions(rowId);
        } else {
            handleRowSubjectChange(rowId);
        }
        updatePreview();
    }

    function removeCriteriaRow(rowId) {
        const row = $(`#criteriaRow_${rowId}`);
        if (row) row.remove();
        delete criteriaRowState[rowId];
        updatePreview();
    }

    function handleRowCountModeChange(rowId, mode) {
    criteriaRowState[rowId].countMode = mode;
    const wrapper = $(`#rowMinMax_${rowId}`);
    if (wrapper) wrapper.style.display = mode === 'subject' ? 'none' : 'flex';
}

    function handleRowDifficultyChange(rowId, value, checked) {
    const state = criteriaRowState[rowId];
    if (checked) state.difficulty.add(value);
    else state.difficulty.delete(value);
}

    async function fetchRowFilters(rowId) {
        const subject = $(`#critSubject_${rowId}`)?.value || '';
        const state = criteriaRowState[rowId];
        if (!subject) return null;

        const listingIdsQuery = Array.from(selectedListingIds).join(',');
        const qsectionQuery = Array.from(state.qsections).join(',');
        const topicQuery = Array.from(state.topics).join(',');

        const url = `/owner/live-test/question-filters?listingIds=${encodeURIComponent(listingIdsQuery)}&subject=${encodeURIComponent(subject)}&qsection=${encodeURIComponent(qsectionQuery)}&topic=${encodeURIComponent(topicQuery)}`;

        try {
            const res = await fetch(url);
            const result = await res.json();
            return result.success ? result.data : null;
        } catch (err) {
            console.error('Question filters fetch error:', err);
            return null;
        }
    }

    async function refreshRowFilterOptions(rowId) {
        const data = await fetchRowFilters(rowId);
        populateRowDropdown(rowId, 'qsection', data ? data.qsections : []);
        populateRowDropdown(rowId, 'topic', data ? data.topics : []);
        populateRowDropdown(rowId, 'subTopic', data ? data.subTopics : []);
    }

    async function handleRowSubjectChange(rowId) {
        const state = criteriaRowState[rowId];
        state.qsections.clear();
        state.topics.clear();
        state.subTopics.clear();
        renderRowTags(rowId, 'qsection');
        renderRowTags(rowId, 'topic');
        renderRowTags(rowId, 'subTopic');
        await refreshRowFilterOptions(rowId);
        updatePreview();
    }

    async function handleRowQsectionChange(rowId) {
        const dropdown = $(`#qsectionDropdown_${rowId}`);
        const val = dropdown.value;
        const state = criteriaRowState[rowId];
        if (val && !state.qsections.has(val)) {
            state.qsections.add(val);
            renderRowTags(rowId, 'qsection');
        }
        dropdown.value = '';

        state.topics.clear();
        state.subTopics.clear();
        renderRowTags(rowId, 'topic');
        renderRowTags(rowId, 'subTopic');

        await refreshRowFilterOptions(rowId);
    }

    async function handleRowTopicChange(rowId) {
        const dropdown = $(`#topicDropdown_${rowId}`);
        const val = dropdown.value;
        const state = criteriaRowState[rowId];
        if (val && !state.topics.has(val)) {
            state.topics.add(val);
            renderRowTags(rowId, 'topic');
        }
        dropdown.value = '';

        state.subTopics.clear();
        renderRowTags(rowId, 'subTopic');

        await refreshRowFilterOptions(rowId);
    }

    function handleRowSubTopicChange(rowId) {
        const dropdown = $(`#subTopicDropdown_${rowId}`);
        const val = dropdown.value;
        const state = criteriaRowState[rowId];
        if (val && !state.subTopics.has(val)) {
            state.subTopics.add(val);
            renderRowTags(rowId, 'subTopic');
        }
        dropdown.value = '';
    }

    function populateRowDropdown(rowId, field, options) {
        const idMap = { qsection: 'qsectionDropdown', topic: 'topicDropdown', subTopic: 'subTopicDropdown' };
        const dropdown = $(`#${idMap[field]}_${rowId}`);
        if (!dropdown) return;

        if (!options || options.length === 0) {
            dropdown.innerHTML = `<option value="" disabled selected>None</option>`;
            return;
        }
        dropdown.innerHTML = `<option value="" disabled selected>Choose ${field}</option>` +
            options.map(o => `<option value="${o}">${o}</option>`).join('');
    }

    function renderRowTags(rowId, field) {
        const idMap = { qsection: 'qsectionTags', topic: 'topicTags', subTopic: 'subTopicTags' };
        const container = $(`#${idMap[field]}_${rowId}`);
        if (!container) return;

        const setKey = field === 'qsection' ? 'qsections' : field === 'topic' ? 'topics' : 'subTopics';
        const set = criteriaRowState[rowId][setKey];
        container.innerHTML = Array.from(set).map(v => `
            <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">
                ${v}
                <button type="button" data-action="remove-row-tag" data-row-id="${rowId}" data-field="${field}" data-value="${v}" class="hover:text-red-500 font-bold">✕</button>
            </span>
        `).join('');
    }

    function removeRowTag(rowId, field, val) {
        const setKey = field === 'qsection' ? 'qsections' : field === 'topic' ? 'topics' : 'subTopics';
        criteriaRowState[rowId][setKey].delete(val);
        renderRowTags(rowId, field);
    }

    function collectCriteriaRows() {
        const rows = [];
        $all('#ltCriteriaRowsContainer [id^="criteriaRow_"]').forEach(row => {
            const rowId = row.id.split('_')[1];
            const state = criteriaRowState[rowId] || { qsections: new Set(), topics: new Set(), subTopics: new Set(), difficulty: new Set() };

           const countMode = state.countMode || 'topic';
const minVal = Number($(`#critMinCount_${rowId}`)?.value) || 1;
const maxVal = Number($(`#critMaxCount_${rowId}`)?.value) || 1;

rows.push({
    subject: $(`#critSubject_${rowId}`).value,
    section: Array.from(state.qsections),
    topic: Array.from(state.topics),
    subTopic: Array.from(state.subTopics),
    difficulty: Array.from(state.difficulty),
    countMode,
    minCount: countMode === 'subject' ? 0 : Math.min(minVal, maxVal),
    maxCount: countMode === 'subject' ? 999 : Math.max(minVal, maxVal)
});
        });
        return rows;
    }


        function formatTime12hr(hhmm) {
        if (!hhmm) return '—';
        const [h, m] = hhmm.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    }


        function updateStartTimeDisplay() {
        const display = $('#ltStartTimeDisplay');
        if (display) display.textContent = formatTime12hr($('#ltStartTime').value);
    }
    


    /* ================= PREVIEW ================= */

    function updatePreview() {
        $('#wuPreviewExam').textContent = currentConfigExam || '—';

        let totalQ = '—';
        if (questionCountStrategy === 'all') {
            const v = $('#ltTotalQuestionCount')?.value;
            totalQ = v || '—';
        } else {
            const sum = subjectQuestionCountList.reduce((s, sq) => s + (Number(sq.count) || 0), 0);
            totalQ = sum || '—';
        }
        $('#wuPreviewQuestions').textContent = totalQ;

        $('#ltPreviewRows').textContent = $all('#ltCriteriaRowsContainer [id^="criteriaRow_"]').length;
        $('#wuPreviewSources').textContent = selectedListingIds.size + ' Series';

        const lang = $('input[name="wuLanguage"]:checked')?.value || 'English';
        $('#wuPreviewLanguage').textContent = lang === 'both' ? 'Both' : lang;
        $('#wuPreviewStartTime').textContent = formatTime12hr($('#ltStartTime').value);
        $('#ltPreviewMaxRepeat').textContent = $('#ltMaxRepeat').value || '—';

       const daysArr = Array.from(selectedDays);
$('#ltPreviewDays').textContent = daysArr.length === 0 ? '⚠️ No Days Selected' : (daysArr.length === 7 ? 'All Days' : daysArr.join(', '));
    }

    /* ================= SAVE / DELETE ================= */

    async function saveConfig(btn) {
        const easy = parseInt($('#wuDiffEasy').value, 10) || 0;
        const medium = parseInt($('#wuDiffMedium').value, 10) || 0;
        const hard = parseInt($('#wuDiffHard').value, 10) || 0;

        if (easy + medium + hard !== 100) {
            $('#wuDiffError').classList.remove('hidden');
            return;
        }
        if (selectedListingIds.size === 0) {
            alert('Please select at least one question source.');
            return;
        }

        const criteria = collectCriteriaRows();
        if (criteria.length === 0) {
            alert('Kam se kam ek Filter Row add karo.');
            return;
        }
        if (selectedDays.size === 0) {
    alert('Kam se kam ek Day select karo.');
    return;
}
        for (const row of criteria) {
    if (!row.subject) {
        alert('Har row me Subject choose karna zaroori hai.');
        return;
    }
    if (row.countMode !== 'subject') {
        if (!row.minCount || !row.maxCount || row.minCount < 1 || row.maxCount < row.minCount) {
            alert(`"${row.subject}" row ka Min/Max Q sahi nahi hai.`);
            return;
        }
    }
}

        let questionCount = null;
        if (questionCountStrategy === 'all') {
            questionCount = Number($('#ltTotalQuestionCount')?.value) || 0;
            if (!questionCount || questionCount < 5) {
                alert('Total No of Questions kam se kam 5 honi chahiye.');
                return;
            }
        } else {
            if (subjectQuestionCountList.length === 0) {
                alert('Subject-wise question count add karo.');
                return;
            }
        }
if (timeStrategy === 'total') {
    const d = parseInt($('#ltTotalDuration')?.value, 10);
    if (!d || d < 1) { alert('Total Duration sahi bharo.'); return; }
} else {
    if (subjectTimeList.length === 0) { alert('Subject-wise time add karo.'); return; }
}
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const { ok, data } = await apiPost('/owner/live-test/config', {
            category: btn.dataset.category,
            exam: btn.dataset.exam,
            includedListings: Array.from(selectedListingIds),
            languageMode: $('input[name="wuLanguage"]:checked').value,
            criteria,
            totalQuestionsStrategy: questionCountStrategy,
            questionCount: questionCountStrategy === 'all' ? questionCount : undefined,
            subjectQuestionCounts: questionCountStrategy === 'subject' ? subjectQuestionCountList : [],
            maxRepeat: Number($('#ltMaxRepeat').value) || 2,
timeStrategy: timeStrategy,
duration: timeStrategy === 'total' ? parseInt($('#ltTotalDuration').value, 10) : undefined,
subjectTimes: timeStrategy === 'subject' ? subjectTimeList : [],
            difficultyDistribution: { easy, medium, hard },
            startTime: $('#ltStartTime').value,
            scheduledDays: Array.from(selectedDays)
        });

        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Configuration`;

        if (!ok) {
            alert(data.message || 'Could not save configuration.');
            return;
        }

        backToList();
        loadDashboardStats();
    }

    async function deleteConfig(examName) {
        if (!confirm(`Delete Live Test config for "${examName}"? This will also remove today's active test if any.`)) return;

        const res = await fetch('/owner/live-test/config/' + encodeURIComponent(examName), {
            method: 'DELETE',
            headers: { 'x-csrf-token': getCsrfToken() }
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            alert(data.message || 'Could not delete.');
            return;
        }

        loadDashboardStats();
    }

    async function openLeaderboardModal(examName) {
        toggleHidden($('#wuLeaderboardModalOverlay'));
        $('#wuLbExamName').textContent = examName;
        $('#wuLbContent').innerHTML = `<p class="text-center text-gray-400 py-8">Loading...</p>`;

        const data = await apiGet('/owner/live-test/leaderboard/' + encodeURIComponent(examName));

        if (!data.success || !data.active) {
            $('#wuLbContent').innerHTML = `<p class="text-center text-gray-400 py-8">No active live test right now for this exam.</p>`;
            return;
        }

        if (data.leaderboard.length === 0) {
            $('#wuLbContent').innerHTML = `<p class="text-center text-gray-400 py-8">No attempts yet today.</p>`;
            return;
        }

        const rows = data.leaderboard.map(entry => `
            <tr class="border-b border-gray-50">
                <td class="py-2.5 pr-3 text-gray-500">${entry.rank}</td>
                <td class="py-2.5 pr-3 text-gray-800 font-medium">${entry.name}</td>
                <td class="py-2.5 pr-3 text-gray-600">${entry.score}/${entry.totalMarks}</td>
                <td class="py-2.5 pr-3 text-gray-600">${entry.accuracy}%</td>
                <td class="py-2.5 text-gray-600">${entry.time}</td>
            </tr>
        `).join('');

        $('#wuLbContent').innerHTML = `
            <p class="text-xs text-gray-400 mb-3">Total Participants: <span class="font-semibold text-gray-600">${data.totalParticipants}</span></p>
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-gray-400 text-xs uppercase border-b border-gray-100">
                        <th class="text-left py-2 pr-3 font-semibold">Rank</th>
                        <th class="text-left py-2 pr-3 font-semibold">Student</th>
                        <th class="text-left py-2 pr-3 font-semibold">Score</th>
                        <th class="text-left py-2 pr-3 font-semibold">Accuracy</th>
                        <th class="text-left py-2 font-semibold">Time</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    function backToList() {
    $('#liveTestConfigView').classList.add('hidden');
    $('#liveTestListView').classList.remove('hidden');
}

    function toggleHidden(el) { if (el) el.classList.toggle('hidden'); }

    /* ================= EVENTS ================= */

    document.addEventListener('click', function (e) {
        if (e.target.closest('#openAddLiveTestModalBtn')) { openAddModal(); return; }
        if (e.target.closest('#closeAddLiveTestModalBtn') || e.target.closest('#wuModalCancelBtn')) {
            toggleHidden($('#addLiveTestModalOverlay')); return;
        }
        if (e.target.closest('#wuModalOpenBtn')) {
            const categoryId = $('#wuModalCategorySelect').value;
            const examName = $('#wuModalExamSelect').value;
            if (categoryId && examName) openConfigView(categoryId, examName);
            return;
        }
        if (e.target.closest('#wuBackToListBtn')) { backToList(); return; }
        if (e.target.closest('#wuSaveConfigBtn')) { saveConfig(e.target.closest('#wuSaveConfigBtn')); return; }
        if (e.target.closest('#wuRefreshBtn')) { loadDashboardStats(); return; }

        const editBtn = e.target.closest('[data-action="wu-edit-exam"]');
        if (editBtn) {
            (async () => {
                const { categories } = await apiGet('/owner/live-test/categories');
                const match = categories.find(c => c.name === editBtn.dataset.categoryName);
                if (match) openConfigView(match._id, editBtn.dataset.exam);
            })();
            return;
        }

        const deleteBtn = e.target.closest('[data-action="wu-delete-exam"]');
        if (deleteBtn) { deleteConfig(deleteBtn.dataset.exam); return; }

        const lbBtn = e.target.closest('[data-action="wu-view-leaderboard"]');
        if (lbBtn) { openLeaderboardModal(lbBtn.dataset.exam); return; }

        if (e.target.closest('#wuLbCloseBtn')) { toggleHidden($('#wuLeaderboardModalOverlay')); return; }

        if (e.target.closest('#ltAddCriteriaRowBtn')) { addCriteriaRow(); return; }

        const removeRowBtn = e.target.closest('[data-action="remove-criteria-row"]');
        if (removeRowBtn) { removeCriteriaRow(removeRowBtn.dataset.rowId); return; }

        const rowTagBtn = e.target.closest('[data-action="remove-row-tag"]');
        if (rowTagBtn) { removeRowTag(rowTagBtn.dataset.rowId, rowTagBtn.dataset.field, rowTagBtn.dataset.value); return; }

        if (e.target.closest('[data-action="lt-add-subject-question-count"]')) { addSubjectQuestionCount(); return; }

        const editQc = e.target.closest('[data-action="lt-edit-subject-question-count"]');
        if (editQc) { editSubjectQuestionCount(Number(editQc.dataset.index)); return; }

        const removeQc = e.target.closest('[data-action="lt-remove-subject-question-count"]');
        if (removeQc) { removeSubjectQuestionCount(Number(removeQc.dataset.index)); return; }

        if (e.target.closest('[data-action="lt-add-subject-time"]')) { addSubjectTime(); return; }

const editTime = e.target.closest('[data-action="lt-edit-subject-time"]');
if (editTime) { editSubjectTime(Number(editTime.dataset.index)); return; }

const removeTime = e.target.closest('[data-action="lt-remove-subject-time"]');
if (removeTime) { removeSubjectTime(Number(removeTime.dataset.index)); return; }
    });

    document.addEventListener('change', function (e) {
        if (e.target.id === 'wuModalCategorySelect') { onModalCategoryChange(); return; }
        if (e.target.id === 'wuModalExamSelect') { onModalExamChange(); return; }

        if (e.target.matches('[data-action="wu-source-checkbox"]')) {
            if (e.target.checked) selectedListingIds.add(e.target.value);
            else selectedListingIds.delete(e.target.value);
            updateUniqueCount();
            loadSubjectsForSelectedSources();
            updatePreview();
            return;
        }

        if (['wuDiffEasy', 'wuDiffMedium', 'wuDiffHard'].includes(e.target.id)) { updateDiffBar(); return; }
        if (e.target.id === 'ltStartTime' || e.target.id === 'ltDurationInput' || e.target.id === 'ltMaxRepeat' || e.target.name === 'wuLanguage') {
            updatePreview();
            updateStartTimeDisplay();
            return;
        }

        if (e.target.id === 'ltQuestionCountStrategy') { handleQuestionCountUI(); updatePreview(); return; }
        if (e.target.id === 'ltTotalQuestionCount') { updatePreview(); return; }

        if (e.target.id === 'ltTimeStrategy') { handleTimeStrategyUI(); return; }
if (e.target.id === 'ltTotalDuration') { updatePreview(); return; }

if (e.target.matches('[data-action="row-difficulty-checkbox"]')) {
    handleRowDifficultyChange(e.target.dataset.rowId, e.target.value, e.target.checked);
    return;
}


if (e.target.matches('[data-action="row-countmode-change"]')) {
    handleRowCountModeChange(e.target.dataset.rowId, e.target.value);
    return;
}


        if (e.target.matches('[data-action="lt-day-checkbox"]')) {
            if (e.target.checked) selectedDays.add(e.target.value);
            else selectedDays.delete(e.target.value);
            updatePreview();
            return;
        }

        if (e.target.id === 'ltDaySelectAll') {
            const allDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            if (e.target.checked) selectedDays = new Set(allDays);
            else selectedDays = new Set();
            renderScheduledDays();
            updatePreview();
            return;
        }

        const rowId = e.target.dataset.rowId;
        if (e.target.matches('[data-action="row-subject-change"]')) { handleRowSubjectChange(rowId); updatePreview(); return; }
        if (e.target.matches('[data-action="row-qsection-change"]')) { handleRowQsectionChange(rowId); return; }
        if (e.target.matches('[data-action="row-topic-change"]')) { handleRowTopicChange(rowId); return; }
        if (e.target.matches('[data-action="row-subtopic-change"]')) { handleRowSubTopicChange(rowId); return; }
    });

    document.addEventListener('DOMContentLoaded', function () {
        const link = document.querySelector('[data-target="livetest"]');
        if (link) {
            link.addEventListener('click', function () {
                loadDashboardStats();
            }, { once: true });
        }
    });
})();