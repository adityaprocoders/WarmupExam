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

    let selectedListingIds = new Set();
    let currentConfigExam = null;
    let currentConfigCategory = null;

    /* ================= LIST VIEW ================= */

    async function loadDashboardStats() {
        const tbody = $('#wuTableBody');
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-400 py-8">Loading...</td></tr>`;

        const { stats, rows } = await apiGet('/owner/daily-warmup/dashboard-stats');

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
            completed: '<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">COMPLETED</span>'
        };

        tbody.innerHTML = rows.map(r => `
            <tr class="border-b border-gray-50 hover:bg-gray-50">
                <td class="px-4 py-3 font-semibold text-gray-800">${r.exam}<br><span class="text-xs text-gray-400 font-normal">${r.category}</span></td>
                <td class="px-4 py-3">${statusBadge[r.status]}</td>
                <td class="px-4 py-3 text-gray-500">${r.startTime}</td>
                <td class="px-4 py-3 text-gray-600">${r.questionCount}</td>
                <td class="px-4 py-3 text-gray-600">${r.participants.toLocaleString('en-IN')}</td>
                <td class="px-4 py-3 text-gray-600">${r.avgScore}</td>
                <td class="px-4 py-3 text-gray-600">${r.topScore}</td>
                <td class="px-4 py-3 text-right">
                    <button data-action="wu-edit-exam" data-exam="${r.exam}" data-category-name="${r.category}" class="text-indigo-600 text-xs font-semibold hover:underline mr-3">Edit</button>
                    <button data-action="wu-delete-exam" data-exam="${r.exam}" class="text-red-500 text-xs font-semibold hover:underline">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    /* ================= ADD MODAL ================= */

    async function openAddModal() {
        toggleHidden($('#addWarmupModalOverlay'));
        const catSelect = $('#wuModalCategorySelect');
        catSelect.innerHTML = `<option value="">Select category...</option>`;

        const { categories } = await apiGet('/owner/daily-warmup/categories');
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

        const { exams } = await apiGet('/owner/daily-warmup/exams?category=' + categoryId);
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

    /* ================= CONFIG VIEW ================= */

    async function openConfigView(categoryId, examName) {
        toggleHidden($('#addWarmupModalOverlay'));
        $('#dailyWarmupListView').classList.add('hidden');
        $('#dailyWarmupConfigView').classList.remove('hidden');

        currentConfigExam = examName;
        currentConfigCategory = categoryId;
        selectedListingIds = new Set();

        $('#wuConfigExamLabel').textContent = examName;
        $('#wuSaveConfigBtn').dataset.exam = examName;
        $('#wuSaveConfigBtn').dataset.category = categoryId;

        // load sources + subjects
        const { sources, subjects } = await apiGet(`/owner/daily-warmup/sources?category=${categoryId}&exam=${encodeURIComponent(examName)}`);

        // load existing config (edit mode)
        const { config } = await apiGet(`/owner/daily-warmup/config/${encodeURIComponent(examName)}`);

        renderSources(sources, config);
        renderSubjects(subjects, config);

        if (config) {
    $('#wuQuestionCount').value = config.questionCount || 10;
    $('#wuDurationInput').value = config.duration || 10;
    $('#wuDiffEasy').value = config.difficultyDistribution.easy;
    $('#wuDiffMedium').value = config.difficultyDistribution.medium;
    $('#wuDiffHard').value = config.difficultyDistribution.hard;
    $('#wuStartTime').value = config.startTime || '06:00';
    const langVal = config.languageMode === 'both' ? 'both' : (config.languages[0] || 'English');
    const radio = $(`input[name="wuLanguage"][value="${langVal}"]`);
    if (radio) radio.checked = true;
} else {
    $('#wuQuestionCount').value = 10;
    $('#wuDurationInput').value = 10;
    $('#wuDiffEasy').value = 30;
    $('#wuDiffMedium').value = 50;
    $('#wuDiffHard').value = 20;
    $('#wuStartTime').value = '06:00';
    $(`input[name="wuLanguage"][value="English"]`).checked = true;
}

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

    function renderSubjects(subjects, config) {
        const container = $('#wuSubjectsList');
        const preSelected = new Set(config?.subjects || subjects); // default: sab selected agar naya

        container.innerHTML = subjects.map(s => `
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" data-action="wu-subject-checkbox" value="${s}" ${preSelected.has(s) ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600">
                ${s}
            </label>
        `).join('') || `<p class="text-xs text-gray-400">No subjects found.</p>`;
    }

    async function updateUniqueCount() {
        const ids = Array.from(selectedListingIds);
        if (ids.length === 0) { $('#wuTotalUniqueCount').textContent = '0'; return; }
        const { count } = await apiGet('/owner/daily-warmup/sources/unique-count?listingIds=' + ids.join(','));
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

    function updatePreview() {
    $('#wuPreviewExam').textContent = currentConfigExam || '—';
    $('#wuPreviewQuestions').textContent = $('#wuQuestionCount').value || '—';
    $('#wuPreviewSubjects').textContent = $all('input[data-action="wu-subject-checkbox"]:checked').length + ' Subjects';
    $('#wuPreviewSources').textContent = selectedListingIds.size + ' Series';
    const lang = $('input[name="wuLanguage"]:checked')?.value || 'English';
    $('#wuPreviewLanguage').textContent = lang === 'both' ? 'Both' : lang;
    $('#wuPreviewStartTime').textContent = $('#wuStartTime').value || '—';
    $('#wuPreviewDuration').textContent = $('#wuDurationInput').value ? $('#wuDurationInput').value + ' min' : '—';
}

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

        const subjects = $all('input[data-action="wu-subject-checkbox"]:checked').map(cb => cb.value);
        if (subjects.length === 0) {
            alert('Please select at least one subject.');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';

        const { ok, data } = await apiPost('/owner/daily-warmup/config', {
    category: btn.dataset.category,
    exam: btn.dataset.exam,
    includedListings: Array.from(selectedListingIds),
    languageMode: $('input[name="wuLanguage"]:checked').value,
    subjects,
    questionCount: parseInt($('#wuQuestionCount').value, 10),
    duration: parseInt($('#wuDurationInput').value, 10),
    difficultyDistribution: { easy, medium, hard },
    startTime: $('#wuStartTime').value
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
    if (!confirm(`Delete Daily Warmup config for "${examName}"? This will also remove today's active test if any.`)) return;

    const res = await fetch('/owner/daily-warmup/config/' + encodeURIComponent(examName), {
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

    function backToList() {
        $('#dailyWarmupConfigView').classList.add('hidden');
        $('#dailyWarmupListView').classList.remove('hidden');
    }

    function toggleHidden(el) { if (el) el.classList.toggle('hidden'); }

    /* ================= EVENTS ================= */

    document.addEventListener('click', function (e) {
        if (e.target.closest('#openAddWarmupModalBtn')) { openAddModal(); return; }
        if (e.target.closest('#closeAddWarmupModalBtn') || e.target.closest('#wuModalCancelBtn')) {
            toggleHidden($('#addWarmupModalOverlay')); return;
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
                const { categories } = await apiGet('/owner/daily-warmup/categories');
                const match = categories.find(c => c.name === editBtn.dataset.categoryName);
                if (match) openConfigView(match._id, editBtn.dataset.exam);
            })();
            return;
        }

        const deleteBtn = e.target.closest('[data-action="wu-delete-exam"]');
        if (deleteBtn) { deleteConfig(deleteBtn.dataset.exam); return; }
    });
         
 

    document.addEventListener('change', function (e) {
        if (e.target.id === 'wuModalCategorySelect') { onModalCategoryChange(); return; }
        if (e.target.id === 'wuModalExamSelect') { onModalExamChange(); return; }

        if (e.target.matches('[data-action="wu-source-checkbox"]')) {
            if (e.target.checked) selectedListingIds.add(e.target.value);
            else selectedListingIds.delete(e.target.value);
            updateUniqueCount();
            updatePreview();
            return;
        }
        if (e.target.matches('[data-action="wu-subject-checkbox"]')) { updatePreview(); return; }
        if (['wuDiffEasy', 'wuDiffMedium', 'wuDiffHard'].includes(e.target.id)) { updateDiffBar(); return; }
        if (e.target.id === 'wuQuestionCount' || e.target.id === 'wuStartTime' || e.target.name === 'wuLanguage') {
            updatePreview();
        }
    });

    // tab activate hote hi stats load (owner-dashboard.js ke side-link click se hi
    // section visible hota hai — hum sirf pehli baar visible hone par load karte hain)
    document.addEventListener('DOMContentLoaded', function () {
        const link = document.querySelector('[data-target="dailywarmup"]');
        if (link) {
            link.addEventListener('click', function () {
                loadDashboardStats();
            }, { once: true });
        }
    });
})();