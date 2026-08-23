 
 function saveResetState(email, expiresInSeconds) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    sessionStorage.setItem('pendingReset', JSON.stringify({ email, expiresAt }));
}

function clearResetState() {
    sessionStorage.removeItem('pendingReset');
}

function getResetState() {
    const raw = sessionStorage.getItem('pendingReset');
    if (!raw) return null;
    try {
        const state = JSON.parse(raw);
        if (state.expiresAt <= Date.now()) {
            clearResetState();
            return null;
        }
        return state;
    } catch {
        return null;
    }
}


let currentResetToken = null;

function enterTokenMode(email, token) {
    currentResetToken = token;
    saveResetState(email, 300); // countdown ke liye reuse
    startOtpCountdown(300);

    const otpGroup = document.getElementById('resetOtp')?.closest('div');
    if (otpGroup) otpGroup.classList.add('hidden');
    document.getElementById('resetOtp').required = false;

    document.getElementById('resendOtpBtn').classList.add('hidden'); // token-mode mein resend-OTP relevant nahi
}

function exitTokenMode() {
    currentResetToken = null;

    const otpGroup = document.getElementById('resetOtp')?.closest('div');
    if (otpGroup) otpGroup.classList.remove('hidden');
    document.getElementById('resetOtp').required = true;

    document.getElementById('resendOtpBtn').classList.remove('hidden');
}


    function openAuthModal(type) {
        const currentUrl = window.location.pathname
        document.getElementById('returnTo_login').value = currentUrl;
        document.getElementById('returnTo_register').value = currentUrl;

        document.getElementById('authOverlay').classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        switchAuthPanel(type);
    }
    

    function closeAuthModal() {
        document.getElementById('authOverlay').classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

        function switchAuthPanel(type) {
    if (type === 'login' || type === 'forgot') {
        const pending = getResetState();
        if (pending) {
            document.getElementById('resetEmailDisplay').textContent = pending.email;
            document.getElementById('resetEmailHidden').value = pending.email;
            const remaining = Math.max(1, Math.round((pending.expiresAt - Date.now()) / 1000));
            startOtpCountdown(remaining);
            type = 'reset';
        } else if (type === 'forgot') {
            const msgEl = document.getElementById('forgotEmailMsg');
            msgEl.classList.add('hidden');
            msgEl.textContent = '';
        }
    }

    document.getElementById('loginPanel').classList.toggle('hidden', type !== 'login');
    document.getElementById('registerPanel').classList.toggle('hidden', type !== 'register');
    document.getElementById('forgotPanel').classList.toggle('hidden', type !== 'forgot');
    document.getElementById('resetPanel').classList.toggle('hidden', type !== 'reset');

    if (window.lucide) lucide.createIcons();
}
    // Password Show/Hide Toggle Function
    function togglePassword(fieldId, iconId) {
        const passwordInput = document.getElementById(fieldId);
        const eyeIcon = document.getElementById(iconId);
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            // Change icon to Slash/Hide state
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>`;
        } else {
            passwordInput.type = 'password';
            // Change icon back to normal Eye/Show state
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>`;
        }
    }

    // Backdrop click se close
    document.getElementById('authBackdrop').addEventListener('click', closeAuthModal);

 document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'open-auth') openAuthModal(el.dataset.mode);
    else if (action === 'close-auth') closeAuthModal();
    else if (action === 'switch-panel') switchAuthPanel(el.dataset.panel);
    else if (action === 'toggle-password') togglePassword(el.dataset.field, el.dataset.icon);
    else if (action === 'resend-otp') resendOtp();
});
 

document.addEventListener('input', function (e) {
    if (e.target.dataset.oninput === 'lowercase') {
        e.target.value = e.target.value.toLowerCase();
    }
});


    // Escape key se close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAuthModal();
    });


 

let otpCountdownInterval = null;

