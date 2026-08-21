document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("ebookFilterForm");

    // Setup each custom dropdown
    document.querySelectorAll(".custom-dropdown").forEach(function (dropdown) {
        const toggle = dropdown.querySelector(".dropdown-toggle");
        const menu = dropdown.querySelector(".dropdown-menu");
        const label = dropdown.querySelector(".dropdown-label");
        const arrow = dropdown.querySelector(".dropdown-arrow");
        const field = dropdown.dataset.dropdown; // "exam" or "sort"
        const hiddenInput = document.getElementById(field + "Input");

        toggle.addEventListener("click", function (e) {
            e.stopPropagation();
            closeAllDropdowns(dropdown);
            menu.classList.toggle("hidden");
            arrow.classList.toggle("rotate-180");
        });

        dropdown.querySelectorAll(".dropdown-option").forEach(function (option) {
            option.addEventListener("click", function () {
                const value = option.dataset.value;
                label.textContent = option.textContent.trim();
                if (hiddenInput) hiddenInput.value = value;

                dropdown.querySelectorAll(".dropdown-option").forEach(function (opt) {
                    opt.classList.remove("bg-indigo-600", "text-white");
                    opt.classList.add("text-slate-700");
                });
                option.classList.add("bg-indigo-600", "text-white");
                option.classList.remove("text-slate-700");

                menu.classList.add("hidden");
                arrow.classList.remove("rotate-180");

                form.submit();
            });
        });
    });

    function closeAllDropdowns(except) {
        document.querySelectorAll(".custom-dropdown").forEach(function (dropdown) {
            if (dropdown !== except) {
                dropdown.querySelector(".dropdown-menu").classList.add("hidden");
                dropdown.querySelector(".dropdown-arrow").classList.remove("rotate-180");
            }
        });
    }

    // Close on outside click
    document.addEventListener("click", function () {
        closeAllDropdowns(null);
    });
});