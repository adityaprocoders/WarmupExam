document.addEventListener('DOMContentLoaded', function () {
    const categorySelect = document.getElementById('category-select');
    if (categorySelect && typeof Choices !== 'undefined') {
        new Choices(categorySelect, {
            searchEnabled: true,
            itemSelectText: '',
            placeholder: true,
            placeholderValue: 'Search category...',
            shouldSort: false,
        });
    }
});