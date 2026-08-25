 
const urlParams = new URLSearchParams(window.location.search);
const contextData = {
    listingId: urlParams.get('listingId') || '',
    sectionId: urlParams.get('sectionId') || '',
    parentType: urlParams.get('parentType') || 'section',
    parentId: urlParams.get('parentId') || '',
    returnUrl: urlParams.get('returnUrl') || '/',
    editId: urlParams.get('editId') || ''
};

let selectedSubjects = new Set();
let testLanguageMode = 'single';
let testLanguages = ['English'];
let testShowLanguage = 'all';
let subjectTimeList = [];
let editingSubjectTimeIndex = null;
let questionCount = 0;
let isEditMode = !!contextData.editId;
let currentViewMode = 'manual';
let testQuestionsState = [];
let subjectsList = [];
let testDurationState = 0;

const imageDataStore = {};
const questionOptionCount = {};  

function getOptionCount(qId) {
  if (!questionOptionCount[qId]) questionOptionCount[qId] = 4;
  return questionOptionCount[qId];
}

function indexToLetter(i) {
  return String.fromCharCode(65 + i);
}

/* Attribute values me quotes/HTML break na ho isliye chhota escape helper.
   (Pehle inline onclick="fn('${val}')" bhi quotes se break ho sakta tha —
   ye sirf usi cheez ko attribute-safe tareeke se karta hai, logic same hai.) */
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function ensureImageStore(qId) {
  if (!imageDataStore[qId]) {
    imageDataStore[qId] = { question: null, options: [null, null, null, null], solution: null };
  }
  return imageDataStore[qId];
}

function restoreImagePreviews(qId) {
  const store = imageDataStore[qId];
  if (!store) return;

  if (store.question) showPreview(`qImagePreview_${qId}`, store.question);
  if (store.solution) showPreview(`qSolImagePreview_${qId}`, store.solution);

  const optCount = getOptionCount(qId);
  for (let oi = 0; oi < optCount; oi++) {
    if (store.options[oi]) showPreview(`qOptImagePreview_${qId}_${oi}`, store.options[oi]);
  }
}

async function uploadAndStore(inputEl, kind, qId, optionIdx) {
  const file = inputEl.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  const store = ensureImageStore(qId);

  try {
    const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
    const result = await res.json();

    if (!result.success) {
      alert("Image upload fail: " + (result.message || "Unknown error"));
      return;
    }

    if (kind === 'question') {
      store.question = result.url;
      showPreview(`qImagePreview_${qId}`, result.url);
    } else if (kind === 'option') {
      store.options[optionIdx] = result.url;
      showPreview(`qOptImagePreview_${qId}_${optionIdx}`, result.url);
    } else if (kind === 'solution') {
      store.solution = result.url;
      showPreview(`qSolImagePreview_${qId}`, result.url);
    }
  } catch (err) {
    console.error("Image upload error:", err);
    alert("Image upload me error aaya");
  }
}

let previewLoadQueue = [];
let previewLoadTimer = null;

function showPreview(imgId, url) {
  previewLoadQueue.push({ imgId, url });
  scheduleNextPreviewLoad();
}

function scheduleNextPreviewLoad() {
  if (previewLoadTimer) return;

  previewLoadTimer = setInterval(() => {
    const next = previewLoadQueue.shift();
    if (!next) {
      clearInterval(previewLoadTimer);
      previewLoadTimer = null;
      return;
    }
    const img = document.getElementById(next.imgId);
    if (img) {
      img.src = next.url;
      img.classList.remove('hidden');
    }
  }, 150);
}

/* ---------------------------------------------------------
   LOAD SUBJECTS FROM LISTING (marks config)
--------------------------------------------------------- */
async function loadSubjects() {
    try {
        const res = await fetch(`/api/listing/${contextData.listingId}/subjects`);
        const result = await res.json();

        if (result.success) {
            subjectsList = result.data;
            console.log("Subjects loaded from Listing:", subjectsList);
        } else {
            console.error("Subjects load failed:", result.message);
            subjectsList = [];
        }
    } catch (err) {
        console.error("Subjects fetch error:", err);
        subjectsList = [];
    }
}
function getSubjectOptionsHtml(selectedValue) {
    if (subjectsList.length === 0) {
        return `<option value="">No subjects found</option>`;
    }
    return subjectsList.map(s => {
        const isSelected = (s.subject === selectedValue) ? "selected" : "";
        return `<option value="${escapeAttr(s.subject)}" ${isSelected}>${s.subject} (+${s.positiveMarks} / ${s.negativeMarks})</option>`;
    }).join('');
}

function getMarksForSubject(subjectName) {
    let found = subjectsList.find(s => s.subject === subjectName);

    if (!found && subjectsList.length > 0) {
        found = subjectsList[0];
    }

    return found
        ? { positiveMarks: found.positiveMarks, negativeMarks: found.negativeMarks }
        : { positiveMarks: 0, negativeMarks: 0 };
}


/* ---------------------------------------------------------
   TAB SWITCH
--------------------------------------------------------- */

function renderView(mode) {
    const totalInputBeforeSwitch = document.getElementById('totalTimeInput');
    if (totalInputBeforeSwitch) {
        testDurationState = Number(totalInputBeforeSwitch.value) || 0;
    }

    if (currentViewMode === 'manual' && document.getElementById('questionsListContainer')) {
        testQuestionsState = collectManualQuestions();
    } else if (currentViewMode === 'json') {
        const jsonEditor = document.getElementById('jsonEditor');
        if (jsonEditor && jsonEditor.value.trim()) {
            try {
                const parsed = JSON.parse(jsonEditor.value);
                testQuestionsState = Array.isArray(parsed) ? parsed : (parsed.questions || testQuestionsState);
            } catch (err) {
                // invalid JSON hai to purana state hi rakho, silently ignore
            }
        }
    }

    currentViewMode = mode;
    const container = document.getElementById("mainContainer");
    const manualTab = document.getElementById("manualTab");
    const jsonTab = document.getElementById("jsonTab");

    manualTab.className =
        mode === "manual"
            ? "pb-2 font-bold text-indigo-600 border-b-2 border-indigo-600"
            : "pb-2 font-bold text-gray-400";

    jsonTab.className =
        mode === "json"
            ? "pb-2 font-bold text-indigo-600 border-b-2 border-indigo-600"
            : "pb-2 font-bold text-gray-400";

    if (mode === "manual") {
        container.innerHTML = `
            <div id="timeDynamicContainer" class="p-6 border rounded-xl bg-gray-50 mb-6"></div>
            <div id="questionsListContainer" class="space-y-6"></div>
            <button type="button" data-action="add-question" class="w-full mt-6 py-4 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50">
                + Add New Question
            </button>
        `;
        handleTimeUI();
        renderManualQuestions(testQuestionsState);
    } else {
        container.innerHTML = `
            <div id="timeDynamicContainer" class="p-6 border rounded-xl bg-gray-50 mb-6"></div>
            <div>
                <div class="flex items-center justify-between mb-2">
                    <label class="block text-sm font-bold">JSON Configuration</label>
                    <button type="button" data-action="load-demo" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
                        📋 Load Example Format (${testLanguageMode === 'multiple' ? 'Multiple' : 'Single'} Language)
                    </button>
                </div>
                <p class="text-xs text-gray-400 mb-2">
                    Ye editor <b>${testLanguageMode === 'multiple' ? 'Multiple' : 'Single'}-language</b> mode me hai. Format guide ke liye upar "Load Example" click karo.
                </p>
                <textarea id="jsonEditor" data-oninput="calc-marks-json" class="w-full h-72 p-4 border rounded-xl font-mono text-sm" placeholder='Paste JSON configuration here...'></textarea>
            </div>
        `;
        handleTimeUI();

        const jsonEditor = document.getElementById('jsonEditor');
        if (jsonEditor) {
            // Agar koi saved data nahi hai to language-mode ke hisaab se DEMO dikhao
            const dataToShow = (Array.isArray(testQuestionsState) && testQuestionsState.length > 0)
                ? testQuestionsState
                : getDemoQuestionsJson();
            jsonEditor.value = JSON.stringify(dataToShow, null, 2);
        }
        calculateTotalMarksFromJson();
    }
}


