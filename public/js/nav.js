(function () {
    const menuBtn = document.getElementById('menuBtn');
    const closeBtn = document.getElementById('closeBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('overlay');
    const stickyCta = document.getElementById('stickyCta');

    if (!menuBtn || !mobileMenu || !overlay) {
        console.error('Menu elements missing:', { menuBtn, mobileMenu, overlay });
        return;
    }

    function openMenu() {
        mobileMenu.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        if (stickyCta) stickyCta.classList.add('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        mobileMenu.classList.add('translate-x-full');
        overlay.classList.add('hidden');
        if (stickyCta) stickyCta.classList.remove('hidden');
        document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);

    const currentPath = window.location.pathname;
    document.querySelectorAll(".nav-link").forEach(link => {
        const href = link.getAttribute("href");
        if (href === currentPath) {
            link.classList.add("text-indigo-700", "font-semibold");
        }
    });
})();