const urlParams = new URLSearchParams(window.location.search);
const contextData = {
    listingId: urlParams.get('listingId') || '',
    sectionId: urlParams.get('sectionId') || '',
    parentType: urlParams.get('parentType') || 'section',
    parentId: urlParams.get('parentId') || '',
    returnUrl: urlParams.get('returnUrl') || '/'
};

let subjectsList = [];
let availableLanguagesList = [];
let criteriaRowCount = 0;
let subjectTimeList = [];
let selectedSubjects = new Set();
let editingSubjectTimeIndex = null;
let testDurationState = 0;
let testShowLanguage = 'all';

let criteriaRowState = {};

let globalSectionsList = [];
let selectedGlobalSections = new Set();

let questionCountStrategy = 'all';
let totalQuestionCountState = 0;
let subjectQuestionCountList = [];
let editingSubjectQuestionIndex = null;

async function loadSubjects() {
    try {
        const res = await fetch(`/api/listing/${contextData.listingId}/subjects`);
        if (!res.ok) throw new Error(`Subjects request failed: ${res.status}`);
        const result = await res.json();
        subjectsList = result.success ? result.data : [];
    } catch (err) {
        console.error("Subjects fetch error:", err);
        subjectsList = [];
    }
}

async function loadLanguages() {
    try {
        const res = await fetch(`/api/listing/${contextData.listingId}/languages`);
        if (!res.ok) throw new Error(`Languages request failed: ${res.status}`);
        const result = await res.json();
        availableLanguagesList = result.success ? result.data : [];
    } catch (err) {
        console.error("Languages fetch error:", err);
        availableLanguagesList = [];
    }
}

async function loadGlobalSections() {
    try {
        const res = await fetch(`/api/listing/${contextData.listingId}/sections`);
        const result = await res.json();
        globalSectionsList = result.success ? result.data : [];
        renderGlobalSectionDropdown();
    } catch (err) {
        console.error("Sections fetch error:", err);
        globalSectionsList = [];
        renderGlobalSectionDropdown();
    }
}

function renderGlobalSectionDropdown() {
    const dropdown = document.getElementById('globalSectionDropdown');
    if (!dropdown) return;
    const remaining = globalSectionsList.filter(s => !selectedGlobalSections.has(s.sectionId));
    if (remaining.length === 0) {
        dropdown.innerHTML = `<option value="" disabled selected>${globalSectionsList.length === 0 ? 'No section found' : 'Sab section select ho gaye'}</option>`;
        return;
    }
    dropdown.innerHTML = `<option value="" disabled selected>Choose section</option>` +
        remaining.map(s => `<option value="${s.sectionId}">${s.section} (${s.count} Q)</option>`).join('');
}

function addGlobalSectionTag() {
    const dropdown = document.getElementById('globalSectionDropdown');
    const val = dropdown.value;
    if (val && !selectedGlobalSections.has(val)) {
        selectedGlobalSections.add(val);
        renderGlobalSectionTags();
        renderGlobalSectionDropdown();
    }
    dropdown.value = "";
}

function renderGlobalSectionTags() {
    const container = document.getElementById('globalSectionTags');
    if (!container) return;
    container.innerHTML = Array.from(selectedGlobalSections).map(sid => {
        const sec = globalSectionsList.find(s => s.sectionId === sid);
        const label = sec ? sec.section : sid;
        return `
        <span class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
            ${label}
            <button type="button" data-action="remove-global-section-tag" data-value="${sid}" class="hover:text-red-200 font-bold">✕</button>
        </span>`;
    }).join('');
}

function removeGlobalSectionTag(val) {
    selectedGlobalSections.delete(val);
    renderGlobalSectionTags();
    renderGlobalSectionDropdown();
}


function getSubjectOptionsHtml(selectedValue) {
    const placeholder = `<option value="" disabled ${!selectedValue ? "selected" : ""}>Choose subject</option>`;
    if (subjectsList.length === 0) return placeholder + `<option value="">No subjects found</option>`;
    return placeholder + subjectsList.map(s => {
        const isSelected = (s.subject === selectedValue) ? "selected" : "";
        return `<option value="${s.subject}" ${isSelected}>${s.subject}</option>`;
    }).join('');
}

