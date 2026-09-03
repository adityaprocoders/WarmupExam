(function () {
    const searchInput = document.getElementById('examSearch');
    const filterRow = document.getElementById('filterRow');
    const languageBtn = document.getElementById('languageDropdownBtn');
    const languageMenu = document.getElementById('languageDropdownMenu');
    const languageChevron = document.getElementById('languageDropdownChevron');
    const languageOptions = document.querySelectorAll('.language-option');
    const filterTabs = document.querySelectorAll('.filterTab');
    const toggleBtn = document.getElementById('toggleResultsBtn');

    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get('search') || currentParams.get('exam') ||
        currentParams.get('language') || currentParams.get('filter')) {
        filterRow.classList.remove('hidden');
    }

    searchInput.addEventListener('input', function () {
        const q = this.value.trim();
        filterRow.classList.toggle('hidden', q.length === 0);
    });

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

    document.addEventListener('click', (e) => {
        if (!languageBtn.contains(e.target) && !languageMenu.contains(e.target)) {
            languageMenu.classList.add('hidden');
            languageChevron.classList.remove('rotate-180');
        }
    });

    languageOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const params = new URLSearchParams(window.location.search);
            const value = opt.dataset.value;
            if (value) params.set('language', value);
            else params.delete('language');
            window.location.href = `/alltests?${params.toString()}`;
        });
    });

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const params = new URLSearchParams(window.location.search);
            const clicked = tab.dataset.filter;
            const current = params.get('filter');
            if (current === clicked) params.delete('filter');
            else params.set('filter', clicked);
            window.location.href = `/alltests?${params.toString()}`;
        });
    });

    // ---- Show More / Show Less toggle ----
    if (toggleBtn) {
        let expanded = false;
        toggleBtn.addEventListener('click', () => {
            const hiddenCards = document.querySelectorAll('.search-result-card.hidden');
            const allCards = document.querySelectorAll('.search-result-card');

            if (!expanded) {
                hiddenCards.forEach(card => card.classList.remove('hidden'));
                toggleBtn.innerHTML = 'Show Less <i class="fa-solid fa-chevron-up ml-1 text-xs"></i>';
                expanded = true;
            } else {
                allCards.forEach((card, index) => {
                    if (index >= 4) card.classList.add('hidden');
                });
                toggleBtn.innerHTML = 'Show More <i class="fa-solid fa-chevron-down ml-1 text-xs"></i>';
                expanded = false;
                toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }
})();



