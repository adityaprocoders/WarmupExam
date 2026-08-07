 
document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("logoutModalOverlay");
    const cancelBtn = document.getElementById("logoutCancelBtn");
    const confirmBtn = document.getElementById("logoutConfirmBtn");
    const logoutForms = document.querySelectorAll(".logout-form");
    const globalLoader = document.getElementById("global-loader"); // 👈 naya

    if (!overlay || logoutForms.length === 0) return;

    let formToSubmit = null;

    const openModal = () => {
        overlay.classList.remove("hidden");
        overlay.classList.add("flex");

        // 👇 agar loader.js ne isko yahin show kar diya, to hata do
        if (globalLoader) {
            globalLoader.classList.add("hidden");
            globalLoader.classList.remove("flex");
        }
    };

    const closeModal = () => {
        overlay.classList.add("hidden");
        overlay.classList.remove("flex");
        formToSubmit = null;
    };

    logoutForms.forEach((form) => {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            e.stopImmediatePropagation(); // 👈 naya — loader.js ka listener isi form pe chalne se roke
            formToSubmit = form;
            openModal();
        }, true); // 👈 naya — capture phase mein pehle chale, loader.js se pehle
    });

    cancelBtn.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    confirmBtn.addEventListener("click", () => {
        if (formToSubmit) {
            // 👇 OK dabane par hi loader dikhana hai
            if (globalLoader) {
                globalLoader.classList.remove("hidden");
                globalLoader.classList.add("flex");
            }
            formToSubmit.submit();
        }
    });
});