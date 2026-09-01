(function () {
  let qbPage = 1;
  const qbLimit = 10;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + '…' : (str || ''); }

  window.loadQuestionBank = function () {
    loadQbStats();
    loadQbFilters();
    fetchQbQuestions();
  };

  async function loadQbStats() {
    try {
      const res = await fetch('/api/owner/question-bank/stats');
      const data = await res.json();
      if (data.success) {
        document.getElementById('qbStatTotal').textContent = data.stats.totalQuestions;
        document.getElementById('qbStatActive').textContent = data.stats.active;
        document.getElementById('qbStatReported').textContent = data.stats.reported;
      }
    } catch (err) { console.error(err); }
  }

  document.getElementById('qbStatReported').closest('.bg-white').style.cursor = 'pointer';
document.getElementById('qbStatReported').closest('.bg-white').addEventListener('click', () => {
    document.getElementById('qbFilterStatus').value = 'Reported';
    qbPage = 1;
    fetchQbQuestions();
});

document.getElementById('qbStatActive').closest('.bg-white').style.cursor = 'pointer';
document.getElementById('qbStatActive').closest('.bg-white').addEventListener('click', () => {
    document.getElementById('qbFilterStatus').value = 'Active';
    qbPage = 1;
    fetchQbQuestions();
});

document.getElementById('qbStatTotal').closest('.bg-white').style.cursor = 'pointer';
document.getElementById('qbStatTotal').closest('.bg-white').addEventListener('click', () => {
    document.getElementById('qbFilterStatus').value = 'all';
    qbPage = 1;
    fetchQbQuestions();
});


  async function loadQbFilters() {
    try {
      const res = await fetch('/api/owner/question-bank/filters');
      const data = await res.json();
      if (!data.success) return;

      const listingSel = document.getElementById('qbFilterListing');
      data.listings.forEach(l => listingSel.insertAdjacentHTML('beforeend', `<option value="${l._id}">${escapeHtml(l.title)}</option>`));

      const subjectSel = document.getElementById('qbFilterSubject');
      data.subjects.forEach(s => subjectSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));

      const topicSel = document.getElementById('qbFilterTopic');
      data.topics.forEach(t => topicSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`));
    } catch (err) { console.error(err); }
  }

  ['qbFilterListing', 'qbFilterSubject', 'qbFilterTopic', 'qbFilterDifficulty', 'qbFilterStatus'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { qbPage = 1; fetchQbQuestions(); });
  });

  let qbSearchTimeout = null;
  document.getElementById('qbSearchInput').addEventListener('input', function () {
    clearTimeout(qbSearchTimeout);
    qbSearchTimeout = setTimeout(() => { qbPage = 1; fetchQbQuestions(); }, 400);
  });

  const qbTableBody = document.getElementById('qbTableBody');
  const qbPageInfo = document.getElementById('qbPageInfo');

  async function fetchQbQuestions() {
    qbTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-gray-400 py-8">Loading...</td></tr>`;

    const params = new URLSearchParams({
      listing: document.getElementById('qbFilterListing').value,
      subject: document.getElementById('qbFilterSubject').value,
      topic: document.getElementById('qbFilterTopic').value,
      difficulty: document.getElementById('qbFilterDifficulty').value,
      status: document.getElementById('qbFilterStatus').value,
      search: document.getElementById('qbSearchInput').value.trim(),
      page: qbPage, limit: qbLimit
    });

    try {
      const res = await fetch(`/api/owner/question-bank/questions?${params}`);
      const data = await res.json();
      if (!data.success) { qbTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-8">Load error.</td></tr>`; return; }

      if (!data.questions.length) {
        qbTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-gray-400 py-8">Koi question nahi mila.</td></tr>`;
        qbPageInfo.textContent = '—';
        return;
      }

      qbTableBody.innerHTML = data.questions.map(qbRow).join('');
      attachRowEvents();

      const totalPages = Math.max(1, Math.ceil(data.total / qbLimit));
      qbPageInfo.textContent = `Page ${data.page} of ${totalPages} (${data.total} total)`;
      document.getElementById('qbPrevPageBtn').disabled = data.page <= 1;
      document.getElementById('qbNextPageBtn').disabled = data.page >= totalPages;
    } catch (err) {
      qbTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-red-500 py-8">Load karne mein error aayi.</td></tr>`;
    }
  }

  function difficultyBadge(d) {
    const map = { Easy: 'bg-green-50 text-green-600', Medium: 'bg-amber-50 text-amber-600', Hard: 'bg-red-50 text-red-600' };
    return `<span class="text-xs font-bold px-2 py-0.5 rounded-full ${map[d] || map.Medium}">${escapeHtml(d)}</span>`;
  }
  function statusBadge(s) {
    const map = { Active: 'bg-green-50 text-green-600', Reported: 'bg-red-50 text-red-600', Disabled: 'bg-gray-100 text-gray-500' };
    return `<span class="text-xs font-bold px-2 py-0.5 rounded-full ${map[s] || map.Active}">${escapeHtml(s)}</span>`;
  }

  function qbRow(q) {
    return `
      <tr class="border-t border-gray-50 hover:bg-gray-50/60 cursor-pointer qbRowClick" data-id="${q._id}">
        <td class="px-4 py-3 text-xs font-mono text-gray-500">${q._id.slice(-6).toUpperCase()}</td>
        <td class="px-4 py-3 text-gray-800 max-w-[240px]">${escapeHtml(truncate(q.question, 60))}</td>
        <td class="px-4 py-3 text-gray-600 text-xs">${escapeHtml(q.exam)}</td>
        <td class="px-4 py-3 text-gray-600 text-xs">${escapeHtml(q.topic)}</td>
        <td class="px-4 py-3">${difficultyBadge(q.difficulty)}</td>
        <td class="px-4 py-3 text-gray-600 text-xs">${escapeHtml(q.language)}</td>
        <td class="px-4 py-3">${statusBadge(q.status)}</td>
        <td class="px-4 py-3 text-gray-600 text-xs">${q.usedIn}</td>
        <td class="px-4 py-3 text-xs ${q.reportCount > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}">${q.reportCount}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap" onclick="event.stopPropagation()">
          <button data-id="${q._id}" class="qbEditBtn text-indigo-600 hover:text-indigo-800 mr-2"><i class="fa-solid fa-pen text-xs"></i></button>
          <button data-id="${q._id}" class="qbDuplicateBtn text-gray-500 hover:text-gray-700 mr-2"><i class="fa-regular fa-copy text-xs"></i></button>
          <button data-id="${q._id}" class="qbDeleteBtn text-red-500 hover:text-red-700"><i class="fa-solid fa-trash text-xs"></i></button>
        </td>
      </tr>`;
  }

  function attachRowEvents() {
    document.querySelectorAll('.qbRowClick').forEach(row => row.addEventListener('click', () => openQbDetail(row.dataset.id)));
    document.querySelectorAll('.qbEditBtn').forEach(btn => btn.addEventListener('click', () => openQbEdit(btn.dataset.id)));
    document.querySelectorAll('.qbDuplicateBtn').forEach(btn => btn.addEventListener('click', () => duplicateQbQuestion(btn.dataset.id)));
    document.querySelectorAll('.qbDeleteBtn').forEach(btn => btn.addEventListener('click', () => deleteQbQuestion(btn.dataset.id)));
  }

  document.getElementById('qbPrevPageBtn').addEventListener('click', () => { if (qbPage > 1) { qbPage--; fetchQbQuestions(); } });
  document.getElementById('qbNextPageBtn').addEventListener('click', () => { qbPage++; fetchQbQuestions(); });

  // ---------------- DETAIL PANEL ----------------
  const qbDetailOverlay = document.getElementById('qbDetailOverlay');
  const qbDetailBody = document.getElementById('qbDetailBody');
  const qbDetailActions = document.getElementById('qbDetailActions');

  async function openQbDetail(id) {
    qbDetailOverlay.classList.remove('hidden');
    document.getElementById('qbDetailId').textContent = 'Q' + id.slice(-6).toUpperCase();
    qbDetailBody.innerHTML = `<p class="text-center text-gray-400 py-8">Loading...</p>`;
    qbDetailActions.innerHTML = '';

    try {
      const res = await fetch(`/api/owner/question-bank/questions/${id}`);
      const data = await res.json();
      if (!data.success) { qbDetailBody.innerHTML = `<p class="text-center text-red-500 py-8">Load error.</p>`; return; }
      renderQbDetail(data.question);
    } catch (err) {
      qbDetailBody.innerHTML = `<p class="text-center text-red-500 py-8">Load karne mein error aayi.</p>`;
    }
  }

  function renderQbDetail(q) {
    const statusColors = { Active: 'text-green-600', Reported: 'text-red-600', Disabled: 'text-gray-500' };
    document.getElementById('qbDetailStatus').textContent = q.status;
    document.getElementById('qbDetailStatus').className = `text-xs font-semibold ${statusColors[q.status] || ''}`;

    const isMultiLang = q.languageMode === 'multiple';
    const source = isMultiLang ? (q.translations?.[0] || {}) : q;
    const optionsHtml = (source.options || []).map((opt, idx) => {
      const isCorrect = (q.correctAnswers || []).includes(idx);
      return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg border ${isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'}">
        ${isCorrect ? '<i class="fa-solid fa-circle-check text-green-500 text-xs"></i>' : '<span class="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block"></span>'}
        <span class="text-sm ${isCorrect ? 'text-green-700 font-medium' : 'text-gray-700'}">${escapeHtml(opt.text)}</span>
      </div>`;
    }).join('');

    let reportHtml = '';
    if (q.reportInfo) {
      reportHtml = `
        <div class="bg-red-50 border border-red-100 rounded-lg p-3">
          <p class="text-xs font-bold text-red-700 mb-1"><i class="fa-solid fa-flag mr-1"></i> Reported by ${escapeHtml(q.reportInfo.reporterName)}</p>
          <p class="text-xs text-red-600">Reason: ${escapeHtml(q.reportInfo.reason)}</p>
          ${q.reportInfo.description ? `<p class="text-xs text-red-600 mt-1">"${escapeHtml(q.reportInfo.description)}"</p>` : ''}
          ${q.reportInfo.totalReports > 1 ? `<p class="text-xs text-red-500 mt-1">+${q.reportInfo.totalReports - 1} other student(s) also reported this</p>` : ''}
        </div>`;
    }

    qbDetailBody.innerHTML = `
      ${reportHtml}
      <div>
        <p class="text-xs font-bold text-gray-400 uppercase mb-1.5">Question</p>
        <p class="text-gray-800">${escapeHtml(source.question)}</p>
        ${source.questionImage ? `<img src="${escapeHtml(source.questionImage)}" class="mt-2 rounded-lg border border-gray-100 max-h-48">` : ''}
      </div>
      <div>
        <p class="text-xs font-bold text-gray-400 uppercase mb-1.5">Options</p>
        <div class="space-y-1.5">${optionsHtml || '<p class="text-xs text-gray-400">No options (integer type)</p>'}</div>
      </div>
      ${source.solution?.text ? `<div><p class="text-xs font-bold text-gray-400 uppercase mb-1.5">Solution</p><p class="text-gray-700 text-sm whitespace-pre-line">${escapeHtml(source.solution.text)}</p></div>` : ''}
      <div>
        <p class="text-xs font-bold text-gray-400 uppercase mb-1.5">Meta</p>
        <p class="text-xs text-gray-500">Exam: ${escapeHtml(q.listing?.title || '-')} / ${escapeHtml(q.subject)} / ${escapeHtml(q.topic)}</p>
        <p class="text-xs text-gray-500">Used in: ${q.usedIn} test(s)</p>
        <p class="text-xs text-gray-500">Added on: ${new Date(q.createdAt).toLocaleString('en-IN')}</p>
      </div>
    `;

    let actionsHtml = `
      <button data-id="${q._id}" class="qbDetailEditBtn flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-lg">Edit Question</button>
      <button data-id="${q._id}" class="qbDetailDuplicateBtn flex-1 border-2 border-gray-200 text-gray-600 text-xs font-semibold py-2.5 rounded-lg hover:bg-gray-50">Duplicate</button>`;

    if (q.status === 'Reported') {
      actionsHtml += `<button data-id="${q._id}" class="qbDetailResolveBtn flex-1 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold py-2.5 rounded-lg">Resolve</button>`;
    }
    if (q.status !== 'Disabled') {
      actionsHtml += `<button data-id="${q._id}" class="qbDetailDisableBtn flex-1 bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-semibold py-2.5 rounded-lg">Disable</button>`;
    } else {
      actionsHtml += `<button data-id="${q._id}" class="qbDetailEnableBtn flex-1 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold py-2.5 rounded-lg">Enable</button>`;
    }

    qbDetailActions.innerHTML = actionsHtml;

    qbDetailActions.querySelector('.qbDetailEditBtn')?.addEventListener('click', () => openQbEdit(q._id));
    qbDetailActions.querySelector('.qbDetailDuplicateBtn')?.addEventListener('click', () => duplicateQbQuestion(q._id));
    qbDetailActions.querySelector('.qbDetailResolveBtn')?.addEventListener('click', () => resolveQbQuestion(q._id));
    qbDetailActions.querySelector('.qbDetailDisableBtn')?.addEventListener('click', () => disableQbQuestion(q._id));
    qbDetailActions.querySelector('.qbDetailEnableBtn')?.addEventListener('click', () => enableQbQuestion(q._id));
  }

  document.getElementById('qbDetailCloseBtn').addEventListener('click', () => qbDetailOverlay.classList.add('hidden'));

 function openQbEdit(id) {
    openQbQuestionModal('edit', id);
}
document.getElementById('qbAddQuestionBtn').addEventListener('click', () => {
    openQbQuestionModal('add', null);
});

  async function resolveQbQuestion(id) {
    if (!confirm('Is question ko resolve karna hai? Report clear ho jaayegi.')) return;
    try {
      const res = await fetch(`/api/owner/question-bank/questions/${id}/resolve`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) { qbDetailOverlay.classList.add('hidden'); fetchQbQuestions(); loadQbStats(); }
      else alert(data.message);
    } catch (err) { alert('Something went wrong'); }
  }

  async function disableQbQuestion(id) {
    if (!confirm('Is question ko disable karna hai?')) return;
    try {
      const res = await fetch(`/api/owner/question-bank/questions/${id}/disable`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) { qbDetailOverlay.classList.add('hidden'); fetchQbQuestions(); loadQbStats(); }
      else alert(data.message);
    } catch (err) { alert('Something went wrong'); }
  }

  async function enableQbQuestion(id) {
    try {
      const res = await fetch(`/api/owner/question-bank/questions/${id}/enable`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) { qbDetailOverlay.classList.add('hidden'); fetchQbQuestions(); loadQbStats(); }
      else alert(data.message);
    } catch (err) { alert('Something went wrong'); }
  }

  async function duplicateQbQuestion(id) {
    try {
      const res = await fetch(`/api/owner/question-bank/questions/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) { fetchQbQuestions(); loadQbStats(); } else alert(data.message);
    } catch (err) { alert('Something went wrong'); }
  }

  async function deleteQbQuestion(id) {
    if (!confirm('Is question ko delete karna hai?')) return;
    try {
      let res = await fetch(`/api/owner/question-bank/questions/${id}`, { method: 'DELETE' });
      let data = await res.json();
      if (!data.success && data.requiresForce) {
        if (!confirm(`${data.message}\n\nPhir bhi permanently delete karna hai?`)) return;
        res = await fetch(`/api/owner/question-bank/questions/${id}?force=true`, { method: 'DELETE' });
        data = await res.json();
      }
      if (data.success) { qbDetailOverlay.classList.add('hidden'); fetchQbQuestions(); loadQbStats(); }
      else alert(data.message);
    } catch (err) { alert('Something went wrong'); }
  }
})();





// ---------------- ADD/EDIT QUESTION MODAL ----------------
let qbFormMode = 'add';
let qbFormEditId = null;
let qbFormLanguages = [];
let qbFormActiveLang = null;
let qbFormLangData = {};
let optionIdCounter = 0;

const qbFormModalOverlay = document.getElementById('qbFormModalOverlay');

document.querySelectorAll('.qbFormTabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.qbFormTabBtn').forEach(b => b.className = 'qbFormTabBtn pb-3 pt-3 font-bold text-sm text-gray-400 border-b-2 border-transparent');
        btn.className = 'qbFormTabBtn pb-3 pt-3 font-bold text-sm text-indigo-600 border-b-2 border-indigo-600';
        const tab = btn.dataset.qbtab;
        document.getElementById('qbTabManual').classList.toggle('hidden', tab !== 'manual');
        document.getElementById('qbTabJson').classList.toggle('hidden', tab !== 'json');
        if (tab === 'json') syncManualToJson();
        else syncJsonToManual();
    });
});

