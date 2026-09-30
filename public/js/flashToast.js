document.addEventListener('DOMContentLoaded', () => {
  // Backend se aaye flash toasts ko animate karo (page load pe)
  document.querySelectorAll('.flash-toast').forEach((el, i) => {
    setTimeout(() => {
      el.classList.remove('translate-x-[120%]', 'opacity-0');
    }, 80 + i * 120);
  });

  document.querySelectorAll('.flash-toast [data-dismiss-toast]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeToast(btn.closest('.flash-toast'));
    });
  });

  document.querySelectorAll('.flash-toast').forEach(el => {
    setTimeout(() => removeToast(el), 3500);
  });
});

function removeToast(el) {
  if (!el) return;
  el.classList.add('translate-x-[120%]', 'opacity-0');
  setTimeout(() => el.remove(), 500);
}

// ---------- Frontend/JS errors ke liye (fetch fail, validation, network error) ----------
function showToast(message, type = 'error') {
  const container = document.getElementById('flashContainer');
  if (!container) return;

  const isSuccess = type === 'success';
  const icon = isSuccess ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  const iconBg = isSuccess ? 'bg-emerald-50' : 'bg-red-50';
  const iconColor = isSuccess ? 'text-emerald-500' : 'text-red-500';
  const barColor = isSuccess ? 'bg-emerald-400' : 'bg-red-400';
  const label = isSuccess ? 'Success' : 'Error';

  const toast = document.createElement('div');
  toast.className = 'flash-toast pointer-events-auto flex items-start gap-3 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden translate-x-[120%] opacity-0 transition-all duration-500 ease-out';

  toast.innerHTML = `
    <div class="flex items-start gap-3 p-4 w-full relative">
      <div class="shrink-0 w-9 h-9 rounded-full ${iconBg} flex items-center justify-center">
        <i class="${icon} text-base ${iconColor}"></i>
      </div>
      <div class="flex-1 pt-0.5 min-w-0">
        <p class="text-sm font-semibold text-slate-800">${label}</p>
        <p class="text-sm text-slate-500 mt-0.5 break-words">${message}</p>
      </div>
      <button data-dismiss-toast class="shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
    <div class="h-1 ${barColor} toast-progress"></div>
  `;

  container.appendChild(toast);

  // Slide-in animation
  setTimeout(() => {
    toast.classList.remove('translate-x-[120%]', 'opacity-0');
  }, 50);

  // Manual dismiss
  toast.querySelector('[data-dismiss-toast]').addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto dismiss
  setTimeout(() => removeToast(toast), 3500);
}