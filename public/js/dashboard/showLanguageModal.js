let selectedShowLanguage = null;
let pendingBulkCopyMode = null;
let pendingMixedBulkItems = null;

async function fetchLanguagesForSections(sectionIds) {
    const langSet = new Set();
    for (const id of sectionIds) {
        try {
            const res = await fetch(`/api/copy/languages?sourceType=section&sourceId=${id}`);
            const data = await res.json();
            if (data.success) (data.languages || []).forEach(l => langSet.add(l));
        } catch (err) {
            console.error('Language fetch error:', err);
        }
    }
    return Array.from(langSet);
}

async function fetchLanguagesForItems(items) {
    const langSet = new Set();
    for (const item of items) {
        try {
            const res = await fetch(`/api/copy/languages?sourceType=${item.type}&sourceId=${item.id}`);
            const data = await res.json();
            if (data.success) (data.languages || []).forEach(l => langSet.add(l));
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

    if (pendingMixedBulkItems) {
        // ek hi item ho to uska apna type use karo (section ke liye series-level paste chahiye)
        if (pendingMixedBulkItems.length === 1) {
            openCopyModal(pendingMixedBulkItems[0].type, pendingMixedBulkItems[0].id);
        } else {
            openCopyModal('mixed', null);
        }
    } else if (pendingSingleCopySource) {
        openCopyModal(pendingSingleCopySource.type, pendingSingleCopySource.id);
        pendingSingleCopySource = null;
    } else {
        openBulkCopyModal(pendingBulkCopyMode);
    }
}

// Sidebar: selected sections ka bulk copy
async function startBulkCopyWithLanguageCheck(mode) {
    const sectionIds = getSelectedSectionIds();
    if (sectionIds.length === 0) return;

    const withTests = await askCopyWithTests();
    if (withTests === null) return;
    copyIncludeTests = withTests;
    copyRandomConfig = null;
    copyRandomMode = false;
        selectedShowLanguage = null;
    pendingMixedBulkItems = null;   // sidebar se hamesha sirf sections copy hote hain

    if (!withTests) {
        selectedShowLanguage = null;
        openBulkCopyModal(mode);
        return;
    }

    const cm = await askCopyMode(sectionIds.map(id => ({ id, type: 'section' })));
    if (cm === null) return;
    if (cm.mode === 'random') {
        copyRandomMode = true;
        copyRandomConfig = null;
        selectedShowLanguage = null;
        openBulkCopyModal(mode);
        return;
    }

    const languages = await fetchLanguagesForSections(sectionIds);
    if (languages.length === 0) {
        openBulkCopyModal(mode);
        return;
    }
    openShowLanguageModal(languages, mode);
}

// Main area: selected folder / file / test ka bulk copy
async function startItemBulkCopyWithLanguageCheck() {
    const items = getSelectedMixedItems();
    if (items.length === 0) return;

    const withTests = await askCopyWithTests();
    if (withTests === null) return;
    copyIncludeTests = withTests;
    copyRandomConfig = null;
    copyRandomMode = false;
    selectedShowLanguage = null;
    pendingMixedBulkItems = items;

    if (!withTests) {
        selectedShowLanguage = null;
        openCopyModal('mixed', null);
        return;
    }

    const cm = await askCopyMode(items);
    if (cm === null) { pendingMixedBulkItems = null; return; }
    if (cm.mode === 'random') {
        copyRandomMode = true;
        copyRandomConfig = null;
        selectedShowLanguage = null;
        openCopyModal('mixed', null);
        return;
    }

    const languages = await fetchLanguagesForItems(items);
    if (languages.length === 0) {
        openCopyModal('mixed', null);
        return;
    }
    openShowLanguageModal(languages, 'mixed');
}

document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
        case 'close-language-modal':
            closeShowLanguageModal();
            // cancel par purana pending state saaf
            pendingMixedBulkItems = null;
            pendingSingleCopySource = null;
            copyRandomConfig = null;
            copyRandomMode = false;
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