function handleTimeUI() {
  const container = document.getElementById('timeDynamicContainer');
  if (!container) return;

  const strategy = document.getElementById('timeStrategy').value;

  if (strategy === 'total') {
    container.innerHTML = `<div id="totalTimeField"><label class="block text-sm font-bold mb-2">Total Time (in minutes)</label><input type="number" id="totalTimeInput" placeholder="e.g. 120" class="w-full p-3 border border-gray-200 rounded-lg text-sm" value="${testDurationState || ''}"></div>`;
    selectedSubjects.clear();
  } else {
    editingSubjectTimeIndex = null;
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-bold mb-2">Subject</label>
          <div id="tagContainer" class="min-h-[50px] p-2 border border-gray-200 bg-white rounded-xl flex flex-wrap gap-2 mb-2"></div>
          <select id="subjectDropdown" data-action="subject-dropdown-change" class="w-full p-3 border border-gray-200 rounded-xl text-sm">
            <option value="" disabled selected>Choose a subject</option>
            ${getSubjectOptionsHtml(null).replace('<option value="" disabled selected>Choose subject</option>', '')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold mb-2">Time (in minutes)</label>
          <input type="number" id="subTime" class="w-full p-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter minutes">
          <button type="button" id="addSubjectTimeBtn" data-action="add-subject-time" class="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 text-sm">Add Subject Time</button>
        </div>
      </div>
      <div id="addedList" class="mt-6 pt-4 border-t border-gray-200"><h3 class="text-sm font-bold mb-2">Allocated Times:</h3></div>`;

    renderSubjectTimeList();
  }
}

function renderShowLanguageUI() {
  const container = document.getElementById('showLanguageFieldContainer');
  if (!container) return;

  const optionsHtml = [
    `<option value="all" ${testShowLanguage === 'all' ? 'selected' : ''}>All</option>`,
    ...availableLanguagesList.map(lang =>
      `<option value="${lang}" ${testShowLanguage === lang ? 'selected' : ''}>${lang}</option>`
    )
  ].join('');

  container.innerHTML = `
    <select id="showLanguageSelect" data-action="show-language-change"
      class="w-full p-3 border border-gray-200 rounded-xl bg-white font-bold text-sm">
      ${optionsHtml}
    </select>`;
}

function handleQuestionCountUI() {
    const container = document.getElementById('questionCountDynamicContainer');
    if (!container) return;

    const strategy = document.getElementById('questionCountStrategy').value;
    questionCountStrategy = strategy;

    if (strategy === 'all') {
        container.innerHTML = `<input type="number" id="totalQuestionCountInput" min="1" placeholder="e.g. 100" class="w-full p-2 rounded-lg text-gray-800 font-bold outline-none bg-white text-sm" value="${totalQuestionCountState || ''}">`;
    } else {
        editingSubjectQuestionIndex = null;
        container.innerHTML = `
            <select id="qcSubjectDropdown" class="w-full p-2 rounded-lg text-gray-800 font-bold outline-none bg-white text-sm mb-2">
                <option value="" disabled selected>Choose subject</option>
                ${getSubjectOptionsHtml(null).replace('<option value="" disabled selected>Choose subject</option>', '')}
            </select>
            <input type="number" id="qcCountInput" min="1" placeholder="No of questions" class="w-full p-2 rounded-lg text-gray-800 font-bold outline-none bg-white text-sm mb-2">
            <button type="button" id="addQcBtn" data-action="add-subject-question-count" class="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-lg text-sm mb-3">Add</button>
            <div id="qcList"></div>
        `;
        renderSubjectQuestionList();
    }
}

function renderSubjectQuestionList() {
    const list = document.getElementById('qcList');
    if (!list) return;
    list.innerHTML = '';
    subjectQuestionCountList.forEach((sq, index) => {
        list.innerHTML += `
            <div class="flex justify-between items-center gap-2 p-2 mb-2 bg-white/10 rounded-lg">
                <span class="text-sm font-medium">${sq.subject}</span>
                <div class="flex items-center gap-2">
                    <span class="font-bold">${sq.count} Q</span>
                    <button type="button" data-action="edit-subject-question-count" data-index="${index}" class="text-white/70 hover:text-white">
                        <i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                    <button type="button" data-action="remove-subject-question-count" data-index="${index}" class="text-white/70 hover:text-red-200">
                        <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                    </button>
                </div>
            </div>`;
    });
    if (window.lucide) lucide.createIcons();
}

function addSubjectQuestionCount() {
    const subjectSel = document.getElementById('qcSubjectDropdown');
    const countInput = document.getElementById('qcCountInput');
    const subject = subjectSel.value;
    const count = Number(countInput.value);
    if (!subject || !count) return;

    const newEntry = { subject, count };
    if (editingSubjectQuestionIndex !== null) {
        subjectQuestionCountList[editingSubjectQuestionIndex] = newEntry;
        editingSubjectQuestionIndex = null;
        document.getElementById('addQcBtn').innerText = "Add";
    } else {
        subjectQuestionCountList.push(newEntry);
    }
    renderSubjectQuestionList();
    subjectSel.value = "";
    countInput.value = "";
}

function editSubjectQuestionCount(index) {
    const entry = subjectQuestionCountList[index];
    if (!entry) return;
    editingSubjectQuestionIndex = index;
    document.getElementById('qcSubjectDropdown').value = entry.subject;
    document.getElementById('qcCountInput').value = entry.count;
    const btn = document.getElementById('addQcBtn');
    if (btn) btn.innerText = "Update";
}

function removeSubjectQuestionCount(index) {
    subjectQuestionCountList.splice(index, 1);
    if (editingSubjectQuestionIndex === index) {
        editingSubjectQuestionIndex = null;
        document.getElementById('qcSubjectDropdown').value = "";
        document.getElementById('qcCountInput').value = "";
        const btn = document.getElementById('addQcBtn');
        if (btn) btn.innerText = "Add";
    } else if (editingSubjectQuestionIndex !== null && index < editingSubjectQuestionIndex) {
        editingSubjectQuestionIndex--;
    }
    renderSubjectQuestionList();
}

function renderSubjectTimeList() {
  const addedList = document.getElementById('addedList');
  if (!addedList) return;
  addedList.innerHTML = '<h3 class="text-sm font-bold mb-2">Allocated Times:</h3>';
  subjectTimeList.forEach((st, index) => {
    addedList.innerHTML += `
      <div class="flex flex-wrap justify-between items-center gap-2 p-3 mb-2 bg-white border border-indigo-100 rounded-lg">
        <span class="text-sm font-medium">${st.subject}</span>
        <div class="flex items-center gap-3">
          <span class="font-bold text-indigo-600">${st.duration} mins</span>
          <button type="button" data-action="edit-subject-time" data-index="${index}" class="text-gray-400 hover:text-indigo-600">
            <i data-lucide="pencil" class="w-4 h-4 pointer-events-none"></i>
          </button>
          <button type="button" data-action="remove-subject-time" data-index="${index}" class="text-gray-400 hover:text-red-500">
            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
          </button>
        </div>
      </div>`;
  });
  if (window.lucide) lucide.createIcons();
}

function removeSubjectTime(index) {
  subjectTimeList.splice(index, 1);
  if (editingSubjectTimeIndex === index) {
    editingSubjectTimeIndex = null;
    resetAddSubjectTimeButton();
    selectedSubjects.clear();
    renderTags();
    document.getElementById('subTime').value = "";
  } else if (editingSubjectTimeIndex !== null && index < editingSubjectTimeIndex) {
    editingSubjectTimeIndex--;
  }
  renderSubjectTimeList();
}

function editSubjectTime(index) {
  const entry = subjectTimeList[index];
  if (!entry) return;
  editingSubjectTimeIndex = index;
  selectedSubjects.clear();
  entry.subject.split(' + ').forEach(s => selectedSubjects.add(s.trim()));
  renderTags();
  document.getElementById('subTime').value = entry.duration;
  const btn = document.getElementById('addSubjectTimeBtn');
  if (btn) btn.innerText = "Update Subject Time";
}

function resetAddSubjectTimeButton() {
  const btn = document.getElementById('addSubjectTimeBtn');
  if (btn) btn.innerText = "Add Subject Time";
}

function addTag() {
    const d = document.getElementById('subjectDropdown');
    if (d.value && !selectedSubjects.has(d.value)) { selectedSubjects.add(d.value); renderTags(); }
    d.value = "";
}
function renderTags() {
    const c = document.getElementById('tagContainer');
    c.innerHTML = '';
    selectedSubjects.forEach(s => {
        c.innerHTML += `<span class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">${s} <button type="button" data-action="remove-tag" data-subject="${s}" class="hover:text-red-200 font-bold">✕</button></span>`;
    });
}
function removeTag(s) { selectedSubjects.delete(s); renderTags(); }

