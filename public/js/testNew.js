const INPUT_CLS = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const REMOVE_BTN_CLS = "rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-95";
const ADD_BTN_CLS = "w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 sm:w-auto";

const subjectsContainer = document.getElementById("subjectsContainer");
const rankPredictorContainer = document.getElementById("rankPredictorContainer");


let index = subjectsContainer ? parseInt(subjectsContainer.dataset.initialIndex, 10) || 1 : 1;
let rankIndex = rankPredictorContainer ? parseInt(rankPredictorContainer.dataset.initialIndex, 10) || 1 : 1;

function addSubject() {
    const container = document.getElementById("subjectsContainer");
    const div = document.createElement("div");
    div.className = "subject-row mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-5 md:items-center";

    div.innerHTML = `
        <input type="text" name="listing[marks][${index}][subject]" placeholder="Subject" class="${INPUT_CLS}" required>
        <input type="number" step="0.01" name="listing[marks][${index}][positiveMarks]" placeholder="Positive Marks" class="${INPUT_CLS}" required>
        <input type="number" step="0.01" name="listing[marks][${index}][negativeMarks]" placeholder="Negative Marks" class="${INPUT_CLS}" required>
        <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="listing[marks][${index}][qualifyingOnly]" value="true" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500">
            Qualifying Only
        </label>
        <button type="button" class="remove-subject-btn ${REMOVE_BTN_CLS}">Remove</button>
    `;

    container.appendChild(div);
    index++;
}

function removeSubject(button) {
    const container = document.getElementById("subjectsContainer");
    if (container.children.length === 1) {
        showToast("At least one subject is required.", "error");
        return;
    }
    button.closest('.subject-row').remove();
}

function addRankRow() {
    const container = document.getElementById("rankPredictorContainer");
    const div = document.createElement("div");
    div.className = "rank-row mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-3 md:items-center";

    div.innerHTML = `
        <input type="number" step="0.01" name="listing[rankPredictorData][${rankIndex}][marks]" placeholder="Marks" class="${INPUT_CLS}">
        <input type="number" name="listing[rankPredictorData][${rankIndex}][rank]" placeholder="Rank" class="${INPUT_CLS}">
        <button type="button" class="remove-rank-btn ${REMOVE_BTN_CLS}">Remove</button>
    `;

    container.appendChild(div);
    rankIndex++;
}

function removeRankRow(button) {
    const container = document.getElementById("rankPredictorContainer");
    if (container.children.length === 1) {
        showToast("At least one rank entry is required, or leave it empty.", "error");
        return;
    }
    button.closest('.rank-row').remove();
}

// Price calculation
const originalPrice = document.getElementById("originalPrice");
const discountPercentage = document.getElementById("discountPercentage");
const price = document.getElementById("price");

function calculatePrice() {
    const original = parseFloat(originalPrice.value) || 0;
    const discount = parseFloat(discountPercentage.value) || 0;
    const finalPrice = original - (original * discount / 100);
    price.value = Math.round(finalPrice);
}

if (originalPrice && discountPercentage) {
    originalPrice.addEventListener("input", calculatePrice);
    discountPercentage.addEventListener("input", calculatePrice);
}

// ✅ Event delegation — static aur dynamically-added buttons dono cover honge
document.addEventListener('DOMContentLoaded', function () {
    const addSubjectBtn = document.getElementById('addSubjectBtn');
    if (addSubjectBtn) addSubjectBtn.addEventListener('click', addSubject);

    const addRankRowBtn = document.getElementById('addRankRowBtn');
    if (addRankRowBtn) addRankRowBtn.addEventListener('click', addRankRow);

    document.addEventListener('click', function (e) {
        if (e.target.closest('.remove-subject-btn')) {
            removeSubject(e.target.closest('.remove-subject-btn'));
        }
        if (e.target.closest('.remove-rank-btn')) {
            removeRankRow(e.target.closest('.remove-rank-btn'));
        }
    });
});



/* =====================================================================
   MULTI-PART EXAM (Tier / Part / Pre-Mains / Main-Advanced / Custom)  — NAYA ADD-ON
   "Default" chuna to saare part-inputs disabled (submit hi nahi hote) => purana single behaviour.
   ===================================================================== */
