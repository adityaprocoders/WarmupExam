document.addEventListener('DOMContentLoaded', function () {

    // ---------------- Back button ----------------
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function (e) {
            e.preventDefault();

            if (window.history.length > 1) {
                window.history.back(); // jahan se bhi user aaya, wahi exact page pe wapas
            } else {
                // sirf tab jab history bilkul na ho (direct link open kiya, naya tab)
                window.location.href = '/alltests';
            }
        });
    }

    // ---------------- FAQ accordion ----------------
    const faqItems = document.querySelectorAll('#faqList .faq-item');
    if (faqItems.length) {

        // Help Center jaisa reveal effect (agar CSS me .in-view ho)
        faqItems.forEach(function (el) { el.classList.add('in-view'); });

        function closeItem(item) {
            item.classList.remove('open');
            item.querySelector('.faq-answer').style.maxHeight = '0px';
        }

        function openItem(item) {
            faqItems.forEach(function (other) {
                if (other !== item) closeItem(other);
            });
            const answer = item.querySelector('.faq-answer');
            item.classList.add('open');
            answer.style.maxHeight = answer.scrollHeight + 'px';
        }

        faqItems.forEach(function (item) {
            item.querySelector('.faq-question').addEventListener('click', function () {
                if (item.classList.contains('open')) closeItem(item);
                else openItem(item);
            });
        });

        // window resize par open item ki height dobara set karo, taaki text cut na ho
        window.addEventListener('resize', function () {
            const openEl = document.querySelector('#faqList .faq-item.open');
            if (openEl) {
                const answer = openEl.querySelector('.faq-answer');
                answer.style.maxHeight = 'none';
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    }
});