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
    criteriaRowState[rowId] = { sections: new Set(), topics: new Set() };

    const container = document.getElementById('criteriaRowsContainer');

    const row = document.createElement('div');
    row.id = `criteriaRow_${rowId}`;
    row.className = "p-4";
    row.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">

            <div class="md:col-span-3">
                <span class="field-name-tag">Subject</span>
                <select id="critSubject_${rowId}" data-action="row-subject-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    ${getSubjectOptionsHtml(null)}
                </select>
            </div>

            <div class="md:col-span-3">
                <span class="field-name-tag">Section</span>
                <select id="sectionDropdown_${rowId}" data-action="row-section-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="" disabled selected>Choose subject first</option>
                </select>
                <div id="sectionTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
            </div>

            <div class="md:col-span-3">
                <span class="field-name-tag">Topic</span>
                <select id="topicDropdown_${rowId}" data-action="row-topic-change" data-row-id="${rowId}"
                    class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="" disabled selected>Choose subject first</option>
                </select>
                <div id="topicTags_${rowId}" class="flex flex-wrap gap-1 mt-1"></div>
            </div>

            <div class="md:col-span-2">
                <span class="field-name-tag">Difficulty</span>
                <select id="critDifficulty_${rowId}" class="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="Any">Any</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Hard">Hard</option>
                </select>
            </div>

            <div class="md:col-span-1 flex items-end gap-1">
                <div class="flex-1">
                    <span class="field-name-tag">No. Question</span>
                    <input type="number" id="critCount_${rowId}" min="1" value="1"
                        class="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
                </div>
                <button type="button" data-action="remove-criteria-row" data-row-id="${rowId}" class="text-gray-400 hover:text-red-500 shrink-0 pb-2">
                    <i data-lucide="x" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>

        </div>
    `;

    container.appendChild(row);
    if (window.lucide) lucide.createIcons();
    container.scrollTop = container.scrollHeight;
}

function removeCriteriaRow(rowId) {
    const row = document.getElementById(`criteriaRow_${rowId}`);
    if (row) row.remove();
    delete criteriaRowState[rowId];
}

async function handleRowSubjectChange(rowId) {
    const subject = document.getElementById(`critSubject_${rowId}`).value;

    criteriaRowState[rowId].sections.clear();
    criteriaRowState[rowId].topics.clear();
    renderRowTags(rowId, 'section');
    renderRowTags(rowId, 'topic');

    populateRowDropdown(rowId, 'section', []);
    populateRowDropdown(rowId, 'topic', []);

    if (!subject) return;

    try {
        const res = await fetch(`/api/listing/${contextData.listingId}/question-filters?subject=${encodeURIComponent(subject)}`);
        const result = await res.json();

        if (result.success) {
            populateRowDropdown(rowId, 'section', result.data.sections || []);
            populateRowDropdown(rowId, 'topic', result.data.topics || []);
        }
    } catch (err) {
        console.error("Question filters fetch error:", err);
    }
}

function populateRowDropdown(rowId, field, options) {
    const dropdown = document.getElementById(`${field}Dropdown_${rowId}`);
    if (!dropdown) return;

    if (options.length === 0) {
        dropdown.innerHTML = `<option value="" disabled selected>No ${field} found</option>`;
        return;
    }

    dropdown.innerHTML = `<option value="" disabled selected>Choose ${field}</option>` +
        options.map(o => `<option value="${o}">${o}</option>`).join('');
}

function addRowTag(rowId, field) {
    const dropdown = document.getElementById(`${field}Dropdown_${rowId}`);
    const val = dropdown.value;
    const setKey = field === 'section' ? 'sections' : 'topics';

    if (val && !criteriaRowState[rowId][setKey].has(val)) {
        criteriaRowState[rowId][setKey].add(val);
        renderRowTags(rowId, field);
    }
    dropdown.value = "";
}

function renderRowTags(rowId, field) {
    const container = document.getElementById(`${field}Tags_${rowId}`);
    if (!container) return;

    const setKey = field === 'section' ? 'sections' : 'topics';
    const set = criteriaRowState[rowId][setKey];

    container.innerHTML = Array.from(set).map(v => `
        <span class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full">
            ${v}
            <button type="button" data-action="remove-row-tag" data-row-id="${rowId}" data-field="${field}" data-value="${v}" class="hover:text-red-500 font-bold">✕</button>
        </span>
    `).join('');
}

function removeRowTag(rowId, field, val) {
    const setKey = field === 'section' ? 'sections' : 'topics';
    criteriaRowState[rowId][setKey].delete(val);
    renderRowTags(rowId, field);
}

function collectCriteriaRows() {
    const rows = [];
    document.querySelectorAll('#criteriaRowsContainer [id^="criteriaRow_"]').forEach(row => {
        const rowId = row.id.split('_')[1];
        const state = criteriaRowState[rowId] || { sections: new Set(), topics: new Set() };

        rows.push({
            subject: document.getElementById(`critSubject_${rowId}`).value,
            section: Array.from(state.sections),
            topic: Array.from(state.topics),
            difficulty: document.getElementById(`critDifficulty_${rowId}`).value,
            count: Number(document.getElementById(`critCount_${rowId}`).value) || 0
        });
    });
    return rows;
}

async function generateTest() {
    const criteria = collectCriteriaRows();

    if (criteria.length === 0) {
        alert("Kam se kam ek criteria row add karo (Subject/Topic/No. Question)");
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
        criteria,
        noOfPapers: Number(document.getElementById('noOfPapersInput').value) || 1,
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
            window.location.href = contextData.returnUrl;
        }
    } catch (err) {
        console.error("Generate paper error:", err);
        alert("Paper generate karte waqt error aaya");
    }
}

// ---- CSP-safe event delegation ----
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
        case 'remove-row-tag':
            removeRowTag(target.dataset.rowId, target.dataset.field, target.dataset.value);
            break;
        case 'add-subject-time':
            addSubjectTime();
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
        case 'subject-dropdown-change':
            addTag();
            break;
        case 'row-subject-change':
            handleRowSubjectChange(target.dataset.rowId);
            break;
        case 'row-section-change':
            addRowTag(target.dataset.rowId, 'section');
            break;
        case 'row-topic-change':
            addRowTag(target.dataset.rowId, 'topic');
            break;
        case 'show-language-change':
            testShowLanguage = target.value;
            break;
    }
});

async function init() {
    await loadSubjects();
    await loadLanguages();
    handleTimeUI();
    renderShowLanguageUI();
    addCriteriaRow();
    if (window.lucide) lucide.createIcons();
}
init();