document.getElementById('qbFormLangMode').addEventListener('change', function () {
    const isMulti = this.value === 'multiple';
    document.getElementById('qbSingleContentBlock').classList.toggle('hidden', isMulti);
    document.getElementById('qbMultiContentBlock').classList.toggle('hidden', !isMulti);
});

document.getElementById('qbFormType').addEventListener('change', function () {
    const isInteger = this.value === 'integer';
    document.getElementById('qbOptionsBlock').classList.toggle('hidden', isInteger);
    document.getElementById('qbIntegerBlock').classList.toggle('hidden', !isInteger);
});

async function loadQbFormListings() {
    const sel = document.getElementById('qbFormListing');
    sel.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch('/api/owner/question-bank/filters');
        const data = await res.json();
        if (data.success) {
            sel.innerHTML = data.listings.map(l => `<option value="${l._id}">${l.title}</option>`).join('');
        }
    } catch (err) { sel.innerHTML = '<option value="">Load error</option>'; }
}

function addOptionRow(text = '', image = '', isCorrect = false, type = 'mcq') {
    const id = 'opt_' + (optionIdCounter++);
    const inputType = type === 'multiple' ? 'checkbox' : 'radio';
    const list = document.getElementById('qbOptionsList');
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 qbOptionRow';
    row.dataset.optId = id;
    row.innerHTML = `
        <input type="${inputType}" name="qbCorrectOpt" ${isCorrect ? 'checked' : ''} class="qbOptCorrect w-4 h-4">
        <input type="text" placeholder="Option text" value="${text.replace(/"/g, '&quot;')}" class="qbOptText flex-1 border rounded-lg px-3 py-2 text-sm">
        <button type="button" class="qbRemoveOptBtn text-red-400 hover:text-red-600"><i class="fa-solid fa-xmark"></i></button>
    `;
    row.querySelector('.qbRemoveOptBtn').addEventListener('click', () => row.remove());
    list.appendChild(row);
}

