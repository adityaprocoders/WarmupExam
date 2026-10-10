// Owner > User detail > Payment History (table + mobile cards + view modal + refund/delete actions)
(function () {
    const dataEl = document.getElementById('paymentsData');
    if (!dataEl) return;

    let all = [];
    try { all = JSON.parse(dataEl.textContent) || []; } catch (_) { all = []; }

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

    const KIND = {
        testseries: { icon: 'fa-clipboard-list', tone: 'bg-blue-50 text-blue-600' },
        customtest: { icon: 'fa-wand-magic-sparkles', tone: 'bg-emerald-50 text-emerald-600' },
        ebook:      { icon: 'fa-book', tone: 'bg-purple-50 text-purple-600' }
    };
    const STATUS = {
        success:            { label: 'Success',            tone: 'bg-green-50 text-green-600' },
        partially_refunded: { label: 'Partially Refunded', tone: 'bg-amber-50 text-amber-600' },
        refunded:           { label: 'Refunded',           tone: 'bg-red-50 text-red-600' }
    };

    const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    function methodHtml(p) {
        if (!p.methodType) return '<span class="text-gray-300">—</span>';
        return `<p class="text-sm font-semibold text-gray-800">${esc(p.methodType)}</p>` +
               (p.methodDetail ? `<p class="text-[11px] text-gray-400 truncate max-w-[150px]">${esc(p.methodDetail)}</p>` : '');
    }
    const statusBadge = (p) => {
        const s = STATUS[p.status] || STATUS.success;
        return `<span class="inline-block whitespace-nowrap text-[11px] font-bold px-2.5 py-1 rounded-full ${s.tone}">${s.label}</span>`;
    };
    const kindIcon = (p) => {
        const k = KIND[p.kind] || KIND.testseries;
        return `<div class="w-10 h-10 rounded-full ${k.tone} flex items-center justify-center shrink-0"><i class="fa-solid ${k.icon}"></i></div>`;
    };
    const amountHtml = (p) => p.refundedAmount > 0
        ? `<p class="text-sm font-bold text-gray-900">${inr(p.amount)}</p><p class="text-[11px] text-red-500">− ${inr(p.refundedAmount)} refunded</p>`
        : `<p class="text-sm font-bold text-gray-900">${inr(p.amount)}</p>`;

    const actionsHtml = (p) => `
        <div class="flex items-center justify-end gap-1.5">
            <button type="button" data-act="view" data-id="${p.id}" class="px-3.5 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 text-xs font-semibold hover:bg-indigo-50 transition">View</button>
            <button type="button" data-act="menu" data-id="${p.id}" aria-label="More actions" class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        </div>`;

    function rowHtml(p) {
        return `
        <tr class="border-t border-gray-100 hover:bg-indigo-50/30 transition">
            <td class="py-3.5 pl-4 pr-3">
                <div class="flex items-center gap-3">${kindIcon(p)}
                    <div><p class="text-sm font-semibold text-gray-800 whitespace-nowrap">${fmtDate(p.ts)}</p><p class="text-xs text-gray-400">${fmtTime(p.ts)}</p></div>
                </div>
            </td>
            <td class="py-3.5 pr-3 text-xs font-semibold text-gray-500 whitespace-nowrap">#${esc(p.invoiceNo)}</td>
            <td class="py-3.5 pr-3 max-w-[240px]"><p class="text-sm font-bold text-gray-900 truncate" title="${esc(p.itemTitle)}">${esc(p.itemTitle)}</p><p class="text-xs text-gray-400 truncate">${esc(p.subtitle)}</p></td>
            <td class="py-3.5 pr-3"><span class="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">Purchase</span></td>
            <td class="py-3.5 pr-3 whitespace-nowrap">${amountHtml(p)}</td>
            <td class="py-3.5 pr-3">${methodHtml(p)}</td>
            <td class="py-3.5 pr-3">${statusBadge(p)}</td>
            <td class="py-3.5 pr-4">${actionsHtml(p)}</td>
        </tr>`;
    }

    function cardHtml(p) {
        return `
        <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div class="flex items-start gap-3">
                ${kindIcon(p)}
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-gray-900 truncate">${esc(p.itemTitle)}</p>
                    <p class="text-xs text-gray-400 truncate">${esc(p.subtitle)}</p>
                </div>
                ${statusBadge(p)}
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3 text-xs">
                <div><p class="text-gray-400 mb-0.5">Date</p><p class="font-semibold text-gray-700">${fmtDate(p.ts)} · ${fmtTime(p.ts)}</p></div>
                <div class="text-right"><p class="text-gray-400 mb-0.5">Amount</p>${amountHtml(p)}</div>
                <div><p class="text-gray-400 mb-0.5">Invoice</p><p class="font-semibold text-gray-700">#${esc(p.invoiceNo)}</p></div>
                <div class="text-right"><p class="text-gray-400 mb-0.5">Method</p>${methodHtml(p).replace('max-w-[150px]', 'max-w-[120px] ml-auto')}</div>
            </div>
            <div class="mt-3 pt-3 border-t border-gray-100">${actionsHtml(p)}</div>
        </div>`;
    }

    // ---------- filter + render ----------
    function filtered() {
        const f = $('payFrom').value, t = $('payTo').value;
        const from = f ? new Date(f + 'T00:00:00').getTime() : -Infinity;
        const to = t ? new Date(t + 'T23:59:59.999').getTime() : Infinity;
        return all.filter((p) => p.ts >= from && p.ts <= to);
    }

    function render() {
        const list = filtered();
        const net = list.reduce((s, p) => s + (p.amount - (p.refundedAmount || 0)), 0);
        $('payCount').textContent = list.length;
        $('payNet').textContent = inr(net);

        const empty = list.length === 0;
        $('payEmpty').classList.toggle('hidden', !empty);
        $('payEmptyMsg').textContent = all.length === 0
            ? 'Free enrollments and owner grants are not listed here.'
            : 'No payments in the selected date range.';
        $('payList').classList.toggle('hidden', empty);
        $('payRows').innerHTML = list.map(rowHtml).join('');
        $('payCards').innerHTML = list.map(cardHtml).join('');
    }

    ['payFrom', 'payTo'].forEach((id) => $(id).addEventListener('change', render));
    $('payClear').addEventListener('click', () => { $('payFrom').value = ''; $('payTo').value = ''; render(); });

    // ---------- floating three-dot menu (table ke overflow me clip na ho) ----------
    const menu = $('payMenu');
    let menuFor = null;
    function closeMenu() { menu.classList.add('hidden'); menuFor = null; }

    function openMenu(btn, p) {
        menuFor = p;
        menu.innerHTML =
            (p.canRefund ? `<button type="button" data-mact="refund" class="w-full text-left px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"><i class="fa-solid fa-rotate-left w-4"></i> Refund</button>` : '') +
            `<button type="button" data-mact="delete" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><i class="fa-solid fa-trash w-4"></i> Delete permanently</button>`;
        menu.classList.remove('hidden');
        const r = btn.getBoundingClientRect();
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw));
        const top = (r.bottom + mh + 8 > window.innerHeight) ? Math.max(8, r.top - mh - 4) : r.bottom + 4;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    document.addEventListener('click', (e) => { if (!e.target.closest('#payMenu') && !e.target.closest('[data-act="menu"]')) closeMenu(); });
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    // ---------- view modal ----------
    const viewModal = $('payViewModal');
    const row = (k, v) => `<div class="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0"><span class="text-gray-500 shrink-0">${k}</span><span class="font-semibold text-gray-900 text-right break-all">${v}</span></div>`;

    function openView(p) {
        const s = STATUS[p.status] || STATUS.success;
        const breakdown = [];
        if (p.baseAmount !== null && p.baseAmount !== undefined) breakdown.push(row('Plan price', inr(p.baseAmount)));
        if (p.couponDiscount > 0) breakdown.push(row(`Coupon${p.couponCode ? ' (' + esc(p.couponCode) + ')' : ''}`, '− ' + inr(p.couponDiscount)));
        if (p.donation > 0) breakdown.push(row('Donation', '+ ' + inr(p.donation)));
        breakdown.push(row('Total paid', inr(p.amount)));
        if (p.refundedAmount > 0) breakdown.push(row('Refunded', `<span class="text-red-600">${inr(p.refundedAmount)}</span>${p.refundedAt ? ' · ' + fmtDate(p.refundedAt) : ''}`));

        $('payViewBody').innerHTML = `
            <div class="flex items-start gap-3 mb-5">
                ${kindIcon(p)}
                <div class="min-w-0 flex-1"><p class="font-bold text-gray-900">${esc(p.itemTitle)}</p><p class="text-xs text-gray-400">${esc(p.subtitle)}</p></div>
                <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${s.tone}">${s.label}</span>
            </div>
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Transaction</p>
            <div class="text-sm mb-4">
                ${row('Invoice', '#' + esc(p.invoiceNo))}
                ${row('Paid on', fmtDate(p.ts) + ' · ' + fmtTime(p.ts))}
                ${row('Payment method', p.methodType ? esc(p.methodType) + (p.methodDetail ? ' · ' + esc(p.methodDetail) : '') : '—')}
                ${row('Razorpay order', esc(p.orderId))}
                ${row('Razorpay payment', esc(p.paymentId || '—'))}
            </div>
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Amount</p>
            <div class="text-sm mb-4">${breakdown.join('')}</div>
            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Access</p>
            <div class="text-sm">
                ${row('Validity', esc(p.validity))}
                ${row('Valid till (at purchase)', p.expiresTs ? fmtDate(p.expiresTs) : '—')}
            </div>`;
        viewModal.classList.remove('hidden');
    }
    const closeView = () => viewModal.classList.add('hidden');
    $('payViewClose').addEventListener('click', closeView);
    $('payViewClose2').addEventListener('click', closeView);
    viewModal.addEventListener('click', (e) => { if (e.target === viewModal) closeView(); });

    // ---------- confirm modal ----------
    const confirmModal = $('payConfirmModal');
    function askConfirm({ title, html, label, danger }) {
        return new Promise((resolve) => {
            $('payConfirmTitle').textContent = title;
            $('payConfirmMsg').innerHTML = html;
            const ok = $('payConfirmOk');
            ok.textContent = label;
            ok.className = 'flex-1 py-2.5 rounded-lg text-white text-sm font-semibold ' + (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600');
            confirmModal.classList.remove('hidden');
            const done = (v) => {
                confirmModal.classList.add('hidden');
                ok.onclick = null; $('payConfirmCancel').onclick = null;
                resolve(v);
            };
            ok.onclick = () => done(true);
            $('payConfirmCancel').onclick = () => done(false);
        });
    }

    async function call(url, method) {
        try {
            const res = await fetch(url, { method });
            const data = await res.json();
            if (data.success) { showToast(data.message || 'Done.', 'success'); window.location.reload(); }
            else showToast(data.message || 'Action failed.', 'error');
        } catch (_) {
            showToast('Network error. Please check your connection and try again.', 'error');
        }
    }

    async function doRefund(p) {
        const remaining = p.amount - (p.refundedAmount || 0);
        const consequence = p.kind === 'testseries'
            ? 'The student\'s enrollment and <b>all attempts data</b> for this test series will be deleted, exactly like when a plan expires.'
            : 'The student\'s Custom Test access for this plan will be removed (the plan duration is reduced from their expiry).';
        const ok = await askConfirm({
            title: 'Refund this payment?',
            html: `<p class="mb-2"><b>${esc(p.itemTitle)}</b> · #${esc(p.invoiceNo)}</p>
                   <p class="mb-2">${inr(remaining)} will be refunded to the student via Razorpay (usually 5–7 working days).</p>
                   <p class="text-red-600">${consequence} This cannot be undone.</p>`,
            label: `Refund ${inr(remaining)}`, danger: false
        });
        if (ok) call(`/api/owner/payments/${p.id}/refund`, 'POST');
    }

    async function doDelete(p) {
        const ok = await askConfirm({
            title: 'Delete payment record?',
            html: `<p class="mb-2"><b>${esc(p.itemTitle)}</b> · #${esc(p.invoiceNo)}</p>
                   <p>This removes the record from the database <b>permanently</b>. It does not refund the money and does not change the student's access.</p>`,
            label: 'Delete permanently', danger: true
        });
        if (ok) call(`/api/owner/payments/${p.id}`, 'DELETE');
    }

    // ---------- events ----------
    function onClick(e) {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const p = all.find((x) => x.id === b.dataset.id);
        if (!p) return;
        if (b.dataset.act === 'view') openView(p);
        if (b.dataset.act === 'menu') { e.stopPropagation(); (menuFor && menuFor.id === p.id && !menu.classList.contains('hidden')) ? closeMenu() : openMenu(b, p); }
    }
    $('payRows').addEventListener('click', onClick);
    $('payCards').addEventListener('click', onClick);

    menu.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mact]');
        if (!b || !menuFor) return;
        const p = menuFor;
        closeMenu();
        if (b.dataset.mact === 'refund') doRefund(p);
        if (b.dataset.mact === 'delete') doDelete(p);
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeView(); } });

    render();
})();