function addSubjectTime() {
  const t = document.getElementById('subTime').value;
  if (selectedSubjects.size > 0 && t) {
    const subjectLabel = Array.from(selectedSubjects).join(' + ');
    const newEntry = { subject: subjectLabel, duration: Number(t) };
    if (editingSubjectTimeIndex !== null) {
      subjectTimeList[editingSubjectTimeIndex] = newEntry;
      editingSubjectTimeIndex = null;
      resetAddSubjectTimeButton();
    } else {
      subjectTimeList.push(newEntry);
    }
    renderSubjectTimeList();
    selectedSubjects.clear();
    renderTags();
    document.getElementById('subTime').value = "";
  }
}

function addCriteriaRow() {
    criteriaRowCount++;
    const rowId = criteriaRowCount;
    criteriaRowState[rowId] = { qsections: new Set(), topics: new Set(), subTopics: new Set() };

    const container = document.getElementById('criteriaRowsContainer');

    const row = document.createElement('div');
    row.id = `criteriaRow_${rowId}`;
    row.className = "p-4";
    row.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">

            <div class="md:col-span-2">
                <span class="field-name-tag">Subject</span>
                <select id="critSubject_${rowId}" data-action="row-subject-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    ${getSubjectOptionsHtml(null)}
                </select>
            </div>

            <div class="md:col-span-2">
                <span class="field-name-tag">Section</span>
                <select id="qsectionDropdown_${rowId}" data-action="row-qsection-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="" disabled selected>Choose subject first</option>
                </select>
                <div id="qsectionTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
            </div>

            <div class="md:col-span-2">
                <span class="field-name-tag">Topic</span>
                <select id="topicDropdown_${rowId}" data-action="row-topic-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="" disabled selected>Choose section first</option>
                </select>
                <div id="topicTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
            </div>

            <div class="md:col-span-2">
                <span class="field-name-tag">Sub-Topic</span>
                <select id="subTopicDropdown_${rowId}" data-action="row-subtopic-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="" disabled selected>Choose topic first</option>
                </select>
                <div id="subTopicTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
            </div>

            <div class="md:col-span-1">
                <span class="field-name-tag">Difficulty</span>
                <select id="critDifficulty_${rowId}" class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
                    <option value="Any">Any</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Hard">Hard</option>
                </select>
            </div>

            <div class="md:col-span-1">
                <span class="field-name-tag">Min Q</span>
                <input type="number" id="critMinCount_${rowId}" min="1" value="1"
                    class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
            </div>
            <div class="md:col-span-2 flex items-end gap-1">
                <input type="number" id="critMaxCount_${rowId}" min="1" value="1"
                    class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
                <button type="button" data-action="remove-criteria-row" data-row-id="${rowId}" class="text-gray-400 hover:text-red-500 shrink-0 pb-2">
                    <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>

        </div>
    `;

       container.appendChild(row);
    if (window.lucide) lucide.createIcons();
    container.scrollTop = container.scrollHeight;
    handleRowSubjectChange(rowId);
}

function removeCriteriaRow(rowId) {
    const row = document.getElementById(`criteriaRow_${rowId}`);
    if (row) row.remove();
    delete criteriaRowState[rowId];
}


async function fetchRowFilters(rowId) {
    const subject = document.getElementById(`critSubject_${rowId}`).value || '';

    const state = criteriaRowState[rowId];
    const sectionQuery = Array.from(selectedGlobalSections).join(',');
    const qsectionQuery = Array.from(state.qsections).join(',');
    const topicQuery = Array.from(state.topics).join(',');

    const url = `/api/listing/${contextData.listingId}/question-filters?subject=${encodeURIComponent(subject)}&section=${encodeURIComponent(sectionQuery)}&qsection=${encodeURIComponent(qsectionQuery)}&topic=${encodeURIComponent(topicQuery)}`;

    try {
        const res = await fetch(url);
        const result = await res.json();
        return result.success ? result.data : null;
    } catch (err) {
        console.error("Question filters fetch error:", err);
        return null;
    }
}

async function handleRowSubjectChange(rowId) {
    const state = criteriaRowState[rowId];
    state.qsections.clear();
    state.topics.clear();
    state.subTopics.clear();
    renderRowTags(rowId, 'qsection');
    renderRowTags(rowId, 'topic');
    renderRowTags(rowId, 'subTopic');

    const data = await fetchRowFilters(rowId);
    populateRowDropdown(rowId, 'qsection', data ? data.qsections : []);
    populateRowDropdown(rowId, 'topic', data ? data.topics : []);
    populateRowDropdown(rowId, 'subTopic', data ? data.subTopics : []);
}

async function handleRowQsectionChange(rowId) {
    const dropdown = document.getElementById(`qsectionDropdown_${rowId}`);
    const val = dropdown.value;
    const state = criteriaRowState[rowId];
    if (val && !state.qsections.has(val)) {
        state.qsections.add(val);
        renderRowTags(rowId, 'qsection');
    }
    dropdown.value = "";

    state.topics.clear();
    state.subTopics.clear();
    renderRowTags(rowId, 'topic');
    renderRowTags(rowId, 'subTopic');

    const data = await fetchRowFilters(rowId);
    populateRowDropdown(rowId, 'topic', data ? data.topics : []);
    populateRowDropdown(rowId, 'subTopic', []);
}

async function handleRowTopicChange(rowId) {
    const dropdown = document.getElementById(`topicDropdown_${rowId}`);
    const val = dropdown.value;
    const state = criteriaRowState[rowId];
    if (val && !state.topics.has(val)) {
        state.topics.add(val);
        renderRowTags(rowId, 'topic');
    }
    dropdown.value = "";

    state.subTopics.clear();
    renderRowTags(rowId, 'subTopic');

    const data = await fetchRowFilters(rowId);
    populateRowDropdown(rowId, 'subTopic', data ? data.subTopics : []);
}

function handleRowSubTopicChange(rowId) {
    const dropdown = document.getElementById(`subTopicDropdown_${rowId}`);
    const val = dropdown.value;
    const state = criteriaRowState[rowId];
    if (val && !state.subTopics.has(val)) {
        state.subTopics.add(val);
        renderRowTags(rowId, 'subTopic');
    }
    dropdown.value = "";
}

function populateRowDropdown(rowId, field, options) {
    const idMap = { qsection: 'qsectionDropdown', topic: 'topicDropdown', subTopic: 'subTopicDropdown' };
    const dropdown = document.getElementById(`${idMap[field]}_${rowId}`);
    if (!dropdown) return;

    if (!options || options.length === 0) {
        dropdown.innerHTML = `<option value="" disabled selected>No ${field} found</option>`;
        return;
    }
    dropdown.innerHTML = `<option value="" disabled selected>Choose ${field}</option>` +
        options.map(o => `<option value="${o}">${o}</option>`).join('');
}

function renderRowTags(rowId, field) {
    const idMap = { qsection: 'qsectionTags', topic: 'topicTags', subTopic: 'subTopicTags' };
    const container = document.getElementById(`${idMap[field]}_${rowId}`);
    if (!container) return;

    const set = criteriaRowState[rowId][field === 'qsection' ? 'qsections' : field === 'topic' ? 'topics' : 'subTopics'];
    container.innerHTML = Array.from(set).map(v => `
        <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">
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
    document.querySelectorAll('#criteriaRowsContainer [id^="criteriaRow_"]').forEach(row => {
        const rowId = row.id.split('_')[1];
        const state = criteriaRowState[rowId] || { qsections: new Set(), topics: new Set(), subTopics: new Set() };

        const minVal = Number(document.getElementById(`critMinCount_${rowId}`).value) || 1;
        const maxVal = Number(document.getElementById(`critMaxCount_${rowId}`).value) || 1;

        rows.push({
            subject: document.getElementById(`critSubject_${rowId}`).value,
            section: Array.from(state.qsections),
            topic: Array.from(state.topics),
            subTopic: Array.from(state.subTopics),
            difficulty: document.getElementById(`critDifficulty_${rowId}`).value,
            minCount: Math.min(minVal, maxVal),
            maxCount: Math.max(minVal, maxVal)
        });
    });
    return rows;
}


