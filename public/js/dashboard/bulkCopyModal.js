 
let bulkCopyMode = "single";
let bulkCopySelectedListings = new Set();

function openBulkCopyModal(mode) {
    document.getElementById('bulkCopyDropdown').classList.add('hidden');

    bulkCopyMode = mode;
    bulkCopySelectedListings = new Set();

    document.getElementById('bulkCopyModalTitle').textContent =
        mode === 'single' ? 'Copy to One Series' : 'Copy to Multiple Series';

    document.getElementById('bulkCopySectionCount').textContent = getSelectedSectionIds().length;
    document.getElementById('bulkCopySearchInput').value = '';
    document.getElementById('bulkCopyConfirmBtn').disabled = true;

    document.getElementById('bulkCopyModalOverlay').classList.remove('hidden');
    loadBulkCopySeriesList('');
}

function closeBulkCopyModal() {
    document.getElementById('bulkCopyModalOverlay').classList.add('hidden');
}

async function loadBulkCopySeriesList(keyword) {
    const res = await fetch(`/api/search-series?keyword=${encodeURIComponent(keyword)}`);
    const series = await res.json();
    renderBulkCopyList(series);
}

function renderBulkCopyList(series) {
    const list = document.getElementById('bulkCopyListArea');

    if (series.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-400 py-16 text-sm">No series found</p>`;
        return;
    }

    const inputType = bulkCopyMode === 'single' ? 'radio' : 'checkbox';

     list.innerHTML = series.map(s => `
    <label class="flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 cursor-pointer">
        <input
            type="${inputType}"
            name="bulkCopyDest"
            value="${s._id}"
            data-action="bulk-copy-select"
            data-listing-id="${s._id}"
            class="w-4 h-4 text-indigo-600">
        <div class="min-w-0">
            <span class="text-sm font-medium text-slate-700 block truncate">${s.title}</span>
            <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${s.type === 'Paid' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}">${s.type || 'Free'}</span>
                <span class="text-[10px] font-medium text-slate-400">${s.language || 'No language'}</span>
            </div>
        </div>
    </label>
`).join('');

}

function onBulkCopySelectChange(listingId, el) {
    if (bulkCopyMode === 'single') {
        bulkCopySelectedListings = new Set([listingId]);
    } else {
        if (el.checked) bulkCopySelectedListings.add(listingId);
        else bulkCopySelectedListings.delete(listingId);
    }
    document.getElementById('bulkCopyConfirmBtn').disabled = bulkCopySelectedListings.size === 0;
}

let bulkCopySearchTimer;
function handleBulkCopySearch(keyword) {
    clearTimeout(bulkCopySearchTimer);
    bulkCopySearchTimer = setTimeout(() => loadBulkCopySeriesList(keyword.trim()), 300);
}

async function confirmBulkCopy() {
    // 👇 NAYA — agar mixed items (folder/file/test) select kiye hain to unhe use karo, warna purana sections-only tarika
    const items = pendingMixedBulkItems
        ? pendingMixedBulkItems
        : getSelectedSectionIds().map(id => ({ id, type: 'section' }));

    const destListingIds = Array.from(bulkCopySelectedListings);

    if (items.length === 0 || destListingIds.length === 0) return;

    const btn = document.getElementById('bulkCopyConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Copying...';

    try {
        const res = await fetch('/api/bulk-copy-items', {   // 👈 URL badla
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items,   // 👈 sectionIds ki jagah items
                destListingIds,
                selectedLanguage: selectedShowLanguage
            })
        });
        const data = await res.json();

        if (data.success) {
            let message = `${data.copied} copy operations successful` + (data.failed ? `, ${data.failed} failed` : '');

            // 👇 NAYA — agar kisi test me language fallback hua ho ("all" pe set hua ho),
            // to uska path dikhao taaki pata chale kaha aisa hua
            if (data.fallbacks && data.fallbacks.length > 0) {
                const fallbackDetails = data.fallbacks
                    .map(f => `• ${f.path} (chuni gayi language "${f.requestedLanguage}" is test me available nahi thi, "All" set kar diya gaya)`)
                    .join('\n');
                message += `\n\nNote: ${data.fallbacks.length} test(s) me language "All" par set ho gayi:\n${fallbackDetails}`;
            }

            alert(message);
            pendingMixedBulkItems = null; 
            location.reload();
        } else {
            alert(data.message || 'Copy fail ho gaya');
            btn.disabled = false;
            btn.textContent = 'Copy Now';
        }
    } catch (err) {
        alert('Something went wrong');
        btn.disabled = false;
        btn.textContent = 'Copy Now';
    }
}
 
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'close-bulk-copy-modal':
      closeBulkCopyModal();
      break;
    case 'confirm-bulk-copy':
      confirmBulkCopy();
      break;
  }
});



document.addEventListener('input', function (e) {
  const el = e.target.closest('[data-oninput]');
  if (!el) return;

  if (el.dataset.oninput === 'bulk-copy-search') {
    handleBulkCopySearch(el.value);
  }
});

document.addEventListener('change', function (e) {
  const el = e.target.closest('[data-action="bulk-copy-select"]');
  if (!el) return;

  onBulkCopySelectChange(el.dataset.listingId, el);
});