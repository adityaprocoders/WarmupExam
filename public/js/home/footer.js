document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/api/footer-data');
        const data = await response.json();

        if (data.success) {
            const examsGrid = document.getElementById('footer-exams-grid');
            const examsList = document.getElementById('footer-exams-list');
            const seriesGrid = document.getElementById('footer-series-grid');
            const seriesList = document.getElementById('footer-series-list');

            // 1. Populate Exams
            if (data.exams && data.exams.length > 0) {
                // Left column list (first 4 items)
                examsList.innerHTML = data.exams.slice(0, 4).map(exam => `
                    <li><a href="/alltests?exam=${encodeURIComponent(exam)}" class="hover:text-white">${exam}</a></li>
                `).join('');

                // Main grid (all items)
                examsGrid.innerHTML = data.exams.map(exam => `
                    <a href="/alltests?exam=${encodeURIComponent(exam)}" class="hover:text-white">${exam}</a>
                `).join('');
            }

            // 2. Populate Test Series (Listings)
            if (data.testSeries && data.testSeries.length > 0) {
                // Left column list (first 4 items)
                seriesList.innerHTML = data.testSeries.slice(0, 4).map(test => `
                    <li><a href="/test/${test._id}" class="hover:text-white">${test.title} Mock</a></li>
                `).join('');

                // Main grid (all items)
                seriesGrid.innerHTML = data.testSeries.map(test => `
                    <a href="/test/${test._id}" class="hover:text-white">${test.title} Mock</a>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Failed to load footer data", err);
    }
});