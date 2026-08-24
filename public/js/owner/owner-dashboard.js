
(function () {
  // ---------- Sidebar / Nav toggle ----------
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const menuBtn = document.getElementById('menuBtn');
  const pageTitle = document.getElementById('pageTitle');
  const sideLinks = document.querySelectorAll('.side-link');
  const sections = document.querySelectorAll('.content-section');
  let activeTab = 'dashboard';

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });

  const tabLoaders = {
    dashboard: loadDashboard,
    testseries: loadTestSeries,
    coupons: loadCoupons,
    users: () => loadUsers(userSearchInput ? userSearchInput.value.trim() : ''),
    payments: loadPayments,
    loginhistory: loadLoginHistory
  };

  sideLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sideLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      const target = link.dataset.target;
      activeTab = target;
      sections.forEach(s => s.classList.add('hidden'));
      document.getElementById('content-' + target).classList.remove('hidden');
      pageTitle.textContent = link.textContent.trim();

      if (window.innerWidth < 1024) {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
      }

      if (tabLoaders[target]) tabLoaders[target]();
    });
  });

  document.getElementById('refreshBtn').addEventListener('click', () => {
    if (tabLoaders[activeTab]) tabLoaders[activeTab]();
  });

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtCurrency(n) {
    const num = Number(n) || 0;
    return '₹' + num.toLocaleString('en-IN');
  }

  // ---------------- DASHBOARD: Stats + Charts ----------------
  let userGrowthChartInstance = null;
  let revenueChartInstance = null;
  let enrollmentChartInstance = null;

  async function loadDashboard() {
    try {
      const res = await fetch('/api/owner/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        document.getElementById('statTotalTestSeries').textContent = data.stats.totalTestSeries;
        document.getElementById('statTotalUsers').textContent = data.stats.totalUsers;
        document.getElementById('statActiveUsers').textContent = data.stats.activeUsers;
        document.getElementById('statRevenue').textContent = fmtCurrency(data.stats.revenueThisMonth);
        document.getElementById('statAttemptsToday').textContent =
          data.stats.attemptsToday === null ? 'N/A' : data.stats.attemptsToday;
      }
    } catch (err) {
      console.error('Stats load error:', err);
    }

    try {
      const res = await fetch('/api/owner/dashboard/charts');
      const data = await res.json();
      if (data.success) renderCharts(data.userGrowth, data.revenueTrend, data.enrollmentChart);
    } catch (err) {
      console.error('Chart load error:', err);
    }
  }

  function renderCharts(userGrowth, revenueTrend, enrollmentChart) {
    const labels = userGrowth.map(u => u.month);
    const counts = userGrowth.map(u => u.count);

    if (userGrowthChartInstance) userGrowthChartInstance.destroy();
    userGrowthChartInstance = new Chart(document.getElementById('userGrowthChart'), {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          label: 'New Users',
          data: counts.length ? counts : [0],
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.08)',
          fill: true, tension: 0.35, pointRadius: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
      }
    });

    const revLabels = revenueTrend.map(r => r.month);
    const revData = revenueTrend.map(r => r.total);

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: {
        labels: revLabels.length ? revLabels : ['No data'],
        datasets: [{
          label: 'Revenue (₹)',
          data: revData.length ? revData : [0],
          backgroundColor: '#f59e0b', borderRadius: 6, maxBarThickness: 36
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
      }
    });

    const enrollLabels = enrollmentChart.map(e => e.title);
    const enrollCounts = enrollmentChart.map(e => e.count);

    if (enrollmentChartInstance) enrollmentChartInstance.destroy();
    enrollmentChartInstance = new Chart(document.getElementById('enrollmentChart'), {
      type: 'bar',
      data: {
        labels: enrollLabels.length ? enrollLabels : ['No enrollments yet'],
        datasets: [{
          label: 'Enrollments',
          data: enrollCounts.length ? enrollCounts : [0],
          backgroundColor: '#4f46e5', borderRadius: 6, maxBarThickness: 36
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } }
      }
    });
  }

  // ---------------- TEST SERIES ----------------
  const testSeriesGrid = document.getElementById('testSeriesGrid');

  async function loadTestSeries() {
    testSeriesGrid.innerHTML = `<p class="text-gray-400 text-sm col-span-full text-center py-6">Loading test series...</p>`;
    try {
      const res = await fetch('/api/owner/testseries');
      const data = await res.json();
      if (!data.success || !data.listings.length) {
        testSeriesGrid.innerHTML = `<p class="text-gray-400 text-sm col-span-full text-center py-6">Koi test series nahi mili.</p>`;
        return;
      }
      allTestSeriesData = data.listings;   // 👈 NAYA
      testSeriesGrid.innerHTML = data.listings.map(testSeriesCard).join('');
      attachTestSeriesEvents();

      // 👈 NAYA: agar search box me pehle se kuch type kiya hua hai, usko re-apply karo
      const searchInput = document.getElementById('testSeriesSearchInput');
      if (searchInput && searchInput.value.trim()) {
        filterTestSeries(searchInput.value);
      }
    } catch (err) {
      testSeriesGrid.innerHTML = `<p class="text-red-500 text-sm col-span-full text-center py-6">Load karne mein error aayi.</p>`;
    }
}

  // 👇 NAYA: client-side filter (title/exam name se), instant hai — koi naya API call nahi
