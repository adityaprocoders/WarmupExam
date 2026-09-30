/* AI Paper Import: sirf UI helpers (logic aiPaperGenerator.js mein hai) */
document.addEventListener('DOMContentLoaded', function () {

    /* ---------- 1. Source cards: open / close ---------- */
    (function () {
        var fileBlock = document.getElementById('ai-file-block');
        var textBlock = document.getElementById('ai-text-block');
        var cards = document.querySelectorAll('.ai-source-card');
        if (!fileBlock || !textBlock || !cards.length) return;

        function slotOf(card) { return card.querySelector('.ai-source-slot'); }

        function sync() {
            cards.forEach(function (card) {
                var slot = slotOf(card), open = false;
                for (var i = 0; i < slot.children.length; i++) {
                    if (!slot.children[i].classList.contains('hidden')) open = true;
                }
                card.classList.toggle('is-open', open);
            });
        }

        var wasOpen = false;

        // Capture phase: main JS ke handlers se pehle card ki state yaad rakho
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.ai-source-btn');
            if (!btn) return;
            var card = btn.closest('.ai-source-card');
            wasOpen = !!(card && card.classList.contains('is-open'));
        }, true);

        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.ai-source-btn');
            if (!btn) return;
            var card = btn.closest('.ai-source-card');
            var src = btn.getAttribute('data-source');
            if (!card) return;

            if (wasOpen) {
                Array.prototype.forEach.call(slotOf(card).children, function (el) {
                    el.classList.add('hidden');
                });
            } else if (src === 'images' || src === 'pdf') {
                slotOf(card).appendChild(fileBlock);
            }
            requestAnimationFrame(sync);
        });

        var observer = new MutationObserver(sync);
        [fileBlock, textBlock].forEach(function (el) {
            observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        sync();
    })();

    /* ---------- 2. Processing screen: percent, bar, status message ---------- */
    (function () {
        var ring = document.getElementById('ai-progress-ring');
        var pct = document.getElementById('ai-percent');
        var bar = document.getElementById('ai-bar');
        var msg = document.getElementById('ai-status-msg');
        var panel = document.getElementById('ai-processing');
        if (!ring || !pct || !bar) return;

        var C = 264;
        function sync() {
            var raw = ring.style.strokeDashoffset || ring.getAttribute('stroke-dashoffset') || C;
            var off = parseFloat(raw);
            if (isNaN(off)) off = C;
            var p = Math.max(0, Math.min(100, Math.round((1 - off / C) * 100)));
            pct.textContent = p + '%';
            bar.style.width = p + '%';
        }
        new MutationObserver(sync).observe(ring, { attributes: true, attributeFilter: ['stroke-dashoffset', 'style'] });
        sync();

        var lines = [
            'Reading your source carefully...',
            'Understanding question structure...',
            'Matching options with answers...',
            'Writing step-by-step solutions...',
            'Almost there, polishing your paper...'
        ];
        var i = 0;
        setInterval(function () {
            if (!msg || !panel || panel.classList.contains('hidden')) return;
            msg.classList.add('opacity-0');
            setTimeout(function () {
                i = (i + 1) % lines.length;
                msg.textContent = lines[i];
                msg.classList.remove('opacity-0');
            }, 200);
        }, 2800);
    })();
});