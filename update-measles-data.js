#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_URL = 'https://raw.githubusercontent.com/CSSEGISandData/measles_data/main/measles_county_all_updates.csv';
const YEAR = '2026';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift());

  return lines.map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

function stateFromLocationName(locationName) {
  if (!locationName) return null;
  const parts = locationName.split(',').map(part => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function monthName(date) {
  return date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

async function fetchMeaslesData() {
  console.log(`Fetching measles data from ${DATA_URL}`);
  const csvText = await fetchText(DATA_URL);
  const rows = parseCsv(csvText);
  const stateCases = {};
  let latestDataDate = null;

  for (const row of rows) {
    if (!row.date || !row.date.startsWith(`${YEAR}-`)) continue;

    // Johns Hopkins measles data includes multiple outcome types. We only want lab-confirmed cases.
    if (row.outcome_type && row.outcome_type !== 'case_lab-confirmed') continue;

    const state = stateFromLocationName(row.location_name);
    if (!state) continue;

    const value = Number.parseInt(row.value || '0', 10);
    if (!Number.isFinite(value) || value <= 0) continue;

    stateCases[state] = (stateCases[state] || 0) + value;
    if (!latestDataDate || row.date > latestDataDate) latestDataDate = row.date;
  }

  const totalCases = Object.values(stateCases).reduce((sum, value) => sum + value, 0);
  const reportingStates = Object.keys(stateCases).length;

  if (!totalCases || !reportingStates) {
    throw new Error(`No ${YEAR} lab-confirmed measles data was found. Refusing to overwrite site values with zeroes.`);
  }

  console.log(`Found ${totalCases} ${YEAR} lab-confirmed cases across ${reportingStates} states.`);

  return {
    cases: stateCases,
    totalCases,
    reportingStates,
    latestDataDate,
    lastUpdated: new Date().toISOString(),
    source: DATA_URL
  };
}

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not find ${label} in index.html`);
  }
  return content.replace(pattern, replacement);
}

async function updateHtml(measlesData) {
  const htmlPath = path.join(process.cwd(), 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const casesJson = JSON.stringify(measlesData.cases, null, 2);
  html = replaceRequired(
    html,
    /const CASES = \{[\s\S]*?\};/,
    `const CASES = ${casesJson};`,
    'CASES object'
  );

  html = replaceRequired(
    html,
    /<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">Cases in 2026<br>So Far<\/div><\/div>/,
    `<div class="map-stat-num">${measlesData.totalCases.toLocaleString('en-US')}</div><div class="map-stat-label">Cases in 2026<br>So Far</div></div>`,
    'total cases stat'
  );

  html = replaceRequired(
    html,
    /<div class="map-stat-num">[0-9]+<\/div><div class="map-stat-label">Jurisdictions<br>Reporting<\/div><\/div>/,
    `<div class="map-stat-num">${measlesData.reportingStates}</div><div class="map-stat-label">Jurisdictions<br>Reporting</div></div>`,
    'jurisdictions stat'
  );

  const epicenterState = Object.keys(measlesData.cases).reduce((a, b) =>
    measlesData.cases[a] > measlesData.cases[b] ? a : b
  );
  const epicenterCases = measlesData.cases[epicenterState];

  html = replaceRequired(
    html,
    /<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">[^<]+<br>The Epicenter<\/div><\/div>/,
    `<div class="map-stat-num">${epicenterCases.toLocaleString('en-US')}</div><div class="map-stat-label">${epicenterState}<br>The Epicenter</div></div>`,
    'epicenter stat'
  );

  const now = new Date();
  const formattedDate = `${monthName(now)} ${YEAR}`;
  html = html.replace(/Updated [A-Za-z]+ 2026/g, `Updated ${formattedDate}`);

  fs.writeFileSync(htmlPath, html);
  console.log('Updated index.html successfully.');
}

if (require.main === module) {
  fetchMeaslesData()
    .then(updateHtml)
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fetchMeaslesData, updateHtml };
