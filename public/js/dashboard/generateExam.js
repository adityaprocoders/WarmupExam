/* =====================================================================
   generateExam.js  —  EXAM MODE (subject-wise tabs)
   generatePaper.js ke BAAD load hota hai. Ye in globals ko use karta hai:
   contextData, escapeHtml, getQuestionListingId, sourceMode, sourceListingId,
   languageInfo, handleLanguageUI, refreshQuestionSource, resetCriteriaRows,
   explorerReset, renderGlobalSectionTags, renderGlobalSectionDropdown,
   selectedGlobalSections, testLanguageMode, testLanguages, testShowLanguage,
   showToast
===================================================================== */
(function () {
    'use strict';

    const DIFFS = ['Easy', 'Medium', 'Hard'];

    const ex = {
        mode: 'single',      // 'single' | 'exam'
        catalog: [],         // listing ke marks wale subjects [{subject, positiveMarks, negativeMarks}]
        sectionsList: [],    // source listing ke sections
        subjects: [],        // tabs
        activeKey: null,
        popOpen: false,
        uid: 0
    };

    /* ---------- tiny helpers ---------- */
    const $ = (id) => document.getElementById(id);
    const esc = (s) => escapeHtml(s);
    const enc = encodeURIComponent;
    const icons = () => { if (window.lucide) window.lucide.createIcons(); };
    const toast = (m, t) => showToast(m, t || 'error');
    const lid = () => getQuestionListingId();
    const activeTab = () => ex.subjects.find(t => t.key === ex.activeKey) || null;
    const tabByKey = (k) => ex.subjects.find(t => t.key === k) || null;
    const rowById = (tab, id) => (tab ? tab.rows.find(r => r.id === id) : null) || null;
    const hasScopeOrSection = (tab) => tab.sections.length > 0 || !!tab.scope;
    const scopeQuery = (tab) => tab.scope ? `&scopeType=${enc(tab.scope.type)}&scopeId=${enc(tab.scope.id)}` : '';

    function marksOf(subjectName) {
        const c = ex.catalog.find(x => x.subject === subjectName);
        return c ? (Number(c.positiveMarks) || 0) : 0;
    }

    /* ======================= MODE SWITCH ======================= */
    function applyModeVisibility() {
        const isExam = ex.mode === 'exam';
        const set = (id, hidden) => { const el = $(id); if (el) el.hidden = hidden; };

        set('singleModeWrap', isExam);
        set('examModeWrap', !isExam);
 
        set('singleQCountWrap', isExam);
        set('examSummary', !isExam);

        document.querySelectorAll('[data-xa="set-mode"]').forEach(b => {
            b.classList.toggle('is-active', b.dataset.mode === ex.mode);
            b.setAttribute('aria-pressed', b.dataset.mode === ex.mode ? 'true' : 'false');
        });
        const hint = $('exmModeHint');
        if (hint) {
            hint.textContent = isExam
                ? 'Exam Mode: har subject ke liye alag section, topic aur question count.'
                : 'Single Mode: ek criteria table se poora paper banta hai.';
        }
        const fm = $('testFullMarksInput');
        if (fm && !isExam) fm.value = '';
    }

    function singleModeHasData() {
        return typeof selectedGlobalSections !== 'undefined' && selectedGlobalSections.size > 0;
    }

    async function setMode(next) {
        if (next === ex.mode) return;

        const leavingHasData = ex.mode === 'exam' ? ex.subjects.length > 0 : singleModeHasData();
        if (leavingHasData && !window.confirm('Mode badalne par abhi ka bhara hua data reset ho jayega. Continue?')) return;

        if (next === 'exam') {
            // single mode ka data reset
            selectedGlobalSections.clear();
            renderGlobalSectionTags();
            renderGlobalSectionDropdown();
            explorerReset();
            resetCriteriaRows();

            ex.mode = 'exam';
            ex.subjects = [];
            ex.activeKey = null;
            ex.popOpen = false;
            applyModeVisibility();
            render();
            await Promise.all([loadCatalog(), loadSections()]);
            render();
            recalcLanguages();
        } else {
            ex.mode = 'single';
            ex.subjects = [];
            ex.activeKey = null;
            ex.popOpen = false;
            applyModeVisibility();
            await refreshQuestionSource();   // single mode ka state/languages fresh
        }
    }

    // Source / tier badalne par (generatePaper.js se call hota hai)
    window.exOnContextChanged = async function () {
        if (ex.mode !== 'exam') return;
        ex.subjects = [];
        ex.activeKey = null;
        ex.popOpen = false;
        render();
        await Promise.all([loadCatalog(), loadSections()]);
        render();
        recalcLanguages();
    };
    window.exIsExamMode = function () { return ex.mode === 'exam'; };

    /* ======================= DATA LOADERS ======================= */
    async function loadCatalog() {
        const tier = ($('tierSelect') || {}).value || '';
        try {
            const res = await fetch(`/api/listing/${contextData.listingId}/marks-subjects?tier=${enc(tier)}`);
            const j = await res.json();
            ex.catalog = j.success ? j.data : [];
        } catch (e) {
            console.error('Catalog fetch error:', e);
            ex.catalog = [];
        }
    }

    async function loadSections() {
        const l = lid();
        if (!l) { ex.sectionsList = []; return; }
        try {
            const res = await fetch(`/api/listing/${l}/sections`);
            const j = await res.json();
            ex.sectionsList = j.success ? j.data : [];
        } catch (e) {
            console.error('Sections fetch error:', e);
            ex.sectionsList = [];
        }
    }

    /* ======================= TABS ======================= */
    function newTab(name) {
        return {
            key: 's' + (++ex.uid),
            subject: name,
            sections: [],
            scope: null,
            explorerPath: [],
            explorerData: null,
            explorerLoading: false,
            explorerError: false,
            explorerSeq: 0,
            langSeq: 0,
            ssSeq: 0,
            scopeSubjects: [],
            langInfo: null,
            count: '',
            rows: []
        };
    }

    function addSubject(name) {
        const existing = ex.subjects.find(t => t.subject === name);
        ex.popOpen = false;
        if (existing) {
            ex.activeKey = existing.key;
        } else {
            const t = newTab(name);
            ex.subjects.push(t);
            ex.activeKey = t.key;
        }
        render();
    }

    function removeSubject(key) {
        const t = tabByKey(key);
        if (!t) return;
        if ((t.sections.length > 0 || t.count) && !window.confirm(`"${t.subject}" tab hata dein? Iska data chala jayega.`)) return;
        ex.subjects = ex.subjects.filter(x => x.key !== key);
        if (ex.activeKey === key) ex.activeKey = ex.subjects.length ? ex.subjects[0].key : null;
        render();
        recalcLanguages();
    }

    /* ======================= SECTIONS / EXPLORER (per tab) ======================= */
    async function onSectionsChanged(tab) {
        await syncExplorer(tab);
        await Promise.all([refreshTabLanguages(tab), refreshScopeSubjects(tab), refreshAllRowFilters(tab)]);
    }

    function addSection(tab, sid) {
        if (!sid || tab.sections.includes(sid)) return;
        tab.sections.push(sid);
        render();
        onSectionsChanged(tab);
    }

    function removeSection(tab, sid) {
        tab.sections = tab.sections.filter(x => x !== sid);
        render();
        onSectionsChanged(tab);
    }

    async function syncExplorer(tab) {
        tab.explorerSeq++;
        tab.explorerPath = [];
        tab.explorerData = null;
        tab.explorerLoading = false;
        tab.explorerError = false;
        tab.scope = null;

        if (tab.sections.length !== 1) { render(); return; }

        const sid = tab.sections[0];
        const sec = ex.sectionsList.find(s => s.sectionId === sid);
        tab.explorerPath = [{ type: 'section', id: sid, title: sec ? sec.section : 'Section' }];
        await loadExplorer(tab);
    }

    async function loadExplorer(tab) {
        const l = lid();
        const cur = tab.explorerPath[tab.explorerPath.length - 1];
        if (!l || !cur) { render(); return; }

        const seq = ++tab.explorerSeq;
        tab.explorerLoading = true;
        tab.explorerError = false;
        render();

        try {
            const res = await fetch(`/api/listing/${l}/explorer?nodeType=${enc(cur.type)}&nodeId=${enc(cur.id)}`);
            if (!res.ok) throw new Error('Explorer request failed: ' + res.status);
            const j = await res.json();
            if (seq !== tab.explorerSeq) return;
            tab.explorerData = j.success ? j.data : null;
            tab.explorerError = !j.success;
        } catch (e) {
            console.error('Explorer fetch error:', e);
            if (seq !== tab.explorerSeq) return;
            tab.explorerData = null;
            tab.explorerError = true;
        }
        tab.explorerLoading = false;
        render();
    }

    async function goPath(tab, newPath) {
        tab.explorerPath = newPath;
        const last = newPath[newPath.length - 1];
        tab.scope = last && last.type !== 'section' ? { type: last.type, id: last.id } : null;
        await Promise.all([
            loadExplorer(tab),
            refreshTabLanguages(tab),
            refreshScopeSubjects(tab),
            refreshAllRowFilters(tab)
        ]);
    }

    /* ======================= SCOPE SUBJECTS (row Subject dropdown) ======================= */
    async function refreshScopeSubjects(tab) {
        const l = lid();
        const seq = ++tab.ssSeq;
        if (!l || !hasScopeOrSection(tab)) {
            tab.scopeSubjects = [];
            render();
            return;
        }
        try {
            const res = await fetch(`/api/listing/${l}/scope-subjects?section=${enc(tab.sections.join(','))}${scopeQuery(tab)}`);
            const j = await res.json();
            if (seq !== tab.ssSeq) return;
            tab.scopeSubjects = j.success ? j.data : [];
        } catch (e) {
            console.error('Scope subjects fetch error:', e);
            if (seq !== tab.ssSeq) return;
            tab.scopeSubjects = [];
        }
        tab.rows.forEach(r => { if (r.subject && !tab.scopeSubjects.includes(r.subject)) r.subject = ''; });
        render();
    }

    /* ======================= LANGUAGES (saare subjects ka common) ======================= */
    async function refreshTabLanguages(tab) {
        const l = lid();
        const seq = ++tab.langSeq;
        if (!l || !hasScopeOrSection(tab)) {
            tab.langInfo = null;
            recalcLanguages();
            return;
        }
        try {
            const res = await fetch(`/api/listing/${l}/languages?section=${enc(tab.sections.join(','))}${scopeQuery(tab)}`);
            const j = await res.json();
            if (seq !== tab.langSeq) return;
            tab.langInfo = j.success ? j.data : null;
        } catch (e) {
            console.error('Languages fetch error:', e);
            if (seq !== tab.langSeq) return;
            tab.langInfo = null;
        }
        recalcLanguages();
    }

    function intersectMaps(maps) {
        if (maps.length === 0) return new Map();
        const out = new Map();
        maps[0].forEach((count, lang) => {
            let min = count;
            for (let i = 1; i < maps.length; i++) {
                if (!maps[i].has(lang)) return;
                min = Math.min(min, maps[i].get(lang));
            }
            out.set(lang, min);
        });
        return out;
    }

    // Har subject ki language info ka INTERSECTION -> existing language UI ko synthetic languageInfo de do
    function recalcLanguages() {
        if (ex.mode !== 'exam') return;

        const tabs = ex.subjects.filter(t => t.langInfo);
        if (tabs.length === 0) {
            languageInfo = { listingLanguage: 'English', singleCount: 0, translationLanguages: [] };
            handleLanguageUI();
            return;
        }

        const ll = String(tabs[0].langInfo.listingLanguage || 'English');
        const transMaps = [];
        const singleMaps = [];

        tabs.forEach(t => {
            const li = t.langInfo;
            const tm = new Map((li.translationLanguages || []).map(x => [x.lang, x.count]));
            const sm = new Map(tm);
            if (li.singleCount > 0) sm.set(ll, (sm.get(ll) || 0) + li.singleCount);
            transMaps.push(tm);
            singleMaps.push(sm);
        });

        const multi = intersectMaps(transMaps);
        const single = intersectMaps(singleMaps);

        let singleCount = 0;
        if (single.has(ll)) singleCount = Math.max(0, single.get(ll) - (multi.get(ll) || 0));

        languageInfo = {
            listingLanguage: ll,
            singleCount,
            translationLanguages: Array.from(multi.entries()).map(([lang, count]) => ({ lang, count }))
        };
        handleLanguageUI();
    }

    /* ======================= ROWS (optional priority) ======================= */
    function newRow() {
        return {
            id: 'r' + (++ex.uid),
            subject: '',
            section: [],
            topic: [],
            subTopic: [],
            difficulty: [],
            min: 1,
            max: 1,
            opts: { section: [], topic: [], subTopic: [] },
            seq: 0
        };
    }

    function addRow(tab) {
        const r = newRow();
        tab.rows.push(r);
        render();
        fetchRowFilters(tab, r);
    }

    function removeRow(tab, rid) {
        tab.rows = tab.rows.filter(r => r.id !== rid);
        render();
    }

    async function fetchRowFilters(tab, row) {
        const l = lid();
        const seq = ++row.seq;
        if (!l || !hasScopeOrSection(tab)) {
            row.opts = { section: [], topic: [], subTopic: [] };
            render();
            return;
        }

        const q = new URLSearchParams();
        if (row.subject) q.set('subject', row.subject);
        q.set('section', tab.sections.join(','));
        if (row.section.length) q.set('qsection', row.section.join(','));
        if (row.topic.length) q.set('topic', row.topic.join(','));
        if (tab.scope) { q.set('scopeType', tab.scope.type); q.set('scopeId', tab.scope.id); }

        try {
            const res = await fetch(`/api/listing/${l}/question-filters?${q.toString()}`);
            const j = await res.json();
            if (seq !== row.seq) return;
            const d = j.success && j.data ? j.data : { qsections: [], topics: [], subTopics: [] };
            row.opts = { section: d.qsections || [], topic: d.topics || [], subTopic: d.subTopics || [] };
            row.section = row.section.filter(x => row.opts.section.includes(x));
            row.topic = row.topic.filter(x => row.opts.topic.includes(x));
            row.subTopic = row.subTopic.filter(x => row.opts.subTopic.includes(x));
        } catch (e) {
            console.error('Row filters fetch error:', e);
            if (seq !== row.seq) return;
            row.opts = { section: [], topic: [], subTopic: [] };
        }
        render();
    }

    function refreshAllRowFilters(tab) {
        return Promise.all(tab.rows.map(r => fetchRowFilters(tab, r)));
    }

    /* ======================= RENDER ======================= */
    function chip(label, action, attrs) {
        return `<span class="exm-chip">${esc(label)}<button type="button" aria-label="Remove ${esc(label)}" data-xa="${action}" ${attrs}>&#10005;</button></span>`;
    }

    function isTabComplete(t) {
      return hasScopeOrSection(t) && Number(t.count) > 0;
    }

    function tabBarHtml() {
        const tabs = ex.subjects.map(t => `
            <button type="button" class="exm-tab ${t.key === ex.activeKey ? 'is-active' : ''}" data-xa="tab-select" data-key="${t.key}">
                <i data-lucide="book-open"></i>
                <span class="exm-tab-name">${esc(t.subject)}</span>
                ${isTabComplete(t) ? '' : '<span class="exm-dot" title="Setup incomplete"></span>'}
                <span class="exm-tab-x" role="button" aria-label="Remove ${esc(t.subject)}" data-xa="tab-remove" data-key="${t.key}"><i data-lucide="x"></i></span>
            </button>`).join('');

        let pop = '';
        if (ex.popOpen) {
            const items = ex.catalog.map(c => {
                const used = ex.subjects.some(t => t.subject === c.subject);
                return `<button type="button" class="exm-pop-item" data-xa="pop-pick" data-subject="${esc(c.subject)}">
                    <span>${esc(c.subject)}</span>
                    ${used ? '<span class="exm-tick" title="Already added"><i data-lucide="check"></i></span>' : ''}
                </button>`;
            }).join('');
            pop = `<div class="exm-pop">${items || '<div class="exm-pop-empty">Is listing ke marks me koi subject set nahi hai.</div>'}</div>`;
        }

        return `
        <div class="exm-tabbar">
            <div class="exm-tabs">${tabs}</div>
            <div class="exm-addwrap">
                <button type="button" class="exm-add" data-xa="pop-toggle" aria-expanded="${ex.popOpen ? 'true' : 'false'}">
                    <i data-lucide="plus"></i><span>Add Subject</span>
                </button>
                ${pop}
            </div>
        </div>`;
    }

    function emptyHtml() {
        return `
        <div class="gpx-empty">
            <span class="gpx-empty-icon"><i data-lucide="layers"></i></span>
            <div class="gpx-empty-title">No subject added yet</div>
            <div class="gpx-empty-sub">"Add Subject" dabao aur is listing ke subjects me se choose karo. Har subject ka section, questions aur time alag set hota hai.</div>
        </div>`;
    }

    function explorerHtml(tab) {
        if (tab.sections.length === 0) return '';

        const canGoBack = tab.explorerPath.length > 1;
        const head = `
        <div class="gpx-head">
            <span class="gpx-head-icon"><i data-lucide="folder-open"></i></span>
            <div class="gpx-head-text">
                <div class="gpx-head-title">Browse Section</div>
                <div class="gpx-head-sub">Open a folder or file. Questions are picked from wherever you stop.</div>
            </div>
            ${canGoBack ? `<button type="button" class="gpx-back" data-xa="explorer-back"><i data-lucide="arrow-left"></i><span>Back</span></button>` : ''}
        </div>`;

        if (tab.sections.length > 1) {
            return `<div class="gpx-card exm-explorer">${head}
                <div class="gpx-empty">
                    <span class="gpx-empty-icon"><i data-lucide="layers"></i></span>
                    <div class="gpx-empty-title">Multiple sections selected</div>
                    <div class="gpx-empty-sub">Questions saare selected sections se aayenge. Folder/file browse karne ke liye sirf ek section rakho.</div>
                </div></div>`;
        }

        const last = tab.explorerPath.length - 1;
        const crumbs = tab.explorerPath.map((p, i) => {
            const icon = p.type === 'section' ? 'layers' : (p.type === 'folder' ? 'folder' : 'file-text');
            const inner = `<i data-lucide="${icon}"></i><span>${esc(p.title)}</span>`;
            const c = i === last
                ? `<span class="gpx-crumb is-current" aria-current="page">${inner}</span>`
                : `<button type="button" class="gpx-crumb" data-xa="explorer-crumb" data-index="${i}">${inner}</button>`;
            return (i > 0 ? `<i data-lucide="chevron-right" class="gpx-crumb-sep"></i>` : '') + c;
        }).join('');

        const d = tab.explorerData;
        const show = d && !tab.explorerLoading;
        const qc = show ? (Number(d.questionCount) || 0) : 0;
        const tc = show ? (Number(d.testCount) || 0) : 0;
        const badges = show
            ? `<span class="gpx-badge">${qc} ${qc === 1 ? 'question' : 'questions'}</span><span class="gpx-badge">${tc} ${tc === 1 ? 'test' : 'tests'}</span>`
            : '';

        const tile = (type, item) => {
            const n = Number(item.testCount) || 0;
            return `
            <button type="button" class="gpx-tile" data-xa="explorer-open" data-type="${type}" data-id="${esc(item.id)}" data-title="${esc(item.title)}">
                <span class="gpx-tile-icon ${type === 'folder' ? 'is-folder' : 'is-file'}"><i data-lucide="${type === 'folder' ? 'folder' : 'file-text'}"></i></span>
                <span class="gpx-tile-body">
                    <span class="gpx-tile-name" title="${esc(item.title)}">${esc(item.title)}</span>
                    <span class="gpx-tile-meta">${n} ${n === 1 ? 'test' : 'tests'}</span>
                </span>
                <i data-lucide="chevron-right" class="gpx-tile-arrow"></i>
            </button>`;
        };

        let body;
        if (tab.explorerLoading) {
            body = `<div class="gpx-grid"><div class="gpx-skel"></div><div class="gpx-skel"></div><div class="gpx-skel"></div></div>`;
        } else if (tab.explorerError) {
            body = `<div class="gpx-empty">
                <span class="gpx-empty-icon is-error"><i data-lucide="info"></i></span>
                <div class="gpx-empty-title">Could not load this location</div>
                <button type="button" class="gpx-retry" data-xa="explorer-retry">Try again</button></div>`;
        } else {
            const folders = (d && d.folders) || [];
            const files = (d && d.files) || [];
            if (folders.length + files.length === 0) {
                body = `<div class="gpx-empty">
                    <span class="gpx-empty-icon"><i data-lucide="inbox"></i></span>
                    <div class="gpx-empty-title">No more folders or files here</div>
                    <div class="gpx-empty-sub">${tc > 0 ? `All ${tc} ${tc === 1 ? 'test' : 'tests'} in this location will be used.` : 'There are no tests in this location yet.'}</div></div>`;
            } else {
                body = '';
                if (folders.length) body += `<div class="gpx-group-label">Folders <span>${folders.length}</span></div><div class="gpx-grid">${folders.map(f => tile('folder', f)).join('')}</div>`;
                if (files.length) body += `<div class="gpx-group-label">Files <span>${files.length}</span></div><div class="gpx-grid">${files.map(f => tile('file', f)).join('')}</div>`;
            }
        }

        return `<div class="gpx-card exm-explorer">${head}
            <nav class="gpx-crumbs" aria-label="Current location">${crumbs}</nav>
            <div class="gpx-status">
                <span class="gpx-status-label">Questions from</span>
                <span class="gpx-status-path">${tab.explorerPath.map(p => esc(p.title)).join(' &rsaquo; ')}</span>
                <span class="gpx-badges">${badges}</span>
            </div>
            ${body}</div>`;
    }

    function multiField(r, field, label, placeholder, options) {
        const remaining = options.filter(v => !r[field].includes(v));
        const first = remaining.length ? placeholder : (options.length ? 'All selected' : 'No options');
        return `
        <div class="exm-f">
            <span class="field-name-tag">${label}</span>
            <select class="exm-select" data-xa="row-add" data-rid="${r.id}" data-field="${field}" ${remaining.length ? '' : 'disabled'}>
                <option value="" selected disabled>${first}</option>
                ${remaining.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
            </select>
            <div class="exm-chips">${r[field].map(v => chip(v, 'tag-del', `data-rid="${r.id}" data-field="${field}" data-val="${esc(v)}"`)).join('')}</div>
        </div>`;
    }

    function rowHtml(tab, r, i) {
        return `
        <div class="exm-row">
            <div class="exm-row-top">
                <span class="exm-row-no">Priority ${i + 1}</span>
                <button type="button" class="exm-icon-btn" data-xa="row-del" data-rid="${r.id}" aria-label="Remove row"><i data-lucide="trash-2"></i></button>
            </div>
            <div class="exm-row-grid">
                <div class="exm-f">
                    <span class="field-name-tag">Question Subject</span>
                    <select class="exm-select" data-xa="row-subject" data-rid="${r.id}">
                        <option value="">Any subject</option>
                        ${tab.scopeSubjects.map(s => `<option value="${esc(s)}" ${s === r.subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}
                    </select>
                </div>
                ${multiField(r, 'section', 'Section', 'Choose section', r.opts.section)}
                ${multiField(r, 'topic', 'Topic', 'Choose topic', r.opts.topic)}
                ${multiField(r, 'subTopic', 'Sub-Topic', 'Choose sub-topic', r.opts.subTopic)}
                ${multiField(r, 'difficulty', 'Difficulty', 'Choose difficulty', DIFFS)}
                <div class="exm-f">
                    <span class="field-name-tag">Min Q</span>
                    <input id="exMin_${r.id}" type="number" min="1" class="exm-input" data-xa="row-min" data-rid="${r.id}" value="${esc(r.min)}">
                </div>
                <div class="exm-f">
                    <span class="field-name-tag">Max Q</span>
                    <input id="exMax_${r.id}" type="number" min="1" class="exm-input" data-xa="row-max" data-rid="${r.id}" value="${esc(r.max)}">
                </div>
            </div>
        </div>`;
    }

    function panelHtml(tab) {
        const remaining = ex.sectionsList.filter(s => !tab.sections.includes(s.sectionId));
        let secMsg;
        if (remaining.length === 0) {
            if (sourceMode === 'other' && !sourceListingId) secMsg = 'Choose source listing first';
            else secMsg = ex.sectionsList.length === 0 ? 'No section found' : 'All sections selected';
        }
        const secTags = tab.sections.map(sid => {
            const s = ex.sectionsList.find(x => x.sectionId === sid);
            return chip(s ? s.section : sid, 'sec-del', `data-sid="${esc(sid)}"`);
        }).join('');

        const rows = tab.rows.map((r, i) => rowHtml(tab, r, i)).join('');
        const q = Number(tab.count) || 0;

        return `
        <div class="exm-panel">
            <div class="exm-panel-head">
                <span class="exm-panel-icon"><i data-lucide="book-open"></i></span>
                <div class="exm-panel-text">
                    <div class="exm-panel-title">${esc(tab.subject)} Configuration</div>
                    <div class="exm-panel-sub">Set question source and filters for ${esc(tab.subject)}</div>
                </div>
                <span class="exm-badge-active"><i data-lucide="check-circle-2"></i> Active Subject</span>
            </div>

            <div class="exm-panel-body">
                 <div class="exm-block">
                    <label class="exm-label" for="exCount">No of Questions</label>
                    <input id="exCount" type="number" min="1" class="exm-input" data-xa="count" value="${esc(tab.count)}" placeholder="e.g. 25">
                </div>

                <div class="exm-block">
                    <label class="exm-label">Section (questions will be picked from here)</label>
                    <div class="exm-chips exm-chips-lg">${secTags}</div>
                    <select class="exm-select" data-xa="sec-add" ${remaining.length ? '' : 'disabled'}>
                        <option value="" selected disabled>${remaining.length ? 'Choose section' : secMsg}</option>
                        ${remaining.map(s => `<option value="${esc(s.sectionId)}">${esc(s.section)} (${s.count} Q)</option>`).join('')}
                    </select>
                </div>

                ${explorerHtml(tab)}

                <div class="exm-rows-head">
                    <div>
                        <div class="exm-rows-title">Priority filters <span class="exm-opt">optional</span></div>
                        <div class="exm-rows-sub">Row nahi doge to ${q ? q + ' questions' : 'questions'} section/folder se random aayenge. Row doge to uski min–max ke questions pehle aayenge, baaki random se poore honge.</div>
                    </div>
                </div>
                ${rows}
                <button type="button" class="exm-addrow" data-xa="row-add-new" ${hasScopeOrSection(tab) ? '' : 'disabled'}>
                    <i data-lucide="plus"></i><span>${hasScopeOrSection(tab) ? 'Add priority row' : 'Choose a section first'}</span>
                </button>
            </div>
        </div>`;
    }

    function render() {
        const root = $('examModeWrap');
        if (!root || ex.mode !== 'exam') return;

        const ae = document.activeElement;
        const focusId = ae && ae.id && root.contains(ae) ? ae.id : null;
        let caret = null;
        try { caret = ae ? ae.selectionStart : null; } catch (e) { caret = null; }

        const tab = activeTab();
        root.innerHTML = `
            <div class="exm-head">
                <span class="exm-step"><i data-lucide="layers"></i></span>
                <h3 class="exm-title">Subjects</h3>
            </div>
            <p class="exm-sub">Add and configure each subject separately.</p>
            ${tabBarHtml()}
            ${tab ? panelHtml(tab) : emptyHtml()}`;

        icons();

        if (focusId) {
            const n = $(focusId);
            if (n) {
                n.focus();
                if (caret !== null) { try { n.setSelectionRange(caret, caret); } catch (e) { /* number input */ } }
            }
        }
        renderSummary();
    }

    /* ======================= RIGHT PANEL SUMMARY ======================= */
    function round2(n) { return Math.round(n * 100) / 100; }

        function renderSummary() {
        const box = $('examSummary');
        if (!box || ex.mode !== 'exam') return;

        let tq = 0, tm = 0;
        const rows = ex.subjects.map(t => {
            const q = Number(t.count) || 0;
            const mk = round2(q * marksOf(t.subject));
            tq += q; tm += mk;
            const warn = isTabComplete(t) ? '' : `<div class="exm-sum-warn">Setup incomplete</div>`;
            return `
            <div class="exm-sum-row">
                <div class="exm-sum-name">${esc(t.subject)}</div>
                <div class="exm-sum-meta"><span>${q} Q</span><span>${mk} marks</span></div>
                ${warn}
            </div>`;
        }).join('');

        box.innerHTML = `
            <div class="exm-sum-title">Subject Summary</div>
            ${rows || '<div class="exm-sum-empty">Abhi koi subject add nahi hua.</div>'}
            <div class="exm-sum-total">
                <div><b>${tq}</b><span>Questions</span></div>
                <div><b>${round2(tm)}</b><span>Marks</span></div>
            </div>`;

        const fm = $('testFullMarksInput');
        if (fm) fm.value = tm > 0 ? round2(tm) : '';
    }

    /* ======================= EVENTS ======================= */
    document.addEventListener('click', function (e) {
        const t = e.target.closest('[data-xa]');

        if (!t) {
            if (ex.popOpen && !e.target.closest('.exm-addwrap')) { ex.popOpen = false; render(); }
            return;
        }

        const a = t.dataset.xa;
        const tab = activeTab();

        switch (a) {
            case 'set-mode': setMode(t.dataset.mode === 'exam' ? 'exam' : 'single'); break;
            case 'pop-toggle': ex.popOpen = !ex.popOpen; render(); break;
            case 'pop-pick': addSubject(t.dataset.subject); break;
            case 'tab-select': ex.activeKey = t.dataset.key; ex.popOpen = false; render(); break;
            case 'tab-remove': removeSubject(t.dataset.key); break;
            case 'sec-del': if (tab) removeSection(tab, t.dataset.sid); break;
            case 'explorer-open':
                if (tab && tab.explorerPath.length) goPath(tab, [...tab.explorerPath, { type: t.dataset.type, id: t.dataset.id, title: t.dataset.title }]);
                break;
            case 'explorer-back':
                if (tab && tab.explorerPath.length > 1) goPath(tab, tab.explorerPath.slice(0, -1));
                break;
            case 'explorer-crumb': {
                const idx = Number(t.dataset.index);
                if (tab && Number.isInteger(idx) && idx >= 0 && idx < tab.explorerPath.length - 1) goPath(tab, tab.explorerPath.slice(0, idx + 1));
                break;
            }
            case 'explorer-retry': if (tab) loadExplorer(tab); break;
            case 'row-add-new': if (tab) addRow(tab); break;
            case 'row-del': if (tab) removeRow(tab, t.dataset.rid); break;
            case 'tag-del': {
                const r = rowById(tab, t.dataset.rid);
                if (!r) break;
                const f = t.dataset.field;
                r[f] = r[f].filter(v => v !== t.dataset.val);
                render();
                if (f === 'section' || f === 'topic') fetchRowFilters(tab, r);
                break;
            }
            default: break;
        }
    });

    document.addEventListener('change', function (e) {
        const t = e.target.closest('[data-xa]');
        if (!t) return;
        const a = t.dataset.xa;
        const tab = activeTab();
        if (!tab) return;

        if (a === 'sec-add') {
            addSection(tab, t.value);
        } else if (a === 'row-subject') {
            const r = rowById(tab, t.dataset.rid);
            if (!r) return;
            r.subject = t.value;
            r.section = []; r.topic = []; r.subTopic = [];
            fetchRowFilters(tab, r);
        } else if (a === 'row-add') {
            const r = rowById(tab, t.dataset.rid);
            const f = t.dataset.field;
            const v = t.value;
            if (!r || !v) return;
            if (!r[f].includes(v)) r[f].push(v);
            render();
            if (f === 'section' || f === 'topic') fetchRowFilters(tab, r);
        }
    });

    document.addEventListener('input', function (e) {
        const t = e.target.closest('[data-xa]');
        if (!t || ex.mode !== 'exam') return;
        const a = t.dataset.xa;
        const tab = activeTab();
        if (!tab) return;

        if (a === 'count') { tab.count = t.value; renderSummary(); }
 
        else if (a === 'row-min' || a === 'row-max') {
            const r = rowById(tab, t.dataset.rid);
            if (!r) return;
            if (a === 'row-min') r.min = t.value; else r.max = t.value;
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && ex.mode === 'exam' && e.target && e.target.tagName === 'INPUT' && e.target.closest('#examModeWrap')) {
            e.preventDefault();
        }
    });

    /* ======================= GENERATE ======================= */
    window.exGenerate = async function () {
        if (sourceMode === 'other' && !sourceListingId) {
            return toast('Please choose Category, Exam and Listing for the question source.');
        }
        if (ex.subjects.length === 0) return toast('Please add at least one subject.');

        const subjectsPayload = [];
        for (const t of ex.subjects) {
            const name = t.subject;
            if (!hasScopeOrSection(t)) return toast(`${name}: please choose at least one section.`);

            const count = Math.floor(Number(t.count) || 0);
            if (count < 1) return toast(`${name}: please enter number of questions.`);

 

            const rows = [];
            for (let i = 0; i < t.rows.length; i++) {
                const r = t.rows[i];
                const blank = !r.subject && !r.section.length && !r.topic.length && !r.subTopic.length && !r.difficulty.length;
                if (blank) continue;   // khaali row ignore

                const min = Math.floor(Number(r.min) || 0);
                const max = Math.floor(Number(r.max) || 0);
                if (min < 1) return toast(`${name} - Priority ${i + 1}: Min Q kam se kam 1 hona chahiye.`);
                if (max < min) return toast(`${name} - Priority ${i + 1}: Max Q, Min Q se kam nahi ho sakta.`);

                rows.push({
                    subject: r.subject,
                    section: r.section.slice(),
                    topic: r.topic.slice(),
                    subTopic: r.subTopic.slice(),
                    difficulty: r.difficulty.slice(),
                    minCount: min,
                    maxCount: max
                });
            }

            const sumMin = rows.reduce((s, r) => s + r.minCount, 0);
            if (sumMin > count) {
                return toast(`${name}: priority rows ka Min total (${sumMin}) subject ke ${count} questions se zyada hai.`);
            }

            subjectsPayload.push({
                subject: name,
                sections: t.sections.slice(),
                scope: t.scope ? { type: t.scope.type, id: t.scope.id } : null,
                 count,
                rows
            });
        }

        let languages;
        if (testLanguageMode === 'multiple') {
            languages = testLanguages.slice();
            if (languages.length < 2) {
                return toast('Multiple language ke liye saare subjects me kam se kam 2 common languages chahiye.');
            }
        } else {
            const lang = (($('singleLanguageInput') || {}).value || '').trim();
            if (!lang) return toast('Please choose the test language.');
            languages = [lang];
        }

                const timeStrategy = $('timeStrategy').value;

        const payload = {
            mode: 'exam',
            title: $('testTitleInput').value,
            languageMode: testLanguageMode,
            languages,
            showLanguage: testLanguageMode === 'multiple' ? testShowLanguage : 'all',
            tier: ($('tierSelect') || {}).value || null,
            timeStrategy,
            duration: timeStrategy === 'total'
                ? Number(($('totalTimeInput') || {}).value) || 0
                : subjectTimeList.reduce((sum, st) => sum + Number(st.duration || 0), 0),
            subjectTime: timeStrategy === 'subject' ? subjectTimeList : [],
            subjects: subjectsPayload,
            noOfPapers: Number($('noOfPapersInput').value) || 1,
            maxRepeat: Number($('maxRepeatInput').value) || 2,
            visibility: ($('visibilityInput') || {}).value || 'private',
            listingId: contextData.listingId,
            sourceListingId: sourceMode === 'other' ? sourceListingId : '',
            sectionId: contextData.sectionId,
            parentType: contextData.parentType,
            parentId: contextData.parentId
        };

        try {
            const res = await fetch('/api/generate-paper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (!result.success) {
                toast('Issue: ' + (result.message || 'Unknown error'));
            } else if (result.warnings && result.warnings.length > 0) {
                toast('Papers generated, but with some warnings:<br><br>' + result.warnings.map(escapeHtml).join('<br>'));
                setTimeout(() => { window.location.href = contextData.returnUrl; }, 4000);
            } else {
                window.location.href = contextData.returnUrl;
            }
        } catch (err) {
            console.error(err);
            toast('An error occurred while generating the paper.');
        }
    };

    applyModeVisibility();
})();