let allTestSeriesData = [];   // last fetch ka data yahan store rahega

function filterTestSeries(term) {
    const q = term.trim().toLowerCase();
    const cards = document.querySelectorAll('#testSeriesGrid > div[data-title]');

    let visibleCount = 0;
    cards.forEach(card => {
        const matches = !q || card.dataset.title.includes(q) || card.dataset.exam.includes(q);
        card.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    let emptyMsg = document.getElementById('testSeriesEmptyMsg');
    if (visibleCount === 0) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('p');
            emptyMsg.id = 'testSeriesEmptyMsg';
            emptyMsg.className = 'text-gray-400 text-sm col-span-full text-center py-6';
            emptyMsg.textContent = 'Koi matching test series nahi mili.';
            testSeriesGrid.appendChild(emptyMsg);
        }
    } else if (emptyMsg) {
        emptyMsg.remove();
    }
}

function testSeriesCard(s) {
    const priceLabel = s.type === 'Free' ? 'FREE' : fmtCurrency(s.price);
    const typeBadge = s.type === 'Free'
      ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600">FREE</span>`
      : `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">PAID</span>`;
    const visibilityBadge = s.visibility === 'private'
      ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 ml-1.5">PRIVATE</span>`
      : `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 ml-1.5">PUBLIC</span>`;

    const enrollBadge = `
      <span class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 ml-1.5">
        <i class="fa-solid fa-users text-[10px]"></i> ${s.enrolledCount} enrolled
      </span>`;

    return `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-title="${escapeHtml((s.title || '').toLowerCase())}" data-exam="${escapeHtml((s.exam || '').toLowerCase())}">
        <img src="${escapeHtml(s.image)}" class="w-full h-40 object-cover" loading="lazy">
        <div class="p-4">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-bold text-gray-900 truncate">${escapeHtml(s.title)}</h4>
          </div>
          <div class="mb-2 flex flex-wrap items-center">${typeBadge}${visibilityBadge}${enrollBadge}</div>
          <p class="text-gray-900 font-bold mb-1">${priceLabel}</p>
          <p class="text-xs text-gray-400 mb-3">${s.purchasedCount} purchased (all-time)</p>
          <div class="flex gap-2">
            <a href="/tests/${s._id}/edit" class="flex-1 text-center border-2 border-indigo-600 text-indigo-600 text-sm font-semibold py-2 rounded-lg hover:bg-indigo-50">Edit</a>
            <button data-id="${s._id}" class="deleteTestSeriesBtn flex-1 text-center bg-red-50 text-red-600 text-sm font-semibold py-2 rounded-lg hover:bg-red-100">Delete</button>
          </div>
        </div>
      </div>`;
}

  function attachTestSeriesEvents() {
    document.querySelectorAll('.deleteTestSeriesBtn').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Is test series ko delete karna hai?')) return;
        const id = this.dataset.id;
        this.disabled = true;
        try {
          const res = await fetch(`/api/owner/testseries/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) loadTestSeries();
          else { alert(data.message || 'Delete nahi ho paya'); this.disabled = false; }
        } catch (err) {
          alert('Something went wrong');
          this.disabled = false;
        }
      });
    });
  }

  // ---------------- COUPONS ----------------
  const openCouponFormBtn = document.getElementById('openCouponFormBtn');
  const couponFormBox = document.getElementById('couponFormBox');
  const cancelCouponFormBtn = document.getElementById('cancelCouponFormBtn');
  const couponForm = document.getElementById('couponForm');
  const couponFormMsg = document.getElementById('couponFormMsg');
  const couponsTableBody = document.getElementById('couponsTableBody');

  openCouponFormBtn?.addEventListener('click', () => couponFormBox.classList.remove('hidden'));
  cancelCouponFormBtn?.addEventListener('click', () => {
    couponFormBox.classList.add('hidden');
    couponForm.reset();
    couponFormMsg.classList.add('hidden');
  });

  function formatExpiry(dateStr) {
    if (!dateStr) return '<span class="text-gray-400">No expiry</span>';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function couponRow(c) {
    const discountText = c.discountType === 'flat'
      ? `${fmtCurrency(c.discountValue)} off`
      : `${c.discountValue}% off${c.maxDiscount ? ` (max ${fmtCurrency(c.maxDiscount)})` : ''}`;
    const usageText = `${c.usedCount || 0}${c.usageLimit ? ' / ' + c.usageLimit : ' / ∞'}`;
    const statusBadge = c.isActive
      ? `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-600">Active</span>`
      : `<span class="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Inactive</span>`;

    return `
      <tr class="border-t border-gray-50">
        <td class="px-4 py-3 font-bold text-gray-900">${escapeHtml(c.code)}</td>
        <td class="px-4 py-3 text-gray-700">${discountText}</td>
        <td class="px-4 py-3 text-gray-700">${fmtCurrency(c.minPurchase || 0)}</td>
        <td class="px-4 py-3 text-gray-700">${usageText}</td>
        <td class="px-4 py-3 text-gray-700">${formatExpiry(c.expiryDate)}</td>
        <td class="px-4 py-3">${statusBadge}</td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <button data-id="${c._id}" class="toggleCouponBtn text-xs font-semibold text-indigo-600 hover:underline mr-3">
            ${c.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button data-id="${c._id}" class="deleteCouponBtn text-xs font-semibold text-red-600 hover:underline">Delete</button>
        </td>
      </tr>`;
  }

  async function loadCoupons() {
    couponsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-8">Loading coupons...</td></tr>`;
    try {
      const res = await fetch('/admin/coupons');
      const data = await res.json();
      if (!data.success || !data.coupons.length) {
        couponsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400 py-8">No coupons created yet.</td></tr>`;
        return;
      }
      couponsTableBody.innerHTML = data.coupons.map(couponRow).join('');
      attachCouponRowEvents();
    } catch (err) {
      couponsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-8">Failed to load coupons.</td></tr>`;
    }
  }

  function attachCouponRowEvents() {
    document.querySelectorAll('.toggleCouponBtn').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        this.disabled = true;
        try {
          const res = await fetch(`/admin/coupons/${id}/toggle`, { method: 'PATCH' });
          const data = await res.json();
          if (data.success) loadCoupons(); else this.disabled = false;
        } catch (err) { alert('Something went wrong'); this.disabled = false; }
      });
    });
    document.querySelectorAll('.deleteCouponBtn').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Is coupon ko delete karna hai?')) return;
        const id = this.dataset.id;
        try {
          const res = await fetch(`/admin/coupons/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) loadCoupons();
        } catch (err) { alert('Something went wrong'); }
      });
    });
  }

  couponForm?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const formData = new FormData(couponForm);
    const payload = {
      code: formData.get('code'),
      discountType: formData.get('discountType'),
      discountValue: Number(formData.get('discountValue')),
      maxDiscount: formData.get('maxDiscount') ? Number(formData.get('maxDiscount')) : null,
      minPurchase: formData.get('minPurchase') ? Number(formData.get('minPurchase')) : 0,
      expiryDate: formData.get('expiryDate') || null,
      usageLimit: formData.get('usageLimit') ? Number(formData.get('usageLimit')) : null,
      perUserLimit: formData.get('perUserLimit') ? Number(formData.get('perUserLimit')) : 1
    };

    const submitBtn = couponForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';

    try {
      const res = await fetch('/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      couponFormMsg.classList.remove('hidden');
      if (data.success) {
        couponFormMsg.className = 'sm:col-span-2 text-sm text-green-600';
        couponFormMsg.innerText = 'Coupon created successfully!';
        couponForm.reset();
        loadCoupons();
        setTimeout(() => {
          couponFormBox.classList.add('hidden');
          couponFormMsg.classList.add('hidden');
        }, 1200);
      } else {
        couponFormMsg.className = 'sm:col-span-2 text-sm text-red-600';
        couponFormMsg.innerText = data.message || 'Failed to create coupon';
      }
    } catch (err) {
      couponFormMsg.classList.remove('hidden');
      couponFormMsg.className = 'sm:col-span-2 text-sm text-red-600';
      couponFormMsg.innerText = 'Something went wrong, try again';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Save Coupon';
    }
  });

  // ---------------- USERS ----------------
  const userSearchInput = document.getElementById('userSearchInput');
  const usersTableBody = document.getElementById('usersTableBody');
  const usersCardList = document.getElementById('usersCardList');
  const userTotalBadge = document.getElementById('userTotalBadge');
  let userSearchTimeout = null;

  async function loadUsers(searchTerm = '') {
    usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Loading users...</td></tr>`;
    usersCardList.innerHTML = `<p class="text-center text-gray-400 py-8">Loading users...</p>`;

    try {
      const url = searchTerm ? `/api/owner/users?search=${encodeURIComponent(searchTerm)}` : `/api/owner/users`;
      const res = await fetch(url);
      const data = await res.json();

      userTotalBadge.textContent = `${data.total} Total`;

      if (!data.success || !data.users.length) {
        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Koi user nahi mila.</td></tr>`;
        usersCardList.innerHTML = `<p class="text-center text-gray-400 py-8">Koi user nahi mila.</p>`;
        return;
      }

      usersTableBody.innerHTML = data.users.map(userRow).join('');
      usersCardList.innerHTML = data.users.map(userCard).join('');
      attachUserEvents();
    } catch (err) {
      usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Load karne mein error aayi.</td></tr>`;
      usersCardList.innerHTML = `<p class="text-center text-red-500 py-8">Load karne mein error aayi.</p>`;
    }
  }

function statusBadge(status) {
    const map = {
        Active:           { dot: 'bg-green-500', text: 'text-green-600' },
        Expired:          { dot: 'bg-amber-500', text: 'text-amber-600' },
        Suspended:        { dot: 'bg-red-500',   text: 'text-red-600' },
        'No Subscription':{ dot: 'bg-gray-400',  text: 'text-gray-500' }   // 👈 NAYA
    };
    const c = map[status] || map.Active;
    return `<span class="inline-flex items-center gap-1.5 text-xs font-semibold ${c.text}">
        <span class="w-1.5 h-1.5 rounded-full ${c.dot}"></span>${status}
    </span>`;
}
function planBadge(plan) {
    return plan === 'Premium'
        ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Premium</span>`
        : `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Free</span>`;
}

function userAvatar(u, sizeClass) {
    const initial = (u.name || u.username || u.email || '?').charAt(0).toUpperCase();
    if (u.avatar) {
        return `<img src="${escapeHtml(u.avatar)}" class="${sizeClass} rounded-full object-cover shrink-0" loading="lazy">`;
    }
    return `<div class="${sizeClass} rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">${escapeHtml(initial)}</div>`;
}

function fmtJoinDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function userRow(u) {
    return `
      <tr class="border-b border-gray-50 hover:bg-gray-50/60">
        <td class="py-3 pr-3">
          <a href="/owner/users/${u._id}" class="flex items-center gap-2.5 hover:underline">
            ${userAvatar(u, 'w-9 h-9')}
            <div class="min-w-0">
              <span class="font-semibold text-indigo-900 block truncate">${escapeHtml(u.name || '-')}</span>
              <span class="text-[11px] text-gray-400">${u.username ? '@' + escapeHtml(u.username) : '-'}</span>
            </div>
          </a>
        </td>
        <td class="py-3 pr-3 text-gray-600 truncate max-w-[180px]">${escapeHtml(u.email)}</td>
        <td class="py-3 pr-3">${planBadge(u.plan)}</td>
        <td class="py-3 pr-3 text-gray-600 text-center">${u.enrolledCount}</td>
        <td class="py-3 pr-3 text-gray-500 text-xs whitespace-nowrap">${fmtJoinDate(u.joinedOn)}</td>
        <td class="py-3 pr-3">${statusBadge(u.status)}</td>
        <td class="py-3 pr-3">
          <button data-id="${u._id}" class="toggleUserBtn relative inline-flex h-6 w-11 items-center rounded-full transition ${u.hasActiveSub ? 'bg-green-500' : 'bg-gray-300'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition ${u.hasActiveSub ? 'translate-x-6' : 'translate-x-1'}"></span>
          </button>
        </td>
        <td class="py-3 text-right">
          <button data-id="${u._id}" class="deleteUserBtn w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </td>
      </tr>`;
}

function userCard(u) {
    return `
      <div class="border border-gray-100 rounded-xl p-3.5 space-y-3">
        <div class="flex items-center gap-3">
          ${userAvatar(u, 'w-11 h-11')}
          <div class="min-w-0 flex-1">
            <a href="/owner/users/${u._id}" class="font-semibold text-indigo-900 text-sm truncate block hover:underline">${escapeHtml(u.name || '-')}</a>
            <p class="text-[11px] text-gray-400">${u.username ? '@' + escapeHtml(u.username) : '-'}</p>
            <p class="text-xs text-gray-500 truncate">${escapeHtml(u.email)}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          ${planBadge(u.plan)}
          <span class="text-gray-400">•</span>
          <span class="text-gray-600">${u.enrolledCount} series enrolled</span>
          <span class="text-gray-400">•</span>
          ${statusBadge(u.status)}
        </div>

        <p class="text-[11px] text-gray-400">Joined on ${fmtJoinDate(u.joinedOn)}</p>

        <div class="flex items-center justify-between pt-1 border-t border-gray-50">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Subscription</span>
            <button data-id="${u._id}" class="toggleUserBtn relative inline-flex h-6 w-11 items-center rounded-full transition ${u.hasActiveSub ? 'bg-green-500' : 'bg-gray-300'}">
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition ${u.hasActiveSub ? 'translate-x-6' : 'translate-x-1'}"></span>
            </button>
          </div>
          <button data-id="${u._id}" class="deleteUserBtn w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>`;
}

  function attachUserEvents() {
    document.querySelectorAll('.toggleUserBtn').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = this.dataset.id;
        this.disabled = true;
        try {
          const res = await fetch(`/api/owner/users/${id}/toggle`, { method: 'PATCH' });
          const data = await res.json();
          if (data.success) loadUsers(userSearchInput.value.trim());
          else { alert(data.message || 'Update nahi ho paya'); this.disabled = false; }
        } catch (err) { alert('Something went wrong'); this.disabled = false; }
      });
    });

    document.querySelectorAll('.deleteUserBtn').forEach(btn => {
      btn.addEventListener('click', async function () {
        if (!confirm('Is user ko delete karna hai? Ye action wapas nahi ho sakta.')) return;
        const id = this.dataset.id;
        try {
          const res = await fetch(`/api/owner/users/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) loadUsers(userSearchInput.value.trim());
          else alert(data.message || 'Delete nahi ho paya');
        } catch (err) { alert('Something went wrong'); }
      });
    });
  }

  userSearchInput?.addEventListener('input', function () {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(() => loadUsers(this.value.trim()), 400);
  });

  // ---------------- PAYMENTS (naya, real data) ----------------
  const paymentsTableBody = document.getElementById('paymentsTableBody');
  const paymentsTotalRevenue = document.getElementById('paymentsTotalRevenue');
  const paymentsCount = document.getElementById('paymentsCount');

  async function loadPayments() {
    paymentsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Loading payments...</td></tr>`;
    try {
      const res = await fetch('/api/owner/payments');
      const data = await res.json();

      if (!data.success) {
        paymentsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">${escapeHtml(data.message || 'Load nahi ho paya')}</td></tr>`;
        return;
      }

      paymentsTotalRevenue.textContent = fmtCurrency(data.totalRevenue);
      paymentsCount.textContent = data.count;

      if (!data.payments.length) {
        paymentsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Abhi tak koi paid transaction nahi hui.</td></tr>`;
        return;
      }

      paymentsTableBody.innerHTML = data.payments.map(p => `
        <tr class="border-t border-gray-50">
          <td class="px-4 py-3 text-gray-700 font-mono text-xs">${escapeHtml(p.invoiceId)}</td>
          <td class="px-4 py-3">
            <p class="font-semibold text-gray-900">${escapeHtml(p.userName || '-')}</p>
            <p class="text-xs text-gray-500">${escapeHtml(p.userEmail || '')}</p>
          </td>
          <td class="px-4 py-3 text-gray-700">${escapeHtml(p.listingTitle)}</td>
          <td class="px-4 py-3 font-semibold text-gray-900">${fmtCurrency(p.amount)}</td>
          <td class="px-4 py-3 text-gray-500 text-xs">${new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        </tr>
      `).join('');
    } catch (err) {
      paymentsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Load karne mein error aayi.</td></tr>`;
    }
  }


  const loginHistoryTableBody = document.getElementById('loginHistoryTableBody');
const loginHistoryBadge = document.getElementById('loginHistoryBadge');

async function loadLoginHistory() {
  loginHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Loading...</td></tr>`;
  try {
    const res = await fetch('/api/owner/login-history');
    const data = await res.json();

    if (!data.success) {
      loginHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Load nahi ho paya.</td></tr>`;
      return;
    }

    loginHistoryBadge.textContent = `${data.history.length} entries`;

    if (!data.history.length) {
      loginHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-400 py-8">Koi login history nahi hai.</td></tr>`;
      return;
    }

    loginHistoryTableBody.innerHTML = data.history.map(h => `
      <tr class="border-t border-gray-50">
        <td class="px-4 py-3 text-gray-700">${new Date(h.createdAt).toLocaleString('en-IN')}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(h.ipAddress)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(h.location)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(h.device)}</td>
        <td class="px-4 py-3 text-right">
          <button data-id="${h._id}" class="deleteLoginHistoryBtn w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center ml-auto">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </td>
      </tr>
    `).join('');

    attachLoginHistoryEvents();
  } catch (err) {
    loginHistoryTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-500 py-8">Load karne mein error aayi.</td></tr>`;
  }
}

function attachLoginHistoryEvents() {
  document.querySelectorAll('.deleteLoginHistoryBtn').forEach(btn => {
    btn.addEventListener('click', async function () {
      if (!confirm('Is login entry ko delete karna hai?')) return;
      const id = this.dataset.id;
      this.disabled = true;
      try {
        const res = await fetch(`/api/owner/login-history/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) loadLoginHistory();
        else { alert(data.message || 'Delete nahi ho paya'); this.disabled = false; }
      } catch (err) {
        alert('Something went wrong');
        this.disabled = false;
      }
    });
  });
}

document.getElementById('deleteAllLoginHistoryBtn')?.addEventListener('click', async function () {
  if (!confirm('Poori login history delete karna hai? Ye action wapas nahi ho sakta.')) return;
  this.disabled = true;
  try {
    const res = await fetch('/api/owner/login-history-all', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) loadLoginHistory();
    else { alert(data.message || 'Delete nahi ho paya'); this.disabled = false; }
  } catch (err) {
    alert('Something went wrong');
    this.disabled = false;
  }
});

// 👇 NAYA: test series search input
document.getElementById('testSeriesSearchInput')?.addEventListener('input', function () {
    filterTestSeries(this.value);
});

  // ---------------- INITIAL LOAD ----------------
  loadDashboard();
})();
 