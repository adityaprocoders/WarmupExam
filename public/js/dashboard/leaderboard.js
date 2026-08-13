document.addEventListener('DOMContentLoaded', async () => {
    const config = window.__leaderboardConfig;
    if (!config || !config.slug) return;

    const podiumContainer = document.getElementById('podium-container');
    const tableContainer = document.getElementById('table-rows');
    const yourRankBar = document.getElementById('your-rank-bar');

    // ---- Dropdown toggle logic ----
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-action]');

        if (el?.dataset.action === 'toggle-section-dropdown') {
            document.getElementById('sectionDropdownPanel').classList.toggle('hidden');
            document.getElementById('periodDropdownPanel').classList.add('hidden');
        } else if (el?.dataset.action === 'toggle-period-dropdown') {
            document.getElementById('periodDropdownPanel').classList.toggle('hidden');
            document.getElementById('sectionDropdownPanel').classList.add('hidden');
        } else if (el?.dataset.action === 'select-section') {
            config.sectionId = el.dataset.id;
            document.getElementById('sectionLabel').textContent = el.dataset.label;
            document.getElementById('sectionDropdownPanel').classList.add('hidden');
            loadLeaderboard();
        } else if (el?.dataset.action === 'select-period') {
            config.period = el.dataset.value;
            document.getElementById('periodLabel').textContent = el.dataset.value === 'today' ? 'Today' : 'Yesterday';
            document.getElementById('periodDropdownPanel').classList.add('hidden');
            loadLeaderboard();
        } else if (!el) {
            // bahar click hua to sab dropdown band kar do
            document.getElementById('sectionDropdownPanel')?.classList.add('hidden');
            document.getElementById('periodDropdownPanel')?.classList.add('hidden');
        }
    });

    function formatTime(seconds) {
        if (!seconds || seconds <= 0) return "--";
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }

    async function loadLeaderboard() {
        if (!podiumContainer || !tableContainer) return;

        podiumContainer.innerHTML = `<p class="text-xs text-gray-400 col-span-3 text-center py-6">Loading...</p>`;
        tableContainer.innerHTML = '';

        try {
            const params = new URLSearchParams();
            if (config.sectionId && config.sectionId !== 'all') params.set('section', config.sectionId);
            params.set('period', config.period || 'today');

            const res = await fetch(`/api/series/${config.slug}/leaderboard-data?${params.toString()}`);
            const data = await res.json();

            if (!data.success) {
                podiumContainer.innerHTML = '';
                tableContainer.innerHTML = `<p class="text-center text-sm text-gray-400 py-10">${data.message || 'Unable to load leaderboard'}</p>`;
                return;
            }

            const { podium, table, yourRank } = data;

            if (!podium.length && !table.length) {
                podiumContainer.innerHTML = '';
                tableContainer.innerHTML = `<p class="text-center text-sm text-gray-400 py-10">No attempts yet for this period.</p>`;
                if (yourRankBar) yourRankBar.classList.add('hidden');
                return;
            }

            // ---- Podium render ----
            podiumContainer.className = "flex justify-center items-end gap-3 sm:gap-4 px-4 sm:px-6 mt-5 sm:mt-6";

            const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
            const podiumStyles = {
                1: { box: "podium-1", size: "w-16 h-16 sm:w-20 sm:h-20", badge: "bg-amber-400", textSize: "text-lg sm:text-2xl", extra: "-mt-3 sm:-mt-4 shadow-sm border-amber-100" },
                2: { box: "podium-2", size: "w-12 h-12 sm:w-16 sm:h-16", badge: "bg-gray-300", textSize: "text-base sm:text-xl", extra: "border-gray-100" },
                3: { box: "podium-3", size: "w-12 h-12 sm:w-16 sm:h-16", badge: "bg-orange-300", textSize: "text-base sm:text-xl", extra: "border-gray-100" }
            };

            podiumContainer.innerHTML = podiumOrder.map(s => {
                const style = podiumStyles[s.rank] || podiumStyles[3];
                const isFirst = s.rank === 1;
                return `
                    <div class="${style.box} rounded-xl sm:rounded-2xl border ${style.extra} pt-4 sm:pt-5 pb-3 sm:pb-4 px-3 sm:px-4 w-28 sm:w-36 flex flex-col items-center relative min-w-0">
                        ${isFirst ? `<div class="absolute -top-3 sm:-top-4 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-md"><svg class="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 6.6L21 9l-5 4.4L17.4 20 12 16.3 6.6 20 8 13.4 3 9l6.6-.4L12 2z"/></svg></div>` : ''}
                        <div class="relative ${isFirst ? 'mt-2 sm:mt-3' : ''}">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}" class="${style.size} rounded-full ring-2 sm:ring-4 ring-white shadow" />
                            ${!isFirst ? `<div class="absolute -top-1.5 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full ${style.badge} text-white text-[10px] sm:text-xs font-bold flex items-center justify-center shadow">${s.rank}</div>` : ''}
                        </div>
                        <p class="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold text-gray-800 text-center truncate w-full">${s.name}</p>
                        <p class="${style.textSize} font-extrabold text-violet-600 mt-1 sm:mt-2">${s.accuracy}%</p>
                        <p class="text-[10px] sm:text-xs text-gray-400 mt-0.5">Accuracy</p>
                        <div class="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2">
                            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M12 7v5l3 3"/></svg>
                            ${formatTime(s.totalTime)}
                        </div>
                    </div>
                `;
            }).join('');

            // ---- Table render ----
            tableContainer.innerHTML = '';
            table.forEach(s => {
                const row = document.createElement('div');
                row.className = "flex items-center py-2.5 sm:py-3 text-xs sm:text-sm";
                row.innerHTML = `
                    <div class="w-8 sm:w-12 text-gray-500 font-medium">${s.rank}</div>
                    <div class="flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}" class="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
                        <span class="text-gray-800 font-medium truncate">${s.name}</span>
                    </div>
                    <div class="w-16 sm:w-24 text-gray-600">${s.accuracy}%</div>
                    <div class="w-16 sm:w-20 text-gray-600">${formatTime(s.totalTime)}</div>
                `;
                tableContainer.appendChild(row);
            });

            // ---- Your Rank ----
            if (yourRank && yourRankBar) {
                yourRankBar.classList.remove('hidden');
                yourRankBar.innerHTML = `
                    <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div class="text-center flex-shrink-0">
                            <p class="text-[9px] sm:text-[10px] uppercase tracking-wide text-violet-200 whitespace-nowrap">Your Rank</p>
                            <p class="text-lg sm:text-xl font-extrabold">#${yourRank.rank}</p>
                        </div>
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(yourRank.name)}" class="w-8 h-8 sm:w-10 sm:h-10 rounded-full ring-2 ring-white/50 flex-shrink-0" />
                        <div class="min-w-0">
                            <p class="text-xs sm:text-sm font-semibold">You</p>
                            <p class="text-[10px] sm:text-xs text-violet-200 truncate">Keep going, you're doing great!</p>
                        </div>
                    </div>
                    <div class="flex gap-3 sm:gap-5 text-right flex-shrink-0">
                        <div>
                            <p class="text-xs sm:text-sm font-bold">${yourRank.accuracy}%</p>
                            <p class="text-[9px] sm:text-[10px] text-violet-200">Accuracy</p>
                        </div>
                        <div>
                            <p class="text-xs sm:text-sm font-bold">${formatTime(yourRank.totalTime)}</p>
                            <p class="text-[9px] sm:text-[10px] text-violet-200">Time</p>
                        </div>
                    </div>
                `;
            } else if (yourRankBar) {
                yourRankBar.classList.add('hidden');
            }

            if (window.lucide) lucide.createIcons();

        } catch (err) {
            console.error("Leaderboard load error:", err);
            tableContainer.innerHTML = `<p class="text-center text-sm text-red-500 py-10">Something went wrong loading the leaderboard.</p>`;
        }
    }

    if (podiumContainer && tableContainer) {
        loadLeaderboard();
    }
});