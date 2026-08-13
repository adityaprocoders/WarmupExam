// ---------------- ADD CATEGORY MODAL (owner only) ----------------
function openCategoryModal() {
    document.getElementById('categoryModalOverlay')?.classList.remove('hidden');
}
function closeCategoryModal() {
    document.getElementById('categoryModalOverlay')?.classList.add('hidden');
}
document.getElementById('categoryModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'categoryModalOverlay') closeCategoryModal();
});

// ---------------- EDIT CATEGORY MODAL (owner only) ----------------
function openEditModal(id, name, icon, description) {
    const form = document.getElementById('editCategoryForm');
    if (!form) return;
    form.action = '/categories/' + id + '?_method=PUT';
    document.getElementById('editName').value = name;
    document.getElementById('editIcon').value = icon;
    document.getElementById('editDescription').value = description;
    document.getElementById('editCategoryModalOverlay')?.classList.remove('hidden');
}
function closeEditModal() {
    document.getElementById('editCategoryModalOverlay')?.classList.add('hidden');
}
document.getElementById('editCategoryModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'editCategoryModalOverlay') closeEditModal();
});

// ---------------- VIEW ALL / SHOW LESS TOGGLE ----------------
function toggleAllCategories() {
    const extra = document.getElementById('extraCategories');
    const text = document.getElementById('viewAllText');
    const icon = document.getElementById('viewAllIcon');

    if (!extra) return;
    extra.classList.toggle('hidden');

    if (extra.classList.contains('hidden')) {
        text.textContent = 'View All Categories';
        icon.className = 'fa-solid fa-arrow-right text-xs transition-transform duration-300';
    } else {
        text.textContent = 'Show Less';
        icon.className = 'fa-solid fa-arrow-up text-xs transition-transform duration-300';
    }
}


document.getElementById('openCategoryModalBtn')?.addEventListener('click', openCategoryModal);
document.getElementById('closeCategoryModalBtn')?.addEventListener('click', closeCategoryModal);
document.getElementById('closeEditModalBtn')?.addEventListener('click', closeEditModal);
document.getElementById('viewAllBtn')?.addEventListener('click', toggleAllCategories);


// ---------------- CATEGORY CARDS: EDIT & DELETE (event delegation, CSP-safe) ----------------
document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.editCategoryBtn');
    if (editBtn) {
        openEditModal(
            editBtn.dataset.id,
            editBtn.dataset.name,
            editBtn.dataset.icon,
            editBtn.dataset.description
        );
    }
});

document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-confirm-delete-category]');
    if (!form) return;
    if (!confirm('Are you sure you want to delete this category?')) {
        e.preventDefault();
    }
});