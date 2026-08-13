document.addEventListener("DOMContentLoaded", () => {

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

            listBox.innerHTML = data.notifications.map(n => `
                <div class="px-4 py-3 border-b border-slate-50 hover:bg-slate-50">
                    <p class="text-sm font-semibold text-slate-800">${n.title}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${n.message}</p>
                    <p class="text-[10px] text-slate-400 mt-1">${new Date(n.sentAt).toLocaleString()}</p>
                </div>
            `).join("");
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