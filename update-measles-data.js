#!/usr/bin/env node

const https = require('https');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_URL = 'https://raw.githubusercontent.com/CSSEGISandData/measles_data/main/measles_county_all_updates.csv';
const DATA_URL = process.env.MEASLES_DATA_URL || DEFAULT_DATA_URL;
const TARGET_YEAR = process.env.MEASLES_TARGET_YEAR || '2026';

async function fetchMeaslesData() {
  console.log(`Fetching measles data from ${DATA_URL}`);
  console.log(`Filtering to ${TARGET_YEAR} data only...`);

  try {
    const csvData = await fetchCSV(DATA_URL);

    if (!csvData || csvData.length === 0) {
      throw new Error('No data received from measles data source');
    }

    console.log(`Processing ${csvData.length} county records...`);

    const stateCases = {};
    let latestDate = null;
    let includedRows = 0;

    csvData.forEach(record => {
      const date = (record.date || '').trim();
      if (!date.startsWith(`${TARGET_YEAR}-`)) return;

      const locationName = (record.location_name || '').trim();
      const locationType = (record.location_type || '').trim().toLowerCase();
      const outcomeType = (record.outcome_type || '').trim().toLowerCase();
      const value = Number.parseInt(record.value || '0', 10);

      if (!Number.isFinite(value) || value <= 0) return;
      if (outcomeType && !outcomeType.includes('case_lab-confirmed')) return;
      if (locationType && !['county', 'region'].includes(locationType)) return;

      const locationParts = locationName.split(',').map(part => part.trim()).filter(Boolean);
      if (locationParts.length < 2) return;

      const stateName = locationParts[locationParts.length - 1];
      stateCases[stateName] = (stateCases[stateName] || 0) + value;
      includedRows += 1;

      if (!latestDate || date > latestDate) latestDate = date;
    });

    const totalCases = Object.values(stateCases).reduce((sum, count) => sum + count, 0);
    const reportingStates = Object.keys(stateCases).length;

    if (includedRows === 0 || totalCases === 0) {
      throw new Error(`No ${TARGET_YEAR} measles records were found in the data source`);
    }

    console.log(`Included ${includedRows} ${TARGET_YEAR} rows`);
    console.log(`Found ${totalCases} total cases across ${reportingStates} states`);
    console.log('States with cases:', Object.keys(stateCases).join(', '));

    return { cases: stateCases, totalCases, reportingStates, lastUpdated: new Date().toISOString(), source: DATA_URL, latestDataDate: latestDate, targetYear: TARGET_YEAR };
  } catch (error) {
    console.error('Error fetching measles data:', error);
    throw new Error('Failed to fetch measles data');
  }
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const results = [];
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      response.pipe(csv()).on('data', data => results.push(data)).on('end', () => resolve(results)).on('error', reject);
    }).on('error', reject);
  });
}

async function updateHTML(measlesData) {
  console.log('Updating HTML with new data...');
  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  const casesJson = JSON.stringify(measlesData.cases, null, 2);
  const casesRegex = /const CASES = \{[\s\S]*?\};/;
  if (!casesRegex.test(htmlContent)) throw new Error('Could not find const CASES object in index.html');
  htmlContent = htmlContent.replace(casesRegex, `const CASES = ${casesJson};`);

  htmlContent = htmlContent.replace(/<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">Cases in 2026<br>So Far<\/div><\/div>/, `<div class="map-stat-num">${measlesData.totalCases.toLocaleString()}</div><div class="map-stat-label">Cases in 2026<br>So Far</div></div>`);
  htmlContent = htmlContent.replace(/<div class="map-stat-num">[0-9]+<\/div><div class="map-stat-label">Jurisdictions<br>Reporting<\/div><\/div>/, `<div class="map-stat-num">${measlesData.reportingStates}</div><div class="map-stat-label">Jurisdictions<br>Reporting</div></div>`);

  const epicenterState = Object.keys(measlesData.cases).reduce((a, b) => measlesData.cases[a] > measlesData.cases[b] ? a : b);
  const epicenterCases = measlesData.cases[epicenterState];
  htmlContent = htmlContent.replace(/<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">[^<]*<br>The Epicenter<\/div><\/div>/, `<div class="map-stat-num">${epicenterCases.toLocaleString()}</div><div class="map-stat-label">${epicenterState}<br>The Epicenter</div></div>`);

  const currentDate = new Date();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const formattedDate = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  htmlContent = htmlContent.replace(/Updated [A-Za-z]+ 2026/g, `Updated ${formattedDate}`);

  fs.writeFileSync(htmlPath, htmlContent);
  console.log('HTML updated successfully!');
}

if (require.main === module) {
  fetchMeaslesData().then(data => { console.log('Fetched data:', data); return updateHTML(data); }).then(() => { console.log('Update complete!'); process.exit(0); }).catch(error => { console.error('Update failed:', error); process.exit(1); });
}

module.exports = { fetchMeaslesData, updateHTML };
