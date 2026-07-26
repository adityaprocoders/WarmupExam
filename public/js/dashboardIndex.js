   
    let currentCreateType = 'folder';

    function toggleCreateMenu(e) {
        e.stopPropagation();
        document.getElementById('createMenu').classList.toggle('hidden');
    }

    document.addEventListener('click', function () {
        document.getElementById('createMenu').classList.add('hidden');
    });

    const modalCopy = {
        folder: { title: 'Create Folder', sub: 'Naya folder is section me banega.', placeholder: 'e.g. Physics' },
        file: { title: 'Create File', sub: 'Nayi file is folder me add hogi.', placeholder: 'e.g. Chapter Notes.pdf' },
        test: { title: 'Create Test', sub: 'Naya mock test is section me add hoga.', placeholder: 'e.g. Mock Test - 7' }
    };

    // Tere script tag ke andar ye replace kar
function openCreateModal(type) {
    currentCreateType = type;
    document.getElementById('createMenu').classList.add('hidden');
    
    // Modal title/sub update
    const copy = modalCopy[type];
    document.getElementById('createModalTitle').textContent = copy.title;
    
    // Yahan fix hai: Test fields dikhana
    document.getElementById('testFieldsWrap').classList.toggle('hidden', type !== 'test');
    
    document.getElementById('createModalOverlay').classList.remove('hidden');
}

function closeCreateModal() {
    document.getElementById('createModalOverlay').classList.add('hidden');
}

 async function submitCreateForm(e) {
    e.preventDefault(); // Page reload rokne ke liye

    // 1. Form se data nikalo
    const payload = {

    type: currentCreateType,

    title: document.getElementById("createNameInput").value,

    icon: document.getElementById("createIconInput").value,

    listingId: "<%= listing._id %>",

    sectionId: "<%= currentSection ? currentSection._id : "" %>",

    parentType: "<%= folder ? 'folder' : (file ? 'file' : 'section') %>",

    parentId: "<%= folder ? folder._id : (file ? file._id : '') %>",

    currentUrl: window.location.pathname
};

    // Agar Test hai, to extra fields nikalo
    if (currentCreateType === 'test') {
        payload.questions = document.getElementById('testQuestions').value;
        payload.marks = document.getElementById('testMarks').value;
        payload.minutes = document.getElementById('testMinutes').value;
    }

    // 2. Console pe check karo
    console.log("Form Data Submitted:", payload);

    // 3. Ab Backend API call (DB Save)
    try {
        const response = await fetch('/api/create-item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.success) {
            console.log("DB Save Success:", result);
            window.location.reload(); // Save hone ke baad page reload
        } else {
            console.error("DB Error:", result.message);
             alert(result.message);
        }
    } catch (err) {
        console.error("Fetch Error:", err);
         alert("doesn't connect with server , try again!");
    }
}

   
    if (window.lucide) {
        lucide.createIcons();
    };
 
