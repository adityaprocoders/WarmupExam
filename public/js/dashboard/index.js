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
    folder: { title: 'Create Folder', sub: 'Naya folder is section me banega.', placeholder: 'e.g. Physics' },
    file: { title: 'Create File', sub: 'Nayi file is folder me add hogi.', placeholder: 'e.g. Chapter Notes.pdf' },
    test: { title: 'Create Test', sub: 'Naya mock test is section me add hoga.', placeholder: 'e.g. Mock Test - 7' }
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

    console.log("Form Data Submitted:", payload);

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
        console.log("Server response:", result);

        if (!result.success) {
            alert("Issue: " + (result.message || "Unknown error"));
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

        console.log(err);

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
        alert("Instructions load nahi ho paye");
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
    if (hrs > 0) timeLeftText += `${hrs} ghante `;
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

function selectLanguage(lang) {

    document.getElementById("selectedLanguage").innerText = lang;

    handleLanguageSelect(lang);

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


function startTest(testId) {
    const langParam = encodeURIComponent(selectedTestLanguage || 'English');
    const fromParam = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/attempt/${testId}?lang=${langParam}&from=${fromParam}`;
}

if (window.lucide) {
    lucide.createIcons();
};


// copy & past logic

let copySource = { type: null, id: null };
let copyNav = { level: null, exam: null, slug: null, listingId: null, sectionId: null, parentType: "section", parentId: null, path: [] };

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
                <span class="truncate text-sm font-medium text-slate-700">${r.label}</span>
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

    const body = { sourceType: copySource.type, sourceId: copySource.id, destListingId };

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
        alert("Copied successfully!");
        closeCopyModal();

        // Destination pe redirect karo, current page reload mat karo
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
        alert("Copy failed: " + (result.message || "Unknown error"));
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

    if (document.getElementById('predictedRankChart') && rankCurveRaw.length > 0) {
        const customRankMarker = {
            id: 'customRankMarker',
            afterDraw(chart) {
                if (userRank === null) return;
                const { ctx, chartArea: { bottom }, scales: { x, y } } = chart;

                const xCoord = x.getPixelForValue(userScore);
                const yCoord = y.getPixelForValue(userRank);

                if (xCoord !== undefined && !isNaN(xCoord) && yCoord !== undefined && !isNaN(yCoord)) {
                    ctx.save();

                    ctx.beginPath();
                    ctx.strokeStyle = '#8b5cf6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(xCoord, yCoord);
                    ctx.lineTo(xCoord, bottom);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
                    ctx.arc(xCoord, yCoord, 9, 0, 2 * Math.PI);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.fillStyle = '#7c3aed';
                    ctx.arc(xCoord, yCoord, 4.5, 0, 2 * Math.PI);
                    ctx.fill();

                    const boxWidth = 140;
                    const boxHeight = 48;
                    const boxX = Math.max(4, Math.min(chart.width - boxWidth - 4, xCoord - boxWidth / 2));
                    const boxY = yCoord - boxHeight - 12;

                    ctx.fillStyle = '#1e293b';
                    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.fillText(`Marks: ${userScore}`, boxX + 12, boxY + 20);

                    ctx.fillStyle = '#cbd5e1';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(`Predicted Rank: ${userRank}`, boxX + 12, boxY + 36);

                    ctx.restore();
                }
            }
        };

        const ctxRank = document.getElementById('predictedRankChart').getContext('2d');
        new Chart(ctxRank, {
            type: 'line',
            data: {
                datasets: [{
                    data: rankCurveRaw.map(p => ({ x: p.marks, y: p.rank })),
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#7c3aed'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Marks Scored' } },
                    y: { type: 'logarithmic', title: { display: true, text: 'Predicted Rank (AIR)' }, reverse: true }
                }
            },
            plugins: [customRankMarker]
        });
    }

    const distBuckets = dashStats.scoreDistribution || [];

    if (document.getElementById('scoreDistributionChart') && distBuckets.length > 0) {
        const customDistMarker = {
            id: 'customDistMarker',
            afterDraw(chart) {
                const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
                const xCoord = x.getPixelForValue(userScore);

                if (xCoord !== undefined && !isNaN(xCoord)) {
                    ctx.save();

                    ctx.beginPath();
                    ctx.strokeStyle = '#8b5cf6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(xCoord, top + 20);
                    ctx.lineTo(xCoord, bottom);
                    ctx.stroke();

                    const badgeWidth = 45;
                    const badgeHeight = 24;
                    const badgeX = xCoord - badgeWidth / 2;
                    const badgeY = top;

                    ctx.fillStyle = '#7c3aed';
                    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(userScore, xCoord, badgeY + 16);
                    ctx.textAlign = 'start';

                    ctx.restore();
                }
            }
        };

        const ctxDist = document.getElementById('scoreDistributionChart').getContext('2d');
        new Chart(ctxDist, {
            type: 'line',
            data: {
                datasets: [{
                    data: distBuckets.map(b => ({ x: (b.rangeStart + b.rangeEnd) / 2, y: b.count })),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'Marks Scored' } },
                    y: { title: { display: true, text: 'No. of Students' }, beginAtZero: true, ticks: { precision: 0 } }
                }
            },
            plugins: [customDistMarker]
        });
    }

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


const userNameForPdf = pageData.userName;

const CATEGORY_COLORS = [
    [199, 210, 254],
    [187, 247, 208],
    [254, 202, 202],
    [253, 230, 138],
    [191, 219, 254],
    [233, 213, 255],
    [254, 215, 170],
    [204, 251, 241],
    [252, 231, 243],
    [226, 232, 240],
];

function getCategoryColor(category, colorMap) {
    if (!colorMap.has(category)) {
        const idx = colorMap.size % CATEGORY_COLORS.length;
        colorMap.set(category, CATEGORY_COLORS[idx]);
    }
    return colorMap.get(category);
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
        const doc = new jsPDF({ orientation: "landscape" });

        doc.setFontSize(16);
        doc.setTextColor(79, 70, 229);
        doc.text(result.listingTitle || "Test Series", 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(userNameForPdf, 14, 22);
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 14, 27);

        const colorMap = new Map();

        const rows = result.data.map((item, i) => [
            i + 1,
            item.testName,
            item.category,
            new Date(item.date).toLocaleDateString('en-GB'),
            item.attempted,
            item.correct,
            item.wrong,
            item.maxMarks,
            item.score,
            item.rank,
            item.accuracy + "%",
            item.time
        ]);

        doc.autoTable({
            startY: 32,
            head: [["#", "Test Name", "Category", "Date", "Att.", "Cor.", "Wrng.", "Max", "Score", "Rank", "Acc.", "Time"]],
            body: rows,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
            columnStyles: {
                4: { fontStyle: "bold" },
                5: { fontStyle: "bold" },
                6: { fontStyle: "bold" },
                8: { fontStyle: "bold" },
                9: { fontStyle: "bold" }
            },
            didParseCell: function (data) {
                if (data.section === 'body') {
                    const category = result.data[data.row.index].category;
                    const color = getCategoryColor(category, colorMap);
                    data.cell.styles.fillColor = color;

                    const col = data.column.index;

                    if (col === 4) {
                        data.cell.styles.textColor = [217, 119, 6];
                    } else if (col === 5) {
                        data.cell.styles.textColor = [22, 163, 74];
                    } else if (col === 6) {
                        data.cell.styles.textColor = [220, 38, 38];
                    } else if (col === 8) {
                        data.cell.styles.textColor = [22, 163, 74];
                    } else if (col === 9) {
                        data.cell.styles.textColor = [37, 99, 235];
                    }
                }
            }
        });


        let legendY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(9);
        doc.setTextColor(50);
        doc.text("Category Legend:", 14, legendY);
        legendY += 7;

        colorMap.forEach((color, category) => {
            if (legendY > doc.internal.pageSize.getHeight() - 10) {
                doc.addPage();
                legendY = 15;
            }
            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(14, legendY - 4, 5, 5, "F");
            doc.setTextColor(50);
            doc.setFontSize(9);
            doc.text(category, 22, legendY);
            legendY += 7;
        });

        const fileName = `${(result.listingTitle || "TestSeries").replace(/\s+/g, "_")}_All_Attempts.pdf`;
        doc.save(fileName);

    } catch (err) {
        showFlashMessage("Unable to generate PDF. Please try again.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
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
            alert('Update fail ho gaya');
        }
    } catch (err) {
        console.error(err);
        alert('Kuch galat ho gaya');
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