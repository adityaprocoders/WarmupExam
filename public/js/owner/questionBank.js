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
    alert('Edit question form abhi pending hai — ID: ' + id);
  }
  document.getElementById('qbAddQuestionBtn').addEventListener('click', () => {
    alert('Add Question form abhi pending hai.');
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