/* ---------------------------------------------------------
   TIME STRATEGY UI
--------------------------------------------------------- */

function handleTimeUI() {
  const container = document.getElementById('timeDynamicContainer');
  if (!container) return;

  const strategy = document.getElementById('timeStrategy').value;

  if (strategy === 'total') {
    container.innerHTML = `<div id="totalTimeField"><label class="block text-sm font-bold mb-2">Total Time (in minutes)</label><input type="number" id="totalTimeInput" placeholder="e.g. 120" class="w-full p-3 border rounded-lg" value="${testDurationState || ''}"></div>`;
    selectedSubjects.clear();
  } else {
    editingSubjectTimeIndex = null;
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-bold mb-2">Section</label>
          <div id="tagContainer" class="min-h-[50px] p-2 border bg-white rounded-xl flex flex-wrap gap-2 mb-2"></div>
          <select id="subjectDropdown" data-onchange="add-tag" class="w-full p-3 border rounded-xl">
            <option value="" disabled selected>Choose a subject</option>
            ${getSubjectOptionsHtml(null)}
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold mb-2">Time (in minutes)</label>
          <input type="number" id="subTime" class="w-full p-3 border rounded-lg" placeholder="Enter minutes">
          <button type="button" data-action="add-subject-time" id="addSubjectTimeBtn" class="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">Add Subject Time</button>
        </div>
      </div>
      <div id="addedList" class="mt-6 pt-4 border-t border-gray-200"><h3 class="text-sm font-bold mb-2">Allocated Times:</h3></div>`;

    renderSubjectTimeList();
  }
}

function renderSubjectTimeList() {
  const addedList = document.getElementById('addedList');
  if (!addedList) return;

  addedList.innerHTML = '<h3 class="text-sm font-bold mb-2">Allocated Times:</h3>';

  subjectTimeList.forEach((st, index) => {
    addedList.innerHTML += `
      <div class="flex justify-between items-center p-3 mb-2 bg-white border border-indigo-100 rounded-lg">
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

function addTag() { const d = document.getElementById('subjectDropdown'); if (d.value && !selectedSubjects.has(d.value)) { selectedSubjects.add(d.value); renderTags(); } d.value = ""; }
function renderTags() { const c = document.getElementById('tagContainer'); c.innerHTML = ''; selectedSubjects.forEach(s => { c.innerHTML += `<span class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">${s} <button type="button" data-action="remove-tag" data-subject="${escapeAttr(s)}" class="hover:text-red-200 font-bold">✕</button></span>`; }); }
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

/* ---------------------------------------------------------
   LANGUAGE MODE UI
--------------------------------------------------------- */
function handleLanguageUI() {
  const container = document.getElementById('languageFieldContainer');
  if (!container) return;

  const mode = document.getElementById('languageMode').value;
  testLanguageMode = mode;

  if (mode === 'single') {
    const currentLang = testLanguages[0] || '';
    container.innerHTML = `
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Language</label>
        <input type="text" id="singleLanguageInput" placeholder="e.g. English, Hindi, Punjabi..."
          value="${escapeAttr(currentLang)}"
          data-oninput="single-language-input"
          class="w-full md:w-1/3 p-3 border rounded-xl">
      </div>`;
  } else {
    container.innerHTML = `
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Languages (kam se kam 2)</label>
        <div id="langTagContainer" class="min-h-[50px] p-2 border bg-white rounded-xl flex flex-wrap gap-2 mb-2"></div>
        <div class="flex gap-2">
          <input type="text" id="langInput" placeholder="e.g. Hindi, English, Bhojpuri..." class="flex-1 p-3 border rounded-xl">
          <button type="button" data-action="add-language-tag" class="bg-indigo-600 text-white px-4 rounded-xl font-bold">Add</button>
        </div>
      </div>`;
    renderLanguageTags();
  }

  // Sirf har question ka BODY re-render karo (header/topic/subject safe rehta hai)
  document.querySelectorAll('[id^="question_"]').forEach(block => {
    const qId = block.id.split('_')[1];
    const snap = captureQuestionSnapshot(qId);
    renderQuestionBody(qId);
    applyQuestionSnapshot(qId, snap);
  });

  // JSON tab khula ho aur khaali/demo dikh raha ho to usko bhi refresh karo
   if (currentViewMode === 'json') {
    // Header label turant update karo (mode badalte hi)
    const labelBtn = document.querySelector('[data-action="load-demo"]');
    if (labelBtn) {
        labelBtn.textContent = `📋 Load Example Format (${testLanguageMode === 'multiple' ? 'Multiple' : 'Single'} Language)`;
    }
    const modeHint = document.querySelector('#mainContainer p.text-xs.text-gray-400');
    if (modeHint) {
        modeHint.innerHTML = `Ye editor <b>${testLanguageMode === 'multiple' ? 'Multiple' : 'Single'}-language</b> mode me hai. Format guide ke liye upar "Load Example" click karo.`;
    }

    const jsonEditor = document.getElementById('jsonEditor');
    if (jsonEditor && (!jsonEditor.value.trim() || jsonEditor.value.trim() === '[]')) {
      jsonEditor.value = JSON.stringify(getDemoQuestionsJson(), null, 2);
      calculateTotalMarksFromJson();
    }
  }
   renderShowLanguageUI();
}

function renderShowLanguageUI() {
  const container = document.getElementById('showLanguageFieldContainer');
  if (!container) return;

  if (testLanguageMode !== 'multiple' || testLanguages.length === 0) {
    container.innerHTML = '';
    return;
  }

  if (testShowLanguage !== 'all' && !testLanguages.includes(testShowLanguage)) {
    testShowLanguage = 'all';
  }

  const optionsHtml = [
    `<option value="all" ${testShowLanguage === 'all' ? 'selected' : ''}>All</option>`,
    ...testLanguages.map(lang =>
      `<option value="${escapeAttr(lang)}" ${testShowLanguage === lang ? 'selected' : ''}>${lang}</option>`
    )
  ].join('');

  container.innerHTML = `
    <div>
      <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Show Language</label>
      <select id="showLanguageSelect" data-onchange="show-language" class="w-full p-3 border rounded-xl bg-gray-50 font-bold">
        ${optionsHtml}
      </select>
    </div>`;
}


function addLanguageTag() {
  const input = document.getElementById('langInput');
  const val = input.value.trim();
  if (val && !testLanguages.includes(val)) {
    testLanguages.push(val);
    renderLanguageTags();

    document.querySelectorAll('[id^="question_"]').forEach(block => {
      const qId = block.id.split('_')[1];
      const snap = captureQuestionSnapshot(qId);
      renderQuestionBody(qId);
      applyQuestionSnapshot(qId, snap);
    });

    renderShowLanguageUI();
  }
  input.value = '';
}

function removeLanguageTag(lang) {
  testLanguages = testLanguages.filter(l => l !== lang);
  renderLanguageTags();

  document.querySelectorAll('[id^="question_"]').forEach(block => {
    const qId = block.id.split('_')[1];
    const snap = captureQuestionSnapshot(qId);
    renderQuestionBody(qId);
    applyQuestionSnapshot(qId, snap);
  });

  renderShowLanguageUI();
}

function renderLanguageTags() {
  const c = document.getElementById('langTagContainer');
  if (!c) return;
  c.innerHTML = '';
  testLanguages.forEach(lang => {
    c.innerHTML += `<span class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">${lang} <button type="button" data-action="remove-language-tag" data-lang="${escapeAttr(lang)}" class="hover:text-red-200 font-bold">✕</button></span>`;
  });
}


/* ---------------------------------------------------------
   QUESTION BUILDER
--------------------------------------------------------- */
function addQuestion(existingMongoId, initialOptionCount) {
   if (!existingMongoId && subjectsList.length === 0) {
    alert("Pehle Listing me subjects/marks configure karo, tabhi questions add ho sakte hain.");
    return;
  }
  questionCount++;
  const qId = questionCount;
  questionOptionCount[qId] = initialOptionCount || 4;   
  const list = document.getElementById('questionsListContainer');

  const block = document.createElement('div');
  block.id = `question_${qId}`;
  block.className = "border border-gray-100 rounded-2xl p-4 bg-white";
  block.dataset.mongoId = existingMongoId || '';
  block.innerHTML = `
    <div class="flex flex-wrap items-center gap-3 mb-6 bg-gray-50 p-3 rounded-xl">
      <div class="bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold qBadge">Q${qId}</div>

      <select id="qSubject_${qId}" data-onchange="render-question-body" data-qid="${qId}" class="bg-white border rounded-lg px-3 py-1 outline-none text-sm font-medium">
    ${getSubjectOptionsHtml(null)}
</select>

      <select id="qType_${qId}" data-onchange="render-question-body" data-qid="${qId}" class="bg-white border rounded-lg px-3 py-1 outline-none text-sm font-medium">
        <option value="mcq">MCQ</option>
        <option value="multiple">Multiple MCQ</option>
        <option value="integer">Integer/Numeric</option>
      </select>

      <input type="text" id="qSection_${qId}" placeholder="Section" class="bg-white border rounded-lg px-3 py-1 text-sm flex-1">
      <input type="text" id="qTopic_${qId}" placeholder="Topic" class="bg-white border rounded-lg px-3 py-1 text-sm flex-1">
      <input type="text" id="qSubTopic_${qId}" placeholder="Sub Topic" class="bg-white border rounded-lg px-3 py-1 text-sm flex-1">

      <select id="qDifficulty_${qId}" class="bg-white border rounded-lg px-3 py-1 outline-none text-sm font-medium">
        <option>Easy</option>
        <option selected>Medium</option>
        <option>Hard</option>
      </select>
      <button type="button" data-action="remove-question" data-qid="${qId}" class="text-red-400 hover:text-red-600">🗑️</button>
    </div>

    <div id="qBody_${qId}"></div>
  `;

  list.appendChild(block);
  renderQuestionBody(qId);
  renumberQuestions();
  calculateTotalMarks();
}

function removeQuestion(qId) {
  const block = document.getElementById(`question_${qId}`);
  if (block) block.remove();
  renumberQuestions();
  calculateTotalMarks();
}


function snapshotQuestionInputs(qId) {
  const body = document.getElementById(`qBody_${qId}`);
  if (!body) return null;

  const snap = { text: {}, checked: [] };

  body.querySelectorAll('textarea, input[type="text"], input[type="number"]').forEach(el => {
    if (el.id) snap.text[el.id] = el.value;
  });

  body.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked').forEach(el => {
    snap.checked.push(`${el.name}::${el.value}`);
  });

  return snap;
}

