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