const __weakAreaDataEl = document.getElementById('weakAreaData');
const __weakAreaData = __weakAreaDataEl ? JSON.parse(__weakAreaDataEl.textContent) : {};

const subjects = __weakAreaData.subjects || [];
const weakAreaData_focusSubject = __weakAreaData.focusSubject || '';
const weakAreaData_focusTopic = __weakAreaData.focusTopic || '';
const weakAreas = __weakAreaData.weakAreas || [];
const heatmapRows = __weakAreaData.heatmapRows || [];
const topicsBySubject = __weakAreaData.topicsBySubject || {};
const subtopicsByTopic = __weakAreaData.subtopicsByTopic || {};
const weakAreasAll = __weakAreaData.weakAreasAll || [];
let currentSubject = weakAreaData_focusSubject;
let currentTopic = weakAreaData_focusTopic;
let topics = (topicsBySubject[currentSubject] || []);


  // Dynamic & different color pool for subjects
  const dynamicColorPalette = [
    { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    { bg: 'bg-orange-100', text: 'text-orange-600' },
    { bg: 'bg-green-100', text: 'text-green-600' },
    { bg: 'bg-blue-100', text: 'text-blue-600' },
    { bg: 'bg-purple-100', text: 'text-purple-600' },
    { bg: 'bg-pink-100', text: 'text-pink-600' },
    { bg: 'bg-teal-100', text: 'text-teal-600' },
    { bg: 'bg-amber-100', text: 'text-amber-600' }
  ];

  const statusBadge = (status) => {
    const map = {
      'Weak': 'bg-red-50 text-red-500', 'Very Weak': 'bg-red-50 text-red-500',
      'Good': 'bg-green-50 text-green-600', 'Average': 'bg-amber-50 text-amber-600',
      'Excellent': 'bg-green-50 text-green-600', 'Critical': 'bg-red-50 text-red-500',
    };
    return map[status] || 'bg-slate-50 text-slate-500';
  };

  const barColor = (pct) => pct <= 40 ? 'bg-red-400' : pct <= 60 ? 'bg-orange-400' : pct <= 75 ? 'bg-yellow-400' : 'bg-green-500';
  const heatColor = (val) => val === null ? 'bg-slate-200 text-slate-400' : val <= 40 ? 'bg-red-400 text-white' : val <= 60 ? 'bg-orange-300 text-white' : val <= 75 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-300 text-green-900';

  function renderSubjects() {
    const subjectContainer = document.getElementById('subject-cards');
    if (!subjectContainer) return;
    subjectContainer.innerHTML = '';
    
    subjects.forEach((s, index) => {
      // Dynamic color assignment based on index
      const colorScheme = dynamicColorPalette[index % dynamicColorPalette.length];
      const firstLetter = s.name && s.name.length > 0 ? s.name.charAt(0).toUpperCase() : '';

      subjectContainer.innerHTML += `
        <div class="border border-slate-100 rounded-xl p-4 flex flex-col hover:shadow-md transition">
          <div class="flex items-center gap-2 mb-3">
            <div class="h-8 w-8 rounded-lg ${colorScheme.bg} ${colorScheme.text} flex items-center justify-center font-bold text-sm">
              ${firstLetter}
            </div>
            <span class="text-sm font-semibold text-slate-700">${s.name}</span>
          </div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl font-bold text-slate-900">${s.pct}%</span>
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(s.status)}">${s.status}</span>
          </div>
          <div class="h-1.5 w-full rounded-full progress-track mb-3">
            <div class="h-1.5 rounded-full ${barColor(s.pct)}" style="width:${s.pct}%"></div>
          </div>
          <p class="text-xs text-slate-400 mb-3">${s.correctPct}% Correct &nbsp;|&nbsp; ${s.wrongPct}% Wrong &nbsp;|&nbsp; ${s.skippedPct}% Skipped</p>
          <button data-action="open-topics-for-subject" data-subject="${s.name.replace(/"/g, '&quot;')}" class="mt-auto text-xs font-medium text-indigo-600 flex items-center gap-1 hover:gap-2 transition-all">View Topics <span>&rarr;</span></button>
        </div>`;
    });
    if (window.lucide) lucide.createIcons();
  }

  function renderTopics() {
    const topicBody = document.getElementById('topic-rows');
    if (!topicBody) return;
    topicBody.innerHTML = '';
    if (topics.length === 0) {
      topicBody.innerHTML = `<tr><td colspan="5" class="text-center text-xs text-slate-400 py-6">Is subject ke liye koi topic data nahi mila.</td></tr>`;
      return;
    }
    topics.forEach((t, i) => {
      const trendIcon = t.trend === 'up'
        ? '<i data-lucide="trending-up" class="w-4 h-4 text-green-500"></i>'
        : '<i data-lucide="trending-down" class="w-4 h-4 text-red-500"></i>';
      const isActive = t.name === currentTopic;
      topicBody.innerHTML += `
        <tr class="text-slate-700 cursor-pointer hover:bg-slate-50 transition ${isActive ? 'bg-indigo-50/60' : ''}" data-action="select-topic" data-topic="${t.name.replace(/"/g, '&quot;')}">
          <td class="py-2.5 px-1 whitespace-nowrap"><span class="text-slate-400 mr-1">${i+1}.</span>${t.name}</td>
          <td class="py-2.5 px-1">
            <div class="flex items-center gap-2 min-w-[90px]">
              <div class="h-1.5 w-16 rounded-full progress-track"><div class="h-1.5 rounded-full ${barColor(t.pct)}" style="width:${t.pct}%"></div></div>
              <span class="text-xs font-semibold">${t.pct}%</span>
            </div>
          </td>
          <td class="py-2.5 px-1"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadge(t.status)}">${t.status}</span></td>
          <td class="py-2.5 px-1">${trendIcon}</td>
          <td class="py-2.5 px-1 text-slate-300"><i data-lucide="chevron-down" class="w-4 h-4"></i></td>
        </tr>`;
    });
    if (window.lucide) lucide.createIcons();
  }

  function renderSubtopicsInline() {
    const subtopicBody = document.getElementById('subtopic-rows');
    if (!subtopicBody) return;
    subtopicBody.innerHTML = '';
    const key = `${currentSubject}|||${currentTopic}`;
    const rows = subtopicsByTopic[key] || [];
    const label = document.getElementById('subtopicSectionLabel');
    if (label) label.textContent = `(${currentTopic || 'No Data'})`;

    if (rows.length === 0) {
      subtopicBody.innerHTML = `<tr><td colspan="4" class="text-center text-xs text-slate-400 py-6">Is topic ke liye koi subtopic data nahi mila.</td></tr>`;
      return;
    }
    rows.forEach(s => {
      subtopicBody.innerHTML += `
        <tr class="text-slate-700">
          <td class="py-2.5 px-1 whitespace-nowrap">${s.name}</td>
          <td class="py-2.5 px-1">
            <div class="flex items-center gap-2 min-w-[90px]">
              <div class="h-1.5 w-16 rounded-full progress-track"><div class="h-1.5 rounded-full ${barColor(s.pct)}" style="width:${s.pct}%"></div></div>
              <span class="text-xs font-semibold">${s.pct}%</span>
            </div>
          </td>
          <td class="py-2.5 px-1">${s.wrongPct}%</td>
          <td class="py-2.5 px-1"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadge(s.status)}">${s.status}</span></td>
        </tr>`;
    });
  }

  function selectTopic(topicName) {
    currentTopic = topicName;
    renderTopics();
    renderSubtopicsInline();
  }

  function selectSubject(subjectName) {
    currentSubject = subjectName;
    topics = topicsBySubject[subjectName] || [];
    const sortVal = document.getElementById('topicSortSelect')?.value || 'weakest';
    topics = [...topics].sort((a, b) => sortVal === 'strongest' ? b.pct - a.pct : a.pct - b.pct);
    currentTopic = topics.length > 0 ? topics[0].name : null;
    renderTopics();
    renderSubtopicsInline();
  }

  function populateSubjectDropdown() {
    const sel = document.getElementById('subjectFilterSelect');
    if (!sel) return;
    sel.innerHTML = subjects.map(s =>
        `<option value="${s.name}" ${s.name === currentSubject ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    sel.addEventListener('change', (e) => selectSubject(e.target.value));
  }

  // ---- Modal core ----
  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('appModalTitle');
  const modalBody = document.getElementById('appModalBody');

  function openModal(title, bodyHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('appModalClose').addEventListener('click', closeModal);
  document.getElementById('appModalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function buildTopicTableHtml(rows, kind) {
    if (!rows || rows.length === 0) {
      return `<p class="text-center text-xs text-slate-400 py-8">Koi data nahi mila.</p>`;
    }
    const wrongCol = kind === 'subtopic' ? `<th class="font-medium pb-2 px-2">Wrong %</th>` : '';
    const rowsHtml = rows.map((t, i) => `
      <tr class="text-slate-700 border-b border-slate-50">
        <td class="py-2.5 px-2 whitespace-nowrap"><span class="text-slate-400 mr-1">${i+1}.</span>${t.name}</td>
        <td class="py-2.5 px-2">
          <div class="flex items-center gap-2 min-w-[100px]">
            <div class="h-1.5 w-16 rounded-full progress-track shrink-0"><div class="h-1.5 rounded-full ${barColor(t.pct)}" style="width:${t.pct}%"></div></div>
            <span class="text-xs font-semibold">${t.pct}%</span>
          </div>
        </td>
        ${kind === 'subtopic' ? `<td class="py-2.5 px-2">${t.wrongPct}%</td>` : ''}
        <td class="py-2.5 px-2"><span class="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadge(t.status)}">${t.status}</span></td>
      </tr>`).join('');
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[380px]">
          <thead>
            <tr class="text-left text-slate-400 text-xs border-b border-slate-100">
              <th class="font-medium pb-2 px-2">Name</th>
              <th class="font-medium pb-2 px-2">Accuracy</th>
              ${wrongCol}
              <th class="font-medium pb-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  function openTopicsModalForSubject(subjectName) {
    const rows = topicsBySubject[subjectName] || [];
    openModal(`Topics — ${subjectName}`, buildTopicTableHtml(rows, 'topic'));
  }

  function openAllTopicsModal() {
    openModal(`All Topics — ${currentSubject}`, buildTopicTableHtml(topics, 'topic'));
  }

  function openSubtopicsModalForTopic(subjectName, topicName) {
    const key = `${subjectName}|||${topicName}`;
    const rows = subtopicsByTopic[key] || [];
    openModal(`Subtopics — ${topicName}`, buildTopicTableHtml(rows, 'subtopic'));
  }

  function openAllSubtopicsModal() {
    const key = `${currentSubject}|||${currentTopic}`;
    const rows = subtopicsByTopic[key] || [];
    openModal(`All Subtopics — ${currentTopic}`, buildTopicTableHtml(rows, 'subtopic'));
  }

  function openAllWeakAreasModal() {
    if (!weakAreasAll || weakAreasAll.length === 0) {
      openModal('All Weak Areas', `<p class="text-center text-xs text-slate-400 py-8">Koi weak area detect nahi hui.</p>`);
      return;
    }
    const rowsHtml = weakAreasAll.map((w, i) => `
      <div class="flex items-center gap-3 py-2.5 border-b border-slate-50">
        <span class="text-xs text-slate-400 w-5 shrink-0">${i+1}.</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-700 truncate">${w.name}</p>
          <p class="text-[11px] text-slate-400">${w.subject || ''}</p>
        </div>
        <span class="text-sm font-bold text-red-500 shrink-0">${w.pct}%</span>
      </div>`).join('');
    openModal('All Weak Areas', `<div>${rowsHtml}</div>`);
  }

  const weakAreaList = document.getElementById('weak-area-list');
  if (weakAreaList) {
    weakAreas.forEach(w => {
      weakAreaList.innerHTML += `
        <div class="flex items-center gap-3">
          <div class="relative h-10 w-10 shrink-0">
            <svg class="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f2f6" stroke-width="3"></circle>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="${w.pct}, 100" stroke-linecap="round"></circle>
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">${w.pct}%</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-700 truncate">${w.name}</p>
            <p class="text-[11px] text-slate-400">${w.subject || ''}</p>
          </div>
          <button class="text-[11px] font-semibold text-indigo-600 border border-indigo-100 rounded-md px-2 py-1 hover:bg-indigo-50 transition shrink-0">${w.action}</button>
        </div>`;
    });
  }

  const heatmapBody = document.getElementById('heatmap-rows');
  if (heatmapBody) {
    heatmapRows.forEach(row => {
      let cells = row.vals.map(v => `<td class="text-center rounded-md py-2.5 px-2 font-semibold ${heatColor(v)}">${v === null ? '-' : v + '%'}</td>`).join('');
      heatmapBody.innerHTML += `<tr><td class="py-2 px-2 font-medium text-slate-600 whitespace-nowrap">${row.name}</td>${cells}</tr>`;
    });
  }

  const sortSelect = document.getElementById('topicSortSelect');
  if (sortBox = sortSelect) {
    sortSelect.addEventListener('change', () => {
      topics = [...topics].sort((a, b) => sortSelect.value === 'strongest' ? b.pct - a.pct : a.pct - b.pct);
      renderTopics();
    });
  } 
  
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
      case 'open-topics-for-subject':
        openTopicsModalForSubject(el.dataset.subject);
        break;
      case 'select-topic':
        selectTopic(el.dataset.topic);
        break;
      case 'open-all-topics':
        openAllTopicsModal();
        break;
      case 'open-all-subtopics':
        openAllSubtopicsModal();
        break;
      case 'open-all-weak-areas':
        openAllWeakAreasModal();
        break;
    }
  });

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', () => history.back());

  renderSubjects();
  populateSubjectDropdown();
  renderTopics();
  renderSubtopicsInline();

  if (window.lucide) lucide.createIcons();
 