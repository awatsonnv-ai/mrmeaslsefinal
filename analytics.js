/* Umami instrumentation for mrmeasles2026.org.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This is a one-page site. The nav is all in-page anchors, so a visit fires
 * exactly one pageview no matter how long someone reads or what they do.
 * Umami scores a bounce as a session with a single PAGEVIEW, and it derives
 * visit duration from the gap between the first and last pageview. Custom
 * events do not feed either metric — Umami's maintainers have confirmed that
 * bounce and time-on-site "are calculated using only pageview events, and do
 * not factor in custom events or signals of engagement". So the ~83% bounce
 * rate and the near-zero durations were arithmetic, not audience behaviour.
 *
 * Two things happen here:
 *
 *   1. SECTION PAGEVIEWS. When a section crosses the middle of the viewport
 *      and stays there, we send a pageview for `/#<section>`. Bounce rate and
 *      visit duration start measuring something real: how far down someone got
 *      and how long it took them.
 *
 *   2. ACTION EVENTS. Named custom events for the things a visitor can
 *      actually do — nav clicks, the TAKE ACTION CTA, outbound links, the ZIP
 *      lookup, the music toggle, and the Speak4 advocacy form. These do not
 *      move bounce rate; they are the detail behind it.
 *
 * READ THIS BEFORE COMPARING TO OLD NUMBERS
 * -----------------------------------------
 * Pageview counts break here. Before this file, "Views" counted page loads
 * (~1.3 per visit). After it, "Views" counts page loads plus section reaches,
 * so expect roughly 3-5x, and expect bounce rate to fall a long way. Nothing
 * about the audience changed on the day this shipped. Anything spanning the
 * deploy date is two different measures in one chart.
 *
 * PRIVACY
 * -------
 * No field value is ever read or sent. The advocacy form collects names,
 * emails, phone numbers and addresses; none of that touches this file. We
 * record that a submission happened and where on the page it happened, never
 * who made it or what they typed. That keeps the cookieless, no-consent-banner
 * position the tracker comment in index.html claims. If you extend this file,
 * keep it that way: no `.value`, no `FormData`, no input contents.
 */
