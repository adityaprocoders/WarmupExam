async function enrollNow(listingId, isLoggedIn) {
    if (!isLoggedIn) {
        openAuthModal('login');
        return;
    }

    try {
        const res = await fetch(`/enroll/${listingId}`, { method: "POST" });
        const data = await res.json();

        if (data.success) {
            // Redirect nahi, sirf reload — taaki button "Start Test" ban jaye aur flash dikhe
            window.location.reload();
        } else {
             hideLoader(); 
            showToast(data.message || "Enrollment failed.", "error");
        }
    } catch (err) {
         hideLoader(); 
        showToast("Something went wrong, please try again.", "error");
    }
}
 

function buyNow(listingId, isLoggedIn) {
    if (!isLoggedIn) {
        openAuthModal('login');
        return;
    }
    const from = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/order-summary/${listingId}?from=${from}`;
}


document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const loggedIn = btn.dataset.loggedIn === 'true';

    if (btn.dataset.action === 'enroll') enrollNow(id, loggedIn);
    if (btn.dataset.action === 'buy') buyNow(id, loggedIn);
});