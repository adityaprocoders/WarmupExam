 
    (function () {

        document.querySelectorAll('img[data-fallback-src]').forEach(img => {
        img.addEventListener('error', function handler() {
            img.removeEventListener('error', handler);
            img.src = img.dataset.fallbackSrc;
        });
    });

    
        const editBtn = document.getElementById("editBtn");
        const cancelBtn = document.getElementById("cancelBtn");
        const saveBar = document.getElementById("saveBar");
        const saveBtn = document.getElementById("saveBtn");
        const views = document.querySelectorAll(".field-view");
        const inputs = document.querySelectorAll(".field-input");
        const avatarInput = document.getElementById("avatarInput");
        const avatarPreview = document.getElementById("avatarPreview");

        const usernameInput = document.getElementById("usernameInput");
        const usernameIcon = document.getElementById("usernameIcon");
        const usernameHint = document.getElementById("usernameHint");
        const headerUsernameText = document.getElementById("headerUsernameText");
        const originalUsername = usernameInput ? usernameInput.value.trim().toLowerCase() : "";

        const emailInput = document.getElementById("emailInput");
        const emailIcon = document.getElementById("emailIcon");
        const emailHint = document.getElementById("emailHint");
        const headerEmailText = document.getElementById("headerEmailText");
        const originalEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";

        let usernameValid = true;
        let emailValid = true;
        let usernameDebounce = null;
        let emailDebounce = null;

        function setEditMode(isEditing) {
            views.forEach(el => el.classList.toggle("hidden", isEditing));
            inputs.forEach(el => el.classList.toggle("hidden", !isEditing));
            saveBar.classList.toggle("hidden", !isEditing);
            saveBar.classList.toggle("flex", isEditing);
            editBtn.classList.toggle("hidden", isEditing);
        }

        editBtn.addEventListener("click", () => setEditMode(true));

        cancelBtn.addEventListener("click", () => {
            document.getElementById("profileForm").reset();
            avatarPreview.src = "<%= currentUser.avatar || '/images/default-avatar.png' %>";
            headerUsernameText.textContent = originalUsername;
            headerEmailText.textContent = originalEmail;
            if (usernameInput) resetFieldState(usernameInput, usernameIcon, usernameHint, "3-20 characters: letters, numbers, underscore");
            if (emailInput) resetFieldState(emailInput, emailIcon, emailHint, "Enter a valid email address");
            usernameValid = true;
            emailValid = true;
            saveBtn.disabled = false;
            resetPasswordSection();
            setEditMode(false);
        });

        // =====  Avatar Crop + Upload Logic =====
        const cropModal = document.getElementById("cropModal");
        const cropImage = document.getElementById("cropImage");
        const cropCancelBtn = document.getElementById("cropCancelBtn");
        const cropSaveBtn = document.getElementById("cropSaveBtn");
        const cropErrorMsg = document.getElementById("cropErrorMsg");
        let cropper = null;
  

        function openCropModal(imageDataUrl) {
    cropImage.src = imageDataUrl;
    cropModal.classList.remove("hidden");
    cropModal.classList.add("flex");
    if (cropper) cropper.destroy();
    
    cropper = new Cropper(cropImage, {
        aspectRatio: 1,          // Square profile avatar ke liye
        viewMode: 1,             // Image crop box se bahar na jaye
        dragMode: "move",        // Mouse se image ko drag/move karne ke liye
        initialAspectRatio: 1,
        autoCropArea: 0.8,       // Thoda chhota area rakhein taaki drag karne ki jagah mile
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false
    });
}
        
        function closeCropModal() {
            cropModal.classList.add("hidden");
            cropModal.classList.remove("flex");
            if (cropper) { cropper.destroy(); cropper = null; }
            cropErrorMsg.classList.add("hidden");
            avatarInput.value = ""; // taaki same file dubara select ho sake
        }

        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => openCropModal(ev.target.result);
            reader.readAsDataURL(file);
        });

        if (cropCancelBtn) cropCancelBtn.addEventListener("click", closeCropModal);

        if (cropSaveBtn) {
            cropSaveBtn.addEventListener("click", () => {
                if (!cropper) return;
                cropSaveBtn.disabled = true;
                cropSaveBtn.textContent = "Saving...";
                cropErrorMsg.classList.add("hidden");

                cropper.getCroppedCanvas({ width: 400, height: 400 }).toBlob(async (blob) => {
                    const formData = new FormData();
                    formData.append("avatar", blob, "avatar.jpg");

                    try {
                        const res = await fetch("/profile/update-avatar?_method=PATCH", {
    method: "POST",
    headers: {
        "x-csrf-token": document.querySelector('meta[name="csrf-token"]').content
    },
    body: formData
});
                        const data = await res.json();

                        if (data.success) {
                            avatarPreview.src = data.avatarUrl + "?t=" + Date.now(); // cache-bust
                            closeCropModal();
                        } else {
                            cropErrorMsg.textContent = data.message || "Could not update avatar.";
                            cropErrorMsg.classList.remove("hidden");
                        }
                    } catch (err) {
                        cropErrorMsg.textContent = "Something went wrong, try again.";
                        cropErrorMsg.classList.remove("hidden");
                    } finally {
                        cropSaveBtn.disabled = false;
                        cropSaveBtn.textContent = "Save";
                    }
                }, "image/jpeg", 0.9);
            });
        }

        function resetFieldState(inputEl, iconEl, hintEl, defaultHint) {
            inputEl.classList.remove("border-red-500", "border-green-500");
            inputEl.classList.add("border-slate-300");
            iconEl.classList.add("hidden");
            hintEl.textContent = defaultHint;
            hintEl.classList.remove("text-red-500", "text-green-600");
            hintEl.classList.add("text-slate-400");
        }

        function markChecking(inputEl, iconEl, hintEl) {
            inputEl.classList.remove("border-red-500", "border-green-500");
            inputEl.classList.add("border-slate-300");
            iconEl.classList.remove("hidden");
            iconEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-slate-400"></i>';
            hintEl.textContent = "Checking availability...";
            hintEl.classList.remove("text-red-500", "text-green-600");
            hintEl.classList.add("text-slate-400");
        }

        function markAvailable(inputEl, iconEl, hintEl, message) {
            inputEl.classList.remove("border-red-500", "border-slate-300");
            inputEl.classList.add("border-green-500");
            iconEl.classList.remove("hidden");
            iconEl.innerHTML = '<i class="fa-solid fa-circle-check text-green-500"></i>';
            hintEl.textContent = message || "Available";
            hintEl.classList.remove("text-slate-400");
            hintEl.classList.add("text-green-600");
        }

        function markUnavailable(inputEl, iconEl, hintEl, message) {
            inputEl.classList.remove("border-green-500", "border-slate-300");
            inputEl.classList.add("border-red-500");
            iconEl.classList.remove("hidden");
            iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-red-500"></i>';
            hintEl.textContent = message || "Not available";
            hintEl.classList.remove("text-slate-400");
            hintEl.classList.add("text-red-500");
        }

        function updateSaveState() {
            saveBtn.disabled = !(usernameValid && emailValid);
        }

        if (usernameInput) {
            usernameInput.addEventListener("input", () => {
                const cursorPos = usernameInput.selectionStart;
        usernameInput.value = usernameInput.value.toLowerCase();
        usernameInput.setSelectionRange(cursorPos, cursorPos);


                const value = usernameInput.value.trim().toLowerCase();
                headerUsernameText.textContent = value || originalUsername;
                clearTimeout(usernameDebounce);

                if (!value) {
                    usernameValid = false;
                    markUnavailable(usernameInput, usernameIcon, usernameHint, "Username is required");
                    updateSaveState();
                    return;
                }

                if (value === originalUsername) {
                    usernameValid = true;
                    resetFieldState(usernameInput, usernameIcon, usernameHint, "3-20 characters: letters, numbers, underscore");
                    usernameHint.textContent = "This is your current username";
                    updateSaveState();
                    return;
                }

                markChecking(usernameInput, usernameIcon, usernameHint);

                usernameDebounce = setTimeout(async () => {
                    try {
                        const res = await fetch("/profile/check-username?username=" + encodeURIComponent(value));
                        const data = await res.json();
                        usernameValid = !!data.available;
                        if (data.available) {
                            markAvailable(usernameInput, usernameIcon, usernameHint, data.message);
                        } else {
                            markUnavailable(usernameInput, usernameIcon, usernameHint, data.message);
                        }
                    } catch (err) {
                        usernameValid = false;
                        markUnavailable(usernameInput, usernameIcon, usernameHint, "Could not check, try again");
                    }
                    updateSaveState();
                }, 500);
            });
        }

        if (emailInput) {
            emailInput.addEventListener("input", () => {
        const cursorPos = emailInput.selectionStart;
        emailInput.value = emailInput.value.toLowerCase();
        emailInput.setSelectionRange(cursorPos, cursorPos);


    
                const value = emailInput.value.trim().toLowerCase();
                headerEmailText.textContent = value || originalEmail;
                clearTimeout(emailDebounce);

                const basicFormatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

                if (!value || !basicFormatOk) {
                    emailValid = false;
                    markUnavailable(emailInput, emailIcon, emailHint, "Enter a valid email address");
                    updateSaveState();
                    return;
                }

                if (value === originalEmail) {
                    emailValid = true;
                    resetFieldState(emailInput, emailIcon, emailHint, "Enter a valid email address");
                    emailHint.textContent = "This is your current email";
                    updateSaveState();
                    return;
                }

                markChecking(emailInput, emailIcon, emailHint);

                emailDebounce = setTimeout(async () => {
                    try {
                        const res = await fetch("/profile/check-email?email=" + encodeURIComponent(value));
                        const data = await res.json();
                        emailValid = !!data.available;
                        if (data.available) {
                            markAvailable(emailInput, emailIcon, emailHint, data.message);
                        } else {
                            markUnavailable(emailInput, emailIcon, emailHint, data.message);
                        }
                    } catch (err) {
                        emailValid = false;
                        markUnavailable(emailInput, emailIcon, emailHint, "Could not check, try again");
                    }
                    updateSaveState();
                }, 500);
            });
        }

        document.getElementById("profileForm").addEventListener("submit", (e) => {
            if (!usernameValid || !emailValid) {
                e.preventDefault();
            }
        });
 

    // ===== NAYA: Change Password Modal Logic =====
        const changePasswordModal = document.getElementById("changePasswordModal");
        const closeChangePasswordModal = document.getElementById("closeChangePasswordModal");
        const cancelChangePasswordBtn = document.getElementById("cancelChangePasswordBtn");
        const currentPasswordInput = document.getElementById("currentPasswordInput");
        const newPasswordInput = document.getElementById("newPasswordInput");
        const confirmPasswordInput = document.getElementById("confirmPasswordInput");
        const newPasswordHint = document.getElementById("newPasswordHint");
        const confirmPasswordHint = document.getElementById("confirmPasswordHint");
        const updatePasswordBtn = document.getElementById("updatePasswordBtn");
        const passwordUpdateMsg = document.getElementById("passwordUpdateMsg");

        function resetPasswordModal() {
            if (currentPasswordInput) currentPasswordInput.value = "";
            if (newPasswordInput) newPasswordInput.value = "";
            if (confirmPasswordInput) confirmPasswordInput.value = "";
            if (newPasswordHint) {
                newPasswordHint.textContent = "At least 8 characters";
                newPasswordHint.classList.remove("text-red-500", "text-green-600");
                newPasswordHint.classList.add("text-slate-400");
            }
            if (confirmPasswordHint) {
                confirmPasswordHint.textContent = "\u00A0";
                confirmPasswordHint.classList.remove("text-red-500", "text-green-600");
            }
            if (passwordUpdateMsg) passwordUpdateMsg.classList.add("hidden");
            if (updatePasswordBtn) updatePasswordBtn.disabled = true;
        }

        function openChangePasswordModal() {
            resetPasswordModal();
            changePasswordModal.classList.remove("hidden");
            changePasswordModal.classList.add("flex");
        }

        function closePasswordModal() {
            changePasswordModal.classList.add("hidden");
            changePasswordModal.classList.remove("flex");
        }

        if (closeChangePasswordModal) closeChangePasswordModal.addEventListener("click", closePasswordModal);
        if (cancelChangePasswordBtn) cancelChangePasswordBtn.addEventListener("click", closePasswordModal);

        // Show/hide password toggle buttons (eye icon)
        document.querySelectorAll(".pw-toggle").forEach(btn => {
            btn.addEventListener("click", () => {
                const target = document.getElementById(btn.dataset.target);
                const icon = btn.querySelector("i");
                if (target.type === "password") {
                    target.type = "text";
                    icon.classList.remove("fa-eye");
                    icon.classList.add("fa-eye-slash");
                } else {
                    target.type = "password";
                    icon.classList.remove("fa-eye-slash");
                    icon.classList.add("fa-eye");
                }
            });
        });

        function validatePasswordFields() {
            const newPw = newPasswordInput.value;
            const confirmPw = confirmPasswordInput.value;
            const currentPw = currentPasswordInput.value;

            let valid = true;

            if (newPw && newPw.length < 8) {
                newPasswordHint.textContent = "Password must be at least 8 characters";
                newPasswordHint.classList.add("text-red-500");
                newPasswordHint.classList.remove("text-slate-400", "text-green-600");
                valid = false;
            } else if (newPw) {
                newPasswordHint.textContent = "Looks good";
                newPasswordHint.classList.add("text-green-600");
                newPasswordHint.classList.remove("text-slate-400", "text-red-500");
            } else {
                newPasswordHint.textContent = "At least 8 characters";
                newPasswordHint.classList.remove("text-red-500", "text-green-600");
                newPasswordHint.classList.add("text-slate-400");
            }

            if (confirmPw && confirmPw !== newPw) {
                confirmPasswordHint.textContent = "Passwords do not match";
                confirmPasswordHint.classList.add("text-red-500");
                confirmPasswordHint.classList.remove("text-slate-400", "text-green-600");
                valid = false;
            } else if (confirmPw) {
                confirmPasswordHint.textContent = "Passwords match";
                confirmPasswordHint.classList.add("text-green-600");
                confirmPasswordHint.classList.remove("text-slate-400", "text-red-500");
            } else {
                confirmPasswordHint.textContent = "\u00A0";
                confirmPasswordHint.classList.remove("text-red-500", "text-green-600");
            }

            if (!currentPw || !newPw || !confirmPw) valid = false;

            updatePasswordBtn.disabled = !valid;
        }

        [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(el => {
            if (el) el.addEventListener("input", validatePasswordFields);
        });

        function showPasswordMsg(success, message) {
            passwordUpdateMsg.textContent = message;
            passwordUpdateMsg.classList.remove("hidden", "bg-green-50", "text-green-700", "bg-red-50", "text-red-700");
            passwordUpdateMsg.classList.add(success ? "bg-green-50" : "bg-red-50", success ? "text-green-700" : "text-red-700");
        }

        if (updatePasswordBtn) {
            updatePasswordBtn.addEventListener("click", async () => {
                const currentPassword = currentPasswordInput.value;
                const newPassword = newPasswordInput.value;
                const confirmPassword = confirmPasswordInput.value;

                if (!currentPassword || !newPassword || !confirmPassword) {
                    showPasswordMsg(false, "Please fill all password fields.");
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showPasswordMsg(false, "New password and confirm password do not match.");
                    return;
                }
                if (newPassword.length < 8) {
                    showPasswordMsg(false, "Password must be at least 8 characters.");
                    return;
                }

                updatePasswordBtn.disabled = true;
                updatePasswordBtn.textContent = "Updating...";

                try {
                     const res = await fetch("/profile/change-password?_method=PATCH", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-csrf-token": document.querySelector('meta[name="csrf-token"]').content
    },
    body: JSON.stringify({ currentPassword, newPassword })
});
                    const data = await res.json();

                    if (data.success) {
                        showPasswordMsg(true, data.message || "Password updated successfully.");
                        setTimeout(closePasswordModal, 1200);
                    } else {
                        showPasswordMsg(false, data.message || "Something went wrong.");
                        updatePasswordBtn.disabled = false;
                    }
                } catch (err) {
                    showPasswordMsg(false, "Could not update password, try again.");
                    updatePasswordBtn.disabled = false;
                } finally {
                    updatePasswordBtn.textContent = "Update Password";
                }
            });
        }










 
 const settingsBtn = document.getElementById("settingsBtn");
    const settingsMenu = document.getElementById("settingsMenu");
    const menuChangePassword = document.getElementById("menuChangePassword");
    const menuDeleteAccount = document.getElementById("menuDeleteAccount");

    if (settingsBtn) {
        settingsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            settingsMenu.classList.toggle("hidden");
        });
        document.addEventListener("click", (e) => {
            if (settingsMenu && !settingsMenu.contains(e.target) && e.target !== settingsBtn) {
                settingsMenu.classList.add("hidden");
            }
        });
    }
  

    if (menuChangePassword) {
    menuChangePassword.addEventListener("click", () => {
        settingsMenu.classList.add("hidden");
        openChangePasswordModal();
    });
}
     
    // ===== NAYA: Delete Account =====
    const deleteAccountModal = document.getElementById("deleteAccountModal");
    const deleteCancelBtn = document.getElementById("deleteCancelBtn");
    const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
    const deleteAccountMsg = document.getElementById("deleteAccountMsg");

    function closeDeleteModal() {
        deleteAccountModal.classList.add("hidden");
        deleteAccountModal.classList.remove("flex");
        deleteAccountMsg.classList.add("hidden");
    }

    if (menuDeleteAccount) {
        menuDeleteAccount.addEventListener("click", () => {
            settingsMenu.classList.add("hidden");
            deleteAccountModal.classList.remove("hidden");
            deleteAccountModal.classList.add("flex");
        });
    }

    if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeDeleteModal);

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener("click", async () => {
            deleteConfirmBtn.disabled = true;
            deleteConfirmBtn.textContent = "Deleting...";
            try {
                const res = await fetch("/profile/delete-account?_method=DELETE", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "x-csrf-token": document.querySelector('meta[name="csrf-token"]').content
    }
});
                const data = await res.json();

                if (data.success) {
                    window.location.href = "/";
                } else {
                    deleteAccountMsg.textContent = data.message || "Account delete nahi ho paya.";
                    deleteAccountMsg.classList.remove("hidden");
                    deleteAccountMsg.classList.add("bg-red-50", "text-red-700");
                    deleteConfirmBtn.disabled = false;
                    deleteConfirmBtn.textContent = "Ok, Delete";
                }
            } catch (err) {
                deleteAccountMsg.textContent = "Something went wrong, try again.";
                deleteAccountMsg.classList.remove("hidden");
                deleteAccountMsg.classList.add("bg-red-50", "text-red-700");
                deleteConfirmBtn.disabled = false;
                deleteConfirmBtn.textContent = "Ok, Delete";
            }
        });
    }

})();
 
