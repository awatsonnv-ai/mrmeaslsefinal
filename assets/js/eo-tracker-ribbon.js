/* Congressional Vaccine EO Tracker — announcement ticker
   Injected directly below <nav> on both index.html and vaccine-eo-tracker.html.
   Continuous right-to-left scrolling ticker (pure CSS animation, paused on
   hover/focus and for prefers-reduced-motion via CSS). Dismissal persists for
   the browsing session (matches the welcome popup's sessionStorage
   convention, see mm_popup_dismissed in index.html).

   Masthead-aware: on the homepage, when the temporary EO intro masthead
   (#eo-masthead, see assets/js/eo-masthead.js) is present, the ribbon stays
   hidden while the masthead is in view — the masthead already carries the
   EO message, showing both would be redundant — and reveals itself already
   in its compact/sticky form once the masthead scrolls out of view. Pages
   without a masthead (the tracker page, or the homepage with the masthead
   disabled) keep the original behavior: visible immediately, condensing
   after a scroll threshold. */
(function () {
  var DISMISS_KEY = 'mm_ribbon_dismissed';
  var CONDENSE_THRESHOLD = 80;
  // Deliberately well past CONDENSE_THRESHOLD: gives the shrink transition
  // (~250ms, see .is-condensed's transition in eo-tracker.css) real scroll
  // distance to finish before the ribbon locks into position:sticky, so the
  // height change and the "become sticky" moment never land on the same
  // scroll pixel — that's what caused the scroll-catching visible at slow
  // scroll speeds.
  var STICK_THRESHOLD = 200;

  if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

  var onTrackerPage = /vaccine-eo-tracker\.html$/.test(location.pathname);
  var ctaHref = onTrackerPage ? '#state-select' : 'vaccine-eo-tracker.html';

  var MESSAGES = [
    { badge: 'New', text: 'I’m keeping score — see where your senators stand on the vaccine executive order.' }
  ];

  function itemsHtml() {
    return MESSAGES.map(function (m) {
      return '<span class="eo-ribbon-item"><strong>' + m.badge + ':</strong> ' + m.text + '</span>' +
             '<span class="eo-ribbon-sep">●</span>';
    }).join('');
  }

  var summaryText = MESSAGES.map(function (m) { return m.badge + ': ' + m.text; }).join(' ');

  var ribbon = document.createElement('div');
  ribbon.id = 'eo-ribbon';
  ribbon.setAttribute('role', 'region');
  ribbon.setAttribute('aria-label', 'Campaign announcement');
  ribbon.innerHTML =
    '<div class="eo-ribbon-inner">' +
      '<button type="button" class="eo-ribbon-close" aria-label="Dismiss announcement">&#10005;</button>' +
      '<div class="eo-ribbon-row-ticker">' +
        '<span class="eo-ribbon-icon" aria-hidden="true">📣</span>' +
        '<span class="sr-only">' + summaryText + '</span>' +
        '<div class="eo-ribbon-ticker" aria-hidden="true">' +
          '<div class="eo-ribbon-ticker-track">' + itemsHtml() + itemsHtml() + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="eo-ribbon-row-cta">' +
        '<a class="eo-ribbon-cta" href="' + ctaHref + '">See Where Your Senators Stand →</a>' +
      '</div>' +
    '</div>';

  var nav = document.querySelector('nav');
  if (nav && nav.parentNode) {
    nav.parentNode.insertBefore(ribbon, nav.nextSibling);
  } else {
    document.body.insertBefore(ribbon, document.body.firstChild);
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    } else if (window.console && console.debug) {
      console.debug('[eo-tracker] event (GA4 not configured):', name, params || {});
    }
  }

  ribbon.querySelector('.eo-ribbon-cta').addEventListener('click', function () {
    trackEvent('eo_ribbon_cta_click', { page: onTrackerPage ? 'tracker' : 'home' });
  });

  ribbon.querySelector('.eo-ribbon-close').addEventListener('click', function () {
    sessionStorage.setItem(DISMISS_KEY, '1');
    ribbon.remove();
    document.documentElement.style.removeProperty('--ribbon-h');
    trackEvent('eo_ribbon_dismiss', { page: onTrackerPage ? 'tracker' : 'home' });
  });

  var masthead = document.getElementById('eo-masthead');

  if (masthead) {
    // Homepage takeover moment: skip the expanded intro state entirely —
    // reveal already condensed, and only once the masthead has scrolled
    // out of view. Toggling display (rather than a one-time insert) means
    // scrolling back up to the masthead correctly re-hides it too.
    ribbon.classList.add('is-condensed', 'is-stuck');
    ribbon.style.display = 'none';

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          ribbon.style.display = entry.isIntersecting ? 'none' : '';
        });
      }, { threshold: 0 });
      observer.observe(masthead);
    } else {
      // No IntersectionObserver support: fail open rather than hide the
      // announcement entirely.
      ribbon.style.display = '';
    }
  } else {
    // Original behavior — visible immediately, condenses past a scroll
    // threshold, then locks into position:sticky further down the scroll
    // (see STICK_THRESHOLD above) so the shrink and the sticky-engage never
    // coincide.
    var condensed = false;
    var stuck = false;
    function updateScrollState() {
      var y = window.scrollY;
      var shouldCondense = y > CONDENSE_THRESHOLD;
      if (shouldCondense !== condensed) {
        condensed = shouldCondense;
        ribbon.classList.toggle('is-condensed', condensed);
      }
      var shouldStick = y > STICK_THRESHOLD;
      if (shouldStick !== stuck) {
        stuck = shouldStick;
        ribbon.classList.toggle('is-stuck', stuck);
      }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateScrollState();
        ticking = false;
      });
    }, { passive: true });

    updateScrollState();
  }
})();
