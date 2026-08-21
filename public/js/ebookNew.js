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

// Type = Free hone par price fields disable/reset
const ebookType = document.getElementById("ebookType");
function toggleFreePaid() {
    const isFree = ebookType.value === "Free";
    originalPrice.disabled = isFree;
    discountPercentage.disabled = isFree;
    if (isFree) {
        price.value = 0;
    } else {
        calculatePrice();
    }
}
if (ebookType) {
    ebookType.addEventListener("change", toggleFreePaid);
    toggleFreePaid();
}