function restoreQuestionInputs(qId, snap) {
  if (!snap) return;
  const body = document.getElementById(`qBody_${qId}`);
  if (!body) return;

  Object.keys(snap.text).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = snap.text[id];
  });

  snap.checked.forEach(nv => {
    const [name, val] = nv.split('::');
    const el = body.querySelector(`input[name="${name}"][value="${val}"]`);
    if (el) el.checked = true;
  });
}

function captureQuestionSnapshot(qId) {
  const wasMultiple = !!document.getElementById(`qTransQuestion_${qId}_0`);
  const snap = { wasMultiple, checked: [], numeric: null };
  const optCount = getOptionCount(qId);

  if (wasMultiple) {
    snap.translations = testLanguages.map((lang, li) => {
      const opts = [];
      for (let oi = 0; oi < optCount; oi++) {
        opts.push(document.getElementById(`qTransOptText_${qId}_${li}_${oi}`)?.value || '');
      }
      return {
        lang,
        question: document.getElementById(`qTransQuestion_${qId}_${li}`)?.value || '',
        solution: document.getElementById(`qTransSolutionText_${qId}_${li}`)?.value || '',
        options: opts
      };
    });
  } else {
    const opts = [];
    for (let oi = 0; oi < optCount; oi++) {
      opts.push(document.getElementById(`qOptText_${qId}_${oi}`)?.value || '');
    }
    snap.question = document.getElementById(`qText_${qId}`)?.value || '';
    snap.solution = document.getElementById(`qSolution_${qId}`)?.value || '';
    snap.options = opts;
  }

  document.querySelectorAll(`.qCorrect_${qId}:checked`).forEach(el => snap.checked.push(el.value));
  const numEl = document.getElementById(`qNumeric_${qId}`);
  if (numEl) snap.numeric = numEl.value;

  return snap;
}

function applyQuestionSnapshot(qId, snap) {
  if (!snap) return;
  const isMultipleNow = !!document.getElementById(`qTransQuestion_${qId}_0`);

  if (isMultipleNow) {
    testLanguages.forEach((lang, li) => {
      let text = '', solText = '', opts = [];
      if (snap.wasMultiple) {
        const match = snap.translations.find(t => t.lang === lang) || snap.translations[li];
        if (match) { text = match.question; solText = match.solution; opts = match.options; }
      } else {
        text = snap.question; solText = snap.solution; opts = snap.options;
      }
      const qEl = document.getElementById(`qTransQuestion_${qId}_${li}`);
      const solEl = document.getElementById(`qTransSolutionText_${qId}_${li}`);
      if (qEl) qEl.value = text;
      if (solEl) solEl.value = solText;
      opts.forEach((val, oi) => {
        const optEl = document.getElementById(`qTransOptText_${qId}_${li}_${oi}`);
        if (optEl) optEl.value = val;
      });
    });
  } else {
    let text = '', solText = '', opts = [];
    if (snap.wasMultiple) {
      const first = snap.translations[0];
      if (first) { text = first.question; solText = first.solution; opts = first.options; }
    } else {
      text = snap.question; solText = snap.solution; opts = snap.options;
    }
    const qEl = document.getElementById(`qText_${qId}`);
    const solEl = document.getElementById(`qSolution_${qId}`);
    if (qEl) qEl.value = text;
    if (solEl) solEl.value = solText;
    opts.forEach((val, oi) => {
      const optEl = document.getElementById(`qOptText_${qId}_${oi}`);
      if (optEl) optEl.value = val;
    });
  }

  snap.checked.forEach(val => {
    const el = document.querySelector(`.qCorrect_${qId}[value="${val}"]`);
    if (el) el.checked = true;
  });
  if (snap.numeric !== null) {
    const numEl = document.getElementById(`qNumeric_${qId}`);
    if (numEl) numEl.value = snap.numeric;
  }
}

function addOption(qId) {
  const count = getOptionCount(qId);
  questionOptionCount[qId] = count + 1;

  const snap = snapshotQuestionInputs(qId);
  renderQuestionBody(qId);
  restoreQuestionInputs(qId, snap);
}

