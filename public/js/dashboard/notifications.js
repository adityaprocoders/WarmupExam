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


    const bellBtn = document.querySelector('[data-action="toggle-notif-dropdown"]');
    const dropdown = document.getElementById("notifDropdownMenu");
    const listBox = document.getElementById("notifListBox");
    const redDot = document.getElementById("notifRedDot");
    const clearAllBtn = document.getElementById("notifClearAllBtn");   // 🆕

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
                listBox.innerHTML = `<p class="text-center text-xs text-slate-400 py-6">No new notifications right now.</p>`;
                clearAllBtn?.classList.add("hidden");   // 🆕 koi notification nahi -> button hide
                return;
            }

            clearAllBtn?.classList.remove("hidden");   // 🆕 notifications hain -> button dikhao

            listBox.innerHTML = data.notifications.map(n => {
                const { icon, bg, color } = getNotifIcon(n.notifType);
                const link = n.meta?.listingId ? `/test/${n.meta.listingId}` : null;

                return `
                    <div class="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                        <div class="w-9 h-9 shrink-0 rounded-xl ${bg} flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-4.5 h-4.5 ${color}"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-slate-800">${n.title}</p>
                            <p class="text-xs text-slate-500 mt-0.5">${n.message}</p>
                            <div class="flex items-center justify-between mt-1.5">
                                <p class="text-[10px] text-slate-400">${new Date(n.sentAt).toLocaleString()}</p>
                                ${link ? `<a href="${link}" class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">View →</a>` : ""}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            if (window.lucide) lucide.createIcons();
        } catch (err) {
            console.error("Load notifications error:", err);
            listBox.innerHTML = `<p class="text-center text-xs text-red-400 py-6">Failed to load.</p>`;
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
                listBox.innerHTML = `<p class="text-center text-xs text-slate-400 py-6">Koi notification nahi hai</p>`;
                redDot.classList.add("hidden");
                unseenCount = 0;
                clearAllBtn.classList.add("hidden");   // 🆕 clear hote hi button khud hide
            }
        } catch (err) {
            console.error("Clear all error:", err);
        }
    });

});