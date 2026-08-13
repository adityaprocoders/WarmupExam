const subjectsContainer = document.getElementById("subjectsContainer");
const rankPredictorContainer = document.getElementById("rankPredictorContainer");

let index = subjectsContainer ? parseInt(subjectsContainer.dataset.initialIndex, 10) || 1 : 1;
let rankIndex = rankPredictorContainer ? parseInt(rankPredictorContainer.dataset.initialIndex, 10) || 1 : 1;

function addSubject() {
    const container = document.getElementById("subjectsContainer");
    const div = document.createElement("div");
    div.className = "grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 subject-row";

    div.innerHTML = `
        <input type="text" name="listing[marks][${index}][subject]" placeholder="Subject" class="border rounded-lg p-2" required>
        <input type="number" step="0.01" name="listing[marks][${index}][positiveMarks]" placeholder="Positive Marks" class="border rounded-lg p-2" required>
        <input type="number" step="0.01" name="listing[marks][${index}][negativeMarks]" placeholder="Negative Marks" class="border rounded-lg p-2" required>
        <label class="flex items-center gap-2 text-sm text-gray-700 border rounded-lg p-2">
            <input type="checkbox" name="listing[marks][${index}][qualifyingOnly]" value="true" class="text-blue-600 focus:ring-blue-500">
            Qualifying Only
        </label>
        <button type="button" class="remove-subject-btn bg-red-600 text-white rounded-lg px-3 py-2 hover:bg-red-700">Remove</button>
    `;

    container.appendChild(div);
    index++;
}

function removeSubject(button) {
    const container = document.getElementById("subjectsContainer");
    if (container.children.length === 1) {
        alert("At least one subject is required.");
        return;
    }
    button.closest('.subject-row').remove();
}

function addRankRow() {
    const container = document.getElementById("rankPredictorContainer");
    const div = document.createElement("div");
    div.className = "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 rank-row";

    div.innerHTML = `
        <input type="number" step="0.01" name="listing[rankPredictorData][${rankIndex}][marks]" placeholder="Marks" class="border rounded-lg p-2">
        <input type="number" name="listing[rankPredictorData][${rankIndex}][rank]" placeholder="Rank" class="border rounded-lg p-2">
        <button type="button" class="remove-rank-btn bg-red-600 text-white rounded-lg px-3 py-2 hover:bg-red-700">Remove</button>
    `;

    container.appendChild(div);
    rankIndex++;
}

function removeRankRow(button) {
    const container = document.getElementById("rankPredictorContainer");
    if (container.children.length === 1) {
        alert("At least one rank entry is required, ya isko khali chhod do.");
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