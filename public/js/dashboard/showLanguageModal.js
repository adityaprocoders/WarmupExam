let selectedShowLanguage = null;
let pendingBulkCopyMode = null; // language confirm hone ke baad kis mode se bulkCopyModal khulega

async function fetchLanguagesForSections(sectionIds) {
    const langSet = new Set();

    for (const id of sectionIds) {
        try {
            const res = await fetch(`/api/copy/languages?sourceType=section&sourceId=${id}`);
            const data = await res.json();
            if (data.success) {
                (data.languages || []).forEach(l => langSet.add(l));
            }
        } catch (err) {
            console.error('Language fetch error:', err);
        }
    }

    return Array.from(langSet);
}

function renderLanguageOptions(languages) {
    const area = document.getElementById('showLanguageOptionsArea');
    const allOptions = [...languages, 'All'];

    area.innerHTML = allOptions.map(lang => `
        <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 cursor-pointer">
            <input
                type="radio"
                name="showLanguageOption"
                value="${lang}"
                data-action="select-show-language"
                class="w-4 h-4 text-indigo-600">
            <span class="text-sm font-medium text-slate-700">${lang}</span>
        </label>
    `).join('');
}

function openShowLanguageModal(languages, nextMode) {
    selectedShowLanguage = null;
    pendingBulkCopyMode = nextMode;
    document.getElementById('languageNextBtn').disabled = true;
    renderLanguageOptions(languages);
    document.getElementById('showLanguageModalOverlay').classList.remove('hidden');
}

function closeShowLanguageModal() {
    document.getElementById('showLanguageModalOverlay').classList.add('hidden');
}

function confirmLanguageNext() {
    closeShowLanguageModal();

    if (pendingSingleCopySource) {
        // single-item copy flow
        openCopyModal(pendingSingleCopySource.type, pendingSingleCopySource.id);
        pendingSingleCopySource = null;
    } else {
        // bulk copy flow
        openBulkCopyModal(pendingBulkCopyMode);
    }
}

// Bulk-copy button click hote hi ye function call karo (existing "Copy" button ka handler
// jo pehle seedha openBulkCopyModal(mode) call karta tha, ab isko call kare)
async function startBulkCopyWithLanguageCheck(mode) {
    const sectionIds = getSelectedSectionIds();
    if (sectionIds.length === 0) return;

    const languages = await fetchLanguagesForSections(sectionIds);

    if (languages.length === 0) {
        // koi language hi nahi mili (single-language ya koi test nahi) — seedha bulk copy modal
        openBulkCopyModal(mode);
        return;
    }

    openShowLanguageModal(languages, mode);
}

document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
        case 'close-language-modal':
            closeShowLanguageModal();
            break;
        case 'confirm-language-next':
            confirmLanguageNext();
            break;
    }
});

document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-action="select-show-language"]');
    if (!el) return;

    selectedShowLanguage = el.value;
    document.getElementById('languageNextBtn').disabled = false;
});