function removeOption(qId, optIdx) {
  const count = getOptionCount(qId);
  if (count <= 2) {
    alert("Kam se kam 2 options zaroori hain.");
    return;
  }

  const wasMultiple = !!document.getElementById(`qTransQuestion_${qId}_0`);

  // Correct answers ko remap karo — deleted index hatao, upar wale sab 1 shift down
  const correctBefore = Array.from(document.querySelectorAll(`.qCorrect_${qId}:checked`)).map(el => Number(el.value));
  const correctAfter = correctBefore
    .filter(v => v !== optIdx)
    .map(v => (v > optIdx ? v - 1 : v));

  let optionTextsSingle = [];
  let optionTextsMulti = [];
  let questionText = null, solutionText = null, transTexts = null;

  if (wasMultiple) {
    optionTextsMulti = testLanguages.map((lang, li) => {
      const arr = [];
      for (let oi = 0; oi < count; oi++) {
        arr.push(document.getElementById(`qTransOptText_${qId}_${li}_${oi}`)?.value || '');
      }
      arr.splice(optIdx, 1);
      return arr;
    });
    transTexts = testLanguages.map((lang, li) => ({
      question: document.getElementById(`qTransQuestion_${qId}_${li}`)?.value || '',
      solution: document.getElementById(`qTransSolutionText_${qId}_${li}`)?.value || ''
    }));
  } else {
    for (let oi = 0; oi < count; oi++) {
      optionTextsSingle.push(document.getElementById(`qOptText_${qId}_${oi}`)?.value || '');
    }
    optionTextsSingle.splice(optIdx, 1);
    questionText = document.getElementById(`qText_${qId}`)?.value || '';
    solutionText = document.getElementById(`qSolution_${qId}`)?.value || '';
  }

  const numericVal = document.getElementById(`qNumeric_${qId}`)?.value ?? null;

  const store = ensureImageStore(qId);
  store.options.splice(optIdx, 1);
  questionOptionCount[qId] = count - 1;

  renderQuestionBody(qId);

  if (wasMultiple) {
    testLanguages.forEach((lang, li) => {
      const qEl = document.getElementById(`qTransQuestion_${qId}_${li}`);
      if (qEl) qEl.value = transTexts[li].question;
      const solEl = document.getElementById(`qTransSolutionText_${qId}_${li}`);
      if (solEl) solEl.value = transTexts[li].solution;
      optionTextsMulti[li].forEach((val, oi) => {
        const optEl = document.getElementById(`qTransOptText_${qId}_${li}_${oi}`);
        if (optEl) optEl.value = val;
      });
    });
  } else {
    const qEl = document.getElementById(`qText_${qId}`);
    if (qEl) qEl.value = questionText;
    const solEl = document.getElementById(`qSolution_${qId}`);
    if (solEl) solEl.value = solutionText;
    optionTextsSingle.forEach((val, oi) => {
      const optEl = document.getElementById(`qOptText_${qId}_${oi}`);
      if (optEl) optEl.value = val;
    });
  }

  correctAfter.forEach(idx => {
    const el = document.querySelector(`.qCorrect_${qId}[value="${idx}"]`);
    if (el) el.checked = true;
  });
  if (numericVal !== null) {
    const numEl = document.getElementById(`qNumeric_${qId}`);
    if (numEl) numEl.value = numericVal;
  }
}

function renumberQuestions() {
  const badges = document.querySelectorAll('#questionsListContainer .qBadge');
  badges.forEach((badge, index) => { badge.textContent = `Q${index + 1}`; });
}

/* ---------------------------------------------------------
   QUESTION BODY — Single vs Multiple language render
--------------------------------------------------------- */
function isEnglishSubject(qId) {
  const subjectEl = document.getElementById(`qSubject_${qId}`);
  const subjectVal = subjectEl ? subjectEl.value.trim().toLowerCase() : '';
  return subjectVal === 'english';
}

function renderQuestionBody(qId) {
  const typeEl = document.getElementById(`qType_${qId}`);
  const type = typeEl ? typeEl.value : 'mcq';
  const body = document.getElementById(`qBody_${qId}`);
  if (!body) return;

  const forceSingle = isEnglishSubject(qId);   // English subject = hamesha single

  if (testLanguageMode === 'multiple' && !forceSingle) {
    body.innerHTML = renderMultiLanguageBody(qId, type);
  } else {
    body.innerHTML = renderSingleLanguageBody(qId, type);
    updateUI(qId);
  }
  restoreImagePreviews(qId);
  calculateTotalMarks();
}

function renderSingleLanguageBody(qId, type) {
  return `
    <textarea id="qText_${qId}" placeholder="Enter Question..." class="w-full p-4 border rounded-xl mb-4 h-32 focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>

    <div class="border-2 border-dashed rounded-xl p-4 text-center mb-6 text-gray-400 text-sm">
      <p class="mb-1">QUESTION PHOTO (OPTIONAL)</p>
      <input type="file" id="qImageFile_${qId}" accept="image/*" data-onchange="upload-image" data-kind="question" data-qid="${qId}" class="text-sm">
      <img id="qImagePreview_${qId}" class="hidden mt-2 h-20 mx-auto rounded" />
    </div>

    <div id="dynamicFields_${qId}" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"></div>

    <div class="mb-2">
      <p class="text-xs font-bold text-indigo-700 mb-2">QUESTION SOLUTION</p>
      <textarea id="qSolution_${qId}" class="w-full p-4 border rounded-xl h-24 mb-2 outline-none" placeholder="Enter solution details..."></textarea>
      <div class="border-2 border-dashed rounded-xl p-3 text-center bg-gray-50">
        <label class="text-xs text-gray-500 block mb-1">UPLOAD SOLUTION PHOTO</label>
        <input type="file" id="qSolImageFile_${qId}" accept="image/*" data-onchange="upload-image" data-kind="solution" data-qid="${qId}" class="text-sm">
        <img id="qSolImagePreview_${qId}" class="hidden mt-2 h-20 mx-auto rounded" />
      </div>
    </div>
  `;
}