document.getElementById('qbAddOptionBtn').addEventListener('click', () => {
    addOptionRow('', '', false, document.getElementById('qbFormType').value);
});

function resetQbForm() {
    document.getElementById('qbFormListing').value = '';
    document.getElementById('qbFormType').value = 'mcq';
    document.getElementById('qbFormSubject').value = '';
    document.getElementById('qbFormTopic').value = '';
    document.getElementById('qbFormSubTopic').value = '';
    document.getElementById('qbFormDifficulty').value = 'Medium';
    document.getElementById('qbFormLangMode').value = 'single';
    document.getElementById('qbFormQuestion').value = '';
    document.getElementById('qbFormQuestionImage').value = '';
    document.getElementById('qbFormNumericAnswer').value = '';
    document.getElementById('qbFormSolutionText').value = '';
    document.getElementById('qbFormSolutionImage').value = '';
    document.getElementById('qbOptionsList').innerHTML = '';
    document.getElementById('qbSingleContentBlock').classList.remove('hidden');
    document.getElementById('qbMultiContentBlock').classList.add('hidden');
    document.getElementById('qbOptionsBlock').classList.remove('hidden');
    document.getElementById('qbIntegerBlock').classList.add('hidden');
    document.getElementById('qbJsonError').classList.add('hidden');
    qbFormLanguages = [];
    qbFormLangData = {};
    document.getElementById('qbLangTabs').innerHTML = '';
    document.getElementById('qbLangContentArea').innerHTML = '';
    addOptionRow(); addOptionRow();
}

