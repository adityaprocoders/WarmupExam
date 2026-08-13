// ---- Mobile Sidebar Toggle ----

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const menuBtn = document.getElementById('menuBtn');

    if (!sidebar || !overlay) {
        // Sidebar is not present on this page — hide the hamburger button instead
        if (menuBtn) menuBtn.style.display = 'none';
        return;
    }

    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');

    const isOpen = !sidebar.classList.contains('-translate-x-full');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (menuBtn) menuBtn.classList.toggle('hidden', isOpen);
}

// ---- Profile Dropdown Toggle (click) ----
function toggleProfileDropdown() {
    const menu = document.getElementById('profileDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
}

// ---- Profile Dropdown Hover ----
document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('profileDropdownWrapper');
    const menu = document.getElementById('profileDropdownMenu');

    if (wrapper && menu) {
        let hideTimeout;

        wrapper.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            menu.classList.remove('hidden');
        });

        wrapper.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                menu.classList.add('hidden');
            }, 200);
        });
    }
});

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



document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'toggle-sidebar':
      toggleSidebar();
      break;
    case 'toggle-profile-dropdown':
      toggleProfileDropdown();
      break;
  }
});