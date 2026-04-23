#!/usr/bin/env node

const https = require('https');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// For now, we'll use a simplified approach
// TODO: Implement actual scraping from Johns Hopkins source
// This function can be updated to fetch from different sources
async function fetchMeaslesData() {
  console.log('Fetching measles data from Johns Hopkins GitHub repository...');

  try {
    // Fetch the county-level data from Johns Hopkins GitHub repo
    const csvData = await fetchCSV('https://raw.githubusercontent.com/CSSEGISandData/measles_data/main/measles_county_all_updates.csv');

    if (!csvData || csvData.length === 0) {
      throw new Error('No data received from Johns Hopkins repository');
    }

    console.log(`Processing ${csvData.length} county records...`);

    // Aggregate cases by state - only count 2026 data
    const stateCases = {};
    let latestDate = null;

    csvData.forEach(record => {
      // Only process 2026 data
      if (!record.date || !record.date.startsWith('2026')) {
        return;
      }

      // Extract state from location_name (format: "County, State")
      const locationParts = record.location_name.split(', ');
      if (locationParts.length >= 2) {
        const stateName = locationParts[1];
        const caseCount = parseInt(record.value || 0);

        if (caseCount > 0) {
          stateCases[stateName] = (stateCases[stateName] || 0) + caseCount;
        }

        // Track the latest date
        if (!latestDate || record.date > latestDate) {
          latestDate = record.date;
        }
      }
    });

    // Calculate totals
    const totalCases = Object.values(stateCases).reduce((sum, count) => sum + count, 0);
    const reportingStates = Object.keys(stateCases).length;

    console.log(`Found ${totalCases} total cases across ${reportingStates} states`);
    console.log('States with cases:', Object.keys(stateCases).join(', '));

    return {
      cases: stateCases,
      totalCases,
      reportingStates,
      lastUpdated: new Date().toISOString(),
      source: 'https://github.com/CSSEGISandData/measles_data',
      latestDataDate: latestDate
    };

  } catch (error) {
    console.error('Error fetching data from Johns Hopkins:', error);
    throw new Error('Failed to fetch measles data from Johns Hopkins GitHub repository');
  }
}

// Helper function to fetch and parse CSV data
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    const results = [];

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
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

async function updateHTML(measlesData) {
  console.log('Updating HTML with new data...');

  const htmlPath = path.join(__dirname, 'index.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Update the CASES object in the JavaScript
  const casesJson = JSON.stringify(measlesData.cases, null, 2);
  const casesRegex = /const CASES = \{[^}]*\};/;
  const newCasesDeclaration = `const CASES = ${casesJson};`;

  htmlContent = htmlContent.replace(casesRegex, newCasesDeclaration);

  // Update the map stats
  const totalCases = measlesData.totalCases;
  const reportingStates = measlesData.reportingStates;

  // Update total cases - match any number in the cases stat
  htmlContent = htmlContent.replace(
    /<div class="map-stat-num">[0-9,]+<\/div><div class="map-stat-label">Cases in 2026<br>So Far<\/div><\/div>/,
    `<div class="map-stat-num">${totalCases.toLocaleString()}</div><div class="map-stat-label">Cases in 2026<br>So Far</div></div>`
  );

  // Update jurisdictions reporting - match any number in the jurisdictions stat
  htmlContent = htmlContent.replace(
    /<div class="map-stat-num">[0-9]+<\/div><div class="map-stat-label">Jurisdictions<br>Reporting<\/div><\/div>/,
    `<div class="map-stat-num">${reportingStates}</div><div class="map-stat-label">Jurisdictions<br>Reporting</div></div>`
  );

  // Update South Carolina epicenter - find the state with highest cases
  const epicenterState = Object.keys(measlesData.cases).reduce((a, b) =>
    measlesData.cases[a] > measlesData.cases[b] ? a : b
  );
  const epicenterCases = measlesData.cases[epicenterState];

  htmlContent = htmlContent.replace(
    /<div class="map-stat-num">[0-9]+<\/div><div class="map-stat-label">[^<]*<br>The Epicenter<\/div><\/div>/,
    `<div class="map-stat-num">${epicenterCases}</div><div class="map-stat-label">${epicenterState}<br>The Epicenter</div></div>`
  );

  // Update the source timestamp
  const currentDate = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const formattedDate = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  htmlContent = htmlContent.replace(
    /Updated April 2026/,
    `Updated ${formattedDate}`
  );

  fs.writeFileSync(htmlPath, htmlContent);
  console.log('HTML updated successfully!');
}

// Main execution
if (require.main === module) {
  fetchMeaslesData()
    .then(data => {
      console.log('Fetched data:', data);
      return updateHTML(data);
    })
    .then(() => {
      console.log('Update complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Update failed:', error);
      process.exit(1);
    });
}

module.exports = { fetchMeaslesData, updateHTML };