async function openQbQuestionModal(mode, id) {
    qbFormMode = mode;
    qbFormEditId = id;
    resetQbForm();
    await loadQbFormListings();

    document.getElementById('qbFormTitle').textContent = mode === 'edit' ? 'Edit Question' : 'Add New Question';
    document.querySelector('.qbFormTabBtn[data-qbtab="manual"]').click();
    qbFormModalOverlay.classList.remove('hidden');

    if (mode === 'edit') {
        try {
            const res = await fetch(`/api/owner/question-bank/questions/${id}`);
            const data = await res.json();
            if (data.success) populateQbForm(data.question);
        } catch (err) { console.error(err); }
    }
}

function populateQbForm(q) {
    document.getElementById('qbFormListing').value = q.listing?._id || q.listing || '';
    document.getElementById('qbFormType').value = q.type || 'mcq';
    document.getElementById('qbFormSubject').value = q.subject || '';
    document.getElementById('qbFormTopic').value = q.topic || '';
    document.getElementById('qbFormSubTopic').value = q.subTopic || '';
    document.getElementById('qbFormDifficulty').value = q.difficulty || 'Medium';
    document.getElementById('qbFormLangMode').value = q.languageMode || 'single';
    document.getElementById('qbFormLangMode').dispatchEvent(new Event('change'));
    document.getElementById('qbFormType').dispatchEvent(new Event('change'));

    if (q.languageMode === 'multiple') {
        (q.translations || []).forEach(t => {
            qbFormLanguages.push(t.lang);
            qbFormLangData[t.lang] = {
                question: t.question || '', questionImage: t.questionImage || '',
                options: (t.options || []).map(o => o.text || ''),
                solutionText: t.solution?.text || '', solutionImage: t.solution?.image || ''
            };
        });
        renderLangTabs();
        if (qbFormLanguages.length) switchLangTab(qbFormLanguages[0]);
    } else {
        document.getElementById('qbFormQuestion').value = q.question || '';
        document.getElementById('qbFormQuestionImage').value = q.questionImage || '';
        document.getElementById('qbFormSolutionText').value = q.solution?.text || '';
        document.getElementById('qbFormSolutionImage').value = q.solution?.image || '';
        document.getElementById('qbOptionsList').innerHTML = '';
        (q.options || []).forEach((opt, idx) => {
            addOptionRow(opt.text || '', opt.image || '', (q.correctAnswers || []).includes(idx), q.type);
        });
        document.getElementById('qbFormNumericAnswer').value = q.numericAnswer ?? '';
    }
}

