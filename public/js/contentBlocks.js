document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("attachModal");
    if (!modal) return; // customer ke liye modal exist hi nahi karta, safe exit

    const openBtn = document.getElementById("openAttachModalBtn");
    const closeBtn = document.getElementById("closeAttachModalBtn");
    const tabBtns = document.querySelectorAll(".tab-btn");

    const newBlockForm = document.getElementById("newBlockForm");
    const nameInput = document.getElementById("blockNameInput");
    const htmlTextarea = document.getElementById("htmlTextarea");
    const submitBtn = document.getElementById("newBlockSubmitBtn");

    const createAction = newBlockForm.getAttribute("action");

    // ---------- Open / Close attachModal ----------
    openBtn?.addEventListener("click", () => {
        modal.classList.remove("hidden");
        switchTab("existing");
    });

    closeBtn?.addEventListener("click", () => closeModal());

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    function closeModal() {
        modal.classList.add("hidden");
        resetNewBlockForm();
    }

    // ---------- Tab switching ----------
    function switchTab(tab) {
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
        document.getElementById(`tab-${tab}`).classList.remove("hidden");

        tabBtns.forEach(b => {
            const active = b.dataset.tab === tab;
            b.classList.toggle("text-indigo-600", active);
            b.classList.toggle("border-b-2", active);
            b.classList.toggle("border-indigo-600", active);
            b.classList.toggle("text-gray-500", !active);
        });
    }

    tabBtns.forEach(b => {
        b.addEventListener("click", () => {
            switchTab(b.dataset.tab);
            if (b.dataset.tab === "new" && newBlockForm.dataset.mode === "edit") {
                resetNewBlockForm();
            }
        });
    });

    // ---------- Reset form to "create new" mode ----------
    function resetNewBlockForm() {
        newBlockForm.reset();
        newBlockForm.setAttribute("action", createAction);
        newBlockForm.dataset.mode = "create";
        submitBtn.textContent = "Save & Attach";

        const hiddenListingId = newBlockForm.querySelector('input[name="listingId"]');
        hiddenListingId?.remove();
    }

    // ---------- Edit button: prefill form + switch to edit mode ----------
    document.querySelectorAll(".edit-block-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const { id, name, html } = btn.dataset;

            nameInput.value = name;
            htmlTextarea.value = decodeURIComponent(html);

            newBlockForm.setAttribute("action", `/owner/content-library/${id}?_method=PUT`);
            newBlockForm.dataset.mode = "edit";
            submitBtn.textContent = "Update Block";

            let hiddenListingId = newBlockForm.querySelector('input[name="listingId"]');
            if (!hiddenListingId) {
                hiddenListingId = document.createElement("input");
                hiddenListingId.type = "hidden";
                hiddenListingId.name = "listingId";
                newBlockForm.appendChild(hiddenListingId);
            }
            hiddenListingId.value = window.CURRENT_LISTING_ID; // ✅ fixed

            modal.classList.remove("hidden");
            switchTab("new");
        });
    });

    // ---------- Delete dropdown toggle ----------
    document.querySelectorAll(".delete-toggle-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const dropdown = btn.nextElementSibling;

            document.querySelectorAll(".delete-dropdown").forEach(d => {
                if (d !== dropdown) d.classList.add("hidden");
            });
            dropdown.classList.toggle("hidden");
        });
    });

    document.addEventListener("click", () => {
        document.querySelectorAll(".delete-dropdown").forEach(d => d.classList.add("hidden"));
    });

    // ================================================================
    // ========== NAYA: "Copy To..." modal ka poora logic ==========
    // ================================================================

    const copyModal = document.getElementById("copyToModal");
    if (copyModal) {
        const closeCopyBtn = document.getElementById("closeCopyModalBtn");
        const cancelCopyBtn = document.getElementById("cancelCopyBtn");
        const copyForm = document.getElementById("copyToForm");
        const searchInput = document.getElementById("copySearchInput");
        const examRows = document.querySelectorAll(".copy-exam-row");
        const listingRows = document.querySelectorAll(".copy-listing-row");
        const noResultsMsg = document.getElementById("noResultsMsg");

        // ---- Open modal via 🔗 Share button ----
        document.querySelectorAll(".share-block-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const blockId = btn.dataset.id;
                copyForm.setAttribute("action", `/content-blocks/${blockId}/copy-to`);

                // Har baar fresh state se kholo — pichhli selections/search clear karo
                copyForm.reset();
                searchInput.value = "";
                filterCopyList("");

                copyModal.classList.remove("hidden");
            });
        });

        // ---- Close modal ----
        function closeCopyModal() {
            copyModal.classList.add("hidden");
        }
        closeCopyBtn?.addEventListener("click", closeCopyModal);
        cancelCopyBtn?.addEventListener("click", closeCopyModal);
        copyModal.addEventListener("click", (e) => {
            if (e.target === copyModal) closeCopyModal();
        });

        // ---- Live search filter ----
        searchInput?.addEventListener("input", () => {
            filterCopyList(searchInput.value.trim().toLowerCase());
        });

        function filterCopyList(query) {
            let visibleCount = 0;

            examRows.forEach(row => {
                const match = !query || row.dataset.search.includes(query);
                row.classList.toggle("hidden", !match);
                if (match) visibleCount++;
            });

            listingRows.forEach(row => {
                const match = !query || row.dataset.search.includes(query);
                row.classList.toggle("hidden", !match);
                if (match) visibleCount++;
            });

            noResultsMsg.classList.toggle("hidden", visibleCount > 0);
        }

        // ---- Submit confirmation (optional safety) ----
        copyForm.addEventListener("submit", (e) => {
            const checkedCount = copyForm.querySelectorAll('input[type="checkbox"]:checked').length;
            if (checkedCount === 0) {
                e.preventDefault();
                alert("Kam se kam ek exam ya test series select karo.");
            }
        });
    }
});