 

const searchInput = document.getElementById("examSearch");
const resultBox = document.getElementById("searchResult");

let debounce;


document
.getElementById("searchBtn")
.addEventListener("click", () => {

    const keyword = searchInput.value.trim();

    if (!keyword) return;

    window.location.href =
        `/alltests?search=${encodeURIComponent(keyword)}`;

});

searchInput.addEventListener("input", () => {

    clearTimeout(debounce);

    debounce = setTimeout(async () => {

        const keyword = searchInput.value.trim();

        if (!keyword) {
            resultBox.innerHTML = "";
            resultBox.classList.add("hidden");
            return;
        }

        const res = await fetch(`/api/search-tests?keyword=${encodeURIComponent(keyword)}`);

        const data = await res.json();

        resultBox.innerHTML = "";

        if (data.length === 0) {

            resultBox.innerHTML = `
                <div class="p-3 text-gray-500">
                    No Exam Found
                </div>
            `;

            resultBox.classList.remove("hidden");
            return;
        }

        data.forEach(test => {

            resultBox.innerHTML += `
                <div
                    class="search-item px-4 py-3 hover:bg-gray-100 cursor-pointer border-b"
                    data-exam="${test.exam}">

                    <div class="font-semibold">${test.exam}</div>
                    <div class="text-sm text-gray-500">${test.title}</div>

                </div>
            `;

        });

        resultBox.classList.remove("hidden");

    },300);

});

searchInput.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        const keyword = this.value.trim();

        if (!keyword) return;

        window.location.href =
            `/alltests?search=${encodeURIComponent(keyword)}`;

    }

});

document.addEventListener("click", (e) => {

    const item = e.target.closest(".search-item");

    if (!item) return;

    const exam = item.dataset.exam;

    window.location.href = `/alltests?exam=${encodeURIComponent(exam)}`;

});

document.addEventListener("click", (e) => {

    if (
        !searchInput.contains(e.target) &&
        !resultBox.contains(e.target)
    ) {
        resultBox.classList.add("hidden");
    }

});



 