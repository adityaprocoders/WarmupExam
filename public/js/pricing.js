/* Pricing page: sirf UI (reveal, spotlight, count-up). CSP-safe, koi inline style attribute nahi. */
document.addEventListener('DOMContentLoaded', function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wraps = document.querySelectorAll('.pc-reveal');

    // Stagger delay + feature index
    wraps.forEach(function (w) {
        var d = (parseInt(w.getAttribute('data-delay'), 10) || 0) / 1000;
        w.style.setProperty('--d', d + 's');
        w.querySelectorAll('.pc-feat').forEach(function (li) {
            li.style.setProperty('--fi', li.getAttribute('data-i'));
            li.style.setProperty('--d', d + 's');
        });
    });

    function countUp(root) {
        root.querySelectorAll('[data-count]').forEach(function (el) {
            var end = parseInt(el.getAttribute('data-count'), 10);
            if (isNaN(end) || reduce) return;
            var t0 = null, dur = 1100;
            el.textContent = '0';
            function step(ts) {
                if (!t0) t0 = ts;
                var p = Math.min((ts - t0) / dur, 1);
                el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }

    function show(w) {
        w.classList.add('in');
        countUp(w);
        setTimeout(function () { w.classList.add('ready'); }, 1400);
    }

    if (reduce || !('IntersectionObserver' in window)) {
        wraps.forEach(function (w) { w.classList.add('in', 'ready'); });
    } else {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                show(e.target);
                io.unobserve(e.target);
            });
        }, { threshold: 0.12 });
        wraps.forEach(function (w) { io.observe(w); });
    }

    // Spotlight: mouse position card ke andar
    document.querySelectorAll('.pc-card').forEach(function (card) {
        card.addEventListener('pointermove', function (e) {
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        });
    });
});