document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("addSectionBox");

    if (form) {
        form.addEventListener("submit", () => {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            console.log(data);
        });
    }

});

function showAddSection() {

    const box = document.getElementById("addSectionBox");

    box.classList.toggle("hidden");

}

function toggleEdit(id) {

    const text = document.getElementById("title-text-" + id);

    const form = document.getElementById("form-" + id);

    const input = document.getElementById("input-" + id);

    const editBtn = document.getElementById("edit-btn-" + id);

    const saveBtn = document.getElementById("save-btn-" + id);

    // Text Hide
    text.classList.toggle("hidden");

    // Form Show/Hide
    form.classList.toggle("hidden");

    // Buttons
    editBtn.classList.toggle("hidden");
    saveBtn.classList.toggle("hidden");

    if (!form.classList.contains("hidden")) {
        input.focus();
        input.select();
    }

};


function toggleBatchModal() {
    const overlay = document.getElementById('batchModalOverlay');
    overlay.classList.toggle('hidden');
}

function filterBatchList() {
    const query = document.getElementById('batchSearchInput').value.toLowerCase();
    document.querySelectorAll('.batch-row').forEach(row => {
        const name = row.getAttribute('data-batch-name');
        row.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

function continueBatchSelection() {
    const selected = document.querySelector('input[name="batchSelect"]:checked');
    if (!selected) return;
    const slug = selected.value;
    window.location.href = `/series/${slug}`;
}


let selectModeOn = false;

function toggleSelectMode() {
    selectModeOn = !selectModeOn;
    document.querySelectorAll('.section-select-checkbox').forEach(cb => {
        cb.classList.toggle('hidden', !selectModeOn);
        if (!selectModeOn) cb.checked = false;
    });
    const btn = document.getElementById('selectModeBtn');
    if (btn) btn.textContent = selectModeOn ? 'Cancel' : 'Select';
    updateSelectedCount();
}

function getSelectedSectionIds() {
    return Array.from(document.querySelectorAll('.section-select-checkbox:checked'))
        .map(cb => cb.dataset.sectionId);
}

function updateSelectedCount() {
    const count = getSelectedSectionIds().length;
    const bar = document.getElementById('bulkActionBar');
    const text = document.getElementById('selectedCountText');
    if (text) text.textContent = `${count} selected`;
    if (bar) bar.classList.toggle('hidden', !selectModeOn || count === 0);
}

function toggleBulkCopyDropdown() {
    document.getElementById('bulkCopyDropdown').classList.toggle('hidden');
}



document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'toggle-batch-modal':
      toggleBatchModal();
      break;
    case 'toggle-select-mode':
      toggleSelectMode();
      break;
    case 'section-checkbox':
      e.stopPropagation();
      updateSelectedCount();
      break;
    case 'open-copy-modal':
      openCopyModal(el.dataset.copyType, el.dataset.copyId);
      break;
    case 'toggle-edit':
      toggleEdit(el.dataset.id);
      break;
    case 'save-section':
      document.getElementById('form-' + el.dataset.id).submit();
      break;
    case 'show-add-section':
      showAddSection();
      break;
    case 'continue-batch-selection':
      continueBatchSelection();
      break;
    case 'toggle-bulk-copy-dropdown':
      toggleBulkCopyDropdown();
      break;
    case 'open-bulk-copy-modal':
      openBulkCopyModal(el.dataset.mode);
      break;
  }
});

document.addEventListener('input', function (e) {
  const el = e.target.closest('[data-oninput]');
  if (!el) return;

  if (el.dataset.oninput === 'filter-batch-list') {
    filterBatchList();
  }
});