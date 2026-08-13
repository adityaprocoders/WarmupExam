document.addEventListener("DOMContentLoaded", () => {

    const listView = document.getElementById("notifListView");
    const createView = document.getElementById("notifCreateView");
    const tableBody = document.getElementById("notifTableBody");

    let selectedUsers = []; // { _id, name, username, email }
    let searchDebounce = null;
    let editingId = null; // 🆕 null = create mode, ID = edit mode

    // ---------- View toggle ----------
    document.getElementById("openNotifCreateBtn")?.addEventListener("click", () => {
        editingId = null;
        resetForm();
        document.getElementById("notifSendBtn").innerHTML = `<i class="fa-solid fa-paper-plane"></i> Preview & Send`;
        listView.classList.add("hidden");
        createView.classList.remove("hidden");
    });

    function backToList() {
        createView.classList.add("hidden");
        listView.classList.remove("hidden");
        loadNotifications();
    }
    document.getElementById("notifBackToListBtn")?.addEventListener("click", backToList);
    document.getElementById("notifCancelBtn")?.addEventListener("click", backToList);

    function resetForm() {
        document.getElementById("notifTitle").value = "";
        document.getElementById("notifMessage").value = "";
        document.getElementById("notifTitleCount").textContent = "0/60";
        document.getElementById("notifMessageCount").textContent = "0/500";
        document.querySelector('input[name="notifAudience"][value="all"]').checked = true;
        document.querySelectorAll(".notif-audience-card").forEach(c => {
            c.classList.remove("border-indigo-500", "bg-indigo-50");
            c.classList.add("border-gray-200");
        });
        document.querySelector('.notif-audience-card[data-value="all"]').classList.add("border-indigo-500", "bg-indigo-50");
        document.getElementById("notifCustomUserBox").classList.add("hidden");
        document.querySelector('input[name="notifSchedule"][value="now"]').checked = true;
        document.getElementById("notifScheduleTime").classList.add("hidden");
        selectedUsers = [];
        renderSelectedUsers();
        document.getElementById("notifFormMsg").classList.add("hidden");
        updateSummary();
        fetchReach();
    }

    // ---------- Char counters ----------
    document.getElementById("notifTitle")?.addEventListener("input", (e) => {
        document.getElementById("notifTitleCount").textContent = `${e.target.value.length}/60`;
        updateSummary();
    });
    document.getElementById("notifMessage")?.addEventListener("input", (e) => {
        document.getElementById("notifMessageCount").textContent = `${e.target.value.length}/500`;
    });

    // ---------- Audience cards ----------
    document.querySelectorAll(".notif-audience-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".notif-audience-card").forEach(c => {
                c.classList.remove("border-indigo-500", "bg-indigo-50");
                c.classList.add("border-gray-200");
            });
            card.classList.remove("border-gray-200");
            card.classList.add("border-indigo-500", "bg-indigo-50");
            card.querySelector('input[type="radio"]').checked = true;

            const val = card.dataset.value;
            document.getElementById("notifCustomUserBox").classList.toggle("hidden", val !== "custom");
            updateSummary();
            fetchReach();
        });
    });

    function selectAudienceCard(value) {
        document.querySelectorAll(".notif-audience-card").forEach(c => {
            c.classList.remove("border-indigo-500", "bg-indigo-50");
            c.classList.add("border-gray-200");
        });
        const card = document.querySelector(`.notif-audience-card[data-value="${value}"]`);
        if (card) {
            card.classList.remove("border-gray-200");
            card.classList.add("border-indigo-500", "bg-indigo-50");
            card.querySelector('input[type="radio"]').checked = true;
        }
        document.getElementById("notifCustomUserBox").classList.toggle("hidden", value !== "custom");
    }

    // ---------- Schedule toggle ----------
    document.querySelectorAll('input[name="notifSchedule"]').forEach(r => {
        r.addEventListener("change", (e) => {
            const isLater = e.target.value === "later";
            const timeInput = document.getElementById("notifScheduleTime");
            timeInput.classList.toggle("hidden", !isLater);
            timeInput.disabled = !isLater;
            updateSummary();
        });
    });
    document.getElementById("notifScheduleTime")?.addEventListener("change", updateSummary);

    // ---------- Custom user search ----------
    document.getElementById("notifUserSearchInput")?.addEventListener("input", (e) => {
        clearTimeout(searchDebounce);
        const q = e.target.value.trim();
        const resultsBox = document.getElementById("notifUserSearchResults");
        if (!q) { resultsBox.classList.add("hidden"); return; }

        searchDebounce = setTimeout(async () => {
            try {
                const res = await fetch(`/api/owner/notifications/search-users?search=${encodeURIComponent(q)}`);
                const data = await res.json();
                if (!data.success) return;

                resultsBox.innerHTML = data.users.map(u => `
                    <div class="notif-user-result px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between" data-id="${u._id}" data-name="${u.name}" data-username="${u.username}" data-email="${u.email}">
                        <div>
                            <p class="font-medium text-gray-800">${u.name}</p>
                            <p class="text-xs text-gray-400">${u.email}</p>
                        </div>
                        <i class="fa-solid fa-plus text-indigo-500 text-xs"></i>
                    </div>
                `).join("") || `<p class="text-xs text-gray-400 p-3">No students found</p>`;

                resultsBox.classList.remove("hidden");

                resultsBox.querySelectorAll(".notif-user-result").forEach(el => {
                    el.addEventListener("click", () => {
                        const id = el.dataset.id;
                        if (!selectedUsers.find(u => u._id === id)) {
                            selectedUsers.push({ _id: id, name: el.dataset.name, username: el.dataset.username, email: el.dataset.email });
                            renderSelectedUsers();
                            fetchReach();
                        }
                        document.getElementById("notifUserSearchInput").value = "";
                        resultsBox.classList.add("hidden");
                    });
                });
            } catch (err) {
                console.error("User search error:", err);
            }
        }, 300);
    });

    function renderSelectedUsers() {
        const box = document.getElementById("notifSelectedUsers");
        document.getElementById("notifSelectedCount").textContent = selectedUsers.length;
        box.innerHTML = selectedUsers.map(u => `
            <span class="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
                ${u.name}
                <button type="button" class="notif-remove-user hover:text-indigo-900" data-id="${u._id}"><i class="fa-solid fa-xmark"></i></button>
            </span>
        `).join("");

        box.querySelectorAll(".notif-remove-user").forEach(btn => {
            btn.addEventListener("click", () => {
                selectedUsers = selectedUsers.filter(u => u._id !== btn.dataset.id);
                renderSelectedUsers();
                fetchReach();
            });
        });
    }

    // ---------- Live summary ----------
    function getSelectedAudience() {
        return document.querySelector('input[name="notifAudience"]:checked')?.value || "all";
    }

    function updateSummary() {
        const title = document.getElementById("notifTitle").value.trim();
        document.getElementById("notifSummaryTitle").textContent = title || "—";

        const audienceLabels = { all: "All Students", paid: "Paid Students", free: "Free Students", custom: "Custom Users" };
        document.getElementById("notifSummaryAudience").textContent = audienceLabels[getSelectedAudience()];

        const scheduleType = document.querySelector('input[name="notifSchedule"]:checked')?.value;
        const scheduleBadge = document.getElementById("notifSummarySchedule");
        if (scheduleType === "later") {
            const val = document.getElementById("notifScheduleTime").value;
            scheduleBadge.textContent = val ? new Date(val).toLocaleString() : "Pick a date & time";
            scheduleBadge.className = "inline-block bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded-full mt-0.5";
        } else {
            scheduleBadge.textContent = "Send Immediately";
            scheduleBadge.className = "inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full mt-0.5";
        }
    }

    async function fetchReach() {
        const audienceType = getSelectedAudience();
        const reachEl = document.getElementById("notifSummaryReach");
        reachEl.textContent = "…";
        try {
            let url = `/api/owner/notifications/reach?audienceType=${audienceType}`;
            if (audienceType === "custom") {
                url += `&customUserIds=${selectedUsers.map(u => u._id).join(",")}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            reachEl.textContent = data.success ? data.count.toLocaleString() : "—";
        } catch (err) {
            reachEl.textContent = "—";
        }
    }

    // ---------- Send / Update ----------
    document.getElementById("notifSendBtn")?.addEventListener("click", async () => {
        const title = document.getElementById("notifTitle").value.trim();
        const message = document.getElementById("notifMessage").value.trim();
        const audienceType = getSelectedAudience();
        const scheduleType = document.querySelector('input[name="notifSchedule"]:checked')?.value;
        const scheduledAt = document.getElementById("notifScheduleTime").value;
        const msgEl = document.getElementById("notifFormMsg");

        if (!title || !message) {
            msgEl.textContent = "Title aur message dono zaroori hain";
            msgEl.className = "text-sm text-red-600";
            msgEl.classList.remove("hidden");
            return;
        }
        if (audienceType === "custom" && selectedUsers.length === 0) {
            msgEl.textContent = "Kam se kam ek student select karo";
            msgEl.className = "text-sm text-red-600";
            msgEl.classList.remove("hidden");
            return;
        }
        if (scheduleType === "later" && !scheduledAt) {
            msgEl.textContent = "Schedule date/time select karo";
            msgEl.className = "text-sm text-red-600";
            msgEl.classList.remove("hidden");
            return;
        }

        const btn = document.getElementById("notifSendBtn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${editingId ? "Updating..." : "Sending..."}`;

        const payload = {
            title, message, audienceType,
            customUserIds: selectedUsers.map(u => u._id),
            scheduleType,
            scheduledAt: scheduleType === "later" ? scheduledAt : null
        };

        try {
            const url = editingId ? `/api/owner/notifications/${editingId}` : "/api/owner/notifications";
            const method = editingId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                msgEl.textContent = data.message || "Ho gaya";
                msgEl.className = "text-sm text-green-600";
                msgEl.classList.remove("hidden");
                setTimeout(backToList, 900);
            } else {
                msgEl.textContent = data.message || "Kuch galat ho gaya";
                msgEl.className = "text-sm text-red-600";
                msgEl.classList.remove("hidden");
            }
        } catch (err) {
            console.error("Send/update notification error:", err);
            msgEl.textContent = "Server error — dobara try karo";
            msgEl.className = "text-sm text-red-600";
            msgEl.classList.remove("hidden");
        } finally {
            btn.disabled = false;
            btn.innerHTML = editingId ? `<i class="fa-solid fa-floppy-disk"></i> Update Notification` : `<i class="fa-solid fa-paper-plane"></i> Preview & Send`;
        }
    });

    // ---------- Edit ----------
    async function openEdit(notif) {
        editingId = notif._id;
        resetForm();

        document.getElementById("notifTitle").value = notif.title;
        document.getElementById("notifTitle").dispatchEvent(new Event("input"));
        document.getElementById("notifMessage").value = notif.message;
        document.getElementById("notifMessage").dispatchEvent(new Event("input"));

        selectAudienceCard(notif.audienceType);

        if (notif.audienceType === "custom" && notif.customUserIds?.length) {
            try {
                const res = await fetch(`/api/owner/notifications/search-users?ids=${notif.customUserIds.join(",")}`);
                const data = await res.json();
                if (data.success) {
                    selectedUsers = data.users.map(u => ({ _id: u._id, name: u.name, username: u.username, email: u.email }));
                    renderSelectedUsers();
                }
            } catch (err) {
                console.error("Prefill custom users error:", err);
            }
        }

        if (notif.scheduledAt) {
            document.querySelector('input[name="notifSchedule"][value="later"]').checked = true;
            const timeInput = document.getElementById("notifScheduleTime");
            timeInput.classList.remove("hidden");
            timeInput.disabled = false;
            timeInput.value = new Date(notif.scheduledAt).toISOString().slice(0, 16);
        }

        updateSummary();
        fetchReach();

        document.getElementById("notifSendBtn").innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Notification`;
        listView.classList.add("hidden");
        createView.classList.remove("hidden");
    }

    // ---------- Delete ----------
    async function deleteNotif(id) {
        if (!confirm("Ye notification permanently delete karni hai?")) return;
        try {
            const res = await fetch(`/api/owner/notifications/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                loadNotifications();
            } else {
                alert(data.message || "Delete nahi ho paya");
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert("Server error — dobara try karo");
        }
    }

    // ---------- List view load ----------
    async function loadNotifications() {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">Loading...</td></tr>`;
        try {
            const res = await fetch("/api/owner/notifications");
            const data = await res.json();
            if (!data.success || !data.notifications.length) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-400 py-8">Koi notification nahi bheja gaya abhi tak</td></tr>`;
                return;
            }

            const statusBadge = {
                sent: `<span class="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">Active</span>`,
                expired: `<span class="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-1 rounded-full">Expired</span>`,
                scheduled: `<span class="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded-full">Scheduled</span>`
            };

            const audienceLabel = { all: "All Students", paid: "Paid Students", free: "Free Students", custom: "Custom Users" };

            tableBody.innerHTML = data.notifications.map(n => {
                let expiresText = "—";
                if (n.status === "sent" && n.expiresAt) {
                    const msLeft = new Date(n.expiresAt) - new Date();
                    if (msLeft > 0) {
                        const hrs = Math.floor(msLeft / 3600000);
                        const mins = Math.floor((msLeft % 3600000) / 60000);
                        expiresText = `${hrs}h ${mins}m left`;
                    } else {
                        expiresText = "Expired";
                    }
                }

                const editBtn = n.status === "scheduled"
                    ? `<button class="notif-edit-btn text-indigo-600 hover:text-indigo-800 mr-3" data-id="${n._id}" title="Edit"><i class="fa-solid fa-pen"></i></button>`
                    : "";

                return `
                    <tr class="border-t border-gray-100">
                        <td class="px-4 py-3 font-medium text-gray-800">${n.title}</td>
                        <td class="px-4 py-3 text-gray-500">${audienceLabel[n.audienceType] || n.audienceType}</td>
                        <td class="px-4 py-3">${statusBadge[n.status] || n.status}</td>
                        <td class="px-4 py-3 text-gray-500">${n.sentAt ? new Date(n.sentAt).toLocaleString() : (n.scheduledAt ? "Scheduled: " + new Date(n.scheduledAt).toLocaleString() : "—")}</td>
                        <td class="px-4 py-3 text-gray-500">${expiresText}</td>
                        <td class="px-4 py-3 text-right">
                            ${editBtn}
                            <button class="notif-delete-btn text-red-500 hover:text-red-700" data-id="${n._id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            }).join("");

            tableBody.querySelectorAll(".notif-edit-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const notif = data.notifications.find(n => n._id === btn.dataset.id);
                    if (notif) openEdit(notif);
                });
            });

            tableBody.querySelectorAll(".notif-delete-btn").forEach(btn => {
                btn.addEventListener("click", () => deleteNotif(btn.dataset.id));
            });

        } catch (err) {
            console.error("Load notifications error:", err);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-400 py-8">Load nahi ho paya</td></tr>`;
        }
    }

    document.querySelector('[data-target="notifications"]')?.addEventListener("click", loadNotifications);

    if (!document.getElementById("content-notifications").classList.contains("hidden")) {
        loadNotifications();
    }
});