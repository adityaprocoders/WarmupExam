document.addEventListener('DOMContentLoaded', function () {
    if (window.lucide) lucide.createIcons();

    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('contactSubmitBtn');
    const btnText = document.getElementById('contactBtnText');

    const formData = {
        name: this.name.value,
        email: this.email.value,
        subject: this.subject.value,
        message: this.message.value
    };

    btn.disabled = true;
    btnText.textContent = "Sending...";

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

        const res = await fetch('/contact', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-csrf-token': csrfToken
            },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
            showContactPopup(true, "Message Sent Successfully!", "We'll get back to you within 24 hours.");
            this.reset();
        } else {
            showContactPopup(false, "Something Went Wrong", data.message || "Please try again.");
        }
    } catch (err) {
        showContactPopup(false, "Network Error", "Please check your connection and try again.");
    } finally {
        btn.disabled = false;
        btnText.textContent = "Send Message";
    }
});

    function showContactPopup(isSuccess, title, subtitle) {
        const existing = document.getElementById('contactPopupOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'contactPopupOverlay';
        overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" data-popup-close></div>

            <div class="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center animate-[popupIn_0.3s_ease-out]">

                <div class="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-5 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}">
                    ${isSuccess
                        ? `<svg class="w-8 h-8 sm:w-10 sm:h-10 text-green-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" class="animate-[checkDraw_0.4s_ease-out_0.2s_both]"/>
                           </svg>`
                        : `<svg class="w-8 h-8 sm:w-10 sm:h-10 text-red-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                           </svg>`
                    }
                </div>

                <h3 class="text-lg sm:text-xl font-bold text-slate-800 mb-2">${title}</h3>
                <p class="text-sm text-slate-500 mb-5 sm:mb-6">${subtitle}</p>

                <button data-popup-close
                    class="w-full ${isSuccess ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-600 hover:bg-slate-700'} text-white font-semibold py-3 rounded-xl transition-all">
                    Okay
                </button>

            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('overflow-hidden');

        overlay.querySelectorAll('[data-popup-close]').forEach(el => {
            el.addEventListener('click', closeContactPopup);
        });

        if (isSuccess) {
            setTimeout(() => closeContactPopup(), 4000);
        }
    }

    function closeContactPopup() {
        const overlay = document.getElementById('contactPopupOverlay');
        if (overlay) {
            overlay.classList.add('animate-[popupOut_0.2s_ease-in]');
            setTimeout(() => {
                overlay.remove();
                document.body.classList.remove('overflow-hidden');
            }, 200);
        }
    }
});