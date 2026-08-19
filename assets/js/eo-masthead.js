/* Temporary Executive Order campaign masthead — homepage only.
   This is an additive campaign layer, not a rewrite of the homepage: it
   sits in the markup directly above <nav> (see index.html, #eo-masthead).
   Flip EO_MASTHEAD_ENABLED to false and re-deploy to retire it — this
   script removes the section entirely, the existing nav becomes the first
   element on the page again exactly as before this campaign existed, and
   nothing else on the homepage needs to change. */
(function () {
  var EO_MASTHEAD_ENABLED = true;

  var masthead = document.getElementById('eo-masthead');
  if (!masthead) return;

  if (!EO_MASTHEAD_ENABLED) {
    masthead.remove();
    return;
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    } else if (window.console && console.debug) {
      console.debug('[eo-tracker] event (GA4 not configured):', name, params || {});
    }
  }

  Array.prototype.forEach.call(masthead.querySelectorAll('[data-eo-track]'), function (el) {
    el.addEventListener('click', function () {
      trackEvent(el.getAttribute('data-eo-track'), {});
    });
  });
})();