function renderMultiLanguageBody(qId, type) {
  let html = '';

  // SHARED Question Image — ek hi diagram sabhi languages ke liye
  html += `
    <div class="border-2 border-dashed rounded-xl p-4 text-center mb-4 text-gray-400 text-sm bg-gray-50">
      <p class="mb-1 font-bold text-indigo-700">QUESTION PHOTO / DIAGRAM (SHARED — sabhi languages me same rahega)</p>
      <input type="file" id="qImageFile_${qId}" accept="image/*" data-onchange="upload-image" data-kind="question" data-qid="${qId}" class="text-sm">
      <img id="qImagePreview_${qId}" class="hidden mt-2 h-20 mx-auto rounded" />
    </div>
  `;

  // Har language ka apna sirf TEXT box (image nahi)
  testLanguages.forEach((lang, li) => {
    html += `
      <div class="border border-indigo-100 rounded-xl p-4 mb-4 bg-indigo-50/30">
        <p class="text-xs font-bold text-indigo-700 uppercase mb-2">Question Text (${lang})</p>
        <textarea id="qTransQuestion_${qId}_${li}" placeholder="Enter Question in ${lang}..." class="w-full p-4 border rounded-xl h-28 focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>
      </div>
    `;
  });

  if (type !== 'integer') {
    // SHARED Option Images
    html += `<div class="p-4 border rounded-xl bg-gray-50 mb-4">
      <p class="text-xs font-bold text-indigo-700 uppercase mb-3">OPTION IMAGES (SHARED — optional, sabhi languages me same)</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;
    const optCount = getOptionCount(qId);
    for (let oi = 0; oi < optCount; oi++) {
      const opt = indexToLetter(oi);
      html += `
        <div class="p-3 border rounded-xl bg-white">
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-bold uppercase">Option ${opt} Image</label>
            ${optCount > 2 ? `<button type="button" data-action="remove-option" data-qid="${qId}" data-optidx="${oi}" class="text-red-400 hover:text-red-600 text-xs">🗑️</button>` : ''}
          </div>
          <input type="file" id="qOptImageFile_${qId}_${oi}" accept="image/*" data-onchange="upload-image" data-kind="option" data-qid="${qId}" data-optidx="${oi}" class="text-xs">
          <img id="qOptImagePreview_${qId}_${oi}" class="hidden mt-2 h-16 rounded" />
        </div>`;
    }
    html += `</div></div>`;
    html += `<div class="col-span-1 md:col-span-2 mb-4"><button type="button" data-action="add-option" data-qid="${qId}" class="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-bold rounded-lg hover:bg-indigo-50">+ Add Option</button></div>`;

    // Har language ke Option TEXTS
    testLanguages.forEach((lang, li) => {
      html += `<div class="p-4 border rounded-xl bg-indigo-50/30 mb-4">
        <p class="text-xs font-bold text-indigo-700 uppercase mb-2">Option Texts (${lang})</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;
      for (let oi = 0; oi < optCount; oi++) {
        const opt = indexToLetter(oi);
        html += `
          <div>
            <label class="text-xs font-bold uppercase block mb-1">Option ${opt} (${lang})</label>
            <input type="text" id="qTransOptText_${qId}_${li}_${oi}" class="w-full p-2 border rounded" placeholder="Text in ${lang}...">
          </div>`;
      }
      html += `</div></div>`;
    });

    // Correct Answer — SHARED (option index sabhi languages me same order follow karta hai)
    const inputType = (type === 'multiple') ? 'checkbox' : 'radio';
    html += `<div class="p-4 border rounded-xl bg-gray-50 mb-4"><p class="text-xs font-bold text-gray-600 uppercase mb-2">Correct Answer (Option Index)</p><div class="grid grid-cols-2 md:grid-cols-4 gap-3">`;
    for (let oi = 0; oi < optCount; oi++) {
      const opt = indexToLetter(oi);
      html += `
        <label class="flex items-center gap-2 p-2 border rounded-lg bg-white text-sm font-bold">
          <input type="${inputType}" name="qOption_${qId}" value="${oi}" class="qCorrect_${qId} w-4 h-4">
          Option ${opt}
        </label>`;
    }
    html += `</div></div>`;
  } else {
    html += `
      <div class="p-6 border rounded-xl bg-gray-50 mb-4">
        <label class="block text-sm font-bold mb-2">Enter Numeric Answer:</label>
        <input type="number" step="any" id="qNumeric_${qId}" class="w-full p-3 border rounded-lg" placeholder="Enter integer or decimal value">
      </div>`;
  }

  // SHARED Solution Image + har language ka Solution TEXT
  html += `
    <div class="mb-2">
      <p class="text-xs font-bold text-indigo-700 mb-2">SOLUTION PHOTO (SHARED)</p>
      <div class="border-2 border-dashed rounded-xl p-3 text-center bg-gray-50 mb-4">
        <input type="file" id="qSolImageFile_${qId}" accept="image/*" data-onchange="upload-image" data-kind="solution" data-qid="${qId}" class="text-sm">
        <img id="qSolImagePreview_${qId}" class="hidden mt-2 h-20 mx-auto rounded" />
      </div>
  `;
  testLanguages.forEach((lang, li) => {
    html += `
      <p class="text-xs font-bold text-indigo-700 uppercase mb-1">Solution Text (${lang})</p>
      <textarea id="qTransSolutionText_${qId}_${li}" class="w-full p-3 border rounded-xl h-20 mb-3 outline-none" placeholder="Solution in ${lang}..."></textarea>
    `;
  });
  html += `</div>`;

  return html;
}

function updateUI(qId) {
  const type = document.getElementById(`qType_${qId}`).value;
  const container = document.getElementById(`dynamicFields_${qId}`);
  if (!container) return;

  if (type === 'integer') {
    container.innerHTML = `
      <div class="p-6 border rounded-xl bg-gray-50 col-span-2">
        <label class="block text-sm font-bold mb-2">Enter Numeric Answer:</label>
        <input type="number" step="any" id="qNumeric_${qId}" class="w-full p-3 border rounded-lg" placeholder="Enter integer or decimal value">
      </div>`;
   } else {
    const inputType = (type === 'multiple') ? 'checkbox' : 'radio';
    const count = getOptionCount(qId);
    let html = '';

    for (let idx = 0; idx < count; idx++) {
      const opt = indexToLetter(idx);
      html += `
        <div class="p-4 border rounded-xl bg-gray-50 relative">
          <div class="flex items-center gap-2 mb-2">
            <input type="${inputType}" name="qOption_${qId}" value="${idx}" class="qCorrect_${qId} w-4 h-4">
            <label class="text-xs font-bold uppercase">Option ${opt}</label>
            ${count > 2 ? `<button type="button" data-action="remove-option" data-qid="${qId}" data-optidx="${idx}" class="ml-auto text-red-400 hover:text-red-600 text-xs">🗑️</button>` : ''}
          </div>
          <input type="text" id="qOptText_${qId}_${idx}" class="w-full p-2 border rounded" placeholder="Text...">
          <input type="file" id="qOptImageFile_${qId}_${idx}" accept="image/*" data-onchange="upload-image" data-kind="option" data-qid="${qId}" data-optidx="${idx}" class="mt-2 text-xs">
          <img id="qOptImagePreview_${qId}_${idx}" class="hidden mt-2 h-16 rounded" />
        </div>`;
    }

    html += `<div class="col-span-1 md:col-span-2">
      <button type="button" data-action="add-option" data-qid="${qId}" class="w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-bold rounded-lg hover:bg-indigo-50">+ Add Option</button>
    </div>`;

    container.innerHTML = html;
  }
  calculateTotalMarks();
}

/* ---------------------------------------------------------
   LIVE TOTAL MARKS CALCULATION (subject ke +marks se)
--------------------------------------------------------- */
function calculateTotalMarks() {
  const questionBlocks = document.querySelectorAll('[id^="question_"]');
  let total = 0;
  const breakdown = [];

  questionBlocks.forEach((block, index) => {
    const qId = block.id.split('_')[1];
    const subjectSelect = document.getElementById(`qSubject_${qId}`);
    if (!subjectSelect) return;

    const subjectName = subjectSelect.value;
    const marks = getMarksForSubject(subjectName);

    total += marks.positiveMarks;

    breakdown.push({
      question: `Q${index + 1}`,
      subject: subjectName,
      positiveMarks: marks.positiveMarks,
      negativeMarks: marks.negativeMarks
    });
  });

  const fullMarksInput = document.getElementById('testFullMarksInput');
  if (fullMarksInput) {
    fullMarksInput.value = total;
  }

  console.log("---- Total Marks Calculation ----");
  console.table(breakdown);
  console.log("Total Marks:", total);

  return total;
}

/* ---------------------------------------------------------
   PAYLOAD BUILDER (Schema ke jaisa shape)
--------------------------------------------------------- */