// ---- Multi-language tabs ----
document.getElementById('qbAddLangBtn').addEventListener('click', () => {
    const val = document.getElementById('qbNewLangInput').value.trim();
    if (!val || qbFormLanguages.includes(val)) return;
    qbFormLanguages.push(val);
    qbFormLangData[val] = { question: '', questionImage: '', options: ['', ''], solutionText: '', solutionImage: '' };
    document.getElementById('qbNewLangInput').value = '';
    renderLangTabs();
    switchLangTab(val);
});

function renderLangTabs() {
    const wrap = document.getElementById('qbLangTabs');
    wrap.innerHTML = qbFormLanguages.map(l =>
        `<button type="button" data-lang="${l}" class="qbLangTabBtn text-xs font-semibold px-3 py-1.5 rounded-full border ${l === qbFormActiveLang ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}">${l}</button>`
    ).join('');
    wrap.querySelectorAll('.qbLangTabBtn').forEach(btn => {
        btn.addEventListener('click', () => switchLangTab(btn.dataset.lang));
    });
}

function switchLangTab(lang) {
    saveActiveLangFields();
    qbFormActiveLang = lang;
    renderLangTabs();
    const d = qbFormLangData[lang];
    const area = document.getElementById('qbLangContentArea');
    area.innerHTML = `
        <div class="space-y-3">
            <textarea id="qbLangQuestion" rows="3" placeholder="Question text (${lang})" class="w-full border rounded-xl px-3 py-2.5 text-sm">${d.question}</textarea>
            <input type="text" id="qbLangQuestionImage" placeholder="Question image URL" value="${d.questionImage}" class="w-full border rounded-xl px-3 py-2.5 text-sm">
            <div id="qbLangOptionsList" class="space-y-2"></div>
            <button type="button" id="qbLangAddOptBtn" class="text-xs font-semibold text-indigo-600">+ Add Option</button>
            <textarea id="qbLangSolutionText" rows="2" placeholder="Solution (${lang})" class="w-full border rounded-xl px-3 py-2.5 text-sm">${d.solutionText}</textarea>
        </div>
    `;
    const optList = document.getElementById('qbLangOptionsList');
    d.options.forEach(optText => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 qbLangOptRow';
        row.innerHTML = `<input type="text" value="${optText.replace(/"/g, '&quot;')}" class="qbLangOptText flex-1 border rounded-lg px-3 py-2 text-sm"><button type="button" class="text-red-400 qbLangRemoveOpt"><i class="fa-solid fa-xmark"></i></button>`;
        row.querySelector('.qbLangRemoveOpt').addEventListener('click', () => row.remove());
        optList.appendChild(row);
    });
    document.getElementById('qbLangAddOptBtn').addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 qbLangOptRow';
        row.innerHTML = `<input type="text" class="qbLangOptText flex-1 border rounded-lg px-3 py-2 text-sm"><button type="button" class="text-red-400 qbLangRemoveOpt"><i class="fa-solid fa-xmark"></i></button>`;
        row.querySelector('.qbLangRemoveOpt').addEventListener('click', () => row.remove());
        optList.appendChild(row);
    });
}

