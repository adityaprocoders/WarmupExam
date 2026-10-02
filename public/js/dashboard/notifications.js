document.addEventListener("DOMContentLoaded", () => {

    function getNotifIcon(notifType) {
        switch (notifType) {
            case "new_test_series":
                return { icon: "clipboard-list", bg: "bg-orange-100", color: "text-orange-600" };
            case "subscription_expiring":
                return { icon: "clock", bg: "bg-red-100", color: "text-red-600" };
            default:
                return { icon: "bell", bg: "bg-indigo-100", color: "text-indigo-600" };
        }
    }

    // XSS se bachne ke liye (title/message user ya admin se aa sakta hai)
    function escapeHtml(str = "") {
        return String(str).replace(/[&<>"']/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    function emptyState(text) {
        return `
            <div class="flex flex-col items-center justify-center py-10 px-4 text-center">
                <span class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <i data-lucide="bell-off" class="w-5 h-5"></i>
                </span>
                <p class="text-sm font-semibold text-slate-700">${text}</p>
                <p class="text-xs text-slate-400 mt-1">You're all caught up.</p>
            </div>
        `;
    }

    const bellBtn = document.querySelector('[data-action="toggle-notif-dropdown"]');
    const dropdown = document.getElementById("notifDropdownMenu");
    const listBox = document.getElementById("notifListBox");
    const redDot = document.getElementById("notifRedDot");
    const clearAllBtn = document.getElementById("notifClearAllBtn");

    if (!bellBtn) return;

    let unseenCount = 0;

    // ---------- Page load pe fetch ----------
    async function loadNotifications() {
        try {
            const res = await fetch("/api/notifications/mine");
            const data = await res.json();
            if (!data.success) return;

            unseenCount = data.unseenCount;
            redDot.classList.toggle("hidden", unseenCount === 0);

            if (!data.notifications.length) {
                listBox.innerHTML = emptyState("No new notifications");
                clearAllBtn?.classList.add("hidden");
                if (window.lucide) lucide.createIcons();
                return;
            }

            clearAllBtn?.classList.remove("hidden");

            listBox.innerHTML = data.notifications.map(n => {
                const { icon, bg, color } = getNotifIcon(n.notifType);
                const link = n.meta?.listingId ? `/test/${n.meta.listingId}` : null;

                return `
                    <div class="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition">
                        <div class="w-10 h-10 shrink-0 rounded-xl ${bg} flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-800 leading-snug break-words">${escapeHtml(n.title)}</p>
                            <p class="text-xs text-slate-500 mt-0.5 leading-relaxed break-words">${escapeHtml(n.message)}</p>
                            <div class="flex items-center justify-between gap-2 mt-2">
                                <p class="text-[10px] text-slate-400">${new Date(n.sentAt).toLocaleString()}</p>
                                ${link ? `<a href="${link}" class="shrink-0 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">View →</a>` : ""}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error("Load notifications error:", err);
            listBox.innerHTML = `<p class="text-center text-xs text-red-400 py-8">Failed to load.</p>`;
            clearAllBtn?.classList.add("hidden");
        }
    }
    loadNotifications();

    // ---------- Dropdown toggle + mark seen ----------
    bellBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("hidden");

        if (!dropdown.classList.contains("hidden") && unseenCount > 0) {
            redDot.classList.add("hidden");
            try {
                await fetch("/api/notifications/mark-seen", { method: "POST" });
                unseenCount = 0;
            } catch (err) {
                console.error("Mark seen error:", err);
            }
        }
    });

    // outside click pe close
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
            dropdown.classList.add("hidden");
        }
    });

    // ---------- Clear All ----------
    clearAllBtn?.addEventListener("click", async () => {
        try {
            const res = await fetch("/api/notifications/clear-all", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                listBox.innerHTML = emptyState("No notifications");
                if (window.lucide) lucide.createIcons();
                redDot.classList.add("hidden");
                unseenCount = 0;
                clearAllBtn.classList.add("hidden");
            }
        } catch (err) {
            console.error("Clear all error:", err);
        }
    });

});