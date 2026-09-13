// Theme toggle
(function () {
  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function systemPref() {
    return media && media.matches ? 'dark' : 'light';
  }
  function currentTheme() {
    return root.getAttribute('data-theme') || systemPref();
  }
  function reflect(theme) {
    toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    reflect(theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }

  reflect(currentTheme());
  toggle.addEventListener('click', function () {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  // Follow the OS while the visitor hasn't made an explicit choice
  if (media && media.addEventListener) {
    media.addEventListener('change', function () {
      var stored = null;
      try { stored = localStorage.getItem('theme'); } catch (e) {}
      if (stored !== 'light' && stored !== 'dark') { reflect(systemPref()); }
    });
  }
})();

// Mobile nav toggle
(function () {
  var head = document.querySelector('.site-head');
  var btn = document.querySelector('.nav-toggle');
  if (!head || !btn) return;

  function isOpen() { return head.classList.contains('open'); }
  function setOpen(open) {
    head.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', function () { setOpen(!isOpen()); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
  });

  document.addEventListener('click', function (e) {
    if (isOpen() && !head.contains(e.target)) { setOpen(false); }
  });
})();

// Scroll reveal - FALLBACK ONLY. CSS animation-timeline: view() drives this in
// Chrome/Edge 115+ and Safari 26+. Firefox still ships it behind a flag, so this
// observer stays until that lands - without it, html.js .reveal would sit at
// opacity 0 forever there and the page would read as blank below the fold.
// Kept separate so a failure here can't strand the nav, and a failure in the
// nav can't leave every .reveal element stuck at opacity 0.
// The homepage hero is intentionally excluded so it paints immediately.
(function () {
  // If CSS handles it, do nothing at all - no observer, no class toggling.
  if (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) return;

  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal')).filter(function (el) {
    return !(el.closest && el.closest('.welcome'));
  });
  if (!items.length) return;

  var reduceMedia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduce = !!(reduceMedia && reduceMedia.matches);

  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(function (el) { io.observe(el); });
})();

// Drag-to-dismiss the welcome slide: press and slide up to reveal the rest of
// the page. Touch keeps native scrolling (touch-action: pan-y), so on a phone
// the browser wins the gesture and this quietly stands down.
(function () {
  var welcome = document.querySelector('.welcome');
  var target = document.getElementById('proof');
  if (!welcome || !target) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var dragging = false;
  var startY = 0;
  var delta = 0;

  function setTransform(y, opacity) {
    welcome.style.transform = y ? 'translateY(' + y + 'px)' : '';
    welcome.style.opacity = opacity != null ? String(opacity) : '';
  }

  function onDown(e) {
    if (e.target.closest('a, button')) return;
    dragging = true;
    startY = e.clientY;
    welcome.style.transition = 'none';
    welcome.classList.add('dragging');
  }

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var raw = e.clientY - startY;
    delta = raw < 0 ? raw : raw * 0.15; // resist downward drags
    var vh = window.innerHeight;
    var opacity = Math.max(1 - Math.abs(Math.min(delta, 0)) / (vh * 0.8), .25);
    setTransform(delta, opacity);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    welcome.classList.remove('dragging');
    welcome.style.transition = 'transform .4s var(--ease), opacity .3s var(--ease)';
    var threshold = window.innerHeight * 0.16;

    if (delta < -threshold && !reduce) {
      setTransform(-window.innerHeight, 0);
      setTimeout(function () {
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(function () {
          welcome.style.transition = 'none';
          setTransform(0, null);
        }, 500);
      }, 250);
    } else {
      setTransform(0, null);
    }
    delta = 0;
  }

  welcome.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
})();

// Crawl progress is now pure CSS: animation-timeline: scroll(root block).
// The markup lives in each page's HTML rather than being injected here, so the
// bar exists before first paint instead of after site.js parses.

// Tab-away easter egg: the "page" reports itself gone while you're not looking
(function () {
  var original = document.title;
  document.addEventListener('visibilitychange', function () {
    document.title = document.hidden ? '410 Gone - come back?' : original;
  });
})();

// Live Kathmandu clock in the hero terminal panel
(function () {
  var el = document.getElementById('local-time');
  if (!el) return;
  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  var timer = null;

  function tick() { el.textContent = fmt.format(new Date()) + ' NPT'; }
  function start() { if (!timer) { tick(); timer = setInterval(tick, 1000); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  start();
  // No point ticking a clock nobody is looking at
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { start(); }
  });
})();

// For anyone reading the source
console.log('%cGET / → 200 OK', 'font-family:monospace;font-size:13px;font-weight:bold;color:#14794E');
console.log('%cLooking under the hood already - I like that. If you\'re hiring or just want to talk technical SEO: karkitrinabh30@gmail.com', 'font-family:monospace;font-size:12px;color:#868C93');
