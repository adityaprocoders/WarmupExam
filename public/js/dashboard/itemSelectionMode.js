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
        const label = btn.querySelector('.select-btn-label');
        if (label) label.textContent = selectionMode ? 'Cancel' : 'Select';

        btn.classList.toggle('bg-red-50', selectionMode);
        btn.classList.toggle('bg-white', !selectionMode);
        btn.classList.toggle('text-red-500', selectionMode);
        btn.classList.toggle('text-indigo-600', !selectionMode);
    }

        const allBtn = document.getElementById('selectAllItemsBtn');
    if (allBtn) {
        allBtn.classList.toggle('hidden', !selectionMode);
        allBtn.classList.toggle('flex', selectionMode);
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

        const boxes = document.querySelectorAll('[data-action="select-item"]');
    const label = document.getElementById('selectAllItemsLabel');
    if (label) {
        const allChecked = boxes.length > 0 && selectedItemsMap.size === boxes.length;
        label.textContent = allChecked ? 'Deselect All' : 'Select All';
    }
}

function onItemCheckboxChange(el) {
    const { itemType, itemId } = el.dataset;
    el.checked ? selectedItemsMap.set(itemId, itemType) : selectedItemsMap.delete(itemId);
    updateSelectionBar();
}

function getSelectedMixedItems() {
    return Array.from(selectedItemsMap.entries()).map(([id, type]) => ({ id, type }));
}


function toggleSelectAllItems() {
    const boxes = Array.from(document.querySelectorAll('[data-action="select-item"]'));
    const allChecked = boxes.length > 0 && selectedItemsMap.size === boxes.length;

    boxes.forEach(cb => {
        cb.checked = !allChecked;
        if (cb.checked) selectedItemsMap.set(cb.dataset.itemId, cb.dataset.itemType);
        else selectedItemsMap.delete(cb.dataset.itemId);
    });
    updateSelectionBar();
}


function exitItemSelectMode() {
    if (selectionMode) toggleItemSelectMode();
    else clearSelection();
}

document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    switch (el.dataset.action) {
        case 'toggle-item-select-mode':    
            toggleItemSelectMode();   // 👈 RENAMED call
            break;
        case 'cancel-select-mode':
            exitItemSelectMode();
            break;
        case 'bulk-copy-selected-items':
            startItemBulkCopyWithLanguageCheck();
            break;
        case 'select-all-items':
            toggleSelectAllItems();
            break;
    }
});

document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-action="select-item"]');
    if (!el) return;
    onItemCheckboxChange(el);
});