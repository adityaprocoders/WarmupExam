let selectionMode = false;
let selectedItemsMap = new Map(); // id -> type

// 👇 RENAMED — pehle iska naam "toggleSelectMode" tha, sideBar.js se clash ho raha tha
function toggleItemSelectMode() {
    selectionMode = !selectionMode;

    document.querySelectorAll('.select-item-checkbox').forEach(el => {
        el.classList.toggle('hidden', !selectionMode);
    });

    const btn = document.getElementById('selectModeToggleBtn');
    if (btn) {
        btn.classList.toggle('bg-indigo-600', selectionMode);
        btn.classList.toggle('text-white', selectionMode);
        btn.classList.toggle('border-indigo-600', selectionMode);
    }

    if (!selectionMode) clearSelection();
}

function clearSelection() {
    selectedItemsMap.clear();
    document.querySelectorAll('[data-action="select-item"]').forEach(cb => cb.checked = false);
    updateSelectionBar();
}

function updateSelectionBar() {
    const bar = document.getElementById('selectionActionBar');
    document.getElementById('selectionCountText').textContent = `${selectedItemsMap.size} selected`;
    bar.classList.toggle('hidden', selectedItemsMap.size === 0);
}

function onItemCheckboxChange(el) {
    const { itemType, itemId } = el.dataset;
    el.checked ? selectedItemsMap.set(itemId, itemType) : selectedItemsMap.delete(itemId);
    updateSelectionBar();
}

function getSelectedMixedItems() {
    return Array.from(selectedItemsMap.entries()).map(([id, type]) => ({ id, type }));
}

document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
        case 'toggle-item-select-mode':    
            toggleItemSelectMode();   // 👈 RENAMED call
            break;
        case 'cancel-select-mode':
            toggleItemSelectMode();   // 👈 RENAMED call
            break;
        case 'bulk-copy-selected-items':
            startItemBulkCopyWithLanguageCheck();
            break;
    }
});

document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-action="select-item"]');
    if (!el) return;
    onItemCheckboxChange(el);
});