const userId = document.getElementById('userDetailPage').dataset.userId;

// ---------------- GRANT SUBSCRIPTION ----------------
document.getElementById('addSubscriptionForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const payload = {
        listingId: formData.get('listingId'),
        duration: formData.get('duration'),
        startDate: formData.get('startDate') || new Date().toISOString().slice(0,10),
        reason: formData.get('reason')
    };

    if (!payload.listingId) {
        alert('Batch select karo pehle');
        return;
    }

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Granting...';

    try {
        const res = await fetch(`/api/owner/users/${userId}/grant-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            alert(data.message);
            window.location.reload();
        } else {
            alert(data.message || 'Grant nahi ho paya');
        }
    } catch (err) {
        alert('Network error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Grant Subscription';
    }
});

// ---------------- SAVE PERMISSIONS ----------------
document.getElementById('permissionsForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const checked = Array.from(this.querySelectorAll('input[name="permissions"]:checked')).map(c => c.value);

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        const res = await fetch(`/api/owner/users/${userId}/permissions`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: checked })
        });
        const data = await res.json();
        alert(data.success ? 'Permissions save ho gayi' : (data.message || 'Save nahi ho paya'));
    } catch (err) {
        alert('Network error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------- QUICK ACTIONS ----------------
document.getElementById('grantSubBtn')?.addEventListener('click', () => {
    document.getElementById('addSubscriptionForm').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('resetPassBtn')?.addEventListener('click', async () => {
    if (!confirm('Is user ka password reset karke email bhejna hai?')) return;
    try {
        const res = await fetch(`/api/owner/users/${userId}/reset-password`, { method: 'POST' });
        const data = await res.json();
        alert(data.message);
    } catch (err) {
        alert('Network error');
    }
});

document.getElementById('banUserBtn')?.addEventListener('click', async () => {
    if (!confirm('Is user ko ban/unban karna hai?')) return;
    try {
        const res = await fetch(`/api/owner/users/${userId}/ban`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
            alert(data.banned ? 'User ban ho gaya' : 'User unban ho gaya');
            window.location.reload();
        }
    } catch (err) {
        alert('Network error');
    }
});

document.getElementById('deleteAccBtn')?.addEventListener('click', async () => {
    if (!confirm('Is account ko permanently delete karna hai? Ye wapas nahi ho sakta.')) return;
    try {
        const res = await fetch(`/api/owner/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            alert('Account delete ho gaya');
            window.location.href = '/owner-dashboard';
        }
    } catch (err) {
        alert('Network error');
    }
});