const params = new URLSearchParams(window.location.search);
if (params.get('showLogin') === 'true') {
    openAuthModal('login');
    window.history.replaceState({}, document.title, window.location.pathname);
}