function startOtpCountdown(seconds) {
    const resendBtn = document.getElementById('resendOtpBtn');
    const timerText = document.getElementById('otpTimerText');

    clearInterval(otpCountdownInterval);
    resendBtn.disabled = true;

    let remaining = seconds;

    const updateDisplay = () => {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerText.textContent = `Resend OTP in ${mins}:${secs.toString().padStart(2, '0')}`;
    };

    updateDisplay();

    otpCountdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(otpCountdownInterval);
            resendBtn.disabled = false;
            timerText.textContent = "";
        } else {
            updateDisplay();
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const forgotForm = document.getElementById('forgotEmailForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('forgotEmail').value.trim();
            const btn = document.getElementById('sendOtpBtn');
            const msgEl = document.getElementById('forgotEmailMsg');

            btn.disabled = true;
            btn.textContent = "Sending...";

            try {
                const res = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                msgEl.classList.remove('hidden');

                if (data.success) {
                    msgEl.className = "text-center text-sm text-green-600";
                    msgEl.textContent = "✅ OTP sent to your email!";

                    document.getElementById('resetEmailDisplay').textContent = email;
                    document.getElementById('resetEmailHidden').value = email;

                    saveResetState(email, data.expiresIn || 300);
                    switchAuthPanel('reset');
                    startOtpCountdown(data.expiresIn || 300);
                } else {
                    msgEl.className = "text-center text-sm text-red-600";
                    msgEl.textContent = data.message || "Something went wrong";
                }
            } catch (err) {
                msgEl.classList.remove('hidden');
                msgEl.className = "text-center text-sm text-red-600";
                msgEl.textContent = "Network error, try again";
            }

            btn.disabled = false;
            btn.textContent = "Send OTP";
        });
    }

    const resetForm = document.getElementById('resetPasswordForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('resetEmailHidden').value;
            const otp = document.getElementById('resetOtp').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const btn = document.getElementById('resetSubmitBtn');
            const msgEl = document.getElementById('resetMsg');

            btn.disabled = true;
            btn.textContent = "Resetting...";

                        const payload = currentResetToken
                ? { email, resetToken: currentResetToken, newPassword }
                : { email, otp, newPassword };

            try {
                const res = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                msgEl.classList.remove('hidden');

                if (data.success) {
                     clearResetState();
                     exitTokenMode();
                    msgEl.className = "text-center text-sm text-green-600";
                    msgEl.textContent = "Password reset successfully! Redirecting to login...";
                    clearInterval(otpCountdownInterval);
                    setTimeout(() => {
                        switchAuthPanel('login');
                        resetForm.reset();
                        msgEl.classList.add('hidden');
                    }, 1800);
                } else {
                    msgEl.className = "text-center text-sm text-red-600";
                    msgEl.textContent = data.message || "Invalid OTP or something went wrong";
                }
            } catch (err) {
                msgEl.classList.remove('hidden');
                msgEl.className = "text-center text-sm text-red-600";
                msgEl.textContent = "Network error, try again";
            }

            btn.disabled = false;
            btn.textContent = "Reset Password";
        });
    }
});

async function resendOtp() {
    const email = document.getElementById('resetEmailHidden').value;
    const btn = document.getElementById('resendOtpBtn');
    btn.disabled = true;

    try {
        const res = await fetch('/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();

                 if (data.success) {
            saveResetState(email, data.expiresIn || 300);
            startOtpCountdown(data.expiresIn || 300);
        } else {
            alert(data.message || "Failed to resend OTP");
            btn.disabled = false;
        }
    } catch (err) {
        alert("Network error");
        btn.disabled = false;
    }
}
 




document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const resetEmail = params.get('resetEmail');
    const resetTokenFromUrl = params.get('resetToken');

    if (resetEmail && resetTokenFromUrl) {
        // URL turant clean kar do — chahe verify fail ho ya pass, token dobara URL mein nahi rehna chahiye
        window.history.replaceState({}, document.title, window.location.pathname);

        (async () => {
            try {
                const res = await fetch('/verify-reset-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: resetEmail, resetToken: resetTokenFromUrl })
                });
                const data = await res.json();

                if (!data.success) {
                    alert(data.message || "This reset link is invalid or has expired. Please request a new one.");
                    return;
                }

                // ✅ Token verified — reset panel token-mode mein khol do
                document.getElementById('authOverlay').classList.remove('hidden');
                document.body.classList.add('overflow-hidden');

                document.getElementById('resetEmailDisplay').textContent = resetEmail;
                document.getElementById('resetEmailHidden').value = resetEmail;

                enterTokenMode(resetEmail, resetTokenFromUrl);
                switchAuthPanel('reset');
            } catch (err) {
                alert("Network error, please try again.");
            }
        })();
    }
});