function saveActiveLangFields() {
    if (!qbFormActiveLang) return;
    const qEl = document.getElementById('qbLangQuestion');
    if (!qEl) return;
    qbFormLangData[qbFormActiveLang] = {
        question: qEl.value,
        questionImage: document.getElementById('qbLangQuestionImage').value,
        options: Array.from(document.querySelectorAll('.qbLangOptText')).map(i => i.value),
        solutionText: document.getElementById('qbLangSolutionText').value,
        solutionImage: ''
    };
}

// ---- Build payload matching Question schema ----
function buildQbPayload() {
    saveActiveLangFields();
    const type = document.getElementById('qbFormType').value;
    const langMode = document.getElementById('qbFormLangMode').value;

    const payload = {
        listing: document.getElementById('qbFormListing').value,
        subject: document.getElementById('qbFormSubject').value.trim(),
        topic: document.getElementById('qbFormTopic').value.trim(),
        subTopic: document.getElementById('qbFormSubTopic').value.trim(),
        type,
        difficulty: document.getElementById('qbFormDifficulty').value,
        languageMode: langMode,
        correctAnswers: [],
        numericAnswer: null
    };

    if (langMode === 'multiple') {
        payload.translations = qbFormLanguages.map(lang => {
            const d = qbFormLangData[lang];
            return {
                lang,
                question: d.question,
                questionImage: d.questionImage || null,
                options: d.options.filter(t => t.trim()).map(t => ({ text: t, image: null })),
                solution: { text: d.solutionText, image: d.solutionImage || null }
            };
        });
        payload.question = '';
        payload.questionImage = null;
        payload.options = [];
        payload.solution = { text: '', image: null };
    } else {
        payload.question = document.getElementById('qbFormQuestion').value;
        payload.questionImage = document.getElementById('qbFormQuestionImage').value || null;
        payload.solution = {
            text: document.getElementById('qbFormSolutionText').value,
            image: document.getElementById('qbFormSolutionImage').value || null
        };
        payload.translations = [];

        if (type === 'integer') {
            payload.options = [];
            payload.numericAnswer = Number(document.getElementById('qbFormNumericAnswer').value);
        } else {
            const rows = Array.from(document.querySelectorAll('.qbOptionRow'));
            payload.options = rows.map(r => ({ text: r.querySelector('.qbOptText').value, image: null }));
            payload.correctAnswers = rows
                .map((r, idx) => r.querySelector('.qbOptCorrect').checked ? idx : null)
                .filter(idx => idx !== null);
        }
    }

    return payload;
}