async function generateTest() {
    const criteria = collectCriteriaRows();

    if (criteria.length === 0) {
        alert("Kam se kam ek criteria row add karo (Subject/Topic/Min-Max Question)");
        return;
    }

    const timeStrategy = document.getElementById('timeStrategy').value;

    const payload = {
        title: document.getElementById('testTitleInput').value,
        languageMode: availableLanguagesList.length > 1 ? 'multiple' : 'single',
        languages: availableLanguagesList,
        showLanguage: testShowLanguage,
        timeStrategy,
        duration: timeStrategy === 'total'
            ? Number(document.getElementById('totalTimeInput')?.value) || 0
            : subjectTimeList.reduce((sum, st) => sum + Number(st.duration || 0), 0),
        subjectTime: timeStrategy === 'subject' ? subjectTimeList : [],
        sections: Array.from(selectedGlobalSections),
                totalQuestionsStrategy: questionCountStrategy,
        totalQuestionsCount: questionCountStrategy === 'all'
            ? (Number(document.getElementById('totalQuestionCountInput')?.value) || 0)
            : 0,
        subjectQuestionCounts: questionCountStrategy === 'subject' ? subjectQuestionCountList : [],
        criteria,
        noOfPapers: Number(document.getElementById('noOfPapersInput').value) || 1,
        maxRepeat: Number(document.getElementById('maxRepeatInput').value) || 2,
        listingId: contextData.listingId,
        sectionId: contextData.sectionId,
        parentType: contextData.parentType,
        parentId: contextData.parentId
    };

    console.log("Generate Paper payload:", payload);
    window.debugPayload = payload;

    try {
        const res = await fetch('/api/generate-paper', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (!result.success) {
            alert("Issue: " + (result.message || "Unknown error"));
        } else {
            if (result.warnings && result.warnings.length > 0) {
                alert("Papers ban gaye, lekin kuch warnings hain:\n\n" + result.warnings.join('\n'));
            }
            window.location.href = contextData.returnUrl;
        }
    } catch (err) {
        console.error("Generate paper error:", err);
        alert("Paper generate karte waqt error aaya");
    }
}

document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
        case 'add-criteria-row':
            addCriteriaRow();
            break;
        case 'generate-test':
            generateTest();
            break;
        case 'remove-criteria-row':
            removeCriteriaRow(target.dataset.rowId);
            break;
        case 'edit-subject-time':
            editSubjectTime(Number(target.dataset.index));
            break;
        case 'remove-subject-time':
            removeSubjectTime(Number(target.dataset.index));
            break;
        case 'remove-tag':
            removeTag(target.dataset.subject);
            break;
        case 'add-subject-time':
            addSubjectTime();
            break;
        case 'remove-global-section-tag':
            removeGlobalSectionTag(target.dataset.value);
            break;
        case 'remove-row-tag':
            removeRowTag(target.dataset.rowId, target.dataset.field, target.dataset.value);
            break;
                case 'add-subject-question-count':
            addSubjectQuestionCount();
            break;
        case 'edit-subject-question-count':
            editSubjectQuestionCount(Number(target.dataset.index));
            break;
        case 'remove-subject-question-count':
            removeSubjectQuestionCount(Number(target.dataset.index));
            break;
    }
});

document.addEventListener('change', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
        case 'time-strategy-change':
            handleTimeUI();
            break;
        case 'question-count-strategy-change':
            handleQuestionCountUI();
            break;
        case 'subject-dropdown-change':
            addTag();
            break;
        case 'row-subject-change':
            handleRowSubjectChange(target.dataset.rowId);
            break;
        case 'row-qsection-change':
            handleRowQsectionChange(target.dataset.rowId);
            break;
        case 'row-topic-change':
            handleRowTopicChange(target.dataset.rowId);
            break;
        case 'row-subtopic-change':
            handleRowSubTopicChange(target.dataset.rowId);
            break;
        case 'show-language-change':
            testShowLanguage = target.value;
            break;
        case 'global-section-change':
            addGlobalSectionTag();
            break;
    }
});

async function init() {
    await loadSubjects();
    await loadLanguages();
    await loadGlobalSections();
    handleTimeUI();
    renderShowLanguageUI();
    handleQuestionCountUI();
    addCriteriaRow();
    if (window.lucide) lucide.createIcons();
}
init();