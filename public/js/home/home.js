// ---------------- POPULAR TESTS GRID: ENROLL/BUY/DELETE (event delegation, CSP-safe) ----------------
document.getElementById('popularTestsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const loggedIn = btn.dataset.loggedIn === 'true';
    if (btn.dataset.action === 'enroll') enrollNow(id, loggedIn);
    if (btn.dataset.action === 'buy') buyNow(id, loggedIn);
});

document.getElementById('popularTestsGrid')?.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-confirm-delete]');
    if (!form) return;
    if (!confirm('Are you sure you want to delete this?')) {
        e.preventDefault();
    }
});