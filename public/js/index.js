
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

    // Tere script tag ke andar ye replace kar
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
    
    // Modal title/sub update
    const copy = modalCopy[type];
    document.getElementById('createModalTitle').textContent = copy.title;
    
    // Yahan fix hai: Test fields dikhana
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
        listingId: "<%= listing._id %>",
        sectionId: "<%= currentSection ? currentSection._id : '' %>",
        parentType: "<%= folder ? 'folder' : (file ? 'file' : 'section') %>",
        parentId: "<%= folder ? folder._id : (file ? file._id : '') %>",
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

    // Test ke liye poora Test Builder page khulega, chhota modal nahi
    if (type === 'test') {
        const params = new URLSearchParams({
            editId: id,
            listingId: "<%= listing._id %>",
            sectionId: "<%= currentSection ? currentSection._id : '' %>",
            parentType: "<%= folder ? 'folder' : (file ? 'file' : 'section') %>",
            parentId: "<%= folder ? folder._id : (file ? file._id : '') %>",
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
        listingId: "<%= listing._id %>",
        sectionId: "<%= currentSection ? currentSection._id : '' %>",
        parentType: "<%= folder ? 'folder' : (file ? 'file' : 'section') %>",
        parentId: "<%= folder ? folder._id : (file ? file._id : '') %>",
        returnUrl: window.location.pathname + window.location.search
    });

    window.location.href = `/test-builder/new?${params.toString()}`;
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

    // Agar page ke bottom ke paas hain, to icon "down" se "up" kar do, warna "down"
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
        // Time aa chuka hai, page ko refresh kar do taaki button live ho jaye
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

// Chhota inline flash/toast — page reload ke bina message dikhane ke liye
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

function startTest(testId) {
    window.location.href = `/attempt/${testId}`;
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
              onclick="goToBreadcrumb(${i - 1})">${p.label}</span>
        ${i < crumbs.length - 1 ? '<span class="text-gray-300">/</span>' : ''}
    `).join("");
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
    copyNav.level = "series-inside"; // footer paste yahin valid hai section-copy ke liye
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

// Common row renderer — icon Lucide ya FontAwesome dono support karta hai
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
            <div class="opacity-0 group-hover:opacity-100 flex items-center gap-2 shrink-0">
                ${r.canPaste ? `<button data-paste="${i}" class="text-indigo-600 text-xs font-bold px-2 py-1 hover:bg-indigo-100 rounded-lg">Paste</button>` : ""}
                <button data-open="${i}" class="text-gray-400 hover:text-indigo-600">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join("");

    // Event delegation — inline onclick me function reference pass nahi ho sakta, isliye yahan bind karo
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
    } else {
        enabled = (copyNav.level === "section" || copyNav.level === "folder") && !!copyNav.sectionId;
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
        location.reload();
    } else {
        alert("Copy failed: " + (result.message || "Unknown error"));
    }
}

// Simple search — sirf series-name/exam se dhundhta hai, click karte hi seedha uske sections khul jaate hain
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


// --- Dashboard analytics charts: NOW driven by dashboardStats (average-based), not just latest attempt ---
const perfData = <%- JSON.stringify(performanceGrowth || []) %>;
const dashStats = <%- JSON.stringify(dashboardStats || {}) %>;

if (perfData.length > 0) {
    // Default marker = user ka AVERAGE marks/rank (sab mock tests ka average) — latest attempt nahi
    const userScore = (dashStats.avgScore !== undefined && dashStats.avgScore !== null) ? dashStats.avgScore : 182;
    const userRank = (dashStats.avgRank && dashStats.avgRank !== "--") ? dashStats.avgRank : 845;

    // --- 1. Marks vs Predicted Rank Chart ---
    if (document.getElementById('predictedRankChart')) {
        const customRankMarker = {
            id: 'customRankMarker',
            afterDraw(chart) {
                const { ctx, chartArea: { bottom }, scales: { x, y } } = chart;
                
                // X-axis par user score ki location find karo
                const xCoord = x.getPixelForValue(userScore);
                const yCoord = y.getPixelForValue(userRank);

                if (xCoord !== undefined && !isNaN(xCoord)) {
                    ctx.save();
                    
                    // Vertical Dashed Line
                    ctx.beginPath();
                    ctx.strokeStyle = '#8b5cf6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(xCoord, yCoord);
                    ctx.lineTo(xCoord, bottom);
                    ctx.stroke();

                    // Glowing Point Circle
                    ctx.beginPath();
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
                    ctx.arc(xCoord, yCoord, 9, 0, 2 * Math.PI);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.fillStyle = '#7c3aed';
                    ctx.arc(xCoord, yCoord, 4.5, 0, 2 * Math.PI);
                    ctx.fill();

                    // Dark Tooltip Box ("Marks: 182 / Predicted Rank: 845")
                    const boxWidth = 130;
                    const boxHeight = 48;
                    const boxX = xCoord - boxWidth / 2;
                    const boxY = yCoord - boxHeight - 12;

                    ctx.fillStyle = '#1e293b'; // Dark slate background
                    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
                    ctx.fill();

                    // Text inside box
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
                labels: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240],
                datasets: [{
                    data: [50000, 25000, 10000, 5000, 2500, 1200, 800, 450, 200, 80, 20], // Rank curve logic
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
                    x: { title: { display: true, text: 'Marks Scored' } },
                    y: { type: 'logarithmic', title: { display: true, text: 'Predicted Rank (AIR)' }, reverse: true }
                }
            },
            plugins: [customRankMarker]
        });
    }

    // --- 2. Score Distribution Chart (Bell Curve style with user score marker) ---
    if (document.getElementById('scoreDistributionChart')) {
        const customDistMarker = {
            id: 'customDistMarker',
            afterDraw(chart) {
                const { ctx, chartArea: { top, bottom }, scales: { x, y } } = chart;
                const xCoord = x.getPixelForValue(userScore);

                if (xCoord !== undefined && !isNaN(xCoord)) {
                    ctx.save();
                    
                    // Dashed line
                    ctx.beginPath();
                    ctx.strokeStyle = '#8b5cf6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(xCoord, top + 20);
                    ctx.lineTo(xCoord, bottom);
                    ctx.stroke();

                    // Top Badge Box (e.g., "182")
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

                    ctx.restore();
                }
            }
        };

        const ctxDist = document.getElementById('scoreDistributionChart').getContext('2d');
        new Chart(ctxDist, {
            type: 'line',
            data: {
                labels: [40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240],
                datasets: [{
                    data: [50, 300, 1500, 5000, 10200, 8000, 3500, 1200, 300, 60, 10], // Bell curve distribution data
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
                    x: { title: { display: true, text: 'Marks Scored' } },
                    y: { title: { display: true, text: 'No. of Students' }, beginAtZero: true }
                }
            },
            plugins: [customDistMarker]
        });
    }
}
 
 const performanceData = <%- JSON.stringify(performanceGrowth || []) %>;

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
