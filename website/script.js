/* ==========================================================================
   Synthica — shared behavior
   - Hover-activated nav dropdowns (150ms close delay) on desktop
   - Click-to-toggle dropdowns + hamburger on mobile
   - FAQ accordion
   ========================================================================== */

(function () {
  'use strict';

  var CLOSE_DELAY = 150;
  // Keep this breakpoint in sync with the navbar collapse in styles.css (900px).
  var mobileQuery = window.matchMedia('(max-width: 900px)');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initScrolledNav();
    initFaq();
    initReveal();
    initCountUp();
    initSpotlight();
    initNewsletter();
    initThemeToggle();
  });

  /* Newsletter signup: front-end only. On submit we hide the form and show an
     inline success message. No data is sent anywhere yet.
     TODO: connect to Mailchimp/Buttondown — POST the email to your provider's
     endpoint here (e.g. fetch(MAILCHIMP_URL, {...})) before showing success. */
  function initNewsletter() {
    var form = document.querySelector('.newsletter-form');
    if (!form) return;
    var success = document.querySelector('.newsletter-success');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      // TODO: send `form.elements.email.value` to Mailchimp/Buttondown here.
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.classList.add('revealed');
      }
    });
  }

  /* Dark mode: toggle data-theme="dark" on <html>, persist in localStorage.
     The saved theme is also applied pre-paint by an inline script in <head>. */
  function initThemeToggle() {
    var THEME_KEY = 'synthica.theme';
    var root = document.documentElement;
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.theme-toggle'));
    if (!buttons.length) return;

    function isDark() { return root.getAttribute('data-theme') === 'dark'; }

    function syncButtons() {
      var dark = isDark();
      buttons.forEach(function (btn) {
        btn.setAttribute('aria-pressed', String(dark));
        btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      });
    }

    function setTheme(dark) {
      if (dark) root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
      syncButtons();
    }

    syncButtons();
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { setTheme(!isDark()); });
    });
  }

  /* Add .scrolled to the navbar once the page moves past the hero edge, so the
     glass pill stays readable over light content. Uses rAF to stay cheap. */
  function initScrolledNav() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;
    var ticking = false;
    function update() {
      navbar.classList.toggle('scrolled', window.scrollY > 24);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }

  /* Scroll-triggered reveal: elements with [data-reveal] fade/slide in once
     they enter the viewport (21st.dev-style scroll interaction). */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = (entry.target.dataset.reveal || '0') + 'ms';
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* Count-up: [data-count] numbers animate from 0 to their value on first view.
     Honors a [data-suffix] (e.g. "+", "%") and a leading "$". */
  function initCountUp() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!nums.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      nums.forEach(function (el) { el.textContent = formatCount(el); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  function formatCount(el) {
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';
    return prefix + Number(el.dataset.count).toLocaleString() + suffix;
  }

  function animateCount(el) {
    var target = Number(el.dataset.count);
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';
    var duration = 1400;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* Spotlight cards: a radial glow follows the pointer across [data-spotlight]
     elements (Aceternity/21st.dev-style hover effect). */
  function initSpotlight() {
    if (reduceMotion) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-spotlight]'));
    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      });
    });
  }

  function initNav() {
    var navbar = document.querySelector('.navbar');
    var toggle = document.querySelector('.nav-toggle');
    var items = Array.prototype.slice.call(document.querySelectorAll('.nav-item'));

    // Mobile hamburger toggle
    if (toggle && navbar) {
      toggle.addEventListener('click', function () {
        var open = navbar.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    items.forEach(function (item) {
      var dropdown = item.querySelector('.dropdown');
      if (!dropdown) return;

      var trigger = item.querySelector('.nav-link');
      var closeTimer = null;

      function open() {
        clearTimeout(closeTimer);
        item.classList.add('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      }

      function scheduleClose() {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
          item.classList.remove('open');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }, CLOSE_DELAY);
      }

      // Desktop: hover with delayed close
      item.addEventListener('mouseenter', function () {
        if (!mobileQuery.matches) open();
      });
      item.addEventListener('mouseleave', function () {
        if (!mobileQuery.matches) scheduleClose();
      });

      // Mobile (and keyboard): click/tap toggles
      if (trigger) {
        trigger.addEventListener('click', function (e) {
          if (mobileQuery.matches) {
            e.preventDefault();
            var isOpen = item.classList.toggle('open');
            trigger.setAttribute('aria-expanded', String(isOpen));
          }
        });
      }
    });

    // Close any open desktop dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (mobileQuery.matches) return;
      items.forEach(function (item) {
        if (!item.contains(e.target)) {
          item.classList.remove('open');
        }
      });
    });

    // On mobile, tapping a real destination link closes the whole menu.
    if (navbar) {
      navbar.addEventListener('click', function (e) {
        var link = e.target.closest('a');
        if (!link || !mobileQuery.matches) return;
        // Dropdown triggers are <button>, so any <a> here is a navigation.
        navbar.classList.remove('nav-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
        items.forEach(function (item) { item.classList.remove('open'); });
      });
    }

    // Reset stuck open/expanded states when crossing the desktop/mobile line.
    var onChange = function () {
      if (navbar) navbar.classList.remove('nav-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      items.forEach(function (item) {
        item.classList.remove('open');
        var t = item.querySelector('.nav-link');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    };
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onChange);
    else if (mobileQuery.addListener) mobileQuery.addListener(onChange);
  }

  function initFaq() {
    var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
    faqItems.forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;
      question.addEventListener('click', function () {
        var isOpen = item.classList.toggle('open');
        question.setAttribute('aria-expanded', String(isOpen));
      });
    });
  }
})();
