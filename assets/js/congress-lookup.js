(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function displayRepMessage(message, className) {
    const el = document.getElementById('rep-results');
    if (!el) return;
    el.innerHTML = `<p class="${className || 'rep-loading'}">${escapeHtml(message)}</p>`;
    el.style.display = 'block';
  }

  function getName(member) {
    if (!member) return '';
    if (typeof member.name === 'string') return member.name;
    if (member.name && member.name.official_full) return member.name.official_full;
    if (member.name && member.name.first && member.name.last) return `${member.name.first} ${member.name.last}`;
    return member.full_name || member.display_name || member.official_full || '';
  }

  function getParty(member) {
    if (!member) return '';
    if (member.party) return member.party;
    if (member.current_party) return member.current_party;
    if (Array.isArray(member.terms) && member.terms.length) {
      return member.terms[member.terms.length - 1].party || '';
    }
    return '';
  }

  function getDistrict(member, fallbackDistrict) {
    if (!member) return fallbackDistrict || '';
    return member.district || member.district_number || member.house_district || fallbackDistrict || '';
  }

  function isSenator(member) {
    const text = [
      member.type,
      member.chamber,
      member.role,
      member.title,
      member.office
    ].filter(Boolean).join(' ').toLowerCase();

    return text.includes('senator') || text.includes('senate');
  }

  function normalizeMembers(raw) {
    if (!raw) return [];

    let members = [];

    if (Array.isArray(raw)) {
      members = raw;
    } else if (Array.isArray(raw.members)) {
      members = raw.members;
    } else if (Array.isArray(raw.reps)) {
      members = raw.reps;
    } else if (Array.isArray(raw.representatives)) {
      members = raw.representatives;
    } else if (Array.isArray(raw.results)) {
      members = raw.results;
    } else {
      if (Array.isArray(raw.house)) members = members.concat(raw.house);
      if (Array.isArray(raw.senate)) members = members.concat(raw.senate);
      if (Array.isArray(raw.senators)) members = members.concat(raw.senators);

      if (Array.isArray(raw.districts)) {
        raw.districts.forEach(function (district) {
          const districtMembers = district.members || district.representatives || [];
          districtMembers.forEach(function (member) {
            members.push(Object.assign({}, member, {
              district: getDistrict(member, district.district || district.district_number)
            }));
          });
        });
      }
    }

    const seen = new Set();

    return members.map(function (member) {
      const name = getName(member);
      const party = getParty(member);
      const senator = isSenator(member);
      const district = senator ? '' : getDistrict(member);
      const title = senator ? 'U.S. Senator' : `U.S. House of Representatives · District ${district}`;
      const link = member.link || member.url || member.website || member.contact_form || member.contact || '';

      return { name, party, district, title, link };
    }).filter(function (member) {
      if (!member.name) return false;
      const key = `${member.name}|${member.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderReps(reps) {
    const container = document.getElementById('rep-results');
    if (!container) return;

    const repsHtml = reps.map(function (rep) {
      const repPayload = encodeURIComponent(JSON.stringify({
        name: rep.name,
        title: rep.title,
        party: rep.party || '',
        district: rep.district || '',
        link: rep.link || ''
      }));

      return `<div class="rep-card">
        <div class="rep-name">${escapeHtml(rep.name)}${rep.party ? ` (${escapeHtml(rep.party)})` : ''}</div>
        <div class="rep-title">${escapeHtml(rep.title)}</div>
        <div class="rep-actions">
          <button class="btn-contact" onclick="openModal('${repPayload}')">Send Now</button>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = repsHtml;
    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  window.findReps = async function findReps() {
    const input = document.getElementById('zipInput');
    const zip = input ? input.value.trim() : '';

    if (zip.length !== 5 || isNaN(zip)) {
      if (input) input.style.borderColor = '#ffaaaa';
      return;
    }

    if (input) input.style.borderColor = '';
    displayRepMessage('Looking up your representatives…', 'rep-loading');

    try {
      const dataUrl = `congress/data/zip/${zip[0]}.json`;
      const response = await fetch(dataUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Could not load ${dataUrl}`);
      }

      const data = await response.json();
      const raw = data[zip];

      if (!raw) {
        throw new Error('No representatives found for that ZIP code.');
      }

      const reps = normalizeMembers(raw);

      if (!reps.length) {
        throw new Error('No representatives found for that ZIP code.');
      }

      renderReps(reps);
    } catch (error) {
      console.error('Representative lookup failed:', error);
      displayRepMessage('Unable to look up representatives right now. Please try again later.', 'rep-error');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('zipInput');
    if (!input) return;

    input.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.findReps();
      }
    });
  });
})();
