 
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();

    const ALL_LIMIT = 10;
    const CATEGORY_LABELS = { payments: 'Payments', tests: 'Tests', account: 'Account', reports: 'AI Reports' };

    const categoryTabs = document.querySelectorAll('.category-tab');
    const faqItems = Array.from(document.querySelectorAll('.faq-item'));
    const searchInput = document.getElementById('helpSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const noResultsMsg = document.getElementById('noResultsMsg');
    const limitNote = document.getElementById('limitNote');
    const limitShownEl = document.getElementById('limitShown');
    const limitTotalEl = document.getElementById('limitTotal');
    const showAllBtn = document.getElementById('showAllBtn');
    const suggestionsBox = document.getElementById('searchSuggestions');

    // cache original text so highlighting never corrupts the source we search against
    faqItems.forEach((item, idx) => {
        const q = item.querySelector('.faq-question span');
        const a = item.querySelector('.faq-answer p');
        item._originalQ = q.textContent;
        item._originalA = a.textContent;
        item.id = item.id || `faq-item-${idx}`;
    });

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function highlight(text, term) {
        // highlighting disabled per request — return plain, escaped text
        return escapeHtml(text);
    }

    function getActiveCategory() {
        const activeTab = document.querySelector('.category-tab.active-tab');
        return activeTab ? activeTab.dataset.category : 'all';
    }

    function openItem(item) {
        document.querySelectorAll('.faq-item.open').forEach(openEl => {
            if (openEl !== item) {
                openEl.classList.remove('open');
                openEl.querySelector('.faq-answer').style.maxHeight = '0px';
            }
        });
        const answer = item.querySelector('.faq-answer');
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }

    function closeItem(item) {
        item.classList.remove('open');
        item.querySelector('.faq-answer').style.maxHeight = '0px';
    }

    function applyFilters() {
        const activeCategory = getActiveCategory();
        const rawTerm = searchInput.value.trim();
        const searchTerm = rawTerm.toLowerCase();

        clearSearchBtn.classList.toggle('hidden', rawTerm === '');

        const matched = [];
        faqItems.forEach(item => {
            const matchesCategory = activeCategory === 'all' || item.dataset.category === activeCategory;
            const questionText = item._originalQ.toLowerCase();
            const answerText = item._originalA.toLowerCase();
            const matchesSearch = searchTerm === '' ||
                questionText.includes(searchTerm) ||
                answerText.includes(searchTerm);

            const isMatch = matchesCategory && matchesSearch;
            item.dataset.match = isMatch ? '1' : '0';
            if (isMatch) matched.push(item);

            // refresh highlighted text
            item.querySelector('.faq-question span').innerHTML = highlight(item._originalQ, rawTerm);
            item.querySelector('.faq-answer p').innerHTML = highlight(item._originalA, rawTerm);
        });

        // cap "All" tab to ALL_LIMIT items when there's no active search
        const capActive = !window.forceShowAll && activeCategory === 'all' && searchTerm === '' && matched.length > ALL_LIMIT;
        const limit = capActive ? ALL_LIMIT : Infinity;

        let shown = 0;
        matched.forEach(item => {
            if (shown < limit) {
                item.style.display = '';
                shown++;
            } else {
                item.style.display = 'none';
                if (item.classList.contains('open')) closeItem(item);
            }
        });
        faqItems.forEach(item => {
            if (item.dataset.match !== '1') {
                item.style.display = 'none';
                if (item.classList.contains('open')) closeItem(item);
            }
        });

        // resync height of any still-open, still-visible item (content/width may have changed)
        const openVisible = document.querySelector('.faq-item.open');
        if (openVisible && openVisible.style.display !== 'none') {
            const answer = openVisible.querySelector('.faq-answer');
            answer.style.maxHeight = 'none';
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }

        noResultsMsg.classList.toggle('hidden', matched.length !== 0);
       limitNote.classList.toggle('hidden', !capActive);
if (capActive) {
    limitShownEl.textContent = ALL_LIMIT;
    limitTotalEl.textContent = matched.length;
}
    }

    // ---- live suggestions dropdown ----
    let activeSuggestionIndex = -1;

    function closeSuggestions() {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        searchInput.setAttribute('aria-expanded', 'false');
        activeSuggestionIndex = -1;
    }

    function renderSuggestions(rawTerm) {
        const term = rawTerm.toLowerCase();
        if (!term) { closeSuggestions(); return; }

        const matches = faqItems.filter(item =>
            item._originalQ.toLowerCase().includes(term) || item._originalA.toLowerCase().includes(term)
        ).slice(0, 8);

        if (matches.length === 0) { closeSuggestions(); return; }

        suggestionsBox.innerHTML = matches.map((item, i) => `
            <button type="button" class="suggestion-item" role="option" data-target="${item.id}" data-idx="${i}">
                <span class="truncate">${highlight(item._originalQ, rawTerm)}</span>
                <span class="cat-tag">${CATEGORY_LABELS[item.dataset.category] || ''}</span>
            </button>
        `).join('');

        suggestionsBox.classList.remove('hidden');
        searchInput.setAttribute('aria-expanded', 'true');
        activeSuggestionIndex = -1;
    }

    function goToItem(item) {
        const activeCategory = item.dataset.category;
        categoryTabs.forEach(t => t.classList.toggle('active-tab', t.dataset.category === activeCategory));
        searchInput.value = '';
        closeSuggestions();
        applyFilters();
        requestAnimationFrame(() => {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            openItem(item);
        });
    }

    suggestionsBox.addEventListener('click', (e) => {
        const btn = e.target.closest('.suggestion-item');
        if (!btn) return;
        const item = document.getElementById(btn.dataset.target);
        if (item) goToItem(item);
    });

    // debounce so fast typing doesn't thrash the DOM
    let debounceTimer;
    function debouncedUpdate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            applyFilters();
            renderSuggestions(searchInput.value.trim());
        }, 120);
    }

    categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            categoryTabs.forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            window.forceShowAll = false;
            closeSuggestions();
            applyFilters();
            tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
    });

    searchInput.addEventListener('input', debouncedUpdate);
    searchInput.addEventListener('focus', () => renderSuggestions(searchInput.value.trim()));

    searchInput.addEventListener('keydown', (e) => {
        const options = suggestionsBox.querySelectorAll('.suggestion-item');
        if (suggestionsBox.classList.contains('hidden') || options.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % options.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + options.length) % options.length;
        } else if (e.key === 'Enter') {
            if (activeSuggestionIndex >= 0) {
                e.preventDefault();
                options[activeSuggestionIndex].click();
                return;
            }
            closeSuggestions();
            return;
        } else if (e.key === 'Escape') {
            closeSuggestions();
            return;
        } else {
            return;
        }

        options.forEach((opt, i) => opt.classList.toggle('active-suggestion', i === activeSuggestionIndex));
        options[activeSuggestionIndex]?.scrollIntoView({ block: 'nearest' });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#searchWrap')) closeSuggestions();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.focus();
        closeSuggestions();
        applyFilters();
    });

    // Accordion toggle
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const item = question.closest('.faq-item');
            if (item.classList.contains('open')) closeItem(item);
            else openItem(item);
        });
    });

    // recalc open item's height on window resize so text reflow doesn't get clipped
    window.addEventListener('resize', () => {
        const openEl = document.querySelector('.faq-item.open');
        if (openEl) {
            const answer = openEl.querySelector('.faq-answer');
            answer.style.maxHeight = 'none';
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }
    });

    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            window.forceShowAll = true;
            applyFilters();
        });
    }

    applyFilters();
});
 