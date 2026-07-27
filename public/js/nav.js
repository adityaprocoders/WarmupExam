// ---- Mobile Sidebar Toggle ----
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const menuBtn = document.getElementById('menuBtn');

    if (!sidebar || !overlay) {
        console.error('Sidebar elements missing:', { sidebar, overlay });
        return;
    }

    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');

    const isOpen = !sidebar.classList.contains('-translate-x-full');

    document.body.style.overflow = isOpen ? 'hidden' : '';

    // Top hamburger icon hide/show
    if (menuBtn) {
        menuBtn.classList.toggle('hidden', isOpen);
    }
}

// ---- Profile Dropdown Toggle ----
function toggleProfileDropdown() {
    const menu = document.getElementById('profileDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
}

// Click outside profile dropdown => close it
document.addEventListener('click', function (e) {
    const wrapper = document.getElementById('profileDropdownWrapper');
    const menu = document.getElementById('profileDropdownMenu');
    if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// ---- Active Nav Link Highlight ----
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    document.querySelectorAll(".nav-link").forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPath) {
            link.classList.add("text-indigo-700", "font-semibold");
        }
    });
});