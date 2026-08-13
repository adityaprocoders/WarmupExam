 
 
document.addEventListener('DOMContentLoaded', () => {
  const io = initRevealAnimations();
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
});
 
lucide.createIcons();
 