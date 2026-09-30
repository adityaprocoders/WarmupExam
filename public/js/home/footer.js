document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/api/footer-data');
        const data = await response.json();

        if (data.success) {
            const examsGrid = document.getElementById('footer-exams-grid');
            const examsList = document.getElementById('footer-exams-list');
            const seriesGrid = document.getElementById('footer-series-grid');
            const seriesList = document.getElementById('footer-series-list');

            // Left list mein kitne top items dikhane hain
            const TOP_COUNT = 4;

            // Same naam dobara aaye to sirf pehla rakho
            const uniqueBy = (arr, keyFn) => {
                const seen = new Set();
                return arr.filter(item => {
                    const key = String(keyFn(item)).trim().toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            };

            // Text ko HTML mein safely daalne ke liye
            const escapeHtml = (str) => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            // 1. Populate Exams
            if (data.exams && data.exams.length > 0) {
                const exams = uniqueBy(data.exams, exam => exam);

                // Left column list (first 4 items)
                examsList.innerHTML = exams.slice(0, TOP_COUNT).map(exam => `
                    <li><a href="/alltests?exam=${encodeURIComponent(exam)}" class="transition hover:text-white">${escapeHtml(exam)}</a></li>
                `).join('');

                // Main grid (baaki items, jo left list mein nahi hain)
                examsGrid.innerHTML = exams.slice(TOP_COUNT).map(exam => `
                    <a href="/alltests?exam=${encodeURIComponent(exam)}" class="transition hover:text-white">${escapeHtml(exam)}</a>
                `).join('');
            }

            // 2. Populate Test Series (Listings)
            if (data.testSeries && data.testSeries.length > 0) {
                const series = uniqueBy(data.testSeries, test => test.title);

                // Left column list (first 4 items)
                seriesList.innerHTML = series.slice(0, TOP_COUNT).map(test => `
                    <li><a href="/test/${test._id}" class="transition hover:text-white">${escapeHtml(test.title)} Mock</a></li>
                `).join('');

                // Main grid (baaki items, jo left list mein nahi hain)
                seriesGrid.innerHTML = series.slice(TOP_COUNT).map(test => `
                    <a href="/test/${test._id}" class="transition hover:text-white">${escapeHtml(test.title)} Mock</a>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Failed to load footer data", err);
    }
});