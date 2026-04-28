(function () {
  const DATA_URL = `congress/data/zip/${zip[0]}.json`;
  let lookupPromise = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getLookupData() {
    if (!lookupPromise) {
      lookupPromise = fetch(DATA_URL, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) {
          throw new Error('Updated Congress lookup data is missing. Run npm run build:congress and deploy the generated congress/data files.');
        }
        return response.json();
      });
    }
    return lookupPromise;
  }

  function getTitle(member) {
    if (member.chamber === 'senate') return 'U.S. Senator';
    if (member.district !== null && member.district !== undefined && member.district !== '') {
      return 'U.S. House of Representatives · District ' + member.district;
    }
    return 'U.S. House of Representatives';
  }

  function renderRepCard(member) {
    const title = getTitle(member);
    const payload = encodeURIComponent(JSON.stringify({
      name: member.name,
      title: title,
      party: member.party || '',
      district: member.district || '',
      link: member.contactForm || member.url || ''
    }));

    return '<div class="rep-card">' +
      '<div class="rep-name">' + escapeHtml(member.name) + (member.party ? ' (' + escapeHtml(member.party) + ')' : '') + '</div>' +
      '<div class="rep-title">' + escapeHtml(title) + '</div>' +
      '<div class="rep-actions"><button class="btn-contact" onclick="openModal(\'' + payload + '\')">Send Now</button></div>' +
      '</div>';
  }

  function displayMessage(message, className) {
    const results = document.getElementById('rep-results');
    if (!results) return;
    results.innerHTML = '<p class="' + (className || 'rep-loading') + '">' + message + '</p>';
    results.style.display = 'block';
  }

  window.findReps = async function findReps() {
    const input = document.getElementById('zipInput');
    const results = document.getElementById('rep-results');
    if (!input || !results) return;

    const zip = String(input.value || '').replace(/\D/g, '').slice(0, 5);
    if (!/^\d{5}$/.test(zip)) {
      input.style.borderColor = '#ffaaaa';
      return;
    }
    input.style.borderColor = '';
    displayMessage('Looking up your representatives…', 'rep-loading');

    try {
      const data = await getLookupData();
      const entry = data[zip];
      if (!entry || !Array.isArray(entry.members) || entry.members.length === 0) {
        displayMessage('No match found for that ZIP code. Some ZIP codes require address-level confirmation.', 'rep-error');
        return;
      }

      const warning = entry.ambiguousHouseDistrict
        ? '<p class="rep-ready"><strong>Heads up:</strong> this ZIP code may overlap multiple House districts. Confirm the voter\'s address or district before sending.</p>'
        : '';

      results.innerHTML = warning + entry.members.map(renderRepCard).join('');
      results.style.display = 'block';
      results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      console.error('Representative lookup failed:', error);
      displayMessage(escapeHtml(error.message), 'rep-error');
    }
  };
})();
