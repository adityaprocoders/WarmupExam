// js/dashboard/bulkActions.js
// 1) "With tests / Without tests" choice popup (bulk copy se pehle)
// 2) Live progress (%) popup: bulk copy aur bulk delete dono ke liye
// 3) Selected items ka bulk delete (section / folder / file / test) + confirmation popup
// Dependencies (pehle se maujood): getSelectedSectionIds (sideBar.js), getSelectedMixedItems (itemSelectionMode.js), showToast (flashToast.js)

// true  = tests ke saath copy (purana behaviour)
// false = without tests (sirf section / folder / file structure)
var copyIncludeTests = true;

(function () {
    if (window.__bulkActionsLoaded) return;   // do baar load ho to bhi handlers duplicate na ho
    window.__bulkActionsLoaded = true;

    function notify(msg, type) {
        if (typeof showToast === 'function') showToast(msg, type || 'error');
        else alert(msg);
    }

    // ---------- styles (self-contained, Tailwind pe depend nahi) ----------
    const style = document.createElement('style');
    style.textContent = `
    .ba-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px}
    .ba-box{background:#fff;border-radius:16px;width:100%;max-width:420px;box-shadow:0 25px 50px -12px rgba(0,0,0,.35);padding:22px;font-family:inherit}
    .ba-title{font-size:18px;font-weight:700;color:#1e293b;margin:0 0 6px}
    .ba-msg{font-size:13px;color:#475569;line-height:1.5;white-space:pre-line;margin:0 0 16px}
    .ba-opts{display:flex;flex-direction:column;gap:10px}
    .ba-btn{width:100%;text-align:left;border-radius:12px;padding:12px 14px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-size:14px;font-weight:600;color:#1e293b}
    .ba-btn small{display:block;font-weight:400;font-size:12px;color:#64748b;margin-top:2px}
    .ba-btn:hover{background:#eef2ff;border-color:#c7d2fe}
    .ba-btn.ba-primary{background:#4f46e5;border-color:#4f46e5;color:#fff}
    .ba-btn.ba-primary small{color:#e0e7ff}
    .ba-btn.ba-primary:hover{background:#4338ca}
    .ba-btn.ba-danger{background:#dc2626;border-color:#dc2626;color:#fff;text-align:center}
    .ba-btn.ba-danger:hover{background:#b91c1c}
    .ba-cancel{margin-top:12px;width:100%;text-align:center;background:none;border:none;color:#64748b;font-size:14px;cursor:pointer;padding:8px}
    .ba-cancel:hover{color:#1e293b}
    .ba-delete-btn{background:#dc2626;color:#fff;border:none;cursor:pointer}
    .ba-delete-btn:hover{background:#b91c1c}
    .ba-delete-btn:disabled{opacity:.6;cursor:not-allowed}

    /* ---------- premium progress popup ---------- */
    .bp-overlay{position:fixed;inset:0;z-index:2100;background:rgba(15,23,42,.62);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:16px;animation:bp-fade .2s ease}
    .bp-card{width:100%;max-width:440px;background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 32px 80px -16px rgba(15,23,42,.55);animation:bp-pop .32s cubic-bezier(.2,.9,.3,1.15);font-family:inherit}
    .bp-head{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:22px 24px 20px;color:#fff;transition:background .4s ease}
    .bp-head::after{content:"";position:absolute;right:-34px;top:-38px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.13)}
    .bp-head::before{content:"";position:absolute;right:46px;bottom:-46px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.08)}
    .bp-head.copy{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
    .bp-head.delete{background:linear-gradient(135deg,#e11d48,#be123c)}
    .bp-head.success{background:linear-gradient(135deg,#059669,#10b981)}
    .bp-head.warning{background:linear-gradient(135deg,#d97706,#f59e0b)}
    .bp-head.error{background:linear-gradient(135deg,#be123c,#9f1239)}
    .bp-icon{position:relative;z-index:1;flex:none;width:48px;height:48px;border-radius:15px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}
    .bp-icon.pulse::before{content:"";position:absolute;inset:-5px;border-radius:19px;border:2px solid rgba(255,255,255,.5);animation:bp-pulse 1.5s ease-out infinite}
    .bp-icon svg{width:24px;height:24px}
    .bp-htext{position:relative;z-index:1;min-width:0}
    .bp-title{margin:0;font-size:17px;font-weight:700;line-height:1.25}
    .bp-sub{margin:4px 0 0;font-size:12px;opacity:.88;line-height:1.35}
    .bp-body{padding:24px 24px 24px}
    .bp-percent{text-align:center;font-size:56px;font-weight:800;color:#0f172a;letter-spacing:-2px;line-height:1;font-variant-numeric:tabular-nums}
    .bp-percent small{font-size:24px;font-weight:700;color:#94a3b8;margin-left:3px;letter-spacing:0}
    .bp-track{position:relative;height:12px;border-radius:999px;background:#eef2f7;overflow:hidden;margin:20px 0 12px;box-shadow:inset 0 1px 2px rgba(15,23,42,.08)}
    .bp-fill{position:relative;height:100%;width:0;border-radius:999px;overflow:hidden}
    .bp-fill.copy{background:linear-gradient(90deg,#6366f1,#8b5cf6)}
    .bp-fill.delete{background:linear-gradient(90deg,#fb7185,#e11d48)}
    .bp-fill.success{background:linear-gradient(90deg,#10b981,#34d399)}
    .bp-fill.warning{background:linear-gradient(90deg,#f59e0b,#fbbf24)}
    .bp-fill.error{background:linear-gradient(90deg,#e11d48,#fb7185)}
    .bp-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:translateX(-100%);animation:bp-shimmer 1.4s linear infinite}
    .bp-fill.done::after{display:none}
    .bp-fill.indeterminate{width:34% !important;animation:bp-slide 1.2s ease-in-out infinite}
    .bp-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12.5px;color:#64748b}
    .bp-meta b{color:#0f172a;font-weight:700;font-variant-numeric:tabular-nums}
    .bp-status{display:inline-flex;align-items:center;gap:6px;font-weight:600}
    .bp-dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:bp-blink 1s ease-in-out infinite}
    .bp-note{margin:18px 0 0;text-align:center;font-size:11.5px;color:#94a3b8}
    .bp-summary{margin:18px 0 0;padding:12px 14px;border-radius:14px;background:#f8fafc;border:1px solid #eef2f7;font-size:13px;color:#334155;line-height:1.5;white-space:pre-line}
    .bp-details{margin-top:10px;max-height:116px;overflow:auto;font-size:11.5px;color:#64748b;line-height:1.5;white-space:pre-line;padding:10px 12px;border-radius:12px;background:#fffbeb;border:1px solid #fef3c7}
    .bp-action{margin-top:18px;width:100%;padding:13px;border:none;border-radius:14px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;background:#0f172a;transition:transform .1s ease,background .2s}
    .bp-action:hover{background:#1e293b}
    .bp-action:active{transform:scale(.985)}
    .bp-check path{stroke-dasharray:30;stroke-dashoffset:30;animation:bp-check .5s .1s ease forwards}
    @keyframes bp-fade{from{opacity:0}to{opacity:1}}
    @keyframes bp-pop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
    @keyframes bp-pulse{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}
    @keyframes bp-shimmer{to{transform:translateX(100%)}}
    @keyframes bp-slide{0%{margin-left:-34%}100%{margin-left:100%}}
    @keyframes bp-blink{0%,100%{opacity:.35}50%{opacity:1}}
    @keyframes bp-check{to{stroke-dashoffset:0}}
    @media (prefers-reduced-motion:reduce){.bp-overlay,.bp-card,.bp-icon.pulse::before,.bp-fill::after,.bp-fill.indeterminate,.bp-dot,.bp-check path{animation:none !important}.bp-check path{stroke-dashoffset:0}}
    `;
    document.head.appendChild(style);

    // ---------- generic popup: resolve(value) jab koi button dabe, null jab cancel / Esc / bahar click ----------
    function showPopup({ title, message, options, cancelText }) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ba-overlay';

            const box = document.createElement('div');
            box.className = 'ba-box';

            const h = document.createElement('h3');
            h.className = 'ba-title';
            h.textContent = title;
            box.appendChild(h);

            const p = document.createElement('p');
            p.className = 'ba-msg';
            p.textContent = message;
            box.appendChild(p);

            const opts = document.createElement('div');
            opts.className = 'ba-opts';
            options.forEach((o) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'ba-btn ' + (o.kind || '');
                b.textContent = o.label;
                if (o.hint) {
                    const s = document.createElement('small');
                    s.textContent = o.hint;
                    b.appendChild(s);
                }
                b.addEventListener('click', () => close(o.value));
                opts.appendChild(b);
            });
            box.appendChild(opts);

            const c = document.createElement('button');
            c.type = 'button';
            c.className = 'ba-cancel';
            c.textContent = cancelText || 'Cancel';
            c.addEventListener('click', () => close(null));
            box.appendChild(c);

            overlay.appendChild(box);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

            function onKey(e) { if (e.key === 'Escape') close(null); }
            function close(value) {
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(value);
            }
            document.addEventListener('keydown', onKey);

            document.body.appendChild(overlay);
            c.focus(); // delete jaise popup me default focus Cancel par
        });
    }

    // ---------- 1) With tests / Without tests ----------
    // return: true (with tests) | false (without tests) | null (cancel)
    window.askCopyWithTests = function () {
        return showPopup({
            title: 'Copy options',
            message: 'Selected items ko kaise copy karna hai?',
            options: [
                {
                    label: 'Copy with tests',
                    hint: 'Folder / file ke andar ka sab kuch, saare tests ke saath copy hoga.',
                    value: true,
                    kind: 'ba-primary'
                },
                {
                    label: 'Copy without tests',
                    hint: 'Sirf section / folder / file structure copy hoga. Tests copy nahi honge.',
                    value: false
                }
            ]
        });
    };

    // ---------- 2) Premium progress popup ----------
    const ICONS = {
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
        delete: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/><path d="M10 11v5M14 11v5"/></svg>',
        success: '<svg class="bp-check" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>'
    };

    const SCHEDULE = (typeof requestAnimationFrame === 'function')
        ? (fn) => requestAnimationFrame(fn)
        : (fn) => setTimeout(fn, 16);

    function mkEl(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function createProgressModal(kind, labels) {
        const overlay = mkEl('div', 'bp-overlay');
        const card = mkEl('div', 'bp-card');

        const head = mkEl('div', 'bp-head ' + kind);
        const icon = mkEl('div', 'bp-icon pulse');
        icon.innerHTML = ICONS[kind];
        const htext = mkEl('div', 'bp-htext');
        const title = mkEl('h3', 'bp-title', labels.title);
        const sub = mkEl('p', 'bp-sub', labels.sub);
        htext.appendChild(title);
        htext.appendChild(sub);
        head.appendChild(icon);
        head.appendChild(htext);

        const body = mkEl('div', 'bp-body');
        const percent = mkEl('div', 'bp-percent');
        const num = mkEl('span', 'bp-num', '0');
        percent.appendChild(num);
        percent.appendChild(mkEl('small', '', '%'));

        const track = mkEl('div', 'bp-track');
        const fill = mkEl('div', 'bp-fill ' + kind + ' indeterminate');
        track.appendChild(fill);

        const meta = mkEl('div', 'bp-meta');
        const count = mkEl('span', '', 'Preparing...');
        const status = mkEl('span', 'bp-status');
        status.appendChild(mkEl('span', 'bp-dot'));
        const statusText = mkEl('span', '', labels.working);
        status.appendChild(statusText);
        meta.appendChild(count);
        meta.appendChild(status);

        const note = mkEl('p', 'bp-note', 'Please keep this window open until it finishes.');

        body.appendChild(percent);
        body.appendChild(track);
        body.appendChild(meta);
        body.appendChild(note);

        card.appendChild(head);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        let shown = 0, target = 0, animating = false, known = false;

        function paint() {
            const v = Math.round(shown);
            num.textContent = String(v);
            if (known) fill.style.width = shown.toFixed(2) + '%';
        }
        function loop() {
            if (Math.abs(target - shown) < 0.25) {
                shown = target; animating = false; paint(); return;
            }
            shown += (target - shown) * 0.2;
            paint();
            SCHEDULE(loop);
        }
        function setTarget(t) {
            target = Math.max(0, Math.min(100, t));
            if (!animating) { animating = true; SCHEDULE(loop); }
        }

        return {
            update(done, total) {
                if (!total || total <= 0) return;           // total pata nahi: indeterminate bar chalta rahe
                if (!known) {
                    known = true;
                    fill.classList.remove('indeterminate');
                    fill.style.width = '0%';
                }
                count.innerHTML = '';
                const b = mkEl('b', '', String(Math.min(done, total)));
                count.appendChild(b);
                count.appendChild(document.createTextNode(' of ' + total + ' items'));
                setTarget((done / total) * 100);
            },
            // state: 'success' | 'warning' | 'error'
            finish(opts) {
                return new Promise((resolve) => {
                    const state = opts.state;
                    const headKind = state === 'error' ? 'error' : state;

                    head.className = 'bp-head ' + headKind;
                    icon.className = 'bp-icon';
                    icon.innerHTML = state === 'success' ? ICONS.success : ICONS.warning;
                    title.textContent = opts.title;
                    sub.textContent = opts.sub || '';

                    fill.className = 'bp-fill ' + headKind + ' done';
                    if (!known) { known = true; fill.style.width = '0%'; }
                    if (state === 'success') { setTarget(100); count.textContent = opts.countText || 'All items processed'; }
                    else if (state === 'warning') {
                        // keepProgress: status pata nahi (jaise connection toota) to 100% mat dikhao
                        if (!opts.keepProgress) setTarget(100);
                        count.textContent = opts.countText || 'Finished with warnings';
                    }
                    else { count.textContent = opts.countText || 'Stopped'; }

                    statusText.textContent = opts.statusText || (state === 'success' ? 'Completed' : (state === 'warning' ? 'Completed with notes' : 'Failed'));
                    status.firstChild.style.display = 'none';
                    note.remove();

                    if (opts.summary) body.appendChild(mkEl('div', 'bp-summary', opts.summary));
                    if (opts.details && opts.details.length) body.appendChild(mkEl('div', 'bp-details', opts.details.join('\n')));

                    const btn = mkEl('button', 'bp-action', opts.button || 'Done');
                    btn.type = 'button';
                    body.appendChild(btn);

                    let auto = null;
                    function finishNow() {
                        if (auto) clearTimeout(auto);
                        overlay.remove();
                        resolve();
                    }
                    btn.addEventListener('click', finishNow);
                    if (opts.autoContinueMs) auto = setTimeout(finishNow, opts.autoContinueMs);
                    btn.focus();
                });
            },
            close() { overlay.remove(); }
        };
    }

    // ---------- NDJSON stream reader ----------
    async function readNdjson(res, onMsg) {
        const handleLine = (line) => {
            line = line.trim();
            if (!line) return;
            try { onMsg(JSON.parse(line)); } catch (e) { /* adhoori / kharab line skip */ }
        };

        if (res.body && typeof res.body.getReader === 'function') {
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
                const r = await reader.read();
                if (r.done) break;
                buf += dec.decode(r.value, { stream: true });
                let i;
                while ((i = buf.indexOf('\n')) >= 0) {
                    handleLine(buf.slice(0, i));
                    buf = buf.slice(i + 1);
                }
            }
            buf += dec.decode();
            handleLine(buf);
        } else {
            // purane browser: live % nahi, par kaam poora hoga
            (await res.text()).split('\n').forEach(handleLine);
        }
    }

    // ---------- bulk job runner (copy / delete) ----------
    function copySummary(data) {
        const lines = [];
        lines.push(data.copied + ' copy ' + (data.copied === 1 ? 'operation' : 'operations') + ' successful' + (data.failed ? ', ' + data.failed + ' failed' : ''));
        return lines.join('\n');
    }
    function copyDetails(data) {
        if (!data.fallbacks || data.fallbacks.length === 0) return [];
        const out = ['Note: ' + data.fallbacks.length + ' test(s) me language "All" par set ho gayi:'];
        data.fallbacks.forEach((f) => {
            out.push('• ' + f.path + ' (the selected language "' + f.requestedLanguage + '" was not available in this test, so it was set to "All")');
        });
        return out;
    }

    // returns { proceed, data }  — proceed=true: kuch kaam hua, page reload / redirect karna chahiye
    async function runBulkJob({ kind, url, payload }) {
        const labels = kind === 'copy'
            ? { title: 'Copying your content', sub: 'Sections, folders, files and tests are being copied.', working: 'Copying' }
            : { title: 'Deleting selected items', sub: 'Everything inside the selected items is being removed.', working: 'Deleting' };

        const modal = createProgressModal(kind, labels);
        let finalData = null;
        let failedToConnect = false;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({}, payload, { stream: true }))
            });
            const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';

            if (ct.indexOf('ndjson') === -1) {
                // validation error ya purana single-JSON response
                try { finalData = await res.json(); } catch (e) { finalData = { success: false, message: 'Unexpected server response.' }; }
            } else {
                await readNdjson(res, (msg) => {
                    if (msg.type === 'start' || msg.type === 'progress') modal.update(msg.done || 0, msg.total);
                    else if (msg.type === 'done') finalData = msg;
                });
            }
        } catch (err) {
            console.error('Bulk job error:', err);
            failedToConnect = true;
        }

        // ----- final state -----
        let result;
        if (!finalData && !failedToConnect) {
            // stream beech me toot gayi: server par kaam chal raha / ho chuka ho sakta hai
            await modal.finish({
                state: 'warning',
                title: 'Connection interrupted',
                sub: 'The task may still be running on the server.',
                summary: 'Please refresh the page in a few seconds to see the latest state.',
                countText: 'Status unknown',
                statusText: 'Interrupted',
                keepProgress: true,
                button: 'Refresh page'
            });
            result = { proceed: true, data: null };
        } else if (failedToConnect) {
            await modal.finish({
                state: 'error',
                title: 'Something went wrong',
                sub: 'Could not reach the server.',
                summary: 'Please check your connection and try again.',
                button: 'Close'
            });
            result = { proceed: false, data: null };
        } else if (kind === 'copy') {
            const d = finalData;
            if (d.success) {
                const clean = !d.failed && (!d.fallbacks || d.fallbacks.length === 0);
                await modal.finish({
                    state: clean ? 'success' : 'warning',
                    title: clean ? 'Copy complete' : 'Copy finished with notes',
                    sub: clean ? 'Everything was copied successfully.' : 'Please review the notes below.',
                    summary: copySummary(d),
                    details: copyDetails(d),
                    countText: 'All items processed',
                    button: 'Done',
                    autoContinueMs: clean ? 1600 : 0
                });
                result = { proceed: d.copied > 0, data: d };
            } else {
                await modal.finish({ state: 'error', title: 'Copy failed', sub: d.message || 'Unable to copy the selected items.', button: 'Close' });
                result = { proceed: false, data: d };
            }
        } else {
            const d = finalData;
            if (d.deleted > 0) {
                const clean = !d.failed;
                await modal.finish({
                    state: clean ? 'success' : 'warning',
                    title: clean ? 'Deleted successfully' : 'Deleted with some errors',
                    sub: clean ? 'The selected items and everything inside them were removed.' : 'Some items could not be deleted.',
                    summary: d.deleted + ' selected ' + (d.deleted === 1 ? 'item' : 'items') + ' deleted' + (d.failed ? ', ' + d.failed + ' failed' : ''),
                    countText: 'All items processed',
                    button: 'Done',
                    autoContinueMs: clean ? 1600 : 0
                });
                result = { proceed: true, data: d };
            } else {
                await modal.finish({ state: 'error', title: 'Delete failed', sub: d.message || 'Nothing was deleted. Please try again.', button: 'Close' });
                result = { proceed: false, data: d };
            }
        }
        return result;
    }
    window.runBulkJob = runBulkJob;

    // ---------- 3) Bulk delete ----------
    function countByType(items) {
        const c = { section: 0, folder: 0, file: 0, test: 0 };
        items.forEach((i) => { if (c[i.type] !== undefined) c[i.type]++; });
        return c;
    }

    function describeSelection(items) {
        const c = countByType(items);
        const parts = [];
        if (c.section) parts.push(c.section + (c.section === 1 ? ' section' : ' sections'));
        if (c.folder) parts.push(c.folder + (c.folder === 1 ? ' folder' : ' folders'));
        if (c.file) parts.push(c.file + (c.file === 1 ? ' file' : ' files'));
        if (c.test) parts.push(c.test + (c.test === 1 ? ' test' : ' tests'));
        return parts.join(', ');
    }

    async function confirmBulkDelete(items) {
        const c = countByType(items);
        const hasContainer = c.section + c.folder + c.file > 0;

        let message = 'Selected: ' + describeSelection(items) + '.\n\n';
        if (hasContainer) {
            message += 'Selected section / folder / file ke ANDAR ka sab kuch (sub-folders, files aur saare tests, kisi bhi depth tak) permanently delete ho jayega.\n\n';
        }
        message += 'Tests ke saath unke saare students ke attempts / results aur questions (jo kisi aur test me use nahi ho rahe) bhi delete honge.\n\nYe undo nahi ho sakta.';

        const ok = await showPopup({
            title: 'Delete selected items?',
            message,
            options: [{ label: 'Yes, delete everything', value: true, kind: 'ba-danger' }],
            cancelText: 'Cancel'
        });
        return ok === true;
    }

    // items: [{id, type}] | afterUrl: delete ke baad kahan jana hai (null = same page reload)
    async function runBulkDelete(items, afterUrl, triggerBtn) {
        if (!items || items.length === 0) return;

        const ok = await confirmBulkDelete(items);
        if (!ok) return;

        if (triggerBtn) triggerBtn.disabled = true;

        let job;
        try {
            job = await runBulkJob({ kind: 'delete', url: '/api/bulk-delete-items', payload: { items } });
        } catch (err) {
            console.error(err);
            notify('Something went wrong while deleting.', 'error');
            if (triggerBtn) triggerBtn.disabled = false;
            return;
        }

        if (job.proceed) {
            if (afterUrl) window.location.href = afterUrl;
            else window.location.reload();
            return;
        }
        if (triggerBtn) triggerBtn.disabled = false;
    }
    window.runBulkDelete = runBulkDelete;

    // ---------- button clicks ----------
    document.addEventListener('click', function (e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        switch (el.dataset.action) {
            case 'bulk-delete-sections': {
                // sidebar me selected sections
                const items = getSelectedSectionIds().map((id) => ({ id, type: 'section' }));
                // active section delete ho sakta hai, isliye ?section= hata kar series page par jao
                runBulkDelete(items, window.location.pathname, el);
                break;
            }
            case 'bulk-delete-selected-items': {
                // main area me selected folder / file / test
                runBulkDelete(getSelectedMixedItems(), null, el);
                break;
            }
        }
    });
})();