function buildPayload() {
  const timeStrategy = document.getElementById('timeStrategy').value;
  const visibility = document.getElementById('visibilitySelect').value;

  const payload = {
    title: document.getElementById('testTitleInput').value,
    totalMarks: calculateTotalMarks(),
    timeStrategy: timeStrategy,
    languageMode: testLanguageMode,
    languages: testLanguages,
    showLanguage: testLanguageMode === 'multiple' ? testShowLanguage : 'all'
  };

  if (timeStrategy === 'total') {
    const totalInput = document.getElementById('totalTimeInput');
    payload.duration = totalInput ? Number(totalInput.value) || 0 : 0;
    payload.subjectTime = [];
  } else {
    payload.duration = subjectTimeList.reduce((sum, st) => sum + Number(st.duration || 0), 0);
    payload.subjectTime = subjectTimeList;
  }

  const questions = collectManualQuestions();

  payload.totalQuestions = questions.length;
  payload.questions = questions;
  payload.listingId = contextData.listingId;
  payload.sectionId = contextData.sectionId;
  payload.parentType = contextData.parentType;
  payload.parentId = contextData.parentId;
  payload.visibility = visibility;
  payload.publishAt = visibility === 'scheduled'
      ? document.getElementById('publishAtInput')?.value || null
      : null;

  return payload;
}

function letterToOptionIndex(val) {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return null;

  const cleaned = val.trim().toLowerCase();
  const letterMap = { a: 0, b: 1, c: 2, d: 3 };

  if (cleaned in letterMap) return letterMap[cleaned];

  const asNumber = Number(cleaned);
  return isNaN(asNumber) ? null : asNumber;
}

function normalizeImportedQuestion(q, idx) {
  const subjectName = (q.subject || q.sub || '').trim().toLowerCase();
  const forceSingle = subjectName === 'english';
  const languageMode = forceSingle ? 'single' : (q.languageMode === 'multiple' ? 'multiple' : 'single');
  const base = {
    _id: q._id || undefined,
    order: q.order || q.id || (idx + 1),
    subject: q.subject || q.sub || '',
    type: q.type || 'mcq',
    section: q.section || '',
    topic: q.topic || '',
    subTopic: q.subTopic || '',
    difficulty: q.difficulty || 'Medium',
    languageMode: languageMode,
    correctAnswers: Array.isArray(q.correctAnswers)
      ? q.correctAnswers.map(letterToOptionIndex).filter(v => v !== null)
      : (typeof q.correct === 'number' ? [q.correct] : []),
    numericAnswer: q.numericAnswer ?? null
  };

  if (languageMode === 'multiple') {
    base.questionImage = q.questionImage || q.qImg || null;   // shared
    base.options = (q.options || []).map(opt =>
      typeof opt === 'string' ? { text: '', image: null } : { text: '', image: opt.image || null }
    );
    base.solution = q.solution || { text: '', image: q.solImg || null };
    base.question = '';

    base.translations = (q.translations || []).map(t => ({
      lang: t.lang || 'English',
      question: t.question || '',
      questionImage: t.questionImage || null,
      options: (t.options || []).map(o => ({
        text: typeof o === 'string' ? o : (o?.text || ''),
        image: (typeof o === 'object' && o?.image) || null
      })),
      solution: {
        text: t.solutionText || t.solution?.text || '',
        image: t.solution?.image || null
      }
    }));

  } else {
    base.question = q.question || q.text || '';
    base.questionImage = q.questionImage || q.qImg || null;
    base.options = (q.options || []).map((opt, i) => {
      if (typeof opt === 'string') {
        return { text: opt, image: (q.optImgs && q.optImgs[i]) || null };
      }
      return {
        text: opt.text || '',
        image: opt.image || (q.optImgs && q.optImgs[i]) || null
      };
    });
    base.solution = q.solution || { text: q.sol || '', image: q.solImg || null };
    base.translations = [];
  }

  return base;
}

function collectManualQuestions() {
  const questionBlocks = document.querySelectorAll('[id^="question_"]');
  const questions = [];

  questionBlocks.forEach((block, index) => {
    const qId = block.id.split('_')[1];
    const typeEl = document.getElementById(`qType_${qId}`);
    if (!typeEl) return;

    const type = typeEl.value;
    const subjectName = document.getElementById(`qSubject_${qId}`).value;
    const marks = getMarksForSubject(subjectName);
    const imgStore = imageDataStore[qId] || { question: null, options: [null, null, null, null], solution: null };

    const forceSingle = subjectName.trim().toLowerCase() === 'english';
    const qLanguageMode = forceSingle ? 'single' : testLanguageMode;

    const mongoId = block.dataset.mongoId || null;

    const q = {
      _id: mongoId || undefined,
      order: index + 1,
      subject: subjectName,
      positiveMarks: marks.positiveMarks,
      negativeMarks: marks.negativeMarks,
      type: type,
      section: document.getElementById(`qSection_${qId}`).value,
      topic: document.getElementById(`qTopic_${qId}`).value,
      subTopic: document.getElementById(`qSubTopic_${qId}`).value,
      difficulty: document.getElementById(`qDifficulty_${qId}`).value,
      languageMode: qLanguageMode,
      correctAnswers: [],
      numericAnswer: null
    };

    if (qLanguageMode === 'multiple') {
      q.question = "";
      q.questionImage = imgStore.question;
      q.options = [];
      q.solution = { text: "", image: imgStore.solution };

      if (type !== 'integer') {
        const optCount = getOptionCount(qId);
        for (let idx = 0; idx < optCount; idx++) {
          q.options.push({ text: "", image: imgStore.options[idx] || null });
        }
      }

      // Har language ka sirf TEXT (options object shape me, image shared)
      q.translations = testLanguages.map((lang, li) => {
        const trans = {
          lang: lang,
          question: document.getElementById(`qTransQuestion_${qId}_${li}`)?.value || '',
          questionImage: imgStore.question || null,
          options: [],
          solution: {
            text: document.getElementById(`qTransSolutionText_${qId}_${li}`)?.value || '',
            image: imgStore.solution || null
          }
        };

        if (type !== 'integer') {
          const optCount = getOptionCount(qId);
          for (let oi = 0; oi < optCount; oi++) {
            const optInput = document.getElementById(`qTransOptText_${qId}_${li}_${oi}`);
            trans.options.push({
              text: optInput ? optInput.value : "",
              image: imgStore.options[oi] || null
            });
          }
        }

        return trans;
      });
    } else {
      q.question = document.getElementById(`qText_${qId}`).value;
      q.questionImage = imgStore.question;
      q.options = [];
      q.solution = {
        text: document.getElementById(`qSolution_${qId}`).value,
        image: imgStore.solution
      };
      q.translations = [];

      if (type !== 'integer') {
        const optCount = getOptionCount(qId);
        for (let idx = 0; idx < optCount; idx++) {
          const optInput = document.getElementById(`qOptText_${qId}_${idx}`);
          q.options.push({
            text: optInput ? optInput.value : "",
            image: imgStore.options[idx] || null
          });
        }
      }
    }

    if (type === 'integer') {
      const numInput = document.getElementById(`qNumeric_${qId}`);
      q.numericAnswer = numInput ? Number(numInput.value) : null;
    } else {
      const checked = document.querySelectorAll(`.qCorrect_${qId}:checked`);
      checked.forEach(el => q.correctAnswers.push(Number(el.value)));
    }

    questions.push(q);
  });

  return questions;
}

