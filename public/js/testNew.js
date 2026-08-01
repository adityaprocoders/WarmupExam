let index = typeof window.initialSubjectIndex === "number" ? window.initialSubjectIndex : 1;

function addSubject() {
    const container = document.getElementById("subjectsContainer");
    const div = document.createElement("div");
    div.className = "grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 subject-row";

    div.innerHTML = `
        <input
            type="text"
            name="listing[marks][${index}][subject]"
            placeholder="Subject"
            class="border rounded-lg p-2"
            required>

        <input
            type="number"
            step="0.01"
            name="listing[marks][${index}][positiveMarks]"
            placeholder="Positive Marks"
            class="border rounded-lg p-2"
            required>

        <input
            type="number"
            step="0.01"
            name="listing[marks][${index}][negativeMarks]"
            placeholder="Negative Marks"
            class="border rounded-lg p-2"
            required>

        <label class="flex items-center gap-2 text-sm text-gray-700 border rounded-lg p-2">
            <input
                type="checkbox"
                name="listing[marks][${index}][qualifyingOnly]"
                value="true"
                class="text-blue-600 focus:ring-blue-500">
            Qualifying Only
        </label>

        <button
            type="button"
            onclick="removeSubject(this)"
            class="bg-red-600 text-white rounded-lg px-3 py-2 hover:bg-red-700">
            Remove
        </button>
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

    button.parentElement.remove();
};

// ✅ Rank Predictor rows
let rankIndex = typeof window.initialRankIndex === "number" ? window.initialRankIndex : 1;

function addRankRow() {

    const container = document.getElementById("rankPredictorContainer");

    const div = document.createElement("div");

    div.className = "grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 rank-row";

    div.innerHTML = `
        <input
            type="number"
            step="0.01"
            name="listing[rankPredictorData][${rankIndex}][marks]"
            placeholder="Marks"
            class="border rounded-lg p-2">

        <input
            type="number"
            name="listing[rankPredictorData][${rankIndex}][rank]"
            placeholder="Rank"
            class="border rounded-lg p-2">

        <button
            type="button"
            onclick="removeRankRow(this)"
            class="bg-red-600 text-white rounded-lg px-3 py-2 hover:bg-red-700">
            Remove
        </button>
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

    button.parentElement.remove();
}

 
const originalPrice = document.getElementById("originalPrice");
const discountPercentage = document.getElementById("discountPercentage");
const price = document.getElementById("price");

function calculatePrice() {
    const original = parseFloat(originalPrice.value) || 0;
    const discount = parseFloat(discountPercentage.value) || 0;

    const finalPrice = original - (original * discount / 100);

    price.value = Math.round(finalPrice);
}

originalPrice.addEventListener("input", calculatePrice);
discountPercentage.addEventListener("input", calculatePrice);