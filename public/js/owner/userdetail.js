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
        showToast('Please select a batch first.', 'error');
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
             showToast(data.message, "success");
            window.location.reload();
        } else {
            showToast(data.message || 'Grant failed.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please check your connection and try again.', 'error');
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
        showToast(data.success ? 'Permissions saved successfully.' : (data.message || 'Failed to save.'), data.success ? 'success' : 'error');
    } catch (err) {
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------- QUICK ACTIONS ----------------
document.getElementById('grantSubBtn')?.addEventListener('click', () => {
    document.getElementById('addSubscriptionForm').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('resetPassBtn')?.addEventListener('click', async () => {
    if (!confirm('Reset the password for this user and email it to them?')) return;
    try {
        const res = await fetch(`/api/owner/users/${userId}/reset-password`, { method: 'POST' });
        const data = await res.json();
         showToast(data.message, data.success ? "success" : "error");
    } catch (err) {
        showToast('Network error. Please check your connection and try again.', 'error');
    }
});

// ---------------- BAN / UNBAN USER ----------------
document.getElementById('banUserBtn')?.addEventListener('click', async function () {
    const isBanned = this.dataset.banned === 'true';

    if (isBanned) {
        if (!confirm('Remove the ban on this user?')) return;
        this.disabled = true;
        try {
            const res = await fetch(`/api/owner/users/${userId}/unban`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                window.location.reload();
            } else {
                showToast(data.message || 'Unban failed.', 'error');
                this.disabled = false;
            }
        } catch (err) {
            showToast('Network error. Please check your connection and try again.', 'error');
            this.disabled = false;
        }
        return;
    }

    document.getElementById('banUserModalOverlay').classList.remove('hidden');
});

document.getElementById('banModalCloseBtn')?.addEventListener('click', closeBanModal);
document.getElementById('banModalCancelBtn')?.addEventListener('click', closeBanModal);

function closeBanModal() {
    document.getElementById('banUserModalOverlay').classList.add('hidden');
    document.getElementById('banUserForm').reset();
    document.getElementById('banDurationBox').classList.add('hidden');
    document.getElementById('banFormMsg').classList.add('hidden');
}

document.querySelectorAll('input[name="banType"]').forEach(radio => {
    radio.addEventListener('change', function () {
        document.getElementById('banDurationBox').classList.toggle('hidden', this.value !== 'temporary');
    });
});

document.getElementById('banUserForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const payload = {
        banReason: formData.get('banReason'),
        banType: formData.get('banType'),
        durationDays: formData.get('durationDays')
    };

    if (!payload.banReason) {
        showToast('Please select a reason..', 'error');
        return;
    }

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Banning...';

    try {
        const res = await fetch(`/api/owner/users/${userId}/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'success');
            window.location.reload();
        } else {
            showToast(data.message || 'Ban failed.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please check your connection and try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Ban';
    }
});

document.getElementById('deleteAccBtn')?.addEventListener('click', async () => {
    if (!confirm('Permanently delete this account? This action cannot be undone.')) return;
    try {
        const res = await fetch(`/api/owner/users/${userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Account deleted successfully.', 'success');
            window.location.href = '/owner-dashboard';
        }
    } catch (err) {
        showToast('Network error. Please check your connection and try again.', 'error');
    }
});


// ---------------- CUSTOM TEST ACCESS ----------------
(function () {
    const form = document.getElementById('customTestGrantForm');
    if (!form) return;

    const planSelect = document.getElementById('ctPlanSelect');
    const monthsSelect = document.getElementById('ctMonthsSelect');
    let pricing = { pro: [], promax: [] };
    try {
        pricing = JSON.parse(document.getElementById('ctPricingData').textContent);
    } catch (_) {}

    function fillMonths() {
        const rows = pricing[planSelect.value] || [];
        monthsSelect.innerHTML = rows.length
            ? rows.map(r => `<option value="${r.months}">${r.months} Month${r.months > 1 ? 's' : ''} (₹${r.price})</option>`).join('')
            : '<option value="">No duration available</option>';
    }
    planSelect.addEventListener('change', fillMonths);
    fillMonths();

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const plan = planSelect.value;
        const months = monthsSelect.value;
        if (!months) {
            showToast('No duration is configured in pricing for this plan.', 'error');
            return;
        }

        const currentTier = form.dataset.currentTier;
        if (currentTier !== 'free' && currentTier !== plan) {
            if (!confirm('The current plan of this user is different. Applying the new plan will discard the remaining days of the old plan. Continue?')) return;
        }

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Granting...';

        try {
            const res = await fetch(`/api/owner/users/${userId}/custom-test/grant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, months })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                window.location.reload();
            } else {
                showToast(data.message || 'Grant failed.', 'error');
            }
        } catch (err) {
            showToast('Network error. Please check your connection and try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Grant Custom Test Access';
        }
    });

    document.getElementById('revokeCustomTestBtn')?.addEventListener('click', async () => {
        if (!confirm('Remove Custom Test (Pro/Pro Max) access for this user?')) return;
        try {
            const res = await fetch(`/api/owner/users/${userId}/custom-test/revoke`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                window.location.reload();
            } else {
                showToast(data.message || 'Remove failed.', 'error');
            }
        } catch (err) {
            showToast('Network error. Please check your connection and try again.', 'error');
        }
    });
})();