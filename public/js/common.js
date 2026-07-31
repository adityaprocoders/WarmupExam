function initRevealAnimations() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  return io;
} 

 
// ================= CSRF AUTO-PROTECTION (sab forms + fetch ke liye) =================
document.addEventListener('DOMContentLoaded', () => {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    if (!token) return;

    document.querySelectorAll('form').forEach(form => {
        const method = (form.getAttribute('method') || '').toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            if (!form.querySelector('input[name="_csrf"]')) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = '_csrf';
                input.value = token;
                form.appendChild(input);
            }
        }
    });
});

(function () {
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            const token = document.querySelector('meta[name="csrf-token"]')?.content;
            if (token) {
                options.headers = {
                    ...(options.headers || {}),
                    'x-csrf-token': token
                };
            }
        }
        return originalFetch(url, options);
    };
})();