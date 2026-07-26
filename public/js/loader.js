// ---------------- GLOBAL LOADER CONTROL ----------------
function showLoader() {
    const loader = document.getElementById("global-loader");
    if (loader) {
        loader.classList.remove("hidden");
        loader.classList.add("flex");
    }
}

function hideLoader() {
    const loader = document.getElementById("global-loader");
    if (loader) {
        loader.classList.add("hidden");
        loader.classList.remove("flex");
    }
}

// 1️⃣ Normal <form> submit pe automatically loader dikhao
document.addEventListener("submit", function (e) {
    if (e.target.hasAttribute("data-no-loader")) return;
    showLoader();
});

// 2️⃣ Normal internal links (<a href="...">) pe bhi loader dikhao
document.addEventListener("click", function (e) {
    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");

    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (link.target === "_blank") return;
    if (link.hasAttribute("data-no-loader")) return;
    if (href.startsWith("http") && !href.includes(window.location.hostname)) return;

    showLoader();
});

// 3️⃣ Back/forward button (bfcache) se aane par loader hata do
window.addEventListener("pageshow", function () {
    hideLoader();
});

// 4️⃣ Safety fallback — page load complete
window.addEventListener("load", hideLoader);

// 5️⃣ ⭐ EXTRA SAFETY NET — agar koi AJAX call hideLoader() call karna bhool jaaye,
// to loader hamesha ke liye stuck na rahe (max 8 sec ke baad khud hide ho jaayega)
let loaderSafetyTimeout = null;
const originalShowLoader = showLoader;
showLoader = function () {
    originalShowLoader();
    clearTimeout(loaderSafetyTimeout);
    loaderSafetyTimeout = setTimeout(hideLoader, 8000);
};

const originalHideLoader = hideLoader;
hideLoader = function () {
    clearTimeout(loaderSafetyTimeout);
    originalHideLoader();
};