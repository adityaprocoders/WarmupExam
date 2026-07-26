
    document.addEventListener('DOMContentLoaded', () => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        document
            .querySelectorAll('.fade-right, .fade-left, .fade-up, .stat-item')
            .forEach(el => observer.observe(el));
    });
