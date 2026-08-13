(function () {
    'use strict';

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    function toggleHidden(el) {
        if (el) el.classList.toggle('hidden');
    }

    function updateSubjectChipsAndLabel() {
        const checkboxes = $all('input[data-action="subject-checkbox"]:checked');
        const chipsContainer = $('#selectedSubjectChips');
        const label = $('#subjectDropdownLabel');
        if (!chipsContainer || !label) return;

        chipsContainer.innerHTML = '';

        if (checkboxes.length === 0) {
            label.textContent = 'Select subject(s)';
            label.classList.add('text-slate-500');
            return;
        }

        label.textContent = checkboxes.length + ' subject' + (checkboxes.length > 1 ? 's' : '') + ' selected';
        label.classList.remove('text-slate-500');

        checkboxes.forEach(function (cb) {
            const chip = document.createElement('span');
            chip.className = 'px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold';
            chip.textContent = cb.value;
            chipsContainer.appendChild(chip);
        });
    }

    function showFormError(msg) {
        const el = $('#dailyWarmupFormError');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    }

    function clearFormError() {
        const el = $('#dailyWarmupFormError');
        if (el) { el.classList.add('hidden'); el.textContent = ''; }
    }

    async function saveDailyWarmupConfig(btn) {
        clearFormError();

        const subjects = $all('input[data-action="subject-checkbox"]:checked').map(cb => cb.value);
        const difficulty = $('#difficultySelect').value;
        const questionCount = parseInt($('#questionCountInput').value, 10);
        const timeLimit = parseInt($('#timeLimitInput').value, 10);
        const listingSlug = btn.dataset.listingSlug;

        if (subjects.length === 0) return showFormError('Please select at least one subject.');
        if (!questionCount || questionCount < 1) return showFormError('Question count must be at least 1.');
        if (!timeLimit || timeLimit < 1) return showFormError('Time limit must be at least 1 minute.');

        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const res = await fetch('/series/' + listingSlug + '/daily-warmup/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()   // csrf-csrf package ka default header
                },
                body: JSON.stringify({ subjects, difficulty, questionCount, timeLimit })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                showFormError(data.message || 'Could not save settings.');
                return;
            }

            window.location.reload();

        } catch (err) {
            showFormError('Network error — please try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Settings';
        }
    }

    function startCountdown() {
        const el = $('#warmupCountdown');
        if (!el) return;

        const expiresAt = new Date(el.dataset.expiresAt).getTime();

        function tick() {
            const diff = expiresAt - Date.now();
            if (diff <= 0) { el.textContent = 'refreshing...'; return; }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }

        tick();
        setInterval(tick, 1000);
    }

    document.addEventListener('click', function (e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        switch (target.dataset.action) {
            case 'toggle-daily-warmup-modal':
                toggleHidden($('#dailyWarmupModalOverlay'));
                clearFormError();
                break;
            case 'toggle-subject-dropdown':
                toggleHidden($('#subjectDropdownPanel'));
                break;
            case 'save-daily-warmup-config':
                saveDailyWarmupConfig(target);
                break;
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target.matches('input[data-action="subject-checkbox"]')) {
            updateSubjectChipsAndLabel();
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        updateSubjectChipsAndLabel();
        startCountdown();
        if (window.lucide) window.lucide.createIcons();
    });
})();