(function () {
    const pageEl = document.getElementById('categoryDetailPage');
    if (!pageEl) return;

    const categorySlug = pageEl.dataset.categorySlug;
    const csrfToken = pageEl.dataset.csrfToken;

    const grid = document.getElementById('testsGrid');
    if (!grid) return; // totalListingsCount === 0 case — grid section not rendered

    const noResultsMsg = document.getElementById('noResultsMsg');
    const viewAllBtn = document.getElementById('viewAllTestsBtn');
    const viewAllText = document.getElementById('viewAllTestsText');
    const viewAllIcon = document.getElementById('viewAllTestsIcon');
    const searchInput = document.getElementById('categorySearchInput');
    const sectionHeading = document.getElementById('sectionHeading');
    const filterTabs = document.querySelectorAll('.filterTab');
    const examTabs = document.querySelectorAll('.examTab');
    const searchDropdown = document.getElementById('categorySearchDropdown');
    const languageBtn = document.getElementById('languageDropdownBtn');
    const languageMenu = document.getElementById('languageDropdownMenu');
    const languageLabel = document.getElementById('languageDropdownLabel');
    const languageChevron = document.getElementById('languageDropdownChevron');
    const languageOptions = document.querySelectorAll('.language-option');
    const examTabsScroll = document.getElementById('examTabsScroll');
    const examTabsFade = document.getElementById('examTabsFade');
    const moreExamsBtn = document.getElementById('moreExamsBtn');
    const moreExamsMenu = document.getElementById('moreExamsMenu');
    const moreExamsChevron = document.getElementById('moreExamsChevron');
    const moreExamOptions = document.querySelectorAll('.moreExamOption');

    let currentFilter = 'all';
    let currentExam = 'all';   // 👈 NAYA — exam filter independent
    let currentSearch = '';
    let currentPage = 1;
    let currentLanguage = 'all';
    let searchExpanded = false;
    let searchTimeout = null;
    let suggestionTimeout = null;

    function setActiveTabUI(filter) {
    filterTabs.forEach(tab => {
        if (tab.dataset.filter === filter) {
            tab.classList.add('bg-indigo-600', 'text-white');
            tab.classList.remove('text-slate-500', 'hover:bg-slate-50');
        } else {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('text-slate-500', 'hover:bg-slate-50');
        }
    });
}

function setActiveExamUI(examValue) {
    examTabs.forEach(tab => {
        if (tab.dataset.exam === examValue) {
            tab.classList.add('bg-indigo-600', 'text-white');
            tab.classList.remove('text-slate-600', 'bg-slate-50', 'hover:bg-slate-100');
        } else {
            tab.classList.remove('bg-indigo-600', 'text-white');
            tab.classList.add('text-slate-600', 'bg-slate-50', 'hover:bg-slate-100');
        }
    });
}
    

function updateSectionHeading() {
        const headingMap = {
            all: 'All Tests',
            free: 'Free Tests',
            paid: 'Paid Tests',
            latest: 'Latest Tests'
        };
        let text = headingMap[currentFilter] || 'All Tests';
        if (currentExam !== 'all') {
            text = currentExam + ' Tests';
        }
        sectionHeading.textContent = text;
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ================= EXAM-TABS SCROLL OVERFLOW DETECTION =================
    function checkExamTabsOverflow() {
        if (!examTabsScroll || !examTabsFade) return;
        const isOverflowing = examTabsScroll.scrollWidth > examTabsScroll.clientWidth + 2;
        examTabsFade.classList.toggle('hidden', !isOverflowing);
    }
    checkExamTabsOverflow();
    window.addEventListener('resize', checkExamTabsOverflow);
    if (examTabsScroll) {
        examTabsScroll.addEventListener('scroll', () => {
            // scroll ke end tak pahunchte hi fade hata do
            const atEnd = examTabsScroll.scrollLeft + examTabsScroll.clientWidth >= examTabsScroll.scrollWidth - 2;
            examTabsFade.classList.toggle('hidden', atEnd);
        });
    }

    // ================= DELEGATED CLICK/SUBMIT FOR DYNAMIC TEST CARDS (CSP-safe) =================
grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const loggedIn = btn.dataset.loggedIn === 'true';
    if (btn.dataset.action === 'enroll') enrollNow(id, loggedIn);
    if (btn.dataset.action === 'buy') buyNow(id, loggedIn);
});

grid.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-confirm-delete]');
    if (!form) return;
    if (!confirm('Are you sure you want to delete this?')) {
        e.preventDefault();
    }
});

    // ================= GRID FETCH =================
    async function fetchTests({ reset = true } = {}) {
        const isSearchMode = currentSearch.length > 0;

        const params = new URLSearchParams({
            filter: currentFilter,
            search: currentSearch,
            language: currentLanguage,
            exam: currentExam,   // 👈 NAYA
            page: currentPage,
        });

        if (isSearchMode) {
            params.set('limit', searchExpanded ? 'all' : '4');
        }

        try {
            const res = await fetch(`/api/categories/${categorySlug}/tests?${params.toString()}`);
            const data = await res.json();

            if (!data.success) return;

            if (reset) grid.innerHTML = '';

            if (data.listings.length === 0 && reset) {
                noResultsMsg.classList.remove('hidden');
            } else {
                noResultsMsg.classList.add('hidden');
            }

            data.listings.forEach(test => {
                grid.insertAdjacentHTML('beforeend', renderTestCard(test));
            });

            if (isSearchMode) {
                if (data.total > 4) {
                    viewAllBtn.classList.remove('hidden');
                    if (searchExpanded) {
                        viewAllText.textContent = 'Show Less';
                        viewAllIcon.className = 'fa-solid fa-arrow-up';
                    } else {
                        viewAllText.textContent = 'Show Tests';
                        viewAllIcon.className = 'fa-solid fa-arrow-right';
                    }
                } else {
                    viewAllBtn.classList.add('hidden');
                }
            } else {
                if (data.hasMore) {
                    viewAllBtn.classList.remove('hidden');
                    viewAllText.textContent = 'View All Test Series';
                    viewAllIcon.className = 'fa-solid fa-arrow-right';
                } else {
                    viewAllBtn.classList.add('hidden');
                }
            }

        } catch (err) {
            console.error('Failed to load tests', err);
        }
    }

    function renderTestCard(test) {
        const typeBadge = test.type === 'Free'
            ? `<span class="bg-green-50 text-green-600 border-green-300 absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full border">FREE</span>`
            : `<span class="bg-amber-50 text-amber-600 border-amber-300 absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full border shadow-[0_0_12px_rgba(251,146,60,0.8)]">PREMIUM</span>`;

        const priceHtml = test.type === 'Free'
    ? `<div class="text-indigo-700 font-bold text-base sm:text-lg">FREE</div>`
    : `<div class="flex flex-wrap items-center justify-between gap-2 w-full">
         <div class="flex items-baseline gap-2">
           <span class="text-xl sm:text-2xl font-bold text-gray-900">₹${test.price}</span>
           ${test.originalPrice > test.price ? `<span class="text-gray-400 line-through text-sm sm:text-base">${test.originalPrice}</span>` : ''}
         </div>
         ${test.discountPercentage > 0 ? `<span class="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full">
             <i class="fa-solid fa-tag"></i> ${test.discountPercentage}% OFF
           </span>` : ''}
       </div>`;

        const ownerControlsHtml = test.isOwner ? `
            <div class="flex items-center gap-2 px-4 pt-4 pb-3">
                <a href="/tests/${test._id}/edit"
                   class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-sm">
                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                    <span>Edit</span>
                </a>
                <form method="POST" action="/test/${test._id}?_method=DELETE"
              data-confirm-delete class="m-0">
            <input type="hidden" name="_csrf" value="${csrfToken}">
                    <button type="submit"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition duration-200 shadow-sm">
                        <i class="fa-solid fa-trash text-xs"></i>
                        <span>Delete</span>
                    </button>
                </form>
                ${test.visibility === 'private' ? `
                    <span class="ml-auto text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        <i class="fa-solid fa-lock text-[9px]"></i> Private
                    </span>` : ''}
            </div>` : '';
 

            let actionHtml;
if (test.isOwner) {
    actionHtml = `<a href="/test/${test._id}" class="flex-1 min-w-[100px] text-center border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold text-sm py-2.5 rounded-xl transition">EXPLORE</a>
                   <a href="/series/${test.slug}" class="flex-1 min-w-[100px] text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition">🚀 Start Test</a>`;
} else if (test.canAccess) {
    actionHtml = `<a href="/series/${test.slug}" class="w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition">🚀 Start Test</a>`;
} else {
    actionHtml = `<a href="/test/${test._id}" class="flex-1 min-w-[100px] text-center border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold text-sm py-2.5 rounded-xl transition">EXPLORE</a>
       <button data-action="${test.type === 'Free' ? 'enroll' : 'buy'}" data-id="${test._id}" data-logged-in="${!!test.currentUser}"
            class="flex-1 min-w-[100px] text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition">
            ${test.type === 'Free' ? 'ENROLL NOW' : 'BUY NOW'}
       </button>`;
}

        return `
        <div class="group bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
            ${ownerControlsHtml}
            <div class="relative overflow-hidden">
                <img src="${escapeHtml(test.image)}" alt="${escapeHtml(test.title)}" class="w-full h-36 sm:h-40 lg:h-44 object-cover group-hover:scale-105 transition-transform duration-300">
                ${typeBadge}
            </div>
            <div class="p-4 sm:p-5 flex flex-col flex-grow">
                <div class="flex items-start justify-between gap-3 mb-2.5 sm:mb-3">
                    <h4 class="text-base sm:text-xl font-bold text-gray-900 leading-snug">${escapeHtml(test.title)}</h4>
                    ${test.language ? `<span class="shrink-0 text-[10px] sm:text-xs font-semibold text-indigo-600 border border-indigo-300 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">${escapeHtml(test.language)}</span>` : ''}
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5 sm:mb-3">
                    ${test.exam ? `<div class="flex items-center gap-1.5 text-gray-700 text-xs sm:text-sm"><i class="fa-solid fa-book"></i><span class="font-medium">${escapeHtml(test.exam)}</span></div>` : ''}
                    <span class="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap">
                        <i class="fa-solid fa-file-lines"></i> ${test.totalTestCount} Total Tests
                    </span>
                </div>
                <p class="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 flex-grow line-clamp-3">${escapeHtml(test.shortDescription)}</p>
                <div class="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-gray-700 mb-3 sm:mb-4">
                    <i class="fa-regular fa-clock"></i> ${test.validityDays} days access after enrollment
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                    ${priceHtml}
                </div>
                <div class="flex flex-wrap gap-2 mt-auto">
                    ${actionHtml}
                </div>
            </div>
        </div>`;
    }

    // ================= TYPE FILTER TABS (Free / Paid / Latest — toggle behavior) =================
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const clickedFilter = tab.dataset.filter;
            // agar already active hai to toggle off -> 'all'
            currentFilter = (currentFilter === clickedFilter) ? 'all' : clickedFilter;
            currentPage = 1;
            searchExpanded = false;
            setActiveTabUI(currentFilter);
            updateSectionHeading();
            fetchTests({ reset: true });
        });
    });

    // ================= EXAM TABS (independent row) =================
    examTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentExam = tab.dataset.exam;
            currentPage = 1;
            searchExpanded = false;
            setActiveExamUI(currentExam);
            updateSectionHeading();
            fetchTests({ reset: true });
        });
    });

    // ================= MORE EXAMS DROPDOWN =================
