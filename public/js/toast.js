function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");

    const baseClasses = "min-w-[250px] max-w-sm px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-[slideIn_0.3s_ease-out] opacity-0";
    const typeClasses = type === "success"
        ? "bg-green-500"
        : type === "error"
        ? "bg-red-500"
        : "bg-gray-800";

    toast.className = `${baseClasses} ${typeClasses}`;

    const icon = type === "success" ? "check-circle" : type === "error" ? "x-circle" : "info";
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i><span>${message}</span>`;

    container.appendChild(toast);

    // Fade in
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transition = "opacity 0.3s ease";
    });

    // Lucide icon render karna (aap already lucide use kar rahe ho)
    if (window.lucide) lucide.createIcons();

    // Auto remove
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}