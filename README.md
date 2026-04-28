# Mr. Measles Website - Automated Data Updates

This website automatically updates measles case data every Thursday using GitHub Actions.

## How It Works

1. **GitHub Actions Workflow**: Runs every Thursday at 9:00 AM UTC
2. **Data Fetching**: Currently uses simulated data (needs implementation)
3. **HTML Update**: Automatically updates the embedded JavaScript data and statistics
4. **Auto-commit**: Changes are committed and pushed back to the repository

## Current Status

✅ **Completed:**
- GitHub Actions workflow setup
- HTML update script
- Password protection removed for public launch
- **Real Johns Hopkins data integration** - fetches from CSSEGISandData/measles_data
- County-level data aggregation by state
- Automated weekly updates every Thursday

🔄 **In Progress:**
- Data source monitoring and validation

## Data Sources

The site now uses **real-time data** from:
- **Primary Source**: Johns Hopkins CSSEGISandData measles repository
- **Data URL**: https://github.com/CSSEGISandData/measles_data
- **Data File**: measles_county_all_updates.csv (county-level data aggregated by state)
- **Update Frequency**: Repository updated regularly, our site updates Thursdays

**Data Processing:**
- Fetches county-level measles case data
- Aggregates cases by state
- Updates map, statistics, and timestamps automatically

## Implementation Notes

### Data Fetching Challenge
The Johns Hopkins site uses Cloudflare protection, making direct scraping difficult. Potential solutions:

1. **API Access**: Check if Johns Hopkins provides an API or data export
2. **CDC Data**: Use CDC's surveillance data APIs
3. **Manual Override**: Allow manual data entry when automated fetching fails
4. **Alternative Sources**: Use WHO or other international health organization data

### Current Script Behavior
The `update-measles-data.js` script:
- Fetches real measles case data from Johns Hopkins GitHub repository
- Parses county-level CSV data and aggregates by state
- Updates the `CASES` object in `index.html` with current data
- Updates statistics displays (total cases, reporting states)
- Updates the "Updated" timestamp with current date
- Uses data from CSSEGISandData/measles_data repository

## Manual Testing

To test the update process locally:

```bash
npm install
npm run update-data
```

## Deployment

The site will automatically update every Thursday. If you need to trigger an update manually:

1. Go to the repository's Actions tab
2. Find the "Update Measles Data" workflow
3. Click "Run workflow"

## Future Improvements

- [ ] Implement actual data scraping/API integration
- [ ] Add data validation and error handling
- [ ] Create backup data sources
- [ ] Add email notifications for update failures
- [ ] Implement data quality checks
- [ ] Add historical data tracking

## Congress ZIP Lookup

This repo now includes a ZIP/ZCTA-based Congress lookup for the "Contact Your Representatives" section.

### What was added

- `congress/scripts/build-congress-data.mjs` builds current member and ZIP lookup data.
- `congress/data/` stores generated JSON files after the build runs.
- `assets/js/congress-lookup.js` powers the front-end ZIP lookup.
- The site copy now notes that some ZIP codes span multiple House districts and may require address/district confirmation.
- Member records include party status via the `party` field, plus `caucus` where available.

### Build the Congress lookup data

```bash
npm run build:congress
```

Generated files:

- `congress/data/members_current.json`
- `congress/data/zip_to_districts.json`
- `congress/data/zip_to_members.json`
- `congress/data/member_office_zipcodes.json`
- `congress/data/metadata.json`

### ZIP-code caveat

The lookup uses Census ZIP Code Tabulation Areas (ZCTAs), not full street-address geocoding. Some 5-digit ZIP codes overlap multiple congressional districts. When that happens, the lookup returns all matching House representatives and flags the result as ambiguous.
