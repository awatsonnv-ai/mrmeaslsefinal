/* Congressional Vaccine EO Tracker — page logic for vaccine-eo-tracker.html
   Data source: assets/data/eo-tracker-senators.json (single source of truth —
   see that file's "note" field for the states/demo split). */
(function () {
  var DATA_URL = 'assets/data/eo-tracker-senators.json';

  // Only three public stances by design — no "unclear" or "under review"
  // state. Any record that isn't a clean Supports/Opposes is No public
  // stance identified (see assets/data/eo-tracker-senators.json's "note").
  var STANCE_LABELS = {
    supports: { label: 'Supports the EO', icon: '▲' },
    opposes: { label: 'Opposes the EO', icon: '▼' },
    no_stance: { label: 'No public stance identified', icon: '–' }
  };

  // Mr. Measles' in-character reaction to each stance — campaign commentary,
  // kept visually and structurally separate from the factual stance badge
  // above it. Never edit the badge label itself to carry the joke.
  var MEASLES_REACTIONS = {
    supports: 'Finally, someone who understands what’s good for my campaign.',
    opposes: 'Ugh. Another one standing between me and a comeback.',
    no_stance: 'Silence works for me. Every day they sit this one out is another day I get to keep doing my thing.'
  };

  var RFK_VOTE_LABELS = {
    yes: 'Yes',
    no: 'No',
    not_serving: 'Not serving in Senate at time of vote'
  };

  var PARTY_LABELS = { R: 'Republican', D: 'Democrat', I: 'Independent' };

  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    } else if (window.console && console.debug) {
      console.debug('[eo-tracker] event (GA4 not configured):', name, params || {});
    }
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderSenatorCard(senator) {
    var stance = STANCE_LABELS[senator.stance] || STANCE_LABELS.no_stance;
    var reaction = MEASLES_REACTIONS[senator.stance] || '';
    var partyLabel = PARTY_LABELS[senator.party] || senator.party;
    var card = el('div', { class: 'senator-card' });

    var photoHtml = senator.photoUrl
      ? '<img class="senator-photo" src="' + escapeHtml(senator.photoUrl) + '" alt="" />'
      : '<div class="senator-photo-placeholder" aria-hidden="true">' + escapeHtml((senator.name || '?').charAt(0)) + '</div>';

    var sourceHtml = '';
    if (senator.statementSummary || senator.sourceUrl) {
      sourceHtml =
        '<div class="senator-source">' +
          (senator.statementDate ? '<span class="statement-date">' + escapeHtml(senator.statementDate) + '</span>' : '') +
          (senator.sourceUrl ? '<a href="' + escapeHtml(senator.sourceUrl) + '" target="_blank" rel="noopener noreferrer" data-source-link>View statement →</a>' : '') +
        '</div>';
    }

    card.innerHTML =
      '<div class="senator-card-header">' +
        '<div class="senator-card-id">' +
          photoHtml +
          '<div>' +
            '<div class="senator-name">Sen. ' + escapeHtml(senator.name) + '</div>' +
            '<div class="senator-meta">' + escapeHtml(partyLabel) + '</div>' +
          '</div>' +
        '</div>' +
        '<span class="stance-badge stance-badge--' + senator.stance + '"><span class="stance-icon" aria-hidden="true">' + stance.icon + '</span>' + stance.label + '</span>' +
      '</div>' +
      '<div class="rfk-vote-row">RFK confirmation vote: <strong>' + escapeHtml(RFK_VOTE_LABELS[senator.rfkVote] || 'Unknown') + '</strong></div>' +
      (reaction ? '<p class="measles-reaction">' + escapeHtml(reaction) + '</p>' : '') +
      sourceHtml +
      '<a href="#pledge" class="senator-card-pledge-btn" data-open-pledge="senator-card">Sign the Pledge →</a>';

    var sourceLink = card.querySelector('[data-source-link]');
    if (sourceLink) {
      sourceLink.addEventListener('click', function () {
        trackEvent('eo_senator_source_viewed', { senator: senator.name, state: currentStateCode });
      });
    }

    return card;
  }

  function renderPlaceholderCard() {
    var card = el('div', { class: 'senator-card is-placeholder' },
      '<p>Senator data coming soon for this state. Check back as the tracker is populated.</p>');
    return card;
  }

  function renderNoSenateSeatsCard(stateName) {
    var card = el('div', { class: 'senator-card is-placeholder is-no-seats' },
      '<p>' + escapeHtml(stateName) + ' does not have voting representation in the U.S. Senate.</p>');
    return card;
  }

  var TALLY_ORDER = [
    { key: 'opposes', label: 'Opposes' },
    { key: 'supports', label: 'Supports' },
    { key: 'no_stance', label: 'No Stance' }
  ];

  // National totals across all 100 real senators — a fixed summary of the
  // whole dataset, not scoped to whichever state is currently selected.
  // Only three buckets by design (see STANCE_LABELS) — anything that isn't a
  // clean supports/opposes counts as no_stance.
  function renderTally() {
    var row = document.getElementById('eo-tally-row');
    if (!row || !data || !data.states) return;

    var counts = { supports: 0, opposes: 0, no_stance: 0 };
    Object.keys(data.states).forEach(function (code) {
      var senators = data.states[code].senators || [];
      senators.forEach(function (senator) {
        var key = counts[senator.stance] != null ? senator.stance : 'no_stance';
        counts[key] += 1;
      });
    });

    row.innerHTML = TALLY_ORDER.map(function (item) {
      return '<span class="eo-tally-item">' +
        '<i class="legend-dot legend-dot--' + item.key + '" aria-hidden="true"></i>' +
        '<strong class="eo-tally-number">' + (counts[item.key] || 0) + '</strong>' +
        '<span class="eo-tally-label">' + item.label + '</span>' +
      '</span>';
    }).join('');
  }

  var data = null;
  var currentStateCode = null;
  var grid, heading, select, trackerBody, resultsCol;

  function findStateEntry(code) {
    if (!data) return null;
    if (data.states && data.states[code]) return data.states[code];
    if (data.demo && data.demo[code]) return data.demo[code];
    return null;
  }

  function renderResults(code, opts) {
    opts = opts || {};
    var entry = findStateEntry(code);
    if (!entry) return;
    currentStateCode = code;
    var isDemo = !!(data.demo && data.demo[code]);

    heading.textContent = entry.stateName + ' U.S. Senators';
    grid.innerHTML = '';

    if (entry.status === 'no_senate_seats') {
      grid.appendChild(renderNoSenateSeatsCard(entry.stateName));
    } else {
      var senators = entry.senators && entry.senators.length ? entry.senators : [null, null];
      senators.slice(0, 2).forEach(function (senator) {
        grid.appendChild(senator ? renderSenatorCard(senator) : renderPlaceholderCard());
      });

      if (isDemo) {
        Array.prototype.forEach.call(grid.children, function (card) {
          card.appendChild(el('span', { class: 'eo-demo-flag' }, 'Sample data'));
        });
      }
    }

    // Reveal the results column and expand the tracker into its two-column
    // layout. The map never hides — it just stops being centered full-width
    // and shares the row with the results. Re-triggers the fade on every
    // selection (not just the first) as a subtle "results updated" cue.
    trackerBody.classList.add('has-selection');
    resultsCol.hidden = false;
    resultsCol.classList.remove('is-visible');
    void resultsCol.offsetWidth; // force reflow so the re-added class re-triggers the transition
    resultsCol.classList.add('is-visible');

    // Skip on the initial page-load render (default Texas or a direct
    // ?state= link) — jumping the viewport away from the hero before the
    // visitor has seen the page would be more jarring than helpful. Real
    // clicks/dropdown changes still scroll and move focus as before.
    if (opts.scrollToResults !== false) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function updateUrl(code, push) {
    var url = new URL(window.location.href);
    url.searchParams.set('state', code);
    if (push) {
      history.pushState({ state: code }, '', url);
    } else {
      history.replaceState({ state: code }, '', url);
    }
  }

  function onStateChange(code, opts) {
    opts = opts || {};
    if (!findStateEntry(code)) return;
    renderResults(code, { scrollToResults: opts.scrollToResults });
    updateUrl(code, opts.push !== false);
    updateMapSelection(code);
    if (select.value !== code) select.value = code;
    trackEvent('eo_state_selected', { state: code, source: opts.source || 'dropdown' });
  }

  function buildSelectOptions() {
    var realGroup = el('optgroup', { label: 'Select your state' });
    Object.keys(data.states).sort(function (a, b) {
      return data.states[a].stateName.localeCompare(data.states[b].stateName);
    }).forEach(function (code) {
      realGroup.appendChild(el('option', { value: code }, data.states[code].stateName));
    });
    select.appendChild(realGroup);

    if (data.demo && Object.keys(data.demo).length) {
      var demoGroup = el('optgroup', { label: 'Demo — sample data (preview only)' });
      Object.keys(data.demo).forEach(function (code) {
        demoGroup.appendChild(el('option', { value: code }, data.demo[code].stateName));
      });
      select.appendChild(demoGroup);
    }
  }

  var mapSelection = null; // d3 selection of all state paths, kept for updateMapSelection()

  function updateMapSelection(code) {
    if (!mapSelection) return;
    mapSelection.classed('is-selected', function (d) {
      return d.properties && d.properties.__stateCode === code;
    });
  }

  function renderMap() {
    var container = document.getElementById('senate-map');
    if (!container || typeof d3 === 'undefined' || typeof topojson === 'undefined') return;

    var nameToCode = {};
    Object.keys(data.states).forEach(function (code) {
      nameToCode[data.states[code].stateName] = code;
    });

    var width = 960, height = 600;
    var svg = d3.select(container).append('svg')
      .attr('viewBox', '0 0 ' + width + ' ' + height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Clickable map of U.S. states');

    var tip = document.getElementById('senate-map-tip');

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(function (us) {
      var states = topojson.feature(us, us.objects.states);
      var path = d3.geoPath(d3.geoAlbersUsa().fitSize([width, height], states));

      states.features.forEach(function (f) {
        f.properties.__stateCode = nameToCode[f.properties.name] || null;
      });

      mapSelection = svg.selectAll('path.eo-map-state')
        .data(states.features.filter(function (f) { return f.properties.__stateCode; }))
        .join('path')
        .attr('class', 'eo-map-state')
        .attr('d', path)
        .attr('tabindex', '0')
        .attr('role', 'button')
        .attr('aria-label', function (d) { return d.properties.name; })
        .on('click', function (event, d) {
          onStateChange(d.properties.__stateCode, { source: 'map' });
        })
        .on('keydown', function (event, d) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onStateChange(d.properties.__stateCode, { source: 'map' });
          }
        })
        .on('mousemove', function (event, d) {
          if (!tip) return;
          tip.textContent = d.properties.name;
          tip.style.opacity = '1';
          var rect = container.getBoundingClientRect();
          tip.style.left = (event.clientX - rect.left + 12) + 'px';
          tip.style.top = (event.clientY - rect.top - 32) + 'px';
        })
        .on('mouseleave', function () {
          if (tip) tip.style.opacity = '0';
        });

      svg.append('path')
        .datum(topojson.mesh(us, us.objects.states, function (a, b) { return a !== b; }))
        .attr('fill', 'none')
        .attr('stroke', '#fff')
        .attr('stroke-width', '.75')
        .attr('d', path);

      if (currentStateCode) updateMapSelection(currentStateCode);
    }).catch(function () {
      container.innerHTML = '<p class="eo-map-fallback">Map requires an internet connection to load. Use the dropdown above.</p>';
    });
  }

  var DEFAULT_STATE = 'TX';

  function initSelector() {
    select.addEventListener('change', function () {
      onStateChange(select.value, { source: 'dropdown' });
    });

    // Land on a populated view rather than a blank map + unselected dropdown
    // — a direct link's ?state= wins if present, otherwise default to Texas.
    var params = new URLSearchParams(window.location.search);
    var initialState = params.get('state');
    if (initialState && findStateEntry(initialState.toUpperCase())) {
      onStateChange(initialState.toUpperCase(), { source: 'url', push: false, scrollToResults: false });
    } else {
      onStateChange(DEFAULT_STATE, { source: 'default', push: false, scrollToResults: false });
    }
  }

  var pledgeActivated = false;

  // Centralized "open the pledge" action — every Sign the Pledge entry point
  // on the page (senator cards, nav, the module's own button) funnels through
  // here so there is exactly one expand/scroll/activate behavior, not N of them.
  // There is deliberately no matching "close" action — once opened, the
  // pledge module stays open for the rest of the visit.
  function openPledge(opts) {
    opts = opts || {};
    var trigger = document.getElementById('pledge-trigger');
    var panel = document.getElementById('pledge-panel');
    var section = document.getElementById('pledge');
    if (!trigger || !panel || !section) return;

    trigger.setAttribute('aria-expanded', 'true');
    panel.classList.add('is-open');

    if (!pledgeActivated) {
      pledgeActivated = true;
      activateSpeak4Embed();
    }
    trackEvent('eo_pledge_opened', { state: currentStateCode, source: opts.source || 'unknown' });

    section.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function initPledge() {
    var trigger = document.getElementById('pledge-trigger');
    var panel = document.getElementById('pledge-panel');
    if (!trigger || !panel) return;

    // The real Speak4 form now shows immediately instead of waiting behind a
    // click — the idle "click Sign the Pledge" placeholder made visitors do
    // an extra step to see a form that's always the point of this section.
    // pledgeActivated is set here so any later openPledge() call (senator
    // cards, the homepage masthead's cross-page link) just re-scrolls to it
    // instead of re-injecting the Speak4 script.
    trigger.setAttribute('aria-expanded', 'true');
    panel.classList.add('is-open');
    pledgeActivated = true;
    activateSpeak4Embed();

    // Always opens — never toggles back closed. Clicking again while already
    // open is harmless (just re-scrolls to it).
    trigger.addEventListener('click', function () {
      openPledge({ source: 'pledge-module' });
    });

    // Delegate: any [data-open-pledge] element anywhere on the page (every
    // senator card's button, the nav CTA, etc.) triggers the exact same
    // openPledge() action rather than each wiring up its own handler.
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-open-pledge]') : null;
      if (!btn) return;
      e.preventDefault();
      openPledge({ source: btn.getAttribute('data-open-pledge') || 'unknown' });
    });
  }

  function activateSpeak4Embed() {
    var container = document.getElementById('pledge-speak4-embed');
    if (!container) return;

    // Vaccine Protection Pledge campaign — Speak4 ID r601jns7. Same pattern
    // as the site's other two Speak4 embeds (#speak4-embed and
    // #popup-speak4-embed in index.html): a styled script is created and
    // appended into this container, which is where Speak4 renders the form.
    //
    // Contextual state passing (e.g. &state=ME) is NOT wired in — Speak4
    // hasn't confirmed support for it, so this doesn't assume/fabricate that
    // capability. Revisit if/when that's verified against their docs.
    container.innerHTML = '';
    var style = 1;
    var script = document.createElement('script');
    script.src = 'https://speak4.app/lp/r601jns7/' + (style ? 'styled' : 'plain') + '/index.js?ts=' + new Date().getTime();
    container.appendChild(script);

    trackEvent('eo_pledge_action_started', { state: currentStateCode });
  }

  function initShare() {
    var container = document.querySelector('.share-tracker');
    if (!container) return;

    function currentShareUrl() {
      var url = new URL(window.location.href);
      if (currentStateCode) url.searchParams.set('state', currentStateCode);
      return url.toString();
    }

    function shareText() {
      return "I've been tracking where senators stand on the vaccine executive order. Check yours:";
    }

    function fireShare(method) {
      trackEvent('eo_share_clicked', { state: currentStateCode });
      trackEvent('eo_share_method_selected', { method: method, state: currentStateCode });
    }

    var copyBtn = container.querySelector('[data-share="copy"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = currentShareUrl();
        var done = function () {
          copyBtn.setAttribute('data-copied', 'true');
          var original = copyBtn.textContent;
          copyBtn.textContent = 'Link Copied!';
          setTimeout(function () {
            copyBtn.removeAttribute('data-copied');
            copyBtn.textContent = original;
          }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url, done); });
        } else {
          fallbackCopy(url, done);
        }
        fireShare('copy_link');
      });
    }

    function fallbackCopy(text, done) {
      var input = el('input', { value: text, readonly: 'true', style: 'position:fixed;opacity:0;' });
      document.body.appendChild(input);
      input.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* clipboard unavailable */ }
      document.body.removeChild(input);
    }

    var xLink = container.querySelector('[data-share="x"]');
    if (xLink) {
      xLink.addEventListener('click', function () {
        xLink.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(currentShareUrl());
        fireShare('x');
      });
    }

    var fbLink = container.querySelector('[data-share="facebook"]');
    if (fbLink) {
      fbLink.addEventListener('click', function () {
        fbLink.href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentShareUrl());
        fireShare('facebook');
      });
    }

    var emailLink = container.querySelector('[data-share="email"]');
    if (emailLink) {
      emailLink.addEventListener('click', function () {
        emailLink.href = 'mailto:?subject=' + encodeURIComponent('Where does your senator stand on the vaccine EO?') +
          '&body=' + encodeURIComponent(shareText() + ' ' + currentShareUrl());
        fireShare('email');
      });
    }
  }

  function initMethodology() {
    var trigger = document.getElementById('methodology-trigger');
    var body = document.getElementById('methodology-body');
    if (!trigger || !body) return;

    trigger.addEventListener('click', function () {
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!isOpen));
      body.classList.toggle('is-open', !isOpen);
      trackEvent('eo_methodology_toggled', { open: !isOpen });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    grid = document.getElementById('senator-grid');
    heading = document.getElementById('results-heading');
    select = document.getElementById('state-select');
    trackerBody = document.getElementById('tracker-body');
    resultsCol = document.getElementById('tracker-results-col');
    if (!grid || !select) return;

    fetch(DATA_URL)
      .then(function (res) { return res.json(); })
      .then(function (json) {
        data = json;
        buildSelectOptions();
        initSelector();
        initPledge();
        initShare();
        initMethodology();
        renderMap();
        renderTally();

        // Cross-page entry point: any link ending in #pledge (e.g. the
        // homepage masthead's "Sign the Pledge" CTA) auto-expands the
        // module and activates Speak4, not just anchor-scrolls to it.
        if (window.location.hash === '#pledge') {
          openPledge({ source: 'cross-page-link' });
        }

        var lastUpdatedEl = document.getElementById('methodology-last-updated');
        if (lastUpdatedEl && (data.researchCutoff || data.generatedAt)) {
          lastUpdatedEl.textContent = 'Last updated: ' + (data.researchCutoff || data.generatedAt);
        }
      })
      .catch(function (err) {
        grid.innerHTML = '<p class="senator-no-position">Unable to load senator data right now. Please try again shortly.</p>';
        console.error('[eo-tracker] failed to load data', err);
      });

    window.addEventListener('popstate', function () {
      var params = new URLSearchParams(window.location.search);
      var code = params.get('state');
      if (code && findStateEntry(code.toUpperCase())) {
        select.value = code.toUpperCase();
        renderResults(code.toUpperCase());
      }
    });
  });
})();
