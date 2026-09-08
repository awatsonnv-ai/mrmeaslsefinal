# mrmeasles.com

Single-page satire microsite for the Mr. Measles campaign, produced by Informed
Consumer. Deployed by Vercel from `main` — pushing to `main` publishes.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole page. Styles are inline; the `<style>` block in `<helmet>` holds only shared tokens and media queries. |
| `support.js` | Design-canvas runtime. Renders the `<x-dc>` template with React and drives `{{ }}` bindings, `<sc-if>` and `<sc-for>`. Do not edit — generated. |
| `justify.js` | `<x-justify>`, the force-justified wood-type line. Splits text into one span per letter (or per word with `mode="words"`). |
| `usmap.js` | `<us-measles-map>`, the D3 choropleth. Shades states from `data/measles-stats.json`. |
| `vendor/` | React, ReactDOM, d3 and topojson, served locally so the page makes no CDN calls. |
| `data/` | `measles-stats.json` (generated), `eo-tracker-senators.json`, `states-10m.json`. |
| `scripts/update-measles-data.mjs` | Refreshes the measles figures. See below. |

## Measles data

Figures in the "See the spread" panel and the 2025 lines in "My numbers" come
from the Johns Hopkins Measles Tracking Team's public dataset.

- Source: <https://github.com/CSSEGISandData/measles_data> (`measles_county_all_updates.csv`)
- Licence: CC BY 4.0 — cite as "JHU Measles Tracking Team Data"
- Upstream refreshes **Fridays, end of day**, and **revises past counts backwards**,
  so a published figure can fall as well as rise.
- Counts are **laboratory-confirmed cases only**.

`.github/workflows/update-measles-data.yml` runs the script Saturdays at 11:00
UTC and commits only if a figure actually moved. Run it by hand from the Actions
tab, or locally:

```bash
node scripts/update-measles-data.mjs
```

The script writes `data/measles-stats.json` and refreshes the one-line
`MEASLES_FALLBACK` literal in `index.html`, which the page uses if that fetch
fails. It throws rather than writing zeroes if the feed is missing or its shape
changes, so a bad upstream day fails the job instead of blanking the site.

### What updates automatically

- Cases so far this year, and jurisdictions reporting
- The epicenter card — **both the state name and its count**, following whichever
  jurisdiction leads. "Jurisdictions" counts DC alongside the 50 states.
- Map shading, bucketed to match the on-page legend exactly:
  `#141414` none · `#E17E8D` 1–50 · `#E8232F` 50–100+ · `#F2C338` epicenter
  (the smiley marker relocates to the epicenter's centroid)
- The 2025 case and jurisdiction counts in "My numbers"

### What is deliberately hardcoded

Two percentages are **not** in this dataset and are not touched by the script:

- **"94% outbreak-associated"** — the dataset has no outbreak field. Its
  `outcome_type` column distinguishes imported from local cases, which is a
  different measure.
- **"90% of 2025 cases were in unvaccinated individuals"** — derivable only for
  the ~28% of 2025 cases that carry a reported vaccination status, so it cannot
  be stated as a share of all cases.

Both were kept as-is by decision. If either is ever revisited, the dataset does
support *locally acquired* share and *unvaccinated among cases with a reported
status*, either of which could be automated.

The campaign year is pinned via `CURRENT_YEAR` in the script because the page
copy names the years in text ("cases in 2026 so far"). Rolling into a new year
means editing both.

## Local preview

```bash
python3 -m http.server 8000
```

Relative `fetch()` calls mean `file://` will not work — serve it.