function renderManualQuestions(questionsArray) {
  document.getElementById('questionsListContainer').innerHTML = '';
  questionCount = 0;

  if (!Array.isArray(questionsArray) || questionsArray.length === 0) {
    addQuestion();
    return;
  }

  questionsArray.forEach(q => {
    const optCount = (q.options && q.options.length >= 2) ? q.options.length : 4;
    addQuestion(q._id, optCount);   
    const qId = questionCount;

    document.getElementById(`qSubject_${qId}`).value = q.subject || '';
    document.getElementById(`qType_${qId}`).value = q.type || 'mcq';
    document.getElementById(`qSection_${qId}`).value = q.section || '';
    document.getElementById(`qTopic_${qId}`).value = q.topic || '';
    document.getElementById(`qSubTopic_${qId}`).value = q.subTopic || '';
    document.getElementById(`qDifficulty_${qId}`).value = q.difficulty || 'Medium';

    // type set hone ke baad body ko sahi mode me render karo
    renderQuestionBody(qId);

    const qMode = q.languageMode || testLanguageMode;
    const store = ensureImageStore(qId);

    // SHARED images (dono mode me top-level se aate hain)
    store.question = q.questionImage || null;
    store.solution = q.solution?.image || null;
    if (store.question) showPreview(`qImagePreview_${qId}`, store.question);
    if (store.solution) showPreview(`qSolImagePreview_${qId}`, store.solution);

    if (q.type !== 'integer') {
      (q.options || []).forEach((opt, idx) => {
        store.options[idx] = opt.image || null;
        if (opt.image) showPreview(`qOptImagePreview_${qId}_${idx}`, opt.image);
      });
    }

    if (qMode === 'multiple' && Array.isArray(q.translations)) {
      q.translations.forEach((t, li) => {
        const qEl = document.getElementById(`qTransQuestion_${qId}_${li}`);
        if (qEl) qEl.value = t.question || '';

        const solEl = document.getElementById(`qTransSolutionText_${qId}_${li}`);
        if (solEl) solEl.value = t.solution?.text || t.solutionText || '';

        if (q.type !== 'integer') {
          (t.options || []).forEach((opt, oi) => {
            const optInput = document.getElementById(`qTransOptText_${qId}_${li}_${oi}`);
            if (optInput) {
              optInput.value = (typeof opt === 'string') ? opt : (opt?.text || '');
            }
          });
        }
      });
    } else {
      const textEl = document.getElementById(`qText_${qId}`);
      if (textEl) textEl.value = q.question || '';

      const solEl = document.getElementById(`qSolution_${qId}`);
      if (solEl) solEl.value = q.solution?.text || '';

      if (q.type !== 'integer') {
        (q.options || []).forEach((opt, idx) => {
          const optInput = document.getElementById(`qOptText_${qId}_${idx}`);
          if (optInput) optInput.value = opt.text || '';
        });
      }
    }

    if (q.type === 'integer') {
      const numInput = document.getElementById(`qNumeric_${qId}`);
      if (numInput) numInput.value = q.numericAnswer ?? '';
    } else {
      (q.correctAnswers || []).forEach(ansIdx => {
        const el = document.querySelector(`.qCorrect_${qId}[value="${ansIdx}"]`);
        if (el) el.checked = true;
      });
    }
  });

  renumberQuestions();
  calculateTotalMarks();
}

/* ---------------------------------------------------------
   JSON DEMO — Single & Multiple language ke liye
--------------------------------------------------------- */
function getDemoQuestionsJson() {
  const defaultSubject = subjectsList[0]?.subject || "Physics";

  if (testLanguageMode === 'multiple') {
    return [
      {
        subject: defaultSubject,
        type: "mcq",
        section: "",
        topic: "Kinematics",
        subTopic: "Uniform Motion",
        difficulty: "Medium",
        languageMode: "multiple",
        questionImage: null,               // SHARED diagram (agar ho to yaha URL)
        options: [
          { text: "", image: null },
          { text: "", image: null },
          { text: "", image: null },
          { text: "", image: null }
        ],
        solution: { text: "", image: null },   // SHARED solution image
        translations: testLanguages.map(lang => ({
          lang: lang,
          question: `Enter question text in ${lang} here...`,
          options: [`Option A (${lang})`, `Option B (${lang})`, `Option C (${lang})`, `Option D (${lang})`],
          solutionText: `Solution text in ${lang}...`
        })),
        correctAnswers: [0],
        numericAnswer: null
      }
    ];
  }

  return [
    {
      subject: defaultSubject,
      type: "mcq",
      section: "",
      topic: "Kinematics",
      subTopic: "Uniform Motion",
      difficulty: "Medium",
      languageMode: "single",
      question: "Enter question here...",
      questionImage: null,
      options: [
        { text: "Option A", image: null },
        { text: "Option B", image: null },
        { text: "Option C", image: null },
        { text: "Option D", image: null }
      ],
      correctAnswers: [0],
      numericAnswer: null,
      solution: { text: "Solution text...", image: null },
      translations: []
    }
  ];
}


function loadDemoIntoEditor() {
    const jsonEditor = document.getElementById('jsonEditor');
    if (!jsonEditor) return;

    const hasContent = jsonEditor.value.trim() && jsonEditor.value.trim() !== '[]';

    if (hasContent) {
        const confirmReplace = confirm(
            `Editor me pehle se content hai. Example format load karne se ye content REPLACE ho jayega.\n\nKya aap ${testLanguageMode === 'multiple' ? 'Multiple' : 'Single'}-language ka example load karna chahte ho?`
        );
        if (!confirmReplace) return;
    }

    jsonEditor.value = JSON.stringify(getDemoQuestionsJson(), null, 2);
    calculateTotalMarksFromJson();
}

function calculateTotalMarksFromJson() {
    const jsonText = document.getElementById('jsonEditor').value;
    let total = 0;

    try {
        const parsed = JSON.parse(jsonText);
        const questionsArray = Array.isArray(parsed) ? parsed : parsed.questions;

        if (Array.isArray(questionsArray)) {
            questionsArray.forEach(q => {
                const marks = getMarksForSubject(q.subject);
                total += marks.positiveMarks;
            });
        }
    } catch (err) {
        // typing ke dauraan JSON invalid ho sakta hai, isliye silently ignore
    }

    const fullMarksInput = document.getElementById('testFullMarksInput');
    if (fullMarksInput) {
        fullMarksInput.value = total;
    }
}