(function () {
  'use strict';

  // Included twice (a shared header plus the page, say) this would double
  // every event and every section pageview. Claim the window once.
  if (window.__mmAnalytics) return;
  window.__mmAnalytics = true;

  /* ------------------------------------------------------------------ *
   * Transport
   * ------------------------------------------------------------------ */

  // The Umami script is `defer`, and this file is too, so `window.umami`
  // normally exists by the time we run. Normally is not always — ad blockers
  // drop it entirely, and a slow CDN can reorder things — so queue and flush
  // rather than assume, and give up quietly instead of retrying forever.
  var pending = [];
  var MAX_PENDING = 40;
  var flushTimer = null;

  function umamiReady() {
    return !!(window.umami && typeof window.umami.track === 'function');
  }

  function send(args) {
    try {
      window.umami.track.apply(null, args);
    } catch (err) {
      /* Analytics must never break the page. */
    }
  }

  function track() {
    var args = Array.prototype.slice.call(arguments);
    if (umamiReady()) {
      send(args);
    } else if (pending.length < MAX_PENDING) {
      pending.push(args);
    }
  }

  flushTimer = setInterval(function () {
    if (!umamiReady()) return;
    clearInterval(flushTimer);
    while (pending.length) send(pending.shift());
  }, 200);

  // If the tracker has not appeared within 15s it is blocked. Stop polling and
  // drop the queue; this is the common case for a visitor running uBlock.
  setTimeout(function () {
    clearInterval(flushTimer);
    pending.length = 0;
  }, 15000);

  /* Named custom event. Does not affect bounce rate. */
  function event(name, data) {
    if (data) track(name, data);
    else track(name);
  }

  /* Virtual pageview. This is what moves bounce rate and visit duration. */
  var viewsSent = 0;
  var MAX_VIEWS = 8; // bound the inflation; ~7 sections plus a conversion
  function pageview(url, title) {
    if (viewsSent >= MAX_VIEWS) return;
    viewsSent += 1;
    track(function (props) {
      var next = {};
      for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k)) next[k] = props[k];
      next.url = url;
      if (title) next.title = title;
      return next;
    });
  }

  /* ------------------------------------------------------------------ *
   * 1. Section pageviews
   * ------------------------------------------------------------------ */

  // `hero` is deliberately absent: the page load already counts as the entry
  // pageview, and firing it again would duplicate the landing row.
  var SECTIONS = {
    about: 'About Mr. Measles',
    eo: 'Executive order',
    tracker: 'Where your rep stands',
    citations: 'Sources',
    map: 'Outbreak map',
    cyr: 'Contact your representative'
  };

  // A section counts as reached once it has held the middle of the viewport
  // for DWELL_MS. The rootMargin carves a thin band across the centre of the
  // screen, which is what makes this work for sections taller than the
  // viewport — an intersection *ratio* threshold can never be met by a section
  // three screens tall, but crossing the centre line always can.
  var DWELL_MS = 1000;
  var BAND = '-45% 0px -45% 0px';

  function basePath() {
    // '/' -> '/#about'   '/florida' -> '/florida#about'
    // Matches the shape Umami already records when someone opens a shared
    // deep link, so the rows merge instead of splitting.
    var p = window.location.pathname || '/';
    return p === '/' ? '/' : p.replace(/\/$/, '');
  }

  function initSections() {
    if (typeof IntersectionObserver !== 'function') return;

    var seen = Object.create(null);
    var timers = Object.create(null);
    var path = basePath();
    var landing = (window.location.pathname || '/') + (window.location.hash || '');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.id;
        if (!id || seen[id]) return;

        if (entry.isIntersecting) {
          if (timers[id]) return;
          timers[id] = setTimeout(function () {
            timers[id] = null;
            if (seen[id]) return;
            seen[id] = true;
            io.unobserve(entry.target);
            var url = path + '#' + id;
            // Don't re-send the section someone deep-linked straight into;
            // the entry pageview already carries that URL.
            if (url !== landing) pageview(url, SECTIONS[id]);
          }, DWELL_MS);
        } else if (timers[id]) {
          clearTimeout(timers[id]);
          timers[id] = null;
        }
      });
    }, { rootMargin: BAND, threshold: 0 });

    Object.keys(SECTIONS).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Action events
   * ------------------------------------------------------------------ */

  var SOCIAL = {
    'facebook.com': 'facebook',
    'www.facebook.com': 'facebook',
    'instagram.com': 'instagram',
    'www.instagram.com': 'instagram',
    'x.com': 'x',
    'twitter.com': 'x'
  };

  function placementOf(node) {
    return node && node.closest && node.closest('#popup-speak4-embed') ? 'popup' : 'inline';
  }

  function initClicks() {
    document.addEventListener('click', function (e) {
      try {
        var a = e.target.closest && e.target.closest('a[href]');
        if (a) return handleLink(a);

        var btn = e.target.closest && e.target.closest('button');
        if (!btn) return;

        var aria = btn.getAttribute('aria-label');
        if (aria === 'Play music' || aria === 'Pause music') {
          // aria-label reflects the state BEFORE React re-renders, so it names
          // the action the visitor just asked for.
          event('music_toggle', { action: aria === 'Pause music' ? 'pause' : 'play' });
          return;
        }

        if (aria === 'Close') {
          event('popup_dismiss', { via: 'close' });
          return;
        }

        var label = (btn.innerText || '').trim().toLowerCase();
        if (label === 'skip for now') event('popup_dismiss', { via: 'skip' });
      } catch (err) {
        /* never break a click */
      }
    }, true);
  }

  function handleLink(a) {
    var href = a.getAttribute('href') || '';

    if (href.indexOf('mailto:') === 0) {
      event('press_email');
      return;
    }

    if (href.charAt(0) === '#') {
      var target = href.slice(1);
      if (target === 'cyr') {
        event('cta_take_action', { from: a.closest('nav') ? 'nav' : 'body' });
      } else {
        event('nav_click', { to: target });
      }
      return;
    }

    // Outbound. `a.host` is resolved by the browser, so protocol-relative and
    // relative hrefs are handled without parsing.
    if (a.host && a.host !== window.location.host) {
      var network = SOCIAL[a.host];
      if (network) event('social_click', { network: network });
      else event('outbound_click', { host: a.host });
    }
  }

  function initZip() {
    document.addEventListener('submit', function (e) {
      try {
        var form = e.target;
        if (!form || !form.querySelector) return;
        if (form.querySelector('#zip-input')) {
          // No ZIP value, by decision. We record that a lookup happened.
          event('zip_lookup');
        }
      } catch (err) { /* noop */ }
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * 3. Speak4 advocacy form
   * ------------------------------------------------------------------ */

  // Speak4 injects a real <form class="speak4-form"> into the page (it is not
  // an iframe), so ordinary delegation reaches it. Two containers exist: the
  // inline one in the "contact your rep" section and the one inside the
  // first-visit popup, which only mounts once that popup opens.
  var EMBEDS = ['speak4-embed', 'popup-speak4-embed'];

  function initAdvocacy() {
    var started = Object.create(null);

    // First interaction with the form. focusin bubbles; focus does not.
    document.addEventListener('focusin', function (e) {
      try {
        var form = e.target.closest && e.target.closest('form.speak4-form');
        if (!form) return;
        var where = placementOf(form);
        if (started[where]) return;
        started[where] = true;
        event('advocacy_start', { placement: where });
      } catch (err) { /* noop */ }
    }, true);

    // Submission attempt. Fires whether or not the request succeeds, so read
    // this as intent, and advocacy_complete as outcome.
    document.addEventListener('submit', function (e) {
      try {
        var form = e.target;
        if (!form || !form.classList || !form.classList.contains('speak4-form')) return;
        event('advocacy_submit', { placement: placementOf(form) });
      } catch (err) { /* noop */ }
    }, true);

    initCompletionWatch();
  }

  // COMPLETION DETECTION IS UNVERIFIED.
  //
  // Confirming it needs one real submission — the form contacts an actual
  // legislator, so it was not something to test speculatively. Speak4 exposes
  // no JS API and no documented postMessage, so this watches the container for
  // the two shapes a success state normally takes: the form is torn down, or a
  // success/thank-you node replaces it.
  //
  // TO VERIFY: submit the form once with your own details, watch the Umami
  // realtime view for `advocacy_complete`, and inspect what Speak4 actually
  // renders. If neither branch fires, read the class name off the rendered
  // confirmation and add it to SUCCESS_HINT below.
  //
  // One caution: the embed renders `speak4-embed__bread` elements, which look
  // like a step indicator. If the flow has more than one step, the form may be
  // swapped for step two rather than for a confirmation — in which case this
  // fires on reaching step two, not on completion. The single test submission
  // will tell you which, and the fix is to gate on the last breadcrumb.
  var SUCCESS_HINT = '[class*="success"],[class*="thank"],[class*="confirm"],[class*="complete"]';

  function initCompletionWatch() {
    if (typeof MutationObserver !== 'function') return;

    // One observer on the document rather than one per container. The popup's
    // container does not exist until the popup opens, and React can unmount
    // and remount it, so binding to the elements directly would miss it.
    var state = Object.create(null);
    EMBEDS.forEach(function (id) { state[id] = { hadForm: false, done: false }; });

    var queued = false;

    function inspect() {
      queued = false;
      EMBEDS.forEach(function (id) {
        var s = state[id];
        if (s.done) return;

        var container = document.getElementById(id);
        if (!container) { s.hadForm = false; return; }

        var form = container.querySelector('form.speak4-form');
        if (form) s.hadForm = true;

        // Nothing has rendered yet — not a completion, just a slow embed.
        if (!s.hadForm) return;

        // Either the form went away after having been there, or a
        // success-shaped node appeared alongside it. Requiring hadForm first
        // is what stops a stray class name firing this before anyone has
        // touched the form. Checked against the live embed: none of its 25
        // rendered class names match SUCCESS_HINT.
        if (form && !container.querySelector(SUCCESS_HINT)) return;

        s.done = true;
        var where = id === 'popup-speak4-embed' ? 'popup' : 'inline';
        event('advocacy_complete', { placement: where });
        // Also a pageview, so the completion shows up in Pages and counts
        // toward bounce rate and visit duration like any other step.
        pageview(basePath() + '#action-complete', 'Advocacy action completed');
      });

      if (EMBEDS.every(function (id) { return state[id].done; })) mo.disconnect();
    }

    // childList only, and coalesced to one check per frame: this page animates
    // constantly (parallax, ticker, the dot field) and an unthrottled subtree
    // observer would run thousands of times a minute for no reason.
    var mo = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(inspect);
    });

    mo.observe(document.body, { childList: true, subtree: true });
    inspect(); // catch a form that mounted before we got here
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  // Idempotent on purpose. One `load` event is all a browser sends, but this
  // also covers the file being included twice (a shared header plus the page)
  // and a second listener firing during teardown — either would double-count
  // every event and every section pageview.
  var booted = false;

  function start() {
    if (booted) return;
    booted = true;
    try { initSections(); } catch (err) {}
    try { initClicks(); } catch (err) {}
    try { initZip(); } catch (err) {}
    try { initAdvocacy(); } catch (err) {}
  }

  // The page is React-rendered by support.js, so the sections and the popup
  // container may not exist at DOMContentLoaded. Wait for the first frame
  // after load, then start; the observers pick up anything that mounts later.
  if (document.readyState === 'complete') {
    setTimeout(start, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(start, 0); });
  }
})();
