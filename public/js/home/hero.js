(function () {
  var root = document.getElementById('wxHero');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Typing effect */
  var words = ['Defence', 'SSC', 'Railway', 'Banking', 'JEE', 'NEET', 'GATE', 'CUET'];
  var el = document.getElementById('wxWord');
  if (el) {
    if (reduce) { el.textContent = words.join(' · '); }
    else {
      var w = 0, c = 0, del = false;
      (function tick() {
        var word = words[w];
        el.textContent = word.slice(0, c);
        if (!del && c < word.length) { c++; return setTimeout(tick, 110); }
        if (!del && c === word.length) { del = true; return setTimeout(tick, 1400); }
        if (del && c > 0) { c--; return setTimeout(tick, 55); }
        del = false; w = (w + 1) % words.length; setTimeout(tick, 250);
      })();
    }
  }

  /* 2. Count-up */
  function countUp(node) {
    var end = +node.dataset.count, suf = node.dataset.suffix || '';
    function fmt(n) { return Math.round(n).toLocaleString('en-IN') + suf; }
    if (reduce) { node.textContent = fmt(end); return; }
    var dur = 1800, start = null;
    function step(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(end * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* 3. Scroll reveal (stats) */
  var items = root.querySelectorAll('.wx-reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('wx-in');
        var c = e.target.querySelector('[data-count]');
        if (c && !c.dataset.done) { c.dataset.done = 1; countUp(c); }
        io.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    items.forEach(function (n) { io.observe(n); });
  } else {
    items.forEach(function (n) { n.classList.add('wx-in'); });
    root.querySelectorAll('[data-count]').forEach(countUp);
  }

  /* 4. Mouse parallax on hero image (desktop only) */
  var stage = document.getElementById('wxStage'), wrap = document.getElementById('wxImgWrap');
  if (stage && wrap && !reduce && window.matchMedia('(hover: hover)').matches) {
    stage.addEventListener('mousemove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      wrap.style.transform = 'translate(' + (x * 22) + 'px,' + (y * 22) + 'px)';
    });
    stage.addEventListener('mouseleave', function () { wrap.style.transform = ''; });
  }
})();