#!/usr/bin/env node

const https = require('https');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const DATA_URL = 'https://raw.githubusercontent.com/CSSEGISandData/measles_data/main/measles_county_all_updates.csv';
const TRACK_YEAR = '2026';
const COUNTED_OUTCOME = 'case_lab-confirmed';

async function fetchMeaslesData() {
  console.log(`Fetching ${TRACK_YEAR} measles data from Johns Hopkins GitHub repository...`);

  const csvData = await fetchCSV(DATA_URL);

  if (!csvData || csvData.length === 0) {
    throw new Error('No data received from Johns Hopkins repository');
  }

  console.log(`Processing ${csvData.length} county records...`);

  const stateCases = {};
  let latestDate = null;

  csvData.forEach((record) => {
    const date = String(record.date || '').trim();
    const outcomeType = String(record.outcome_type || '').trim();

    // Only count 2026 lab-confirmed case records.
    // The source also contains other years and other outcome types.
    if (!date.startsWith(`${TRACK_YEAR}-`) || outcomeType !== COUNTED_OUTCOME) {
      return;
    }

    const locationName = String(record.location_name || '').trim();
    const locationParts = locationName.split(',').map((part) => part.trim()).filter(Boolean);

    if (locationParts.length < 2) {
      return;
    }

    const stateName = locationParts[locationParts.length - 1];
    const caseCount = Number.parseInt(record.value || '0', 10);

    if (Number.isFinite(caseCount) && caseCount > 0) {
      stateCases[stateName] = (stateCases[stateName] || 0) + caseCount;
    }

    if (!latestDate || date > latestDate) {
      latestDate = date;
    }
  });

  const totalCases = Object.values(stateCases).reduce((sum, count) => sum + count, 0);
  const reportingStates = Object.keys(stateCases).length;

  if (totalCases === 0 || reportingStates === 0) {
    throw new Error(`No ${TRACK_YEAR} ${COUNTED_OUTCOME} records were found in the data source.`);
  }

  console.log(`Found ${totalCases} total ${TRACK_YEAR} cases across ${reportingStates} states/jurisdictions.`);
  console.log('States/jurisdictions with cases:', Object.keys(stateCases).join(', '));

  return {
    cases: stateCases,
    totalCases,
    reportingStates,
    lastUpdated: new Date().toISOString(),
    source: 'https://github.com/CSSEGISandData/measles_data',
    latestDataDate: latestDate
  };
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const results = [];

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        response.resume();
        return;
      }

      response
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    }).on('error', reject);
  });
}

function replaceOrThrow(content, regex, replacement, label) {
  if (!regex.test(content)) {
    throw new Error(`Could not find expected HTML section for: ${label}`);
  }
  return content.replace(regex, replacement);
}

function getMonthYearLabel(dateString) {
  const date = dateString ? new Date(`${dateString}T00:00:00Z`) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function updateHTML(measlesData) {
  console.log('Updating HTML with new data...');

  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const casesJson = JSON.stringify(measlesData.cases, null, 2);
  htmlContent = replaceOrThrow(
    htmlContent,
    /const CASES = \{[\s\S]*?\};/,
    `const CASES = ${casesJson};`,
    'CASES JavaScript object'
  );

  htmlContent = replaceOrThrow(
    htmlContent,
    /<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">Cases in 2026<br>So Far<\/div><\/div>/,
    `<div class="map-stat-num">${measlesData.totalCases.toLocaleString()}</div><div class="map-stat-label">Cases in 2026<br>So Far</div></div>`,
    'total 2026 case count'
  );

  htmlContent = replaceOrThrow(
    htmlContent,
    /<div class="map-stat-num">[0-9]+<\/div><div class="map-stat-label">Jurisdictions<br>Reporting<\/div><\/div>/,
    `<div class="map-stat-num">${measlesData.reportingStates}</div><div class="map-stat-label">Jurisdictions<br>Reporting</div></div>`,
    'jurisdictions reporting count'
  );

  const epicenterState = Object.keys(measlesData.cases).reduce((winner, state) => {
    return measlesData.cases[state] > measlesData.cases[winner] ? state : winner;
  });
  const epicenterCases = measlesData.cases[epicenterState];

  htmlContent = replaceOrThrow(
    htmlContent,
    /<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">[^<]+<br>The Epicenter<\/div><\/div>/,
    `<div class="map-stat-num">${epicenterCases.toLocaleString()}</div><div class="map-stat-label">${epicenterState}<br>The Epicenter</div></div>`,
    'epicenter stat'
  );

  const formattedDate = getMonthYearLabel(measlesData.latestDataDate || measlesData.lastUpdated);
  htmlContent = replaceOrThrow(
    htmlContent,
    /Updated [A-Za-z]+ 2026/,
    `Updated ${formattedDate}`,
    'map source updated date'
  );

  fs.writeFileSync(htmlPath, htmlContent);
  console.log('HTML updated successfully!');
}

if (require.main === module) {
  fetchMeaslesData()
    .then((data) => {
      console.log('Fetched data:', data);
      return updateHTML(data);
    })
    .then(() => {
      console.log('Update complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Update failed:', error);
      process.exit(1);
    });
}

module.exports = { fetchMeaslesData, updateHTML };