/* ---------------------------------------------------------
   VISIBILITY UI
--------------------------------------------------------- */
function handleVisibilityUI() {
  const visibility = document.getElementById('visibilitySelect').value;
  const container = document.getElementById('scheduleFieldContainer');

  if (visibility === 'scheduled') {
    container.innerHTML = `
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Publish Date & Time</label>
        <input type="datetime-local" id="publishAtInput" class="p-3 border rounded-xl" required>
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

async function loadExistingTest() {
    try {
        const res = await fetch(`/api/test-builder/${contextData.editId}`);
        const result = await res.json();

        if (!result.success) {
            alert("Test load nahi ho paya: " + (result.message || "Unknown error"));
            return;
        }

        const { test, questions } = result.data;

        // Header fields fill karo
        document.getElementById('testTitleInput').value = test.title || '';
        document.getElementById('timeStrategy').value = test.timeStrategy || 'total';
        document.getElementById('visibilitySelect').value = test.visibility || 'private';

        // Language state pehle set karo, questions render hone se pehle
        document.getElementById('languageMode').value = test.languageMode || 'single';
        testLanguageMode = test.languageMode || 'single';
        testLanguages = (test.languages && test.languages.length > 0) ? test.languages : ['English'];
        testShowLanguage = test.showLanguage || 'all';
        handleLanguageUI();

        handleTimeUI();
        handleVisibilityUI();

         if (test.timeStrategy === 'total') {
            testDurationState = test.duration || 0;
            const totalInput = document.getElementById('totalTimeInput');
            if (totalInput) totalInput.value = test.duration || '';
        } else {
             subjectTimeList = test.subjectTime || [];
            renderSubjectTimeList();
          }

        if (test.visibility === 'scheduled' && test.publishAt) {
            const publishInput = document.getElementById('publishAtInput');
            if (publishInput) {
                const d = new Date(test.publishAt);
                const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                publishInput.value = localISO;
            }
        }

        testQuestionsState = questions;
        renderManualQuestions(testQuestionsState);

        document.querySelector('#testBuilderForm button[type="submit"]').innerText = "Update Test";

    } catch (err) {
        console.error("Load existing test error:", err);
        alert("Test load karte waqt error aaya");
    }
}

/* ---------------------------------------------------------
   SCROLL BUTTON
--------------------------------------------------------- */
window.addEventListener('scroll', function () {
    const btn = document.getElementById('scrollTopBtn');
    const icon = document.getElementById('scrollBtnIcon');
    if (!btn || !icon) return;

    const scrolled = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (scrolled > 300) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }

    if (scrolled + window.innerHeight >= maxScroll - 50) {
        icon.setAttribute('data-lucide', 'arrow-up');
    } else {
        icon.setAttribute('data-lucide', 'arrow-down');
    }

    if (window.lucide) {
        lucide.createIcons();
    }
});

function handleScrollBtnClick() {
    const scrolled = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (scrolled + window.innerHeight >= maxScroll - 50) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    }
}

/* ---------------------------------------------------------
   FORM SUBMIT -> API CALL
--------------------------------------------------------- */

document.getElementById('testBuilderForm').addEventListener('submit', async function (e) {
  e.preventDefault();


    if (currentViewMode === 'manual') {
    const questionBlocks = document.querySelectorAll('[id^="question_"]');
    for (const block of questionBlocks) {
      const qId = block.id.split('_')[1];
      const subjectEl = document.getElementById(`qSubject_${qId}`);
      if (subjectEl && !subjectEl.value.trim()) {
        alert(`Question ${qId} me Subject choose karna zaroori hai. Save karne se pehle sabhi questions me subject select karo.`);
        return;
      }
    }
  }

  const visibility = document.getElementById('visibilitySelect').value;
  if (visibility === 'scheduled') {
    const publishAtVal = document.getElementById('publishAtInput')?.value;
    if (!publishAtVal) {
      alert("Schedule ke liye Publish Date & Time zaroor daalo");
      return;
    }
  }

  let payload;

  if (currentViewMode === 'json') {

    const jsonText = document.getElementById('jsonEditor').value;
    let questionsArray;

    try {
      const parsed = JSON.parse(jsonText);
      questionsArray = Array.isArray(parsed) ? parsed : parsed.questions;

      if (!Array.isArray(questionsArray)) {
        alert("JSON ek questions array hona chahiye, jaise: [ {...}, {...} ]");
        return;
      }
    } catch (err) {
      alert("Invalid JSON: " + err.message);
      console.error("JSON parse error:", err);
      return;
    }

    questionsArray = questionsArray.map((q, idx) => normalizeImportedQuestion(q, idx));

    const timeStrategy = document.getElementById('timeStrategy').value;

    payload = {
  title: document.getElementById('testTitleInput').value,
  timeStrategy: timeStrategy,
  languageMode: testLanguageMode,
  languages: testLanguages,
  showLanguage: testLanguageMode === 'multiple' ? testShowLanguage : 'all',
  duration: timeStrategy === 'total'
    ? Number(document.getElementById('totalTimeInput')?.value) || 0
    : 0,
  subjectTime: timeStrategy === 'subject' ? subjectTimeList : [],
  questions: questionsArray,
  totalQuestions: questionsArray.length,
  totalMarks: questionsArray.reduce((sum, q) => sum + getMarksForSubject(q.subject).positiveMarks, 0)
};


    payload.questions = payload.questions.map(q => {
      const marks = getMarksForSubject(q.subject);
      return { ...q, positiveMarks: marks.positiveMarks, negativeMarks: marks.negativeMarks };
    });

  } else {
    payload = buildPayload();
  }

  payload.listingId = contextData.listingId;
  payload.sectionId = contextData.sectionId;
  payload.parentType = contextData.parentType;
  payload.parentId = contextData.parentId;
  payload.visibility = visibility;
  payload.publishAt = visibility === 'scheduled'
      ? document.getElementById('publishAtInput')?.value || null
      : null;

  console.log("Frontend se ja raha payload:", payload);

  try {
    const url = isEditMode
      ? `/api/test-builder/${contextData.editId}`
      : '/api/test-builder';

    const method = isEditMode ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    console.log("Server response:", result);

    if (!result.success) {
        alert("Issue: " + (result.message || "Unknown error"));
    } else {
         window.location.href = contextData.returnUrl;
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
});

/* ===========================================================
   CSP EVENT DELEGATION
   Ye teen listeners poori app ke saare "onclick / onchange /
   oninput" ka kaam karte hain. Naye elements innerHTML se
   banne ke baad bhi kaam karte hain kyunki listener document
   par lagा hai, individual elements par nahi.
=========================================================== */

document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const action = el.dataset.action;

  switch (action) {
    case 'tab':
      renderView(el.dataset.mode);
      break;
    case 'scroll-btn':
      handleScrollBtnClick();
      break;
    case 'add-question':
      addQuestion();
      break;
    case 'load-demo':
      loadDemoIntoEditor();
      break;
    case 'add-subject-time':
      addSubjectTime();
      break;
    case 'edit-subject-time':
      editSubjectTime(Number(el.dataset.index));
      break;
    case 'remove-subject-time':
      removeSubjectTime(Number(el.dataset.index));
      break;
    case 'add-language-tag':
      addLanguageTag();
      break;
    case 'remove-language-tag':
      removeLanguageTag(el.dataset.lang);
      break;
    case 'remove-tag':
      removeTag(el.dataset.subject);
      break;
    case 'remove-question':
      removeQuestion(el.dataset.qid);
      break;
    case 'add-option':
      addOption(el.dataset.qid);
      break;
    case 'remove-option':
      removeOption(el.dataset.qid, Number(el.dataset.optidx));
      break;
  }
});

document.addEventListener('change', function (e) {
  const el = e.target.closest('[data-onchange]');
  if (!el) return;

  const action = el.dataset.onchange;

  switch (action) {
    case 'time-strategy':
      handleTimeUI();
      break;
    case 'language-mode':
      handleLanguageUI();
      break;
    case 'visibility':
      handleVisibilityUI();
      break;
    case 'add-tag':
      addTag();
      break;
    case 'show-language':
      testShowLanguage = el.value;
      break;
      case 'render-question-body': {
  const qId = el.dataset.qid;
  const snap = captureQuestionSnapshot(qId);
  renderQuestionBody(qId);
  applyQuestionSnapshot(qId, snap);
  break;
}
    case 'upload-image':
      uploadAndStore(
        el,
        el.dataset.kind,
        el.dataset.qid,
        el.dataset.optidx !== undefined ? Number(el.dataset.optidx) : undefined
      );
      break;
  }
});

document.addEventListener('input', function (e) {
  const el = e.target.closest('[data-oninput]');
  if (!el) return;

  const action = el.dataset.oninput;

  switch (action) {
    case 'calc-marks-json':
      calculateTotalMarksFromJson();
      break;
    case 'single-language-input':
      testLanguages = [el.value || 'English'];
      break;
  }
});

/* ---------------------------------------------------------
   BFCACHE FIX — Back button se aane par purana cached form
   dikhne ki bajaye fresh data load ho (save ke baad).
   Ye sirf browser back/forward navigation par trigger hota
   hai, baaki sab logic bilkul same rahega.
--------------------------------------------------------- */
window.addEventListener('pageshow', function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});


/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
async function init() {
  await loadSubjects();
  renderView('manual');
  handleLanguageUI();

  if (isEditMode) {
    await loadExistingTest();
  }
}

init();