function syncManualToJson() {
    const payload = buildQbPayload();
    document.getElementById('qbJsonTextarea').value = JSON.stringify(payload, null, 2);
}

function syncJsonToManual() {
    try {
        const payload = JSON.parse(document.getElementById('qbJsonTextarea').value);
        populateQbForm(payload);
        document.getElementById('qbJsonError').classList.add('hidden');
    } catch (err) {
        document.getElementById('qbJsonError').textContent = 'Invalid JSON: ' + err.message;
        document.getElementById('qbJsonError').classList.remove('hidden');
    }
}

document.getElementById('qbFormCloseBtn').addEventListener('click', () => qbFormModalOverlay.classList.add('hidden'));
document.getElementById('qbFormCancelBtn').addEventListener('click', () => qbFormModalOverlay.classList.add('hidden'));

document.getElementById('qbFormSaveBtn').addEventListener('click', async () => {
    let payload;
    const isJsonTab = !document.getElementById('qbTabJson').classList.contains('hidden');

    if (isJsonTab) {
        try {
            payload = JSON.parse(document.getElementById('qbJsonTextarea').value);
        } catch (err) {
            document.getElementById('qbJsonError').textContent = 'Invalid JSON: ' + err.message;
            document.getElementById('qbJsonError').classList.remove('hidden');
            return;
        }
    } else {
        payload = buildQbPayload();
    }

    if (!payload.listing) return alert('Listing choose karna zaroori hai');
    if (!payload.subject || !payload.topic) return alert('Subject aur Topic zaroori hain');

    const url = qbFormMode === 'edit'
        ? `/api/owner/question-bank/questions/${qbFormEditId}`
        : `/api/owner/question-bank/questions`;
    const method = qbFormMode === 'edit' ? 'PATCH' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            qbFormModalOverlay.classList.add('hidden');
            fetchQbQuestions();
            loadQbStats();
        } else {
            alert(data.message || 'Save nahi ho paya');
        }
    } catch (err) {
        alert('Something went wrong');
    }
});