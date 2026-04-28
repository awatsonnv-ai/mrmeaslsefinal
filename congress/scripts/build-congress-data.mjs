#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'congress', 'data');

const LEGISLATORS_URL = process.env.LEGISLATORS_URL || 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const OFFICES_URL = process.env.OFFICES_URL || 'https://unitedstates.github.io/congress-legislators/legislators-district-offices.json';
const CD_ZCTA_URL = process.env.CD_ZCTA_URL || 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_cd11920_zcta520_natl.txt';

const STATE_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText}: ${url}`);
  return res.text();
}

function latestTerm(terms) {
  const now = new Date();
  const active = terms.filter(t => new Date(t.start) <= now && (!t.end || new Date(t.end) > now));
  const list = active.length ? active : terms;
  return list.slice().sort((a, b) => String(b.start).localeCompare(String(a.start)))[0];
}

function districtKey(state, district) {
  return `${state}-${String(district).padStart(2, '0')}`;
}

function normalizeMember(member) {
  const term = latestTerm(member.terms || []);
  const chamber = term.type === 'sen' ? 'senate' : 'house';
  return {
    bioguide: member.id?.bioguide,
    govtrack: member.id?.govtrack || null,
    name: member.name?.official_full || [member.name?.first, member.name?.middle, member.name?.last].filter(Boolean).join(' '),
    firstName: member.name?.first || null,
    lastName: member.name?.last || null,
    chamber,
    state: term.state,
    district: term.type === 'rep' ? Number(term.district ?? 0) : null,
    districtKey: term.type === 'rep' ? districtKey(term.state, Number(term.district ?? 0)) : null,
    party: term.party || null,
    caucus: term.caucus || null,
    stateRank: term.state_rank || null,
    class: term.class || null,
    phone: term.phone || null,
    office: term.office || null,
    address: term.address || null,
    url: term.url || null,
    contactForm: term.contact_form || null,
    termStart: term.start || null,
    termEnd: term.end || null
  };
}

function parseDelimited(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(/\t|,|\|/).map(h => h.trim());
  return lines.map(line => {
    const cols = line.split(/\t|,|\|/);
    const row = {};
    header.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
}

function zctaFromRow(row) {
  return row.GEOID_ZCTA5_20 || row.ZCTA5 || row.ZCTA5CE20 || row.ZCTA5CE || row.ZCTA || row.zip || row.ZIP || null;
}

function congressionalDistrictFromRow(row) {
  const geoid = row.GEOID_CD119 || row.GEOID_CD119_20 || row.GEOID || row.CD119 || row.CD119FP || row.CD || '';
  const cleaned = String(geoid).replace(/\D/g, '');
  if (cleaned.length >= 4) {
    const state = STATE_FIPS[cleaned.slice(0, 2)];
    const district = Number(cleaned.slice(-2));
    if (state && Number.isFinite(district)) return { state, district, districtKey: districtKey(state, district) };
  }

  const state = row.STATE || row.STUSAB || STATE_FIPS[String(row.STATEFP || '').padStart(2, '0')];
  const district = Number(row.CD119FP || row.CD119 || row.CD || row.DISTRICT);
  if (state && Number.isFinite(district)) return { state, district, districtKey: districtKey(state, district) };
  return null;
}

function addUnique(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, []);
  if (!map.get(key).some(v => JSON.stringify(v) === JSON.stringify(value))) map.get(key).push(value);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [legislatorsRaw, officesRaw, relRaw] = await Promise.all([
    fetchText(LEGISLATORS_URL),
    fetchText(OFFICES_URL),
    fetchText(CD_ZCTA_URL)
  ]);

  const legislators = JSON.parse(legislatorsRaw);
  const offices = JSON.parse(officesRaw);
  const members = legislators.map(normalizeMember).filter(m => m.bioguide && m.state);

  const membersByState = new Map();
  const repsByDistrict = new Map();
  for (const m of members) {
    addUnique(membersByState, m.state, m);
    if (m.chamber === 'house' && m.districtKey) repsByDistrict.set(m.districtKey, m);
  }

  const officeZipMap = {};
  for (const item of offices) {
    const bioguide = item.id?.bioguide;
    if (!bioguide) continue;
    officeZipMap[bioguide] = (item.offices || [])
      .map(o => ({ city: o.city || null, state: o.state || null, zip: o.zip || null, phone: o.phone || null, address: [o.address, o.suite].filter(Boolean).join(', ') || null }))
      .filter(o => o.zip || o.phone || o.address);
  }

  const zipToDistricts = new Map();
  for (const row of parseDelimited(relRaw)) {
    const zcta = zctaFromRow(row);
    const cd = congressionalDistrictFromRow(row);
    if (!zcta || !cd || !repsByDistrict.has(cd.districtKey)) continue;
    addUnique(zipToDistricts, zcta.padStart(5, '0'), cd);
  }

  const zipToMembers = {};
  for (const [zip, districts] of zipToDistricts.entries()) {
    const stateSet = [...new Set(districts.map(d => d.state))];
    const senators = stateSet.flatMap(state => (membersByState.get(state) || []).filter(m => m.chamber === 'senate'));
    const representatives = districts.map(d => repsByDistrict.get(d.districtKey)).filter(Boolean);
    zipToMembers[zip] = {
      zip,
      ambiguousHouseDistrict: representatives.length > 1,
      districts,
      senators,
      representatives,
      members: [...senators, ...representatives]
    };
  }

  const sortedMembers = members.sort((a, b) => (a.state + a.chamber + (a.district ?? '') + a.name).localeCompare(b.state + b.chamber + (b.district ?? '') + b.name));
  const zipDistrictObj = Object.fromEntries([...zipToDistricts.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  await fs.writeFile(path.join(OUT_DIR, 'members_current.json'), JSON.stringify(sortedMembers, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'zip_to_districts.json'), JSON.stringify(zipDistrictObj, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'zip_to_members.json'), JSON.stringify(zipToMembers, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'member_office_zipcodes.json'), JSON.stringify(officeZipMap, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'metadata.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sources: { LEGISLATORS_URL, OFFICES_URL, CD_ZCTA_URL },
    note: 'ZIP lookup is based on Census ZCTAs. Some ZIP/ZCTA values map to multiple House districts; use address-level confirmation for final delivery when necessary.'
  }, null, 2));

  console.log(`Wrote ${members.length} current members and ${zipToMembers ? Object.keys(zipToMembers).length : 0} ZIP/ZCTA lookups to ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