(function () {
    const PRESETS = {
        tier: ["Tier 1", "Tier 2"],
        part: ["Part 1", "Part 2"],
        prelims_mains: ["Prelims", "Mains"],
        main_advanced: ["Main", "Advanced"],
        custom: ["Part 1", "Part 2"]
    };
    const MAX_PARTS = 6;   // pehla part + 5 extra

    function esc(v) {
        return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
 
        function subjectRowHtml(ti, sj, m) {
        m = m || {};
        return `
        <div class="tier-subject-row mb-3 grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:gap-3 md:grid-cols-5">
            <input type="text" name="listing[tiers][${ti}][marks][${sj}][subject]" value="${esc(m.subject)}" placeholder="Subject" class="${INPUT_CLS} col-span-2">
            <input type="number" step="any" name="listing[tiers][${ti}][marks][${sj}][positiveMarks]" value="${esc(m.positiveMarks != null ? m.positiveMarks : "")}" placeholder="+ Marks" class="${INPUT_CLS}">
            <input type="number" step="any" name="listing[tiers][${ti}][marks][${sj}][negativeMarks]" value="${esc(m.negativeMarks != null ? m.negativeMarks : "")}" placeholder="- Marks" class="${INPUT_CLS}">
            <div class="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-start">
                <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" name="listing[tiers][${ti}][marks][${sj}][qualifyingOnly]" value="true" ${m.qualifyingOnly ? "checked" : ""} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"> Qualifying
                </label>
                <button type="button" class="remove-tier-subject-btn ${REMOVE_BTN_CLS}">Remove</button>
            </div>
        </div>`;
    }

    function rankRowHtml(ti, rj, r) {
        r = r || {};
        return `
        <div class="tier-rank-row mb-3 grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3 sm:gap-3">
            <input type="number" step="any" name="listing[tiers][${ti}][rankPredictorData][${rj}][marks]" value="${esc(r.marks != null ? r.marks : "")}" placeholder="Marks" class="${INPUT_CLS}">
            <input type="number" name="listing[tiers][${ti}][rankPredictorData][${rj}][rank]" value="${esc(r.rank != null ? r.rank : "")}" placeholder="Rank" class="${INPUT_CLS}">
            <button type="button" class="remove-tier-rank-btn col-span-2 sm:col-span-1 ${REMOVE_BTN_CLS}">Remove</button>
        </div>`;
    }

    function tierBlockHtml(ti, t) {
        t = t || {};
        const subs = (t.marks && t.marks.length ? t.marks : [{}]).map((m, j) => subjectRowHtml(ti, j, m)).join("");
        const ranks = (t.rankPredictorData && t.rankPredictorData.length ? t.rankPredictorData : [{}]).map((r, j) => rankRowHtml(ti, j, r)).join("");
        const nextSub = (t.marks && t.marks.length ? t.marks.length : 1);
        const nextRank = (t.rankPredictorData && t.rankPredictorData.length ? t.rankPredictorData.length : 1);
        return `
        <div class="tier-block mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-tier-index="${ti}" data-next-subject="${nextSub}" data-next-rank="${nextRank}">
            <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div class="flex-1">
                    <label class="block text-sm font-semibold text-slate-700">Part name</label>
                    <input type="text" name="listing[tiers][${ti}][name]" value="${esc(t.name)}" placeholder="e.g. Tier 2, Mains, Part 2" class="tier-name-input mt-1 w-full sm:w-2/3 ${INPUT_CLS} py-2.5">
                    <input type="hidden" name="listing[tiers][${ti}][key]" value="${esc(t.key)}">
                </div>
                <button type="button" class="remove-tier-btn w-full sm:w-auto ${REMOVE_BTN_CLS}">Remove Part</button>
            </div>

            <div class="mb-3 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <h4 class="text-sm font-bold text-slate-800 sm:text-base">Marks Configuration</h4>
                <button type="button" class="add-tier-subject-btn ${ADD_BTN_CLS}">+ Add Subject</button>
            </div>
            <div class="tier-subjects">${subs}</div>

            <div class="mb-3 mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <h4 class="text-sm font-bold text-slate-800 sm:text-base">Rank Predictor Data</h4>
                <button type="button" class="add-tier-rank-btn w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 sm:w-auto">+ Add Row</button>
            </div>
            <div class="tier-ranks">${ranks}</div>
        </div>`;
    }

    let nextTierIndex = 1; // 0 = pehla part (upar wale purane blocks)

    const $ = (id) => document.getElementById(id);
    const structureType = () => ($("structureTypeSelect") ? $("structureTypeSelect").value : "");
    const isMulti = () => structureType() !== "";
    const extraCount = () => document.querySelectorAll("#tiersContainer .tier-block").length;

    function addTier(t) {
        const box = $("tiersContainer");
        if (!box || extraCount() + 1 >= MAX_PARTS) return;
        box.insertAdjacentHTML("beforeend", tierBlockHtml(nextTierIndex++, t));
        sync();
    }

    // Single => part inputs disable + marks 'required' wapas; Multi => enable + 'required' hata do (koi part khali ho sakta hai)
    function sync() {
        const multi = isMulti();
        if ($("examStructureInput")) $("examStructureInput").value = multi ? "multi" : "single";
        $("tierBox") && $("tierBox").classList.toggle("hidden", !multi);
        $("extraTiersBox") && $("extraTiersBox").classList.toggle("hidden", !multi);
        document.querySelectorAll("#tierBox input, #extraTiersBox input").forEach(el => { el.disabled = !multi; });

        document.querySelectorAll('input[name^="listing[marks]"][name$="[subject]"]').forEach(el => {
            if (multi) el.removeAttribute("required"); else if (el.name === "listing[marks][0][subject]") el.setAttribute("required", "required");
        });

        const first = document.querySelector('input[name="listing[tiers][0][name]"]');
        const label = multi && first && first.value.trim() ? "— " + first.value.trim() : "";
        document.querySelectorAll(".tier1-label").forEach(el => { el.textContent = label; });

        const atMax = extraCount() + 1 >= MAX_PARTS;
        $("addTierBtn") && ($("addTierBtn").disabled = atMax);
        $("tierLimitNote") && $("tierLimitNote").classList.toggle("hidden", !atMax);
    }

    // Preset chuna => naam apne aap bhar do (custom me naam jo hain wahi rehte hain)
    function applyPreset() {
        const type = structureType();
        if (!type) { sync(); return; }
        const names = PRESETS[type] || PRESETS.custom;
        const first = document.querySelector('input[name="listing[tiers][0][name]"]');
        if (first && (type !== "custom" || !first.value.trim())) first.value = names[0];
        if (extraCount() === 0) addTier({ name: names[1] });
        else if (type !== "custom") {
            const firstExtra = document.querySelector("#tiersContainer .tier-name-input");
            if (firstExtra) firstExtra.value = names[1];
        }
        sync();
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!$("examStructureBox")) return;

        const dataEl = $("initialTiersData");   // edit page: saved parts wapas dikhao
        if (dataEl) {
            try { JSON.parse(dataEl.textContent || "[]").forEach(t => addTier(t)); }
            catch (e) { console.error("tiers data parse error", e); }
        }

        $("structureTypeSelect").addEventListener("change", applyPreset);
        const first = document.querySelector('input[name="listing[tiers][0][name]"]');
        if (first) first.addEventListener("input", sync);
        $("addTierBtn") && $("addTierBtn").addEventListener("click", () => addTier({ name: "Part " + (extraCount() + 2) }));

        document.addEventListener("click", function (e) {
            const block = e.target.closest(".tier-block");
            if (!block) return;
            const ti = block.dataset.tierIndex;
            if (e.target.closest(".add-tier-subject-btn")) {
                const j = Number(block.dataset.nextSubject || 0); block.dataset.nextSubject = j + 1;
                block.querySelector(".tier-subjects").insertAdjacentHTML("beforeend", subjectRowHtml(ti, j, {}));
            } else if (e.target.closest(".add-tier-rank-btn")) {
                const j = Number(block.dataset.nextRank || 0); block.dataset.nextRank = j + 1;
                block.querySelector(".tier-ranks").insertAdjacentHTML("beforeend", rankRowHtml(ti, j, {}));
            } else if (e.target.closest(".remove-tier-subject-btn")) {
                if (block.querySelectorAll(".tier-subject-row").length > 1) e.target.closest(".tier-subject-row").remove();
            } else if (e.target.closest(".remove-tier-rank-btn")) {
                if (block.querySelectorAll(".tier-rank-row").length > 1) e.target.closest(".tier-rank-row").remove();
            } else if (e.target.closest(".remove-tier-btn")) {
                if (extraCount() > 1) { block.remove(); sync(); }
                else alert("A multi-part exam needs at least 2 parts.");
            }
        });

        sync();
    });
})();