if (moreExamsBtn) {
    moreExamsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = moreExamsMenu.classList.contains('hidden');

        if (isHidden) {
            const rect = moreExamsBtn.getBoundingClientRect();
            moreExamsMenu.style.position = 'fixed';
            moreExamsMenu.style.top = (rect.bottom + 8) + 'px';
            const menuWidth = 224;
            let leftPos = rect.right - menuWidth;
            if (leftPos < 8) leftPos = 8;
            moreExamsMenu.style.left = leftPos + 'px';
            document.body.appendChild(moreExamsMenu);
        }

        moreExamsMenu.classList.toggle('hidden');
        moreExamsChevron.classList.toggle('rotate-180');
    });

    moreExamOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            currentExam = opt.dataset.exam;
            currentPage = 1;
            searchExpanded = false;
            setActiveExamUI(currentExam);
            updateSectionHeading();
            moreExamsMenu.classList.add('hidden');
            moreExamsChevron.classList.remove('rotate-180');
            fetchTests({ reset: true });
        });
    });

    document.addEventListener('click', (e) => {
        if (!moreExamsBtn.contains(e.target) && !moreExamsMenu.contains(e.target)) {
            moreExamsMenu.classList.add('hidden');
            moreExamsChevron.classList.remove('rotate-180');
        }
    });

    // 👇 NAYA — page scroll hote hi dropdown band ho jaye
    window.addEventListener('scroll', () => {
        if (!moreExamsMenu.classList.contains('hidden')) {
            moreExamsMenu.classList.add('hidden');
            moreExamsChevron.classList.remove('rotate-180');
        }
    }, { passive: true });
}



    // ================= LANGUAGE DROPDOWN =================
    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = languageMenu.classList.contains('hidden');

        if (isHidden) {
            const rect = languageBtn.getBoundingClientRect();
            languageMenu.style.position = 'fixed';
            languageMenu.style.top = (rect.bottom + 8) + 'px';
            languageMenu.style.left = rect.left + 'px';
            document.body.appendChild(languageMenu);
        }

        languageMenu.classList.toggle('hidden');
        languageChevron.classList.toggle('rotate-180');
    });

    languageOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            currentLanguage = opt.dataset.value;

            languageOptions.forEach(o => o.querySelector('.fa-check').classList.add('opacity-0'));
            opt.querySelector('.fa-check').classList.remove('opacity-0');

            if (currentLanguage === 'all') {
    languageLabel.textContent = 'Language';
    languageBtn.classList.remove('bg-indigo-600', 'text-white');
    languageBtn.classList.add('text-slate-500', 'hover:bg-slate-50');
} else {
    languageLabel.textContent = currentLanguage;
    languageBtn.classList.add('bg-indigo-600', 'text-white');
    languageBtn.classList.remove('text-slate-500', 'hover:bg-slate-50');
}

            languageMenu.classList.add('hidden');
            languageChevron.classList.remove('rotate-180');
            currentPage = 1;
            searchExpanded = false;
            fetchTests({ reset: true });
        });
    });

    document.addEventListener('click', (e) => {
        if (!languageBtn.contains(e.target) && !languageMenu.contains(e.target)) {
            languageMenu.classList.add('hidden');
            languageChevron.classList.remove('rotate-180');
        }
    });

    // ================= SEARCH =================
    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        clearTimeout(suggestionTimeout);
        const q = this.value.trim();

        if (!q) {
            searchDropdown.classList.add('hidden');
            currentSearch = '';
            currentPage = 1;
            searchExpanded = false;
            fetchTests({ reset: true });
            return;
        }

        searchTimeout = setTimeout(() => {
            currentSearch = q;
            currentPage = 1;
            searchExpanded = false;
            fetchTests({ reset: true });
        }, 400);

        suggestionTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/api/categories/${categorySlug}/search-suggestions?q=${encodeURIComponent(q)}`);
                const data = await res.json();
                renderSearchDropdown(data, q);
            } catch (err) {
                console.error('Suggestions fetch failed', err);
            }
        }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            currentSearch = searchInput.value.trim();
            currentPage = 1;
            searchExpanded = false;
            searchDropdown.classList.add('hidden');
            fetchTests({ reset: true });
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.classList.add('hidden');
        }
    });

    function renderSearchDropdown(data, q) {
        const hasExams = data.exams.length > 0;
        const hasSeries = data.series.length > 0;

        if (!hasExams && !hasSeries) {
            searchDropdown.innerHTML = `<div class="p-4 text-sm text-slate-400">"${escapeHtml(q)}"No results found.</div>`;
            searchDropdown.classList.remove('hidden');
            return;
        }

        let html = '';

        if (hasExams) {
            html += `<div class="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        <i class="fa-solid fa-book mr-1"></i> Exam
                     </div>`;
            data.exams.forEach(ex => {
                html += `<div class="suggestion-item px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-slate-800"
                              data-type="exam" data-value="${escapeHtml(ex.label)}">
                            ${escapeHtml(ex.label)}
                         </div>`;
            });
        }

        if (hasSeries) {
            html += `<div class="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        <i class="fa-solid fa-file-lines mr-1"></i> Test Series
                     </div>`;
            data.series.forEach(s => {
                html += `<div class="suggestion-item px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-slate-800"
                              data-type="series" data-value="${escapeHtml(s.label)}" data-slug="${escapeHtml(s.slug)}">
                            ${escapeHtml(s.label)}
                         </div>`;
            });
        }

        searchDropdown.innerHTML = html;
        searchDropdown.classList.remove('hidden');

        searchDropdown.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;

                if (type === 'series') {
                    window.location.href = `/series/${item.dataset.slug}`;
                    return;
                }

                searchInput.value = item.dataset.value;
                currentSearch = item.dataset.value;
                currentPage = 1;
                searchExpanded = false;
                searchDropdown.classList.add('hidden');
                fetchTests({ reset: true });
            });
        });
    }

    // ================= VIEW ALL / SHOW TESTS BUTTON =================
    viewAllBtn.addEventListener('click', () => {
        const isSearchMode = currentSearch.length > 0;

        if (isSearchMode) {
            searchExpanded = !searchExpanded;
            fetchTests({ reset: true });
        } else {
            currentPage += 1;
            fetchTests({ reset: true });
        }
    });

})();
 