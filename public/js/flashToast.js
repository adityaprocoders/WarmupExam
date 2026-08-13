document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.flash-toast').forEach((el, i) => {
    setTimeout(() => {
      el.classList.remove('translate-x-[120%]', 'opacity-0');
    }, 80 + i * 120);
  });

  function removeToast(el) {
    if (!el) return;
    el.classList.add('translate-x-[120%]', 'opacity-0');
    setTimeout(() => el.remove(), 500);
  }

  document.querySelectorAll('.flash-toast [data-dismiss-toast]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeToast(btn.closest('.flash-toast'));
    });
  });

  document.querySelectorAll('.flash-toast').forEach(el => {
    setTimeout(() => removeToast(el), 3500);
  });

  if (window.lucide) lucide.createIcons();
});