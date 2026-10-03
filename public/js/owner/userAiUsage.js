(function () {
    const btn = document.getElementById("aiLimitBtn");
    const overlay = document.getElementById("aiLimitModal");
    const body = document.getElementById("aiLimitBody");
    const page = document.getElementById("userDetailPage");
    if (!btn || !overlay || !body || !page) return;

    const userId = page.dataset.userId;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function close() { overlay.classList.add("hidden"); }

    document.getElementById("aiLimitClose").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

    function row(label, icon, color, u, unit) {
        const used = Number(u.used) || 0;
        const limit = Number(u.limit) || 0;
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const full = limit > 0 && used >= limit;
        return `
        <div class="flex items-center gap-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><i class="fa-solid ${icon} text-xs"></i></span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between text-xs mb-1.5">
                    <span class="font-medium text-slate-700">${label}</span>
                    <span class="font-semibold ${full ? "text-rose-600" : "text-slate-800"}">${used.toLocaleString()} / ${limit.toLocaleString()}${unit ? " " + unit : ""}${full ? " · Limit reached" : ""}</span>
                </div>
                <div class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div class="h-1.5 rounded-full ${full ? "bg-rose-500" : color}" style="width:${pct}%"></div>
                </div>
            </div>
        </div>`;
    }

    function render(d) {
        const L = d.limits || {};
        const rows = [
            row("AI Questions", "fa-wand-magic-sparkles", "bg-indigo-500", d.usage.aiQuestions),
            row("Requests", "fa-paper-plane", "bg-violet-500", d.usage.requests),
            row("Text", "fa-align-left", "bg-emerald-500", d.usage.text),
            row("Images", "fa-image", "bg-amber-500", d.usage.images)
        ];
        if (L.pdfAllowed) rows.push(row("PDF", "fa-file-pdf", "bg-cyan-500", d.usage.pdf, "MB"));

        const num = (v) => Number(v || 0).toLocaleString();
        const pdfText = L.pdfAllowed
            ? `${esc(L.pdfMBPerDay)} MB (max ${esc(L.pdfMaxPages)} pages/file)`
            : `<span class="text-slate-400">Not available</span>`;

        body.innerHTML = `
            <div class="flex items-center justify-between mb-5">
                <span class="text-xs font-bold px-2.5 py-1 rounded-full ${d.tier === "promax" ? "bg-purple-50 text-purple-600" : (d.tier === "pro" ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500")}">${esc(d.tierLabel)} Plan</span>
                <span class="text-xs text-slate-400">Today's usage</span>
            </div>
            <div class="space-y-4">${rows.join("")}</div>
            <div class="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p class="mb-3 text-xs font-semibold text-slate-600">${esc(d.tierLabel)} plan limits</p>
                <ul class="space-y-2 text-xs">
                    <li class="flex justify-between"><span class="text-slate-500">Text / request</span><span class="font-semibold text-slate-700">${num(L.textCharsPerRequest)} chars</span></li>
                    <li class="flex justify-between"><span class="text-slate-500">Text / day</span><span class="font-semibold text-slate-700">${num(L.textCharsPerDay)} chars</span></li>
                    <li class="flex justify-between"><span class="text-slate-500">Images / day</span><span class="font-semibold text-slate-700">${esc(L.imagesPerDay)} (max ${esc(L.imageMaxSizeMB)} MB each)</span></li>
                    <li class="flex justify-between"><span class="text-slate-500">PDF / day</span><span class="font-semibold text-slate-700">${pdfText}</span></li>
                </ul>
            </div>`;
    }

    btn.addEventListener("click", async () => {
        overlay.classList.remove("hidden");
        body.innerHTML = '<p class="text-center text-sm text-gray-400 py-8">Loading...</p>';
        try {
            const res = await fetch(`/api/owner/users/${encodeURIComponent(userId)}/ai-usage`, { credentials: "same-origin" });
            const data = await res.json();
            if (!data.success) {
                body.innerHTML = `<p class="text-center text-sm text-red-500 py-8">${esc(data.message || "Failed to load.")}</p>`;
                return;
            }
            render(data);
        } catch (err) {
            body.innerHTML = '<p class="text-center text-sm text-red-500 py-8">Something went wrong. Please try again.</p>';
        }
    });
})();