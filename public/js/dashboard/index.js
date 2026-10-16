const pageDataEl = document.getElementById('dashboardPageData');
const pageData = pageDataEl ? JSON.parse(pageDataEl.textContent) : {};
let currentCreateType = 'folder';
let isEditMode = false;
let editId = null;

function toggleCreateMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('createMenu');
    if (menu) menu.classList.toggle('hidden');
}

document.addEventListener('click', function () {
    const menu = document.getElementById('createMenu');
    if (menu) menu.classList.add('hidden');
});

const modalCopy = {
    folder: { title: 'Create Folder', sub: 'A new folder will be created in this section.', placeholder: 'e.g. Physics' },
    file: { title: 'Create File', sub: 'A new file will be added to this folder.', placeholder: 'e.g. Chapter Notes.pdf' },
    test: { title: 'Create Test', sub: 'A new mock test will be added to this section.', placeholder: 'e.g. Mock Test - 7' }
};

function openCreateModal(type) {
    isEditMode = false;
    editId = null;

    document.getElementById("createNameInput").value = "";
    document.getElementById("createIconInput").value = "";
    document.getElementById("testQuestions").value = "";
    document.getElementById("testMarks").value = "";
    document.getElementById("testMinutes").value = "";

    document.querySelector("#createModalOverlay button[type='submit']").innerText = "Save";

    currentCreateType = type;
    document.getElementById('createMenu').classList.add('hidden');

    const copy = modalCopy[type];
    document.getElementById('createModalTitle').textContent = copy.title;

    document.getElementById('testFieldsWrap').classList.toggle('hidden', type !== 'test');

    document.getElementById('createModalOverlay').classList.remove('hidden');
}

function closeCreateModal() {
    document.getElementById('createModalOverlay').classList.add('hidden');
}

async function submitCreateForm(e) {
    e.preventDefault();

    const payload = {
        type: currentCreateType,
        title: document.getElementById("createNameInput").value,
        icon: document.getElementById("createIconInput").value,
        listingId: pageData.listingId,
        sectionId: pageData.sectionId,
        parentType: pageData.parentType,
        parentId: pageData.parentId,
        currentUrl: window.location.pathname + window.location.search
    };

    if (currentCreateType === 'test') {
        payload.questions = document.getElementById('testQuestions').value;
        payload.marks = document.getElementById('testMarks').value;
        payload.minutes = document.getElementById('testMinutes').value;
    }

   

    try {
        const url = isEditMode
            ? `/api/update-item/${editId}`
            : '/api/create-item';

        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
         
        if (!result.success) {
            showToast("Issue: " + (result.message || "Unknown error"), "error");
        } else {
            window.location.href = payload.currentUrl;
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

async function editItem(type, id) {

    if (type === 'test') {
        const params = new URLSearchParams({
            editId: id,
            listingId: pageData.listingId,
            sectionId: pageData.sectionId,
            parentType: pageData.parentType,
            parentId: pageData.parentId,
            returnUrl: window.location.pathname + window.location.search
        });

        window.location.href = `/test-builder/new?${params.toString()}`;
        return;
    }

    try {

        const res = await fetch(`/api/item/${type}/${id}`);

        const result = await res.json();

        if (!result.success) return;

        const item = result.data;

        currentCreateType = type;
        isEditMode = true;
        editId = id;

        document.getElementById("createModalTitle").innerText = "Edit " + type;

        document.getElementById("createNameInput").value = item.title || "";
        document.getElementById("createIconInput").value = item.icon || "";

        document.getElementById("testFieldsWrap").classList.add("hidden");

        document.querySelector("#createModalOverlay button[type='submit']").innerText = "Update";

        document.getElementById("createModalOverlay").classList.remove("hidden");

    }

    catch (err) {
 

    }

}
async function deleteItem(type, id) {

    const ok = confirm(
        "Delete permanently?"
    );

    if (!ok) return;

    try {

        const response = await fetch(
            `/api/delete-item/${id}`,
            {
                method: "DELETE",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    type
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            location.reload();

        }

    } catch (err) {

        console.error(err);

    }
}

function goToTestBuilder(e) {
    e.preventDefault();

    const params = new URLSearchParams({
        listingId: pageData.listingId,
        sectionId: pageData.sectionId,
        parentType: pageData.parentType,
        parentId: pageData.parentId,
        returnUrl: window.location.pathname + window.location.search
    });

    window.location.href = `/test-builder/new?${params.toString()}`;
}

function goToGeneratePaper(e) {
    e.preventDefault();

    const params = new URLSearchParams({
        listingId: pageData.listingId,
        sectionId: pageData.sectionId,
        parentType: pageData.parentType,
        parentId: pageData.parentId,
        returnUrl: window.location.pathname + window.location.search
    });

    window.location.href = `/generate-paper/new?${params.toString()}`;
}


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


async function openInstructionsModal(testId) {
    try {
        const res = await fetch(`/mock-test/${testId}/instructions`);
        const html = await res.text();

        document.getElementById('instructionsModalContainer').innerHTML = html;
        document.getElementById('mainContent').classList.add('blur-sm');
        document.body.classList.add('overflow-hidden');

        const hiddenLangField = document.getElementById("effectiveTestLanguage");

        selectedTestLanguage = hiddenLangField
            ? hiddenLangField.value
            : "English";

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Instructions load error:", err);
        showToast("Failed to load instructions.", "error");
    }
}


function handleUpcomingClick(btn) {
    const publishAt = new Date(btn.dataset.publishAt);
    const now = new Date();
    const diffMs = publishAt - now;

    if (diffMs <= 0) {
        location.reload();
        return;
    }

    const totalMins = Math.ceil(diffMs / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    let timeLeftText = "";
    if (hrs > 0) timeLeftText += `${hrs} hour(s)  `;
    timeLeftText += `${mins} minute`;

    const formatted = publishAt.toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
    });

    showFlashMessage(`This test has not started yet. It is scheduled to begin on ${formatted}.`);
}

function showFlashMessage(msg) {
    let el = document.getElementById("inlineFlashMsg");
    if (!el) {
        el = document.createElement("div");
        el.id = "inlineFlashMsg";
        el.className = "fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg z-[999] text-sm font-medium";
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = "0"; }, 4000);
}


function closeInstructionsModal() {
    document.getElementById('instructionsModalContainer').innerHTML = '';
    document.getElementById('mainContent').classList.remove('blur-sm');
    document.body.classList.remove('overflow-hidden');
}

function toggleProceedBtn() {
    const btn = document.getElementById('proceedBtn');
    const checked = document.getElementById('agree').checked;
    btn.disabled = !checked;
    btn.classList.toggle('opacity-50', !checked);
    btn.classList.toggle('cursor-not-allowed', !checked);
}

let selectedTestLanguage = 'English';

function handleLanguageSelect(lang) {

    selectedTestLanguage = lang;

    const hidden = document.getElementById("effectiveTestLanguage");

    if (hidden) {
        hidden.value = lang;
    }

}


function toggleLanguageDropdown() {

    document.getElementById("languageMenu").classList.toggle("hidden");

    document.getElementById("languageArrow").classList.toggle("rotate-180");

}

function applyInstructionLang(lang) {
    const root = document.getElementById("modal-instructions");
    if (!root) return;

    let all = {}, htmlLangs = {};
    try {
        all = JSON.parse(root.dataset.i18nAll || "{}");
        htmlLangs = JSON.parse(root.dataset.htmlLangs || "{}");
    } catch (e) { return; }

    const dict = all[lang];
    if (!dict) return;

    root.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key] !== undefined) el.textContent = dict[key];
    });

    root.setAttribute("lang", htmlLangs[lang] || "en");
}

function selectLanguage(lang) {

    let labels = {};
    try {
        labels = JSON.parse(document.getElementById("modal-instructions")?.dataset.langLabels || "{}");
    } catch (e) {}

    document.getElementById("selectedLanguage").innerText = labels[lang] || lang;

    handleLanguageSelect(lang);
    applyInstructionLang(lang);

    document.querySelectorAll("[class*='check-']").forEach(el => {
        el.classList.add("hidden");
    });

    const check = document.querySelector(".check-" + lang);

    if (check) check.classList.remove("hidden");

    document.getElementById("languageMenu").classList.add("hidden");

}

window.addEventListener("click", function (e) {

    const dropdown = document.getElementById("languageDropdown");

    if (dropdown && !dropdown.contains(e.target)) {

        document.getElementById("languageMenu").classList.add("hidden");

        document.getElementById("languageArrow").classList.remove("rotate-180");

    }

});


let __startingTest = false;

async function startTest(testId) {
    if (__startingTest) return;
    __startingTest = true;

    const lang = selectedTestLanguage || 'English';
    const langParam = encodeURIComponent(lang);
    const fromParam = encodeURIComponent(window.location.pathname + window.location.search);
    const btn = document.getElementById('proceedBtn');
    if (btn) {
        btn.dataset.origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = document.getElementById('modal-instructions')?.getAttribute('lang') === 'hi'
            ? 'शुरू हो रहा है...' : 'Starting...';
    }

    try {
        const res = await fetch(`/api/attempt/${testId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang })
        });

        if (res.redirected) {
            window.location.href = res.url;
            return;
        }

        let result = {};
        try { result = await res.json(); } catch (_) {}

        if (result.code === 'ALREADY_SUBMITTED' && result.redirect) {
            window.location.href = result.redirect;
            return;
        }
        if (!res.ok || !result.success) {
            throw new Error(result.message || 'Unable to start the test.');
        }

        window.location.href = `/attempt/${testId}?lang=${langParam}&from=${fromParam}`;
    } catch (err) {
        __startingTest = false;
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.origHtml || 'Proceed'; }
        showToast(err.message || 'Unable to start the test.', 'error');
    }
}

if (window.lucide) {
    lucide.createIcons();
};


// copy & past logic

let copySource = { type: null, id: null };
let copyNav = { level: null, exam: null, slug: null, listingId: null, sectionId: null, parentType: "section", parentId: null, path: [] };

// naya wrapper — pehle language check karega, phir asli copy modal khulega
async function startSingleCopyWithLanguageCheck(type, id) {
    try {
        const res = await fetch(`/api/copy/languages?sourceType=${type}&sourceId=${id}`);
        const data = await res.json();

        if (data.success && data.languages && data.languages.length > 0) {
            openShowLanguageModal(data.languages, null); // mode null hai kyunki single-copy flow hai
            pendingSingleCopySource = { type, id }; // language confirm hone ke baad ye use hoga
        } else {
            openCopyModal(type, id); // koi test/language nahi mili, seedha copy modal
        }
    } catch (err) {
        console.error('Language fetch error:', err);
        openCopyModal(type, id); // error aaye to bhi purana flow chalta rahe
    }
}

let pendingSingleCopySource = null;


function openCopyModal(type, id) {
    copySource = { type, id };
    copyNav = { level: null, exam: null, slug: null, listingId: null, sectionId: null, parentType: "section", parentId: null, path: [] };

    document.getElementById("copySearchInput").value = "";
    document.getElementById("copyModalOverlay").classList.remove("hidden");
    loadExamList();
}

function closeCopyModal() {
    document.getElementById("copyModalOverlay").classList.add("hidden");
}

function renderBreadcrumb() {
    const bc = document.getElementById("copyBreadcrumb");
    const crumbs = [{ label: "All Exams" }, ...copyNav.path];

    bc.innerHTML = crumbs.map((p, i) => `
        <span class="cursor-pointer hover:text-indigo-600 ${i === crumbs.length - 1 ? 'font-semibold text-slate-700' : ''}"
              data-breadcrumb-index="${i - 1}">${p.label}</span>
        ${i < crumbs.length - 1 ? '<span class="text-gray-300">/</span>' : ''}
    `).join("");

    bc.querySelectorAll("[data-breadcrumb-index]").forEach(el => {
        el.addEventListener("click", () => goToBreadcrumb(Number(el.dataset.breadcrumbIndex)));
    });
}

function goToBreadcrumb(index) {
    if (index < 0) { loadExamList(); return; }

    const node = copyNav.path[index];
    copyNav.path = copyNav.path.slice(0, index + 1);

    if (node.type === "exam") loadSeriesList(node.exam);
    else if (node.type === "series") loadSectionList(node.slug, node.listingId);
    else if (node.type === "section") { copyNav.sectionId = node.sectionId; copyNav.parentType = "section"; copyNav.parentId = null; loadFolderList(); }
    else { copyNav.parentType = node.type; copyNav.parentId = node.id; loadFolderList(); }
}

async function loadExamList() {
    copyNav.level = "exam";
    copyNav.path = [];
    renderBreadcrumb();

    const res = await fetch("/api/exams");
    const exams = await res.json();

    renderRows(exams.map(e => ({
        label: e,
        icon: "graduation-cap",
        onOpen: () => navigateExam(e),
        canPaste: false
    })), "No exams found");

    updatePasteFooterBtn();
}

function navigateExam(exam) {
    copyNav.path.push({ label: exam, type: "exam", exam });
    loadSeriesList(exam);
}

async function loadSeriesList(exam) {
    copyNav.level = "series";

    const res = await fetch(`/api/exams/${encodeURIComponent(exam)}/series`);
    const seriesList = await res.json();

    const canPasteRow = copySource.type === "section";

       renderRows(seriesList.map(s => ({
        label: s.title,
        icon: "layers",
        language: s.language || "",
        type: s.type || "Free",   // 👈 NAYA
        onOpen: () => navigateSeries(s.slug, s._id, s.title),
        canPaste: canPasteRow,
        onPaste: () => doPaste(s._id, null, null, null)
    })), "No test series found");

    renderBreadcrumb();
    updatePasteFooterBtn();
}

function navigateSeries(slug, listingId, title) {
    copyNav.slug = slug;
    copyNav.listingId = listingId;
    copyNav.sectionId = null;
    copyNav.parentType = "section";
    copyNav.parentId = null;
    copyNav.path.push({ label: title, type: "series", slug, listingId });
    loadSectionList(slug, listingId);
}

async function loadSectionList(slug, listingId) {
    copyNav.level = "series-inside";
    copyNav.slug = slug;
    copyNav.listingId = listingId;

    const res = await fetch(`/api/series/${slug}/tree`);
    const data = await res.json();

    const canPasteRow = copySource.type !== "section";

    renderRows((data.sections || []).map(s => ({
        label: s.title,
        iconClass: s.icon || "fa-solid fa-folder",
        onOpen: () => navigateSection(s._id, s.title),
        canPaste: canPasteRow,
        onPaste: () => doPaste(listingId, s._id, "section", null)
    })), "No sections found");

    renderBreadcrumb();
    updatePasteFooterBtn();
}

function navigateSection(sectionId, title) {
    copyNav.sectionId = sectionId;
    copyNav.parentType = "section";
    copyNav.parentId = null;
    copyNav.level = "section";
    copyNav.path.push({ label: title, type: "section", sectionId });
    loadFolderList();
}

async function loadFolderList() {
    copyNav.level = "folder";

    const res = await fetch(
        `/api/series/${copyNav.slug}/tree?section=${copyNav.sectionId}&parentType=${copyNav.parentType}&parentId=${copyNav.parentId || ""}`
    );
    const data = await res.json();

    const items = [
        ...(data.folders || []).map(f => ({ ...f, kind: "folder", icon: "folder" })),
        ...(data.files || []).map(f => ({ ...f, kind: "file", icon: "file-text" }))
    ];

    const canPasteRow = copySource.type !== "section";
    const { listingId, sectionId } = copyNav;

    renderRows(items.map(it => ({
        label: it.title,
        icon: it.icon,
        onOpen: () => navigateInside(it.kind, it._id, it.title),
        canPaste: canPasteRow,
        onPaste: () => doPaste(listingId, sectionId, it.kind, it._id)
    })), "This location is empty");

    renderBreadcrumb();
    updatePasteFooterBtn();
}

function navigateInside(kind, id, title) {
    copyNav.parentType = kind;
    copyNav.parentId = id;
    copyNav.path.push({ label: title, type: kind, id });
    loadFolderList();
}

function renderRows(rows, emptyMsg) {
    const list = document.getElementById("copyListArea");

    if (rows.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-400 py-16 text-sm">${emptyMsg}</p>`;
        return;
    }

    list.innerHTML = rows.map((r, i) => `
        <div class="group flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 cursor-pointer">
            <div class="flex items-center gap-3 flex-1 min-w-0" data-open="${i}">
                ${r.iconClass
                    ? `<i class="${r.iconClass} text-indigo-500 w-5 text-center shrink-0"></i>`
                    : `<i data-lucide="${r.icon}" class="w-5 h-5 text-indigo-500 shrink-0"></i>`}
                <div class="min-w-0">
                    <span class="truncate text-sm font-medium text-slate-700 block">${r.label}</span>
                    ${r.language !== undefined ? `
                        <div class="mt-1 flex items-center gap-1.5">
                            ${r.type !== undefined ? `
                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${r.type === 'Paid' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}">${r.type || 'Free'}</span>
                            ` : ''}
                            <span class="text-[10px] ${r.language ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'} px-2 py-0.5 rounded-full font-medium">${r.language || 'No language set'}</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                ${r.canPaste ? `<button data-paste="${i}" class="text-indigo-600 text-xs font-bold px-2 py-1 hover:bg-indigo-100 rounded-lg">Paste</button>` : ""}
                <button data-open="${i}" class="text-gray-400 hover:text-indigo-600">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join("");

    list.querySelectorAll("[data-open]").forEach(el => {
        el.addEventListener("click", () => rows[el.dataset.open].onOpen());
    });
    list.querySelectorAll("[data-paste]").forEach(el => {
        el.addEventListener("click", (e) => {
            e.stopPropagation();
            rows[el.dataset.paste].onPaste();
        });
    });

    if (window.lucide) lucide.createIcons();
}

function updatePasteFooterBtn() {
    const btn = document.getElementById("pasteHereBtn");
    let enabled = false;

    if (copySource.type === "section") {
        enabled = copyNav.level === "series-inside" && !!copyNav.listingId;
        if (enabled) {
            const currentSeriesTitle = copyNav.path[copyNav.path.length - 1]?.label || "this series";
            btn.textContent = `Paste in "${currentSeriesTitle}"`;
        }
    } else {
        enabled = (copyNav.level === "section" || copyNav.level === "folder") && !!copyNav.sectionId;
        if (enabled) btn.textContent = "Paste Here";
    }

    btn.disabled = !enabled;
    btn.onclick = () => doPaste(copyNav.listingId, copyNav.sectionId, copyNav.parentType, copyNav.parentId);
}


async function doPaste(destListingId, destSectionId, destParentType, destParentId) {

    // 👇 NAYA — agar mixed bulk items pending hain, to unhe is destination pe bulk-copy karo
    if (pendingMixedBulkItems) {
        const res = await fetch("/api/bulk-copy-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: pendingMixedBulkItems,
                destListingIds: [destListingId],
                destSectionId,
                destParentType: destParentType || "section",
                destParentId: destParentId || null,
                selectedLanguage: selectedShowLanguage || null
            })
        });

        const result = await res.json();

        if (result.success) {
            let message = `${result.copied} copy operations successful` + (result.failed ? `, ${result.failed} failed` : '');

            if (result.fallbacks && result.fallbacks.length > 0) {
                const fallbackDetails = result.fallbacks
                    .map(f => `• ${f.path} (the selected language "${f.requestedLanguage}" was not available in this test, so it was set to "All")`)
                    .join('\n');
                message += `\n\nNote: ${result.fallbacks.length} test(s) me language "All" par set ho gayi:\n${fallbackDetails}`;
            }

            showToast(message, "error");
            pendingMixedBulkItems = null;
            closeCopyModal();

            if (destParentType === 'folder') {
                window.location.href = `/folder/${destParentId}`;
            } else if (destParentType === 'file') {
                window.location.href = `/file/${destParentId}`;
            } else if (destSectionId) {
                window.location.href = `/series/${copyNav.slug}?section=${destSectionId}`;
            } else {
                window.location.href = `/series/${copyNav.slug}`;
            }
        } else {
            showToast("Copy failed: " + (result.message || "Unknown error"), "error");
        }
        return; // 👈 mixed flow yahin khatam, neeche wala single-item code na chale
    }

    // ---- purana single-item copy flow (unchanged) ----
    const body = {
        sourceType: copySource.type,
        sourceId: copySource.id,
        destListingId,
        selectedLanguage: selectedShowLanguage || null
    };

    if (copySource.type !== "section") {
        body.destSectionId = destSectionId;
        body.destParentType = destParentType || "section";
        body.destParentId = destParentId || null;
    }

    const res = await fetch("/api/paste-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const result = await res.json();

    if (result.success) {
        showToast("Copied successfully!", "success");
        closeCopyModal();

        if (destParentType === 'folder') {
            window.location.href = `/folder/${destParentId}`;
        } else if (destParentType === 'file') {
            window.location.href = `/file/${destParentId}`;
        } else if (destSectionId) {
            window.location.href = `/series/${copyNav.slug}?section=${destSectionId}`;
        } else {
            window.location.href = `/series/${copyNav.slug}`;
        }
    } else {
        showToast("Copy failed: " + (result.message || "Unknown error"), "error");
    }
}

let copySearchTimer;
function handleCopySearch(keyword) {
    clearTimeout(copySearchTimer);
    keyword = keyword.trim();
    if (!keyword) { loadExamList(); return; }

    copySearchTimer = setTimeout(async () => {
        const res = await fetch(`/api/search-tests?keyword=${encodeURIComponent(keyword)}`);
        const results = await res.json();

        renderRows(results.map(s => ({
            label: `${s.title} (${s.exam})`,
            icon: "layers",
            language: s.language || "",
            type: s.type || "Free",   // 👈 NAYA
            onOpen: () => {
                copyNav.path = [{ label: s.exam, type: "exam", exam: s.exam }];
                navigateSeries(s.slug, s._id, s.title);
            },
            canPaste: copySource.type === "section",
            onPaste: () => doPaste(s._id, null, null, null)
        })), "No results found");
    }, 300);
}


// --- Dashboard analytics charts: 100% driven by dashboardStats / performanceGrowth (no hardcoded numbers) ---
const perfData = pageData.performanceGrowth || [];
const dashStats = pageData.dashboardStats || {};

if (perfData.length > 0) {
    const userScore = (dashStats.avgScore !== undefined && dashStats.avgScore !== null) ? dashStats.avgScore : 0;
    const userRankRaw = (dashStats.avgRank && dashStats.avgRank !== "--") ? dashStats.avgRank : null;
    const userRank = userRankRaw !== null ? Number(userRankRaw) : null;

    const rankCurveRaw = (dashStats.rankPredictorData || [])
        .slice()
        .sort((a, b) => a.marks - b.marks);

 

 

    if (document.getElementById('rankProgressChart')) {
        const rankPoints = perfData
            .filter(p => p.rank !== undefined && p.rank !== null && p.rank !== '--' && !isNaN(Number(p.rank)));

        if (rankPoints.length > 0) {
            const ctxProgress = document.getElementById('rankProgressChart').getContext('2d');
            new Chart(ctxProgress, {
                type: 'line',
                data: {
                    labels: rankPoints.map(p => new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })),
                    datasets: [{
                        label: 'Rank',
                        data: rankPoints.map(p => Number(p.rank)),
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.08)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#059669'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { reverse: true, title: { display: true, text: 'Rank' }, ticks: { precision: 0 } }
                    }
                }
            });
        }
    }
}

const performanceData = pageData.performanceGrowth || [];

if (performanceData.length > 0 && document.getElementById('performanceGrowthChart')) {
    const ctx = document.getElementById('performanceGrowthChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: performanceData.map(p => new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })),
            datasets: [{
                label: 'Score',
                data: performanceData.map(p => p.score),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.08)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#4f46e5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}


/* ====================== PREMIUM PDF EXPORT (All Tests + Section wise) ====================== */

const userNameForPdf = pageData.userName;

/* ---------- chhote helpers ---------- */
function hexToRgb(hex) {
    const h = String(hex || "#64748B").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function pdfFormatTime(sec) {
    const s = Number(sec);
    if (sec === null || sec === undefined || sec === "" || sec === "--" || !isFinite(s)) return "--";
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

function pdfNum(v) {
    const n = Number(v);
    return isFinite(n) ? String(Math.round(n * 100) / 100) : String(v ?? "--");
}

function pdfDate(d) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function pdfDateTime(d) {
    const date = pdfDate(d);
    const time = new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${date}, ${time}`;
}

function pdfFileSlug(text) {
    return String(text || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
}

function pdfFitText(doc, text, maxWidth) {
    let t = String(text ?? "");
    if (doc.getTextWidth(t) <= maxWidth) return t;
    while (t.length > 1 && doc.getTextWidth(t + "...") > maxWidth) t = t.slice(0, -1);
    return t + "...";
}

// Website ka logo (SVG/PNG) ko PNG data-url me badalta hai — fail ho to null (tab vector fallback chalega)
function pdfLoadLogo(src) {
    return new Promise(resolve => {
        try {
            const img = new Image();
            img.onload = () => {
                try {
                    const scale = 4;
                    const w = (img.naturalWidth || 256), h = (img.naturalHeight || 256);
                    const canvas = document.createElement("canvas");
                    canvas.width = w * scale; canvas.height = h * scale;
                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve({ dataUrl: canvas.toDataURL("image/png"), w, h });
                } catch (e) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        } catch (e) { resolve(null); }
    });
}

const PDF = {
    ink: [15, 23, 42],
    navy: [30, 27, 75],
    brand: [59, 79, 228],
    indigo: [79, 70, 229],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    zebra: [248, 250, 252],
    head: [49, 46, 129],
    green: [5, 150, 105],
    red: [225, 29, 72],
    blue: [37, 99, 235],
    amber: [217, 119, 6]
};

/* ---------- vector icons (koi image file nahi chahiye) ---------- */
function icoDoc(doc, x, y, s, rgb) {
    doc.setFillColor(...rgb);
    doc.lines([[0.44 * s, 0], [0.2 * s, 0.2 * s], [0, 0.6 * s], [-0.64 * s, 0], [0, -0.8 * s]], x + 0.18 * s, y + 0.1 * s, [1, 1], "F", true);
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3);
    [0.45, 0.6, 0.75].forEach(f => doc.line(x + 0.3 * s, y + f * s, x + 0.68 * s, y + f * s));
}
function icoUser(doc, x, y, s, rgb) {
    doc.setDrawColor(...rgb); doc.setLineWidth(0.5);
    doc.circle(x + 0.5 * s, y + 0.32 * s, 0.17 * s, "S");
    doc.lines([[0, -0.18 * s, 0.12 * s, -0.32 * s, 0.32 * s, -0.32 * s], [0.2 * s, 0, 0.32 * s, 0.14 * s, 0.32 * s, 0.32 * s]], x + 0.18 * s, y + 0.9 * s, [1, 1], "S", false);
}
function icoCalendar(doc, x, y, s, rgb) {
    doc.setDrawColor(...rgb); doc.setLineWidth(0.5);
    doc.roundedRect(x + 0.14 * s, y + 0.2 * s, 0.72 * s, 0.66 * s, 0.08 * s, 0.08 * s, "S");
    doc.line(x + 0.14 * s, y + 0.4 * s, x + 0.86 * s, y + 0.4 * s);
    doc.line(x + 0.34 * s, y + 0.1 * s, x + 0.34 * s, y + 0.28 * s);
    doc.line(x + 0.66 * s, y + 0.1 * s, x + 0.66 * s, y + 0.28 * s);
}
function icoShield(doc, x, y, s, rgb) {
    doc.setFillColor(...rgb);
    doc.lines([[0.36 * s, 0.14 * s], [0, 0.38 * s, -0.16 * s, 0.56 * s, -0.36 * s, 0.7 * s], [-0.2 * s, -0.14 * s, -0.36 * s, -0.32 * s, -0.36 * s, -0.7 * s], [0.36 * s, -0.14 * s]], x + 0.5 * s, y + 0.08 * s, [1, 1], "F", true);
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
    doc.lines([[0.13 * s, 0.13 * s], [0.22 * s, -0.25 * s]], x + 0.33 * s, y + 0.5 * s, [1, 1], "S", false);
}
function icoTrophy(doc, x, y, s, rgb) {
    doc.setFillColor(...rgb); doc.setDrawColor(...rgb); doc.setLineWidth(0.45);
    doc.lines([[0.44 * s, 0], [-0.08 * s, 0.32 * s], [-0.28 * s, 0]], x + 0.28 * s, y + 0.2 * s, [1, 1], "F", true);
    doc.rect(x + 0.46 * s, y + 0.5 * s, 0.08 * s, 0.2 * s, "F");
    doc.rect(x + 0.32 * s, y + 0.7 * s, 0.36 * s, 0.08 * s, "F");
    doc.circle(x + 0.23 * s, y + 0.3 * s, 0.08 * s, "S");
    doc.circle(x + 0.77 * s, y + 0.3 * s, 0.08 * s, "S");
}
function icoBars(doc, x, y, s, rgb) {
    doc.setFillColor(...rgb);
    doc.rect(x + 0.2 * s, y + 0.55 * s, 0.16 * s, 0.3 * s, "F");
    doc.rect(x + 0.42 * s, y + 0.35 * s, 0.16 * s, 0.5 * s, "F");
    doc.rect(x + 0.64 * s, y + 0.15 * s, 0.16 * s, 0.7 * s, "F");
}
function icoTarget(doc, x, y, s, rgb) {
    doc.setDrawColor(...rgb); doc.setFillColor(...rgb); doc.setLineWidth(0.5);
    doc.circle(x + 0.5 * s, y + 0.5 * s, 0.38 * s, "S");
    doc.circle(x + 0.5 * s, y + 0.5 * s, 0.22 * s, "S");
    doc.circle(x + 0.5 * s, y + 0.5 * s, 0.08 * s, "F");
}
function icoCrown(doc, x, y, s, rgb) {
    doc.setFillColor(...rgb);
    doc.lines([[0, -0.45 * s], [0.2 * s, 0.2 * s], [0.15 * s, -0.3 * s], [0.15 * s, 0.3 * s], [0.2 * s, -0.2 * s], [0, 0.45 * s]], x + 0.15 * s, y + 0.75 * s, [1, 1], "F", true);
    doc.rect(x + 0.15 * s, y + 0.78 * s, 0.7 * s, 0.08 * s, "F");
}

/* ---------- logo (image mile to image, warna vector "WE") ---------- */
function drawLogo(doc, logo, x, y, size) {
    if (logo && logo.dataUrl) {
        const ratio = logo.w / logo.h;
        let w = size, h = size;
        if (ratio > 1) h = size / ratio; else w = size * ratio;
        doc.addImage(logo.dataUrl, "PNG", x + (size - w) / 2, y + (size - h) / 2, w, h);
        return;
    }
    doc.setFillColor(...PDF.brand);
    doc.roundedRect(x, y, size, size, size * 0.25, size * 0.25, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size * 1.15);
    doc.setTextColor(255, 255, 255);
    doc.text("WE", x + size / 2, y + size * 0.66, { align: "center" });
}

/* ---------- gradient / decoration ---------- */
function drawHeaderBackground(doc, W, height) {
    const top = [232, 236, 255], bottom = [255, 255, 255];
    const steps = 60, h = height / steps;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        doc.setFillColor(
            Math.round(top[0] + (bottom[0] - top[0]) * t),
            Math.round(top[1] + (bottom[1] - top[1]) * t),
            Math.round(top[2] + (bottom[2] - top[2]) * t)
        );
        doc.rect(0, i * h, W, h + 0.3, "F");
    }
    // soft blobs
    try {
        doc.setGState(new doc.GState({ opacity: 0.45 }));
        doc.setFillColor(214, 221, 255);
        doc.circle(W - 22, 4, 30, "F");
        doc.circle(W - 70, 26, 14, "F");
        doc.setFillColor(222, 228, 255);
        doc.circle(60, -2, 22, "F");
        doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) { /* GState na ho to blobs skip */ }
    // dotted grid (upar-beech)
    doc.setFillColor(165, 175, 235);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) doc.circle(150 + c * 3.2, 7 + r * 3.2, 0.32, "F");
}

/* ---------- main builder ---------- */
function buildAttemptsPdf(jsPDF, result, userName, logo) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;
    const data = result.data;
    const listingTitle = result.listingTitle || "Test Series";
    const isSection = !!result.sectionTitle;
    const scopeLabel = isSection ? result.sectionTitle : "All Tests";
    const now = new Date();

    /* ===== 1. Brand header ===== */
    drawHeaderBackground(doc, W, 44);
    drawLogo(doc, logo, M, 8, 17);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF.brand);
    doc.text("WarmupExam", M + 21, 16.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF.muted);
    doc.text("India's Smartest Mock Test Platform", M + 21, 22);

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(12.5);
    doc.setTextColor(...PDF.brand);
    doc.text("Prepare Smarter.", W - M, 14, { align: "right" });
    doc.text("Perform Better.", W - M, 21, { align: "right" });

    /* ===== 2. Title block ===== */
    doc.setFillColor(224, 231, 255);
    doc.roundedRect(M, 31, 14, 14, 3, 3, "F");
    icoDoc(doc, M + 2.5, 33.5, 9, PDF.indigo);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.setTextColor(...PDF.navy);
    doc.text("Complete Mock Test Series Report", M + 19, 38.5);

    doc.setFontSize(10.5);
    doc.setTextColor(...PDF.indigo);
    const lt = pdfFitText(doc, listingTitle, 110);
    doc.text(lt, M + 19, 44.5);
    const ltW = doc.getTextWidth(lt);
    doc.setTextColor(148, 163, 184);
    doc.text("|", M + 19 + ltW + 3, 44.5);
    doc.setTextColor(30, 41, 59);
    doc.text(pdfFitText(doc, scopeLabel, 90), M + 19 + ltW + 7, 44.5);

    // right info card
    const cardX = W - M - 90, cardY = 29;
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(221, 227, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, 90, 19, 3, 3, "FD");
    icoShield(doc, cardX + 4, cardY + 3.5, 11, PDF.indigo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...PDF.navy);
    doc.text("Your Performance Report", cardX + 19, cardY + 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text("This report contains your test history,", cardX + 19, cardY + 12);
    doc.text("analysis and performance insights.", cardX + 19, cardY + 15.6);

    /* ===== 3. Info row (student / generated / date range) ===== */
    const dates = data.map(r => new Date(r.date).getTime()).filter(n => isFinite(n));
    const rangeText = dates.length
        ? `${pdfDate(Math.min(...dates))}  -  ${pdfDate(Math.max(...dates))}`
        : "--";
    const infoY = 58;
    const colW = (W - M * 2) / 3;
    const infos = [
        { icon: icoUser, label: "Student Name", value: userName || "Student" },
        { icon: icoCalendar, label: "Report Generated On", value: pdfDateTime(now) },
        { icon: icoCalendar, label: "Date Range", value: rangeText }
    ];
    infos.forEach((it, i) => {
        const x = M + i * colW;
        it.icon(doc, x, infoY - 2, 8, PDF.navy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(...PDF.muted);
        doc.text(it.label, x + 11, infoY + 1.2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.2);
        doc.setTextColor(...PDF.navy);
        doc.text(pdfFitText(doc, it.value, colW - 18), x + 11, infoY + 6.6);
        if (i > 0) {
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(x - 4, infoY - 2, x - 4, infoY + 9);
        }
    });

    let cursorY = infoY + 15;

    /* ===== 4. Summary cards (sirf Section PDF me) ===== */
    if (isSection && data.length) {
        const attempts = data.length;
        const sumScore = data.reduce((s, r) => s + (Number(r.score) || 0), 0);
        const sumMax = data.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);
        const avgScore = sumScore / attempts;
        const avgMax = sumMax / attempts;
        const avgPct = avgMax > 0 ? (avgScore / avgMax) * 100 : 0;
        const totCorrect = data.reduce((s, r) => s + (Number(r.correct) || 0), 0);
        const totAttempted = data.reduce((s, r) => s + (Number(r.attempted) || 0), 0);
        const accuracy = totAttempted > 0 ? (totCorrect / totAttempted) * 100 : 0;

        let best = null;
        data.forEach(r => {
            const mx = Number(r.maxMarks) || 0;
            const p = mx > 0 ? Number(r.score) / mx : -Infinity;
            if (!best || p > best.p) best = { p, r };
        });

        const cards = [];
        cards.push({ icon: icoDoc, bg: [224, 231, 255], fg: PDF.indigo, label: "Total Tests Attempted", main: String(attempts), tail: "", sub: "Across selected section" });
        if (result.rankEnabled && best) {
            cards.push({
                icon: icoTrophy, bg: [209, 250, 229], fg: PDF.green, label: "Best Score",
                main: pdfNum(best.r.score), tail: ` / ${pdfNum(best.r.maxMarks)}`,
                sub: `(${(best.p * 100).toFixed(2)}%)`
            });
        }
        cards.push({
            icon: icoBars, bg: [219, 234, 254], fg: PDF.blue, label: "Average Score",
            main: pdfNum(avgScore), tail: ` / ${pdfNum(avgMax)}`, sub: `(${avgPct.toFixed(2)}%)`
        });
        cards.push({
            icon: icoTarget, bg: [254, 226, 226], fg: PDF.red, label: "Average Accuracy",
            main: `${pdfNum(accuracy)}%`, tail: "", sub: `${totCorrect} correct of ${totAttempted} attempted`
        });
        if (result.rankEnabled && result.bestRank) {
            cards.push({
                icon: icoCrown, bg: [254, 243, 199], fg: PDF.amber, label: "Best Rank",
                main: `AIR ${result.bestRank}`, tail: "", sub: "Predicted all-India rank"
            });
        }

        const gap = 4.5;
        const cw = (W - M * 2 - gap * (cards.length - 1)) / cards.length;
        const ch = 25;
        cards.forEach((c, i) => {
            const x = M + i * (cw + gap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(224, 231, 255);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, cursorY, cw, ch, 3, 3, "FD");
            doc.setFillColor(...c.bg);
            doc.circle(x + 10.5, cursorY + ch / 2, 6.2, "F");
            c.icon(doc, x + 10.5 - 3.6, cursorY + ch / 2 - 3.6, 7.2, c.fg);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.4);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.label, cw - 24), x + 20, cursorY + 8);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(...PDF.navy);
            doc.text(c.main, x + 20, cursorY + 15.8);
            if (c.tail) {
                const mw = doc.getTextWidth(c.main);
                doc.setFontSize(9);
                doc.setTextColor(...PDF.muted);
                doc.text(c.tail, x + 20 + mw, cursorY + 15.8);
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.sub, cw - 24), x + 20, cursorY + 20.6);
        });
        cursorY += ch + 7;
    }

    /* ===== 5. Scope chip + count ===== */
    const seen = new Map();
    data.forEach(r => { if (!seen.has(r.category)) seen.set(r.category, r.color); });
    const scopeColor = isSection ? ([...seen.values()][0] || {}) : { main: "#4F46E5", soft: "#E0E7FF", text: "#4338CA" };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    const chipLabel = pdfFitText(doc, scopeLabel.toUpperCase(), 90);
    const chipW = doc.getTextWidth(chipLabel) + 13;
    doc.setFillColor(...hexToRgb(scopeColor.soft));
    doc.roundedRect(M, cursorY, chipW, 7, 3.5, 3.5, "F");
    doc.setFillColor(...hexToRgb(scopeColor.main));
    doc.circle(M + 4.2, cursorY + 3.5, 1.1, "F");
    doc.setTextColor(...hexToRgb(scopeColor.text));
    doc.text(chipLabel, M + 7.4, cursorY + 4.7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF.muted);
    doc.text(`${data.length} ${data.length === 1 ? "attempt" : "attempts"}`, W - M, cursorY + 4.7, { align: "right" });
    cursorY += 11;

    /* ===== 6. Table ===== */
    const rows = data.map((r, i) => [
        i + 1, r.testName, "", pdfDate(r.date), r.attempted, r.correct, r.wrong,
        pdfNum(r.maxMarks), pdfNum(r.score), (r.rank === "" || r.rank == null) ? "--" : r.rank,
        `${r.accuracy}%`, pdfFormatTime(r.time)
    ]);

    // Test Name column ki fixed width = baaki 11 columns (154 mm) ke baad bacha hua
    const NAME_W = CW - 154;

    doc.autoTable({
        startY: cursorY,
        margin: { top: 22, left: M, right: M, bottom: 16 },
        head: [["#", "TEST NAME", "CATEGORY", "DATE", "ATT.", "CORR.", "WRONG", "MAX", "SCORE", "RANK", "ACC.", "TIME"]],
        body: rows,
        theme: "plain",
        rowPageBreak: "avoid",
        styles: {
            font: "helvetica", fontSize: 8, textColor: PDF.ink, valign: "middle",
            cellPadding: { top: 3.4, bottom: 3.4, left: 3, right: 3 },
            lineColor: PDF.line, lineWidth: { top: 0, right: 0, left: 0, bottom: 0.2 }
        },
        headStyles: {
            fillColor: PDF.head, textColor: 255, fontStyle: "bold", fontSize: 7, lineWidth: 0,
            cellPadding: { top: 3.6, bottom: 3.6, left: 3, right: 3 }
        },
        alternateRowStyles: { fillColor: PDF.zebra },
        columnStyles: {
            0: { cellWidth: 11, halign: "center", textColor: PDF.muted },
            1: { cellWidth: NAME_W, fontStyle: "bold" },
            2: { cellWidth: 48 },
            3: { cellWidth: 24, textColor: PDF.muted },
            4: { cellWidth: 13, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            6: { cellWidth: 16, halign: "center", fontStyle: "bold" },
            7: { cellWidth: 14, halign: "center", textColor: PDF.muted },
            8: { cellWidth: 18, halign: "center", fontStyle: "bold" },
            9: { cellWidth: 20, halign: "center", fontStyle: "bold" },
            10: { cellWidth: 15, halign: "center", fontStyle: "bold" },
            11: { cellWidth: 21, halign: "center", textColor: PDF.muted }
        },
                didParseCell: function (d) {
            if (d.section === "head") {
                if ([0, 4, 5, 6, 7, 8, 9, 10, 11].includes(d.column.index)) d.cell.styles.halign = "center";
                return;
            }
            if (d.row.index < 0 || !data[d.row.index]) return;
            const row = data[d.row.index];
            const col = d.column.index;
            if (col === 1) {
                // Recent Activity jaisa path (folder / file) test name ke neeche — max 2 line
                const pathText = (row.locationPath || []).join(" \u2022 ");
                if (pathText) {
                    const maxW = NAME_W - 3.2;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(5.8);
                    let lines = doc.splitTextToSize(pathText, maxW);
                    if (lines.length > 2) {
                        let l2 = lines[1];
                        while (l2.length > 1 && doc.getTextWidth(l2 + "...") > maxW) l2 = l2.slice(0, -1);
                        lines = [lines[0], l2 + "..."];
                    }
                    row._pathLines = lines;
                    d.cell.styles.valign = "top";
                    d.cell.styles.cellPadding = { top: 2.6, bottom: 2.2 + lines.length * 2.4 + 0.6, left: 1.6, right: 1.6 };
                }
            }
            if (col === 5) d.cell.styles.textColor = PDF.green;
            else if (col === 6) d.cell.styles.textColor = PDF.red;
            else if (col === 8) d.cell.styles.textColor = Number(row.score) >= 0 ? PDF.green : PDF.red;
            else if (col === 9) d.cell.styles.textColor = PDF.blue;
            else if (col === 10) {
                const a = Number(row.accuracy) || 0;
                d.cell.styles.textColor = a >= 70 ? PDF.green : (a >= 40 ? PDF.amber : PDF.red);
            }
        },
        didDrawCell: function (d) {
            // autotable repeat-header row ko section "body" aur index -1 deta hai — skip
            if (d.section !== "body" || d.row.index < 0 || !data[d.row.index]) return;
            const row = data[d.row.index];
            const color = row.color || {};

            if (d.column.index === 0) {
                doc.setFillColor(...hexToRgb(color.main));
                doc.rect(d.cell.x, d.cell.y, 1.5, d.cell.height - 0.2, "F");
            }
            if (d.column.index === 2) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                const label = pdfFitText(doc, String(row.category).toUpperCase(), d.cell.width - 6 - 8);
                const w = doc.getTextWidth(label) + 10;
                const h = 5.6;
                const x = d.cell.x + 3;
                const y = d.cell.y + (d.cell.height - h) / 2;
                doc.setFillColor(...hexToRgb(color.soft));
                doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
                doc.setFillColor(...hexToRgb(color.main));
                doc.circle(x + 3.4, y + h / 2, 0.95, "F");
                doc.setTextColor(...hexToRgb(color.text));
                doc.text(label, x + 6, y + h / 2 + 0.9);
            }
        }
    });

    /* ===== 7. Category legend (table ke neeche) ===== */
    let ly = (doc.lastAutoTable ? doc.lastAutoTable.finalY : cursorY) + 9;
    if (ly > H - 26) { doc.addPage(); ly = 30; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text("CATEGORY LEGEND", M, ly);
    let lx = M + doc.getTextWidth("CATEGORY LEGEND") + 6;
    seen.forEach((color, category) => {
        const label = pdfFitText(doc, String(category).toUpperCase(), 60);
        const w = doc.getTextWidth(label) + 11;
        if (lx + w > W - M) { lx = M; ly += 8; }
        doc.setFillColor(...hexToRgb(color?.soft));
        doc.roundedRect(lx, ly - 4.2, w, 6, 3, 3, "F");
        doc.setFillColor(...hexToRgb(color?.main));
        doc.circle(lx + 3.6, ly - 1.2, 1, "F");
        doc.setTextColor(...hexToRgb(color?.text));
        doc.text(label, lx + 6.4, ly);
        lx += w + 3;
    });

    /* ===== 8. Har page: running header (page 2+) + footer ===== */
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        if (p > 1) {
            drawLogo(doc, logo, M, 5, 8);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...PDF.brand);
            doc.text("WarmupExam", M + 11, 10.6);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.6);
            doc.setTextColor(...PDF.muted);
            doc.text(`Complete Mock Test Series Report  |  ${pdfFitText(doc, listingTitle, 80)}  |  ${scopeLabel}`, W - M, 10, { align: "right" });
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(M, 15, W - M, 15);
        }
        doc.setDrawColor(...PDF.line);
        doc.setLineWidth(0.3);
        doc.line(M, H - 11, W - M, H - 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.4);
        doc.setTextColor(...PDF.muted);
        doc.text("WarmupExam  |  India's Smartest Mock Test Platform", M, H - 6);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: "right" });
    }
    return doc;
}

/* ---------- gradient / decoration ---------- */
function drawHeaderBackground(doc, W, height) {
    const top = [232, 236, 255], bottom = [255, 255, 255];
    const steps = 60, h = height / steps;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        doc.setFillColor(
            Math.round(top[0] + (bottom[0] - top[0]) * t),
            Math.round(top[1] + (bottom[1] - top[1]) * t),
            Math.round(top[2] + (bottom[2] - top[2]) * t)
        );
        doc.rect(0, i * h, W, h + 0.3, "F");
    }
    // soft blobs
    try {
        doc.setGState(new doc.GState({ opacity: 0.45 }));
        doc.setFillColor(214, 221, 255);
        doc.circle(W - 16, 3, 26, "F");
        doc.circle(W - 58, 24, 11, "F");
        doc.setFillColor(222, 228, 255);
        doc.circle(48, -2, 18, "F");
        doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) { /* GState na ho to blobs skip */ }
    // dotted grid (upar-beech)
    doc.setFillColor(165, 175, 235);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) doc.circle(W / 2 - 14 + c * 3, 6 + r * 3, 0.3, "F");
}

// Text ko width me fit karne ke liye font size ghatata hai (min tak), phir bhi na aaye to ... laga deta hai
function pdfFitFont(doc, text, maxW, maxSize, minSize) {
    let size = maxSize;
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxW) {
        size -= 0.5;
        doc.setFontSize(size);
    }
    return pdfFitText(doc, text, maxW);
}

/* ---------- main builder (A4 portrait: 210 x 297 mm) ---------- */
function buildAttemptsPdf(jsPDF, result, userName, logo) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();     // 210
    const H = doc.internal.pageSize.getHeight();    // 297
    const M = 10;
    const CW = W - M * 2;                           // content width = 190
    const data = result.data;
    const listingTitle = result.listingTitle || "Test Series";   // listing ka naam  -> main title
    const examName = result.examName || "";                      // listing ka exam  -> subtitle
    const isSection = !!result.sectionTitle;
    const scopeLabel = isSection ? result.sectionTitle : "All Tests";
    const now = new Date();

    /* ===== 1. Brand header ===== */
    drawHeaderBackground(doc, W, 38);
    drawLogo(doc, logo, M, 7, 15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PDF.brand);
    doc.text("WarmupExam", M + 19, 14.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text("India's Smartest Mock Test Platform", M + 19, 19.5);

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF.brand);
    doc.text("Prepare Smarter.", W - M, 12.5, { align: "right" });
    doc.text("Perform Better.", W - M, 18.5, { align: "right" });

    /* ===== 2. Title block: listing naam + exam naam ===== */
    doc.setFillColor(224, 231, 255);
    doc.roundedRect(M, 27, 13, 13, 3, 3, "F");
    icoDoc(doc, M + 2.2, 29.2, 8.6, PDF.indigo);

    const cardW = 62;
    const titleMaxW = CW - 17 - cardW - 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF.navy);
    const titleText = pdfFitFont(doc, listingTitle, titleMaxW, 15, 9.5);
    doc.text(titleText, M + 17, 33.8);

    // subtitle:  <exam naam> | <All Tests / Section naam>
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    let sx = M + 17;
    if (examName) {
        doc.setTextColor(...PDF.indigo);
        const ex = pdfFitText(doc, examName, titleMaxW * 0.55);
        doc.text(ex, sx, 39.8);
        sx += doc.getTextWidth(ex);
        doc.setTextColor(148, 163, 184);
        doc.text("|", sx + 2.4, 39.8);
        sx += 5.8;
    }
    doc.setTextColor(30, 41, 59);
    doc.text(pdfFitText(doc, scopeLabel, M + 17 + titleMaxW - sx), sx, 39.8);

    // right info card
    const cardX = W - M - cardW, cardY = 26;
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(221, 227, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, cardW, 16, 3, 3, "FD");
    icoShield(doc, cardX + 3, cardY + 3, 10, PDF.indigo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF.navy);
    doc.text("Your Performance Report", cardX + 15, cardY + 6.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...PDF.muted);
    doc.text("This report contains your test history,", cardX + 15, cardY + 10.2);
    doc.text("analysis and performance insights.", cardX + 15, cardY + 13.2);

    /* ===== 3. Info row: student / generated / date range ===== */
    // Date Range = jab se test data save ho raha hai (sabse purana attempt) -> aaj (report ki date)
    const dates = data.map(r => new Date(r.date).getTime()).filter(n => isFinite(n));
    const rangeText = dates.length
        ? `${pdfDate(Math.min(...dates))}  -  ${pdfDate(now)}`
        : "--";
    const infoY = 53;
    const colW = CW / 3;
    const infos = [
        { icon: icoUser, label: "Student Name", value: userName || "Student" },
        { icon: icoCalendar, label: "Report Generated On", value: pdfDateTime(now) },
        { icon: icoCalendar, label: "Date Range", value: rangeText }
    ];
    infos.forEach((it, i) => {
        const x = M + i * colW;
        it.icon(doc, x, infoY - 2, 7, PDF.navy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.6);
        doc.setTextColor(...PDF.muted);
        doc.text(pdfFitText(doc, it.label, colW - 14), x + 9.5, infoY + 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.6);
        doc.setTextColor(...PDF.navy);
        doc.text(pdfFitText(doc, it.value, colW - 14), x + 9.5, infoY + 6);
        if (i > 0) {
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(x - 3, infoY - 2, x - 3, infoY + 8);
        }
    });

    let cursorY = infoY + 13;

    /* ===== 4. Summary cards (sirf Section PDF me) ===== */
    if (isSection && data.length) {
        const attempts = data.length;
        const sumScore = data.reduce((s, r) => s + (Number(r.score) || 0), 0);
        const sumMax = data.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);
        const avgScore = sumScore / attempts;
        const avgMax = sumMax / attempts;
        const avgPct = avgMax > 0 ? (avgScore / avgMax) * 100 : 0;
        const totCorrect = data.reduce((s, r) => s + (Number(r.correct) || 0), 0);
        const totAttempted = data.reduce((s, r) => s + (Number(r.attempted) || 0), 0);
        const accuracy = totAttempted > 0 ? (totCorrect / totAttempted) * 100 : 0;

        let best = null;
        data.forEach(r => {
            const mx = Number(r.maxMarks) || 0;
            const p = mx > 0 ? Number(r.score) / mx : -Infinity;
            if (!best || p > best.p) best = { p, r };
        });

        const cards = [];
        cards.push({ icon: icoDoc, bg: [224, 231, 255], fg: PDF.indigo, label: "Tests Attempted", main: String(attempts), tail: "", sub: "In this section" });
        if (result.rankEnabled && best) {
            cards.push({
                icon: icoTrophy, bg: [209, 250, 229], fg: PDF.green, label: "Best Score",
                main: pdfNum(best.r.score), tail: ` / ${pdfNum(best.r.maxMarks)}`,
                sub: `(${(best.p * 100).toFixed(2)}%)`
            });
        }
        cards.push({
            icon: icoBars, bg: [219, 234, 254], fg: PDF.blue, label: "Average Score",
            main: pdfNum(avgScore), tail: ` / ${pdfNum(avgMax)}`, sub: `(${avgPct.toFixed(2)}%)`
        });
        cards.push({
            icon: icoTarget, bg: [254, 226, 226], fg: PDF.red, label: "Avg. Accuracy",
            main: `${pdfNum(accuracy)}%`, tail: "", sub: `${totCorrect} correct of ${totAttempted}`
        });
        if (result.rankEnabled && result.bestRank) {
            cards.push({
                icon: icoCrown, bg: [254, 243, 199], fg: PDF.amber, label: "Best Rank",
                main: `AIR ${result.bestRank}`, tail: "", sub: "Predicted rank"
            });
        }

        const gap = 3;
        const cw = (CW - gap * (cards.length - 1)) / cards.length;
        const ch = 24;
        cards.forEach((c, i) => {
            const x = M + i * (cw + gap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(224, 231, 255);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, cursorY, cw, ch, 2.6, 2.6, "FD");

            // icon + label (upar wali line)
            doc.setFillColor(...c.bg);
            doc.circle(x + 7.2, cursorY + 6.6, 4.1, "F");
            c.icon(doc, x + 7.2 - 2.5, cursorY + 6.6 - 2.5, 5, c.fg);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.6);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.label, cw - 15), x + 12.8, cursorY + 7.6);

            // value (beech wali line)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13.5);
            doc.setTextColor(...PDF.navy);
            doc.text(c.main, x + 4, cursorY + 16.4);
            if (c.tail) {
                const mw = doc.getTextWidth(c.main);
                doc.setFontSize(8);
                doc.setTextColor(...PDF.muted);
                doc.text(c.tail, x + 4 + mw, cursorY + 16.4);
            }

            // sub text (neeche)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.sub, cw - 8), x + 4, cursorY + 20.6);
        });
        cursorY += ch + 6;
    }

    /* ===== 5. Scope chip + count ===== */
    const seen = new Map();
    data.forEach(r => { if (!seen.has(r.category)) seen.set(r.category, r.color); });
    const scopeColor = isSection ? ([...seen.values()][0] || {}) : { main: "#4F46E5", soft: "#E0E7FF", text: "#4338CA" };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const chipLabel = pdfFitText(doc, scopeLabel.toUpperCase(), 100);
    const chipW = doc.getTextWidth(chipLabel) + 12;
    doc.setFillColor(...hexToRgb(scopeColor.soft));
    doc.roundedRect(M, cursorY, chipW, 6.4, 3.2, 3.2, "F");
    doc.setFillColor(...hexToRgb(scopeColor.main));
    doc.circle(M + 3.9, cursorY + 3.2, 1, "F");
    doc.setTextColor(...hexToRgb(scopeColor.text));
    doc.text(chipLabel, M + 6.8, cursorY + 4.3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(`${data.length} ${data.length === 1 ? "attempt" : "attempts"}`, W - M, cursorY + 4.3, { align: "right" });
    cursorY += 10;

    /* ===== 6. Table ===== */
    const rows = data.map((r, i) => [
        i + 1, r.testName, "", pdfDate(r.date), r.attempted, r.correct, r.wrong,
        pdfNum(r.maxMarks), pdfNum(r.score), (r.rank === "" || r.rank == null) ? "--" : r.rank,
        `${r.accuracy}%`, pdfFormatTime(r.time)
    ]);

    // Test Name column ki fixed width = baaki 11 columns (154 mm) ke baad bacha hua
    const NAME_W = CW - 154;

    doc.autoTable({
        startY: cursorY,
        margin: { top: 20, left: M, right: M, bottom: 15 },
        tableWidth: CW,
        head: [["#", "TEST NAME", "CATEGORY", "DATE", "ATT.", "CORR.", "WRNG.", "MAX", "SCORE", "RANK", "ACC.", "TIME"]],
        body: rows,
        theme: "plain",
        rowPageBreak: "avoid",
        styles: {
            font: "helvetica", fontSize: 7, textColor: PDF.ink, valign: "middle", overflow: "linebreak",
            cellPadding: { top: 2.8, bottom: 2.8, left: 1.6, right: 1.6 },
            lineColor: PDF.line, lineWidth: { top: 0, right: 0, left: 0, bottom: 0.2 }
        },
        headStyles: {
            fillColor: PDF.head, textColor: 255, fontStyle: "bold", fontSize: 6, lineWidth: 0,
            cellPadding: { top: 3, bottom: 3, left: 1.6, right: 1.6 }
        },
        alternateRowStyles: { fillColor: PDF.zebra },
        columnStyles: {
            0: { cellWidth: 8, halign: "center", textColor: PDF.muted },
            1: { cellWidth: NAME_W, fontStyle: "bold" },
            2: { cellWidth: 32 },
            3: { cellWidth: 18, textColor: PDF.muted },
            4: { cellWidth: 9, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            6: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            7: { cellWidth: 11, halign: "center", textColor: PDF.muted },
            8: { cellWidth: 13, halign: "center", fontStyle: "bold" },
            9: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            10: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            11: { cellWidth: 16, halign: "center", textColor: PDF.muted }
        },
        didParseCell: function (d) {
    if (d.section === "head") {
        if ([0, 4, 5, 6, 7, 8, 9, 10, 11].includes(d.column.index)) d.cell.styles.halign = "center";
        return;
    }
    if (d.row.index < 0 || !data[d.row.index]) return;
    const row = data[d.row.index];
    const col = d.column.index;
    if (col === 5) d.cell.styles.textColor = PDF.green;
    else if (col === 6) d.cell.styles.textColor = PDF.red;
    else if (col === 8) d.cell.styles.textColor = Number(row.score) >= 0 ? PDF.green : PDF.red;
    else if (col === 9) d.cell.styles.textColor = PDF.blue;
    else if (col === 10) {
        const a = Number(row.accuracy) || 0;
        d.cell.styles.textColor = a >= 70 ? PDF.green : (a >= 40 ? PDF.amber : PDF.red);
    }
},
        didDrawCell: function (d) {
            // autotable repeat-header row ko section "body" aur index -1 deta hai — skip
            if (d.section !== "body" || d.row.index < 0 || !data[d.row.index]) return;
            const row = data[d.row.index];
            const color = row.color || {};

            if (d.column.index === 0) {
                doc.setFillColor(...hexToRgb(color.main));
                doc.rect(d.cell.x, d.cell.y, 1.2, d.cell.height - 0.2, "F");
            }
            if (d.column.index === 1 && row._pathLines && row._pathLines.length) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(5.8);
                doc.setTextColor(148, 163, 184);
                const n = row._pathLines.length;
                row._pathLines.forEach((ln, i) => {
                    doc.text(ln, d.cell.x + 1.6, d.cell.y + d.cell.height - 2.2 - (n - 1 - i) * 2.4 - 0.9);
                });
            }
            if (d.column.index === 2) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.6);
                const label = pdfFitText(doc, String(row.category).toUpperCase(), d.cell.width - 3.2 - 5.5 - 3);
                const w = doc.getTextWidth(label) + 8.5;
                const h = 4.8;
                const x = d.cell.x + 1.6;
                const y = d.cell.y + (d.cell.height - h) / 2;
                doc.setFillColor(...hexToRgb(color.soft));
                doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
                doc.setFillColor(...hexToRgb(color.main));
                doc.circle(x + 2.9, y + h / 2, 0.8, "F");
                doc.setTextColor(...hexToRgb(color.text));
                doc.text(label, x + 5, y + h / 2 + 0.75);
            }
        }
    });

    /* ===== 7. Category legend (table ke neeche) ===== */
    let ly = (doc.lastAutoTable ? doc.lastAutoTable.finalY : cursorY) + 8;
    if (ly > H - 24) { doc.addPage(); ly = 30; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF.muted);
    doc.text("CATEGORY LEGEND", M, ly);
    let lx = M + doc.getTextWidth("CATEGORY LEGEND") + 5;
    seen.forEach((color, category) => {
        const label = pdfFitText(doc, String(category).toUpperCase(), 50);
        const w = doc.getTextWidth(label) + 9.5;
        if (lx + w > W - M) { lx = M; ly += 7; }
        doc.setFillColor(...hexToRgb(color?.soft));
        doc.roundedRect(lx, ly - 3.8, w, 5.4, 2.7, 2.7, "F");
        doc.setFillColor(...hexToRgb(color?.main));
        doc.circle(lx + 3.2, ly - 1.1, 0.9, "F");
        doc.setTextColor(...hexToRgb(color?.text));
        doc.text(label, lx + 5.6, ly);
        lx += w + 2.6;
    });

    /* ===== 8. Har page: running header (page 2+) + footer ===== */
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        if (p > 1) {
            drawLogo(doc, logo, M, 4.5, 8);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(...PDF.brand);
            doc.text("WarmupExam", M + 10, 10.2);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, `${listingTitle}  |  ${scopeLabel}`, CW - 40), W - M, 9.8, { align: "right" });
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(M, 14.5, W - M, 14.5);
        }
        doc.setDrawColor(...PDF.line);
        doc.setLineWidth(0.3);
        doc.line(M, H - 11, W - M, H - 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...PDF.muted);
        doc.text("WarmupExam  |  India's Smartest Mock Test Platform", M, H - 6);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: "right" });
    }
    return doc;
}

async function exportAllAttemptsPdf() {
    const btn = document.getElementById("exportAllPdfBtn");
    const originalText = btn.innerText;
    btn.innerText = "Generating...";
    btn.disabled = true;

    try {
        const currentParams = new URLSearchParams(window.location.search);
        const statsSectionParam = currentParams.get('statsSection') || 'all';

        const res = await fetch(window.location.pathname.split('/series/')[1]
            ? `/series/${window.location.pathname.split('/series/')[1].split('/')[0]}/export-attempts?statsSection=${statsSectionParam}`
            : window.location.pathname + `/export-attempts?statsSection=${statsSectionParam}`);
        const result = await res.json();

        if (!result.success || !result.data || result.data.length === 0) {
            showFlashMessage("No attempt data found.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const logo = await pdfLoadLogo("/images/logo.svg");
        const doc = buildAttemptsPdf(jsPDF, result, userNameForPdf, logo);

        const base = pdfFileSlug(result.listingTitle) || "TestSeries";
        const sec = result.sectionTitle ? pdfFileSlug(result.sectionTitle) : "All";
        doc.save(`${base}_${sec}_Attempts.pdf`);

    } catch (err) {
        console.error("PDF export error:", err);
        showFlashMessage("Unable to generate PDF. Please try again.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

/* ---------- gradient / decoration ---------- */
function drawHeaderBackground(doc, W, height) {
    const top = [232, 236, 255], bottom = [255, 255, 255];
    const steps = 60, h = height / steps;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        doc.setFillColor(
            Math.round(top[0] + (bottom[0] - top[0]) * t),
            Math.round(top[1] + (bottom[1] - top[1]) * t),
            Math.round(top[2] + (bottom[2] - top[2]) * t)
        );
        doc.rect(0, i * h, W, h + 0.3, "F");
    }
    // soft blobs
    try {
        doc.setGState(new doc.GState({ opacity: 0.45 }));
        doc.setFillColor(214, 221, 255);
        doc.circle(W - 16, 3, 26, "F");
        doc.circle(W - 58, 24, 11, "F");
        doc.setFillColor(222, 228, 255);
        doc.circle(48, -2, 18, "F");
        doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) { /* GState na ho to blobs skip */ }
    // dotted grid (upar-beech)
    doc.setFillColor(165, 175, 235);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) doc.circle(W / 2 - 14 + c * 3, 6 + r * 3, 0.3, "F");
}

// Text ko width me fit karne ke liye font size ghatata hai (min tak), phir bhi na aaye to ... laga deta hai
function pdfFitFont(doc, text, maxW, maxSize, minSize) {
    let size = maxSize;
    doc.setFontSize(size);
    while (size > minSize && doc.getTextWidth(text) > maxW) {
        size -= 0.5;
        doc.setFontSize(size);
    }
    return pdfFitText(doc, text, maxW);
}

/* ---------- main builder (A4 portrait: 210 x 297 mm) ---------- */
function buildAttemptsPdf(jsPDF, result, userName, logo) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();     // 210
    const H = doc.internal.pageSize.getHeight();    // 297
    const M = 10;
    const CW = W - M * 2;                           // content width = 190
    const data = result.data;
    const listingTitle = result.listingTitle || "Test Series";   // listing ka naam  -> main title
    const examName = result.examName || "";                      // listing ka exam  -> subtitle
    const isSection = !!result.sectionTitle;
    const scopeLabel = isSection ? result.sectionTitle : "All Tests";
    const now = new Date();

    /* ===== 1. Brand header ===== */
    drawHeaderBackground(doc, W, 38);
    drawLogo(doc, logo, M, 7, 15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PDF.brand);
    doc.text("WarmupExam", M + 19, 14.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text("India's Smartest Mock Test Platform", M + 19, 19.5);

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF.brand);
    doc.text("Prepare Smarter.", W - M, 12.5, { align: "right" });
    doc.text("Perform Better.", W - M, 18.5, { align: "right" });

    /* ===== 2. Title block: listing naam + exam naam ===== */
    doc.setFillColor(224, 231, 255);
    doc.roundedRect(M, 27, 13, 13, 3, 3, "F");
    icoDoc(doc, M + 2.2, 29.2, 8.6, PDF.indigo);

    const cardW = 62;
    const titleMaxW = CW - 17 - cardW - 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF.navy);
    const titleText = pdfFitFont(doc, listingTitle, titleMaxW, 15, 9.5);
    doc.text(titleText, M + 17, 33.8);

    // subtitle:  <exam naam> | <All Tests / Section naam>
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    let sx = M + 17;
    if (examName) {
        doc.setTextColor(...PDF.indigo);
        const ex = pdfFitText(doc, examName, titleMaxW * 0.55);
        doc.text(ex, sx, 39.8);
        sx += doc.getTextWidth(ex);
        doc.setTextColor(148, 163, 184);
        doc.text("|", sx + 2.4, 39.8);
        sx += 5.8;
    }
    doc.setTextColor(30, 41, 59);
    doc.text(pdfFitText(doc, scopeLabel, M + 17 + titleMaxW - sx), sx, 39.8);

    // right info card
    const cardX = W - M - cardW, cardY = 26;
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(221, 227, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, cardW, 16, 3, 3, "FD");
    icoShield(doc, cardX + 3, cardY + 3, 10, PDF.indigo);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF.navy);
    doc.text("Your Performance Report", cardX + 15, cardY + 6.4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...PDF.muted);
    doc.text("This report contains your test history,", cardX + 15, cardY + 10.2);
    doc.text("analysis and performance insights.", cardX + 15, cardY + 13.2);

    /* ===== 3. Info row: student / generated / date range ===== */
    // Date Range = jab se test data save ho raha hai (sabse purana attempt) -> aaj (report ki date)
    const dates = data.map(r => new Date(r.date).getTime()).filter(n => isFinite(n));
    const rangeText = dates.length
        ? `${pdfDate(Math.min(...dates))}  -  ${pdfDate(now)}`
        : "--";
    const infoY = 53;
    const colW = CW / 3;
    const infos = [
        { icon: icoUser, label: "Student Name", value: userName || "Student" },
        { icon: icoCalendar, label: "Report Generated On", value: pdfDateTime(now) },
        { icon: icoCalendar, label: "Date Range", value: rangeText }
    ];
    infos.forEach((it, i) => {
        const x = M + i * colW;
        it.icon(doc, x, infoY - 2, 7, PDF.navy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.6);
        doc.setTextColor(...PDF.muted);
        doc.text(pdfFitText(doc, it.label, colW - 14), x + 9.5, infoY + 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.6);
        doc.setTextColor(...PDF.navy);
        doc.text(pdfFitText(doc, it.value, colW - 14), x + 9.5, infoY + 6);
        if (i > 0) {
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(x - 3, infoY - 2, x - 3, infoY + 8);
        }
    });

    let cursorY = infoY + 13;

    /* ===== 4. Summary cards (sirf Section PDF me) ===== */
    if (isSection && data.length) {
        const attempts = data.length;
        const sumScore = data.reduce((s, r) => s + (Number(r.score) || 0), 0);
        const sumMax = data.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);
        const avgScore = sumScore / attempts;
        const avgMax = sumMax / attempts;
        const avgPct = avgMax > 0 ? (avgScore / avgMax) * 100 : 0;
        const totCorrect = data.reduce((s, r) => s + (Number(r.correct) || 0), 0);
        const totAttempted = data.reduce((s, r) => s + (Number(r.attempted) || 0), 0);
        const accuracy = totAttempted > 0 ? (totCorrect / totAttempted) * 100 : 0;

        let best = null;
        data.forEach(r => {
            const mx = Number(r.maxMarks) || 0;
            const p = mx > 0 ? Number(r.score) / mx : -Infinity;
            if (!best || p > best.p) best = { p, r };
        });

        const cards = [];
        cards.push({ icon: icoDoc, bg: [224, 231, 255], fg: PDF.indigo, label: "Tests Attempted", main: String(attempts), tail: "", sub: "In this section" });
        if (result.rankEnabled && best) {
            cards.push({
                icon: icoTrophy, bg: [209, 250, 229], fg: PDF.green, label: "Best Score",
                main: pdfNum(best.r.score), tail: ` / ${pdfNum(best.r.maxMarks)}`,
                sub: `(${(best.p * 100).toFixed(2)}%)`
            });
        }
        cards.push({
            icon: icoBars, bg: [219, 234, 254], fg: PDF.blue, label: "Average Score",
            main: pdfNum(avgScore), tail: ` / ${pdfNum(avgMax)}`, sub: `(${avgPct.toFixed(2)}%)`
        });
        cards.push({
            icon: icoTarget, bg: [254, 226, 226], fg: PDF.red, label: "Avg. Accuracy",
            main: `${pdfNum(accuracy)}%`, tail: "", sub: `${totCorrect} correct of ${totAttempted}`
        });
        if (result.rankEnabled && result.bestRank) {
            cards.push({
                icon: icoCrown, bg: [254, 243, 199], fg: PDF.amber, label: "Best Rank",
                main: `AIR ${result.bestRank}`, tail: "", sub: "Predicted rank"
            });
        }

        const gap = 3;
        const cw = (CW - gap * (cards.length - 1)) / cards.length;
        const ch = 24;
        cards.forEach((c, i) => {
            const x = M + i * (cw + gap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(224, 231, 255);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, cursorY, cw, ch, 2.6, 2.6, "FD");

            // icon + label (upar wali line)
            doc.setFillColor(...c.bg);
            doc.circle(x + 7.2, cursorY + 6.6, 4.1, "F");
            c.icon(doc, x + 7.2 - 2.5, cursorY + 6.6 - 2.5, 5, c.fg);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.6);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.label, cw - 15), x + 12.8, cursorY + 7.6);

            // value (beech wali line)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13.5);
            doc.setTextColor(...PDF.navy);
            doc.text(c.main, x + 4, cursorY + 16.4);
            if (c.tail) {
                const mw = doc.getTextWidth(c.main);
                doc.setFontSize(8);
                doc.setTextColor(...PDF.muted);
                doc.text(c.tail, x + 4 + mw, cursorY + 16.4);
            }

            // sub text (neeche)
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, c.sub, cw - 8), x + 4, cursorY + 20.6);
        });
        cursorY += ch + 6;
    }

    /* ===== 5. Scope chip + count ===== */
    const seen = new Map();
    data.forEach(r => { if (!seen.has(r.category)) seen.set(r.category, r.color); });
    const scopeColor = isSection ? ([...seen.values()][0] || {}) : { main: "#4F46E5", soft: "#E0E7FF", text: "#4338CA" };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const chipLabel = pdfFitText(doc, scopeLabel.toUpperCase(), 100);
    const chipW = doc.getTextWidth(chipLabel) + 12;
    doc.setFillColor(...hexToRgb(scopeColor.soft));
    doc.roundedRect(M, cursorY, chipW, 6.4, 3.2, 3.2, "F");
    doc.setFillColor(...hexToRgb(scopeColor.main));
    doc.circle(M + 3.9, cursorY + 3.2, 1, "F");
    doc.setTextColor(...hexToRgb(scopeColor.text));
    doc.text(chipLabel, M + 6.8, cursorY + 4.3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(`${data.length} ${data.length === 1 ? "attempt" : "attempts"}`, W - M, cursorY + 4.3, { align: "right" });
    cursorY += 10;

    /* ===== 6. Table ===== */
    const rows = data.map((r, i) => [
        i + 1, r.testName, "", pdfDate(r.date), r.attempted, r.correct, r.wrong,
        pdfNum(r.maxMarks), pdfNum(r.score), (r.rank === "" || r.rank == null) ? "--" : r.rank,
        `${r.accuracy}%`, pdfFormatTime(r.time)
    ]);

    // Test Name column ki fixed width = baaki 11 columns (154 mm) ke baad bacha hua
    const NAME_W = CW - 154;

    doc.autoTable({
        startY: cursorY,
        margin: { top: 20, left: M, right: M, bottom: 15 },
        tableWidth: CW,
        head: [["#", "TEST NAME", "CATEGORY", "DATE", "ATT.", "CORR.", "WRNG.", "MAX", "SCORE", "RANK", "ACC.", "TIME"]],
        body: rows,
        theme: "plain",
        rowPageBreak: "avoid",
        styles: {
            font: "helvetica", fontSize: 7, textColor: PDF.ink, valign: "middle", overflow: "linebreak",
            cellPadding: { top: 2.8, bottom: 2.8, left: 1.6, right: 1.6 },
            lineColor: PDF.line, lineWidth: { top: 0, right: 0, left: 0, bottom: 0.2 }
        },
        headStyles: {
            fillColor: PDF.head, textColor: 255, fontStyle: "bold", fontSize: 6, lineWidth: 0,
            cellPadding: { top: 3, bottom: 3, left: 1.6, right: 1.6 }
        },
        alternateRowStyles: { fillColor: PDF.zebra },
        columnStyles: {
            0: { cellWidth: 8, halign: "center", textColor: PDF.muted },
            1: { cellWidth: NAME_W, fontStyle: "bold" },
            2: { cellWidth: 32 },
            3: { cellWidth: 18, textColor: PDF.muted },
            4: { cellWidth: 9, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            6: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            7: { cellWidth: 11, halign: "center", textColor: PDF.muted },
            8: { cellWidth: 13, halign: "center", fontStyle: "bold" },
            9: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            10: { cellWidth: 11, halign: "center", fontStyle: "bold" },
            11: { cellWidth: 16, halign: "center", textColor: PDF.muted }
        },
        didParseCell: function (d) {
            if (d.section === "head") {
                if ([0, 4, 5, 6, 7, 8, 9, 10, 11].includes(d.column.index)) d.cell.styles.halign = "center";
                return;
            }
            if (d.row.index < 0 || !data[d.row.index]) return;
            const row = data[d.row.index];
            const col = d.column.index;
            if (col === 1) {
                // Recent Activity jaisa path (folder / file) test name ke neeche — max 2 line
                const pathText = (row.locationPath || []).join(" \u2022 ");
                if (pathText) {
                    const maxW = NAME_W - 3.2;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(5.8);
                    let lines = doc.splitTextToSize(pathText, maxW);
                    if (lines.length > 2) {
                        let l2 = lines[1];
                        while (l2.length > 1 && doc.getTextWidth(l2 + "...") > maxW) l2 = l2.slice(0, -1);
                        lines = [lines[0], l2 + "..."];
                    }
                    row._pathLines = lines;
                    d.cell.styles.valign = "top";
                    d.cell.styles.cellPadding = { top: 2.6, bottom: 2.2 + lines.length * 2.4 + 0.6, left: 1.6, right: 1.6 };
                }
            }
            if (col === 5) d.cell.styles.textColor = PDF.green;
            else if (col === 6) d.cell.styles.textColor = PDF.red;
            else if (col === 8) d.cell.styles.textColor = Number(row.score) >= 0 ? PDF.green : PDF.red;
            else if (col === 9) d.cell.styles.textColor = PDF.blue;
            else if (col === 10) {
                const a = Number(row.accuracy) || 0;
                d.cell.styles.textColor = a >= 70 ? PDF.green : (a >= 40 ? PDF.amber : PDF.red);
            }
        },
        didDrawCell: function (d) {
            // autotable repeat-header row ko section "body" aur index -1 deta hai — skip
            if (d.section !== "body" || d.row.index < 0 || !data[d.row.index]) return;
            const row = data[d.row.index];
            const color = row.color || {};

            if (d.column.index === 0) {
                doc.setFillColor(...hexToRgb(color.main));
                doc.rect(d.cell.x, d.cell.y, 1.2, d.cell.height - 0.2, "F");
            }
            if (d.column.index === 1 && row._pathLines && row._pathLines.length) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(5.8);
                doc.setTextColor(148, 163, 184);
                const n = row._pathLines.length;
                row._pathLines.forEach((ln, i) => {
                    doc.text(ln, d.cell.x + 1.6, d.cell.y + d.cell.height - 2.2 - (n - 1 - i) * 2.4 - 0.9);
                });
            }
            if (d.column.index === 2) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(5.6);
                const label = pdfFitText(doc, String(row.category).toUpperCase(), d.cell.width - 3.2 - 5.5 - 3);
                const w = doc.getTextWidth(label) + 8.5;
                const h = 4.8;
                const x = d.cell.x + 1.6;
                const y = d.cell.y + (d.cell.height - h) / 2;
                doc.setFillColor(...hexToRgb(color.soft));
                doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
                doc.setFillColor(...hexToRgb(color.main));
                doc.circle(x + 2.9, y + h / 2, 0.8, "F");
                doc.setTextColor(...hexToRgb(color.text));
                doc.text(label, x + 5, y + h / 2 + 0.75);
            }
        }
    });

    /* ===== 7. Category legend (table ke neeche) ===== */
    let ly = (doc.lastAutoTable ? doc.lastAutoTable.finalY : cursorY) + 8;
    if (ly > H - 24) { doc.addPage(); ly = 30; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF.muted);
    doc.text("CATEGORY LEGEND", M, ly);
    let lx = M + doc.getTextWidth("CATEGORY LEGEND") + 5;
    seen.forEach((color, category) => {
        const label = pdfFitText(doc, String(category).toUpperCase(), 50);
        const w = doc.getTextWidth(label) + 9.5;
        if (lx + w > W - M) { lx = M; ly += 7; }
        doc.setFillColor(...hexToRgb(color?.soft));
        doc.roundedRect(lx, ly - 3.8, w, 5.4, 2.7, 2.7, "F");
        doc.setFillColor(...hexToRgb(color?.main));
        doc.circle(lx + 3.2, ly - 1.1, 0.9, "F");
        doc.setTextColor(...hexToRgb(color?.text));
        doc.text(label, lx + 5.6, ly);
        lx += w + 2.6;
    });

    /* ===== 8. Har page: running header (page 2+) + footer ===== */
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        if (p > 1) {
            drawLogo(doc, logo, M, 4.5, 8);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(...PDF.brand);
            doc.text("WarmupExam", M + 10, 10.2);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...PDF.muted);
            doc.text(pdfFitText(doc, `${listingTitle}  |  ${scopeLabel}`, CW - 40), W - M, 9.8, { align: "right" });
            doc.setDrawColor(...PDF.line);
            doc.setLineWidth(0.3);
            doc.line(M, 14.5, W - M, 14.5);
        }
        doc.setDrawColor(...PDF.line);
        doc.setLineWidth(0.3);
        doc.line(M, H - 11, W - M, H - 11);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...PDF.muted);
        doc.text("WarmupExam  |  India's Smartest Mock Test Platform", M, H - 6);
        doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: "right" });
    }
    return doc;
}

function openStatsFilterModal() {
    document.getElementById('statsFilterModalOverlay').classList.remove('hidden');
}
function closeStatsFilterModal() {
    document.getElementById('statsFilterModalOverlay').classList.add('hidden');
}

async function saveStatsFilter(slug) {
    const checked = Array.from(document.querySelectorAll('.statsFilterCheckbox:checked'))
        .map(el => el.value);

    try {
        const res = await fetch(`/series/${slug}/stats-visibility`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibleSectionIds: checked })
        });
        const result = await res.json();

        if (result.success) {
            window.location.reload(true);
        } else {
            showToast('Failed to update.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Something went wrong.', 'error');
    }
}

function toggleStatsDropdown(e) {
    e.stopPropagation();
    document.getElementById('statsSectionPanel').classList.toggle('hidden');
}

function selectStatsSection(id, label) {
    window.location.href = '/series/' + pageData.listingSlug + (id === 'all' ? '' : '?statsSection=' + id);
}

document.addEventListener('click', function () {
    const panel = document.getElementById('statsSectionPanel');
    if (panel) panel.classList.add('hidden');
});

document.getElementById('scrollTopBtn')?.addEventListener('click', handleScrollBtnClick);

if (window.lucide) lucide.createIcons();


// ---- CSP-safe event delegation (sabhi data-action wale clicks yahan handle honge) ----
document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
        case 'go-to-url':
            window.location.href = target.dataset.href;
            break;
        case 'go-back':
            e.preventDefault();
            history.back();
            break; 
        case 'edit-item':
            editItem(target.dataset.type, target.dataset.id);
            break;
        case 'delete-item':
            deleteItem(target.dataset.type, target.dataset.id);
            break;
        case 'open-instructions':
            openInstructionsModal(target.dataset.testId);
            break;
        case 'upcoming-click':
            handleUpcomingClick(target);
            break;
        case 'toggle-language-dropdown':
            toggleLanguageDropdown();
            break;
        case 'select-language':
            selectLanguage(target.dataset.lang);
            break;
        case 'close-instructions':
            closeInstructionsModal();
            break;
        case 'start-test':
            startTest(target.dataset.testId);
            break;
        case 'open-stats-filter':
            openStatsFilterModal();
            break;
        case 'toggle-stats-dropdown':
            toggleStatsDropdown(e);
            break;
        case 'select-stats-section':
            selectStatsSection(target.dataset.id);
            break;
        case 'toggle-create-menu':
            toggleCreateMenu(e);
            break;
        case 'open-create-modal':
            openCreateModal(target.dataset.type);
            break;
        case 'go-to-test-builder':
            goToTestBuilder(e);
            break;
        case 'go-to-generate-paper':
            goToGeneratePaper(e);
            break;
        case 'close-stats-filter':
            closeStatsFilterModal();
            break;
        case 'save-stats-filter':
            saveStatsFilter(target.dataset.slug);
            break;
        case 'close-create-modal':
            closeCreateModal();
            break;
        case 'close-copy-modal':
            closeCopyModal();
            break;
    }
});

document.addEventListener('change', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'toggle-proceed') {
        toggleProceedBtn();
    }
});

document.getElementById('exportAllPdfBtn')?.addEventListener('click', exportAllAttemptsPdf);
document.getElementById('scrollTopBtn')?.addEventListener('click', handleScrollBtnClick);

document.getElementById('createModalForm')?.addEventListener('submit', submitCreateForm);

document.getElementById('copySearchInput')?.addEventListener('input', function () {
    handleCopySearch(this.value);
});