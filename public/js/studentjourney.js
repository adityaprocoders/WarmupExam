

  document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal-up, .reveal-left').forEach(el => observer.observe(el));

    const progressObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('grow');
          progressObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    const progressLine = document.querySelector('.timeline-progress');
    if (progressLine) progressObserver.observe(progressLine);
  });
 