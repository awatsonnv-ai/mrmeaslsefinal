# Current Congress lookup data

This folder adds a build pipeline for the Mr. Measles ZIP-code lawmaker lookup.

It generates current U.S. House and Senate member records with party status, district/state identifiers, office/contact fields, and ZIP/ZCTA-to-member lookup tables.

## Generate data

```bash
node congress/scripts/build-congress-data.mjs
```

The script writes:

- `congress/data/members_current.json`
- `congress/data/zip_to_districts.json`
- `congress/data/zip_to_members.json`
- `congress/data/member_office_zipcodes.json`
- `congress/data/metadata.json`

## Sources

- Current member roster: `unitedstates/congress-legislators` generated JSON.
- District office ZIPs: `unitedstates/congress-legislators` district offices JSON.
- ZIP/ZCTA-to-district relationships: U.S. Census Bureau 119th Congressional District to 2020 ZCTA relationship file.

## ZIP/ZCTA caveat

This is a ZIP/ZCTA lookup, not an address-level geocoder. Some 5-digit ZIP codes cross congressional district lines. For those ZIPs, the generated lookup intentionally returns every matching House district plus both statewide senators, and sets `ambiguousHouseDistrict: true`.
