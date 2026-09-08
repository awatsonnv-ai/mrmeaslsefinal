#!/usr/bin/env node
//
// Refreshes the site's measles figures from the Johns Hopkins Measles Tracking
// Team's public dataset.
//
//   Source: https://github.com/CSSEGISandData/measles_data  (CC BY 4.0)
//   Cite as: "JHU Measles Tracking Team Data"
//   Upstream updates Fridays, end of day, and revises past counts backwards.
//
// Writes data/measles-stats.json, which index.html and usmap.js both read at
// runtime, and refreshes the one-line fallback literal in index.html so the
// page still shows correct numbers if that fetch ever fails.
//
// Deliberately does NOT touch:
//   - "94% OUTBREAK-ASSOCIATED" — no outbreak field exists in this dataset;
//     outcome_type only distinguishes imported from local.
//   - "90% ... UNVACCINATED" — only ~28% of 2025 cases carry a reported
//     vaccination status, so a share of all cases isn't derivable.
// Both are intentionally hardcoded in index.html. See the README section.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DATA_URL =
  'https://raw.githubusercontent.com/CSSEGISandData/measles_data/main/measles_county_all_updates.csv';

// The page copy names these years explicitly ("CASES IN 2026 SO FAR",
// "...IN 2025"), so they are pinned rather than derived. Rolling the campaign
// into a new year is a deliberate edit here plus the copy in index.html.
const CURRENT_YEAR = 2026;
const PREVIOUS_YEAR = 2025;

// Only lab-confirmed cases, matching the dataset's own headline definition.
const OUTCOME = 'case_lab-confirmed';

const JURISDICTIONS = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

/** Split one CSV line, honouring quoted fields such as "Adams, Colorado". */
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && quoted && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift());
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

/** "Adams, Colorado" -> "Colorado". Region and unknown-county rows resolve too. */
function jurisdictionOf(locationName) {
  const parts = String(locationName || '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function tally(rows, year) {
  const byJurisdiction = new Map();
  let latestDate = null;
  let skippedUnknown = new Set();

  for (const row of rows) {
    if (!row.date || !row.date.startsWith(`${year}-`)) continue;
    if (row.outcome_type && row.outcome_type !== OUTCOME) continue;

    const where = jurisdictionOf(row.location_name);
    if (!where) continue;
    if (!JURISDICTIONS.includes(where)) {
      skippedUnknown.add(where);
      continue;
    }

    const value = Number.parseInt(row.value || '0', 10);
    if (!Number.isFinite(value) || value <= 0) continue;

    byJurisdiction.set(where, (byJurisdiction.get(where) || 0) + value);
    if (!latestDate || row.date > latestDate) latestDate = row.date;
  }

  const totalCases = [...byJurisdiction.values()].reduce((a, b) => a + b, 0);
  let epicenterState = null;
  let epicenterCases = 0;
  for (const [where, n] of byJurisdiction) {
    if (n > epicenterCases) {
      epicenterState = where;
      epicenterCases = n;
    }
  }

  return {
    totalCases,
    reportingCount: byJurisdiction.size,
    epicenterState,
    epicenterCases,
    byJurisdiction,
    latestDate,
    skippedUnknown: [...skippedUnknown],
  };
}

const main = async () => {
  console.log(`Fetching ${DATA_URL}`);
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const rows = parseCsv(await res.text());
  console.log(`Parsed ${rows.length} rows.`);

  const cur = tally(rows, CURRENT_YEAR);
  const prev = tally(rows, PREVIOUS_YEAR);

  // Never let an upstream outage or schema change blank the site's numbers.
  if (!cur.totalCases || !cur.reportingCount || !cur.epicenterState) {
    throw new Error(
      `No ${CURRENT_YEAR} ${OUTCOME} data found. Refusing to overwrite the site with zeroes.`
    );
  }
  if (!prev.totalCases) {
    throw new Error(`No ${PREVIOUS_YEAR} data found. Refusing to write a partial update.`);
  }
  for (const where of [...cur.skippedUnknown, ...prev.skippedUnknown]) {
    console.warn(`  warning: unrecognised jurisdiction "${where}" ignored`);
  }

  // Every jurisdiction present, zeroes included, so the map can colour directly.
  const byState = {};
  for (const name of JURISDICTIONS) byState[name] = cur.byJurisdiction.get(name) || 0;

  const stats = {
    generatedAt: new Date().toISOString(),
    source: DATA_URL,
    attribution: 'JHU Measles Tracking Team Data',
    license: 'CC BY 4.0',
    latestDataDate: cur.latestDate,
    note:
      'Lab-confirmed cases only. Upstream revises counts backwards, so figures can fall as ' +
      'well as rise. "Outbreak-associated" and "unvaccinated" percentages on the site are ' +
      'NOT from this dataset and are not updated here.',
    currentYear: CURRENT_YEAR,
    totalCases: cur.totalCases,
    reportingJurisdictions: cur.reportingCount,
    epicenterState: cur.epicenterState,
    epicenterCases: cur.epicenterCases,
    previousYear: PREVIOUS_YEAR,
    previousTotalCases: prev.totalCases,
    previousReportingJurisdictions: prev.reportingCount,
    byState,
  };

  // generatedAt moves on every run, which would make the weekly job commit even
  // when no figure changed. Compare everything else and keep the old timestamp
  // when the payload is identical, so "no change" really means no diff.
  const statsPath = join(ROOT, 'data/measles-stats.json');
  const withoutTimestamp = (o) => {
    const { generatedAt, ...rest } = o;
    return JSON.stringify(rest);
  };
  let unchanged = false;
  try {
    const prior = JSON.parse(readFileSync(statsPath, 'utf8'));
    if (withoutTimestamp(prior) === withoutTimestamp(stats)) {
      stats.generatedAt = prior.generatedAt;
      unchanged = true;
    }
  } catch {
    // no prior file, or unreadable — treat as changed
  }

  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(statsPath, JSON.stringify(stats, null, 2) + '\n');
  console.log(unchanged
    ? 'data/measles-stats.json unchanged (figures identical to last run)'
    : 'Wrote data/measles-stats.json');

  // Refresh the single fallback literal in index.html. One exact anchor, asserted —
  // not a regex over design markup, which is how the previous updater broke the page.
  const htmlPath = join(ROOT, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  const fallback = {
    casesTotal: cur.totalCases.toLocaleString('en-US'),
    jurisdictions: String(cur.reportingCount),
    epicenterCases: cur.epicenterCases.toLocaleString('en-US'),
    epicenterState: cur.epicenterState.toUpperCase(),
    prevCasesTotal: prev.totalCases.toLocaleString('en-US'),
    prevJurisdictions: String(prev.reportingCount),
  };
  const marker = /^(\s*)const MEASLES_FALLBACK = \{.*\};(\s*\/\/.*)?$/m;
  if (!marker.test(html)) {
    throw new Error('Could not find the MEASLES_FALLBACK line in index.html');
  }
  html = html.replace(
    marker,
    (_m, indent) =>
      `${indent}const MEASLES_FALLBACK = ${JSON.stringify(fallback)}; // updated by scripts/update-measles-data.mjs`
  );
  writeFileSync(htmlPath, html);
  console.log('Refreshed the MEASLES_FALLBACK line in index.html');

  console.log('');
  console.log(`  ${CURRENT_YEAR}: ${fallback.casesTotal} cases across ${fallback.jurisdictions} jurisdictions`);
  console.log(`  epicenter: ${cur.epicenterState} (${fallback.epicenterCases})`);
  console.log(`  ${PREVIOUS_YEAR}: ${fallback.prevCasesTotal} cases across ${fallback.prevJurisdictions} jurisdictions`);
  console.log(`  data through: ${cur.latestDate}`);
};

main().catch((err) => {
  console.error(`update-measles-data failed: ${err.message}`);
  process.exit(1);
});
