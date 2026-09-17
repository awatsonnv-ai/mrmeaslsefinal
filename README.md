# mrmeasles.com

Single-page satire microsite for the Mr. Measles campaign, produced by Informed
Consumer. Deployed by Vercel from `main` — pushing to `main` publishes.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole page. Styles are inline; the `<style>` block in `<helmet>` holds only shared tokens and media queries. |
| `support.js` | Design-canvas runtime. Renders the `<x-dc>` template with React and drives `{{ }}` bindings, `<sc-if>` and `<sc-for>`. Do not edit — generated. |
| `analytics.js` | Section pageviews and action events for Umami. See "Analytics" below — read it before comparing numbers across 2026-09-17. |
| `justify.js` | `<x-justify>`, the force-justified wood-type line. Splits text into one span per letter (or per word with `mode="words"`). |
| `usmap.js` | `<us-measles-map>`, the D3 choropleth. Shades states from `data/measles-stats.json`. |
| `senatemap.js` | `<senate-tracker-map>`, the D3 US map in the ZIP lookup. Display only — the ZIP form drives the highlight, nothing here is clickable. |
| `vendor/` | React, ReactDOM, d3 and topojson, served locally so the page makes no CDN calls. |
| `data/` | `measles-stats.json` (generated), `eo-tracker-senators.json`, `house-members.json` (generated), `zips/` (generated), `states-10m.json`. |
| `images/house/` | House portraits, one per filled seat (generated). |
| `scripts/update-measles-data.mjs` | Refreshes the measles figures. See below. |
| `scripts/build-congress-data.py` | Rebuilds the ZIP lookup and House portraits. See below. |

## Measles data

Figures in the "See the spread" panel and the 2025 lines in "My numbers" come
from the Johns Hopkins Measles Tracking Team's public dataset.

- Source: <https://github.com/CSSEGISandData/measles_data> (`measles_county_all_updates.csv`)
- Licence: CC BY 4.0 — cite as "JHU Measles Tracking Team Data"
- Upstream refreshes **Fridays, end of day**, and **revises past counts backwards**,
  so a published figure can fall as well as rise.
- Counts are **laboratory-confirmed cases only**.

`.github/workflows/update-measles-data.yml` runs the script daily at 11:00
UTC (`cron: '0 11 * * *'`) and commits only if a figure actually moved. Run it by hand from the Actions
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

## ZIP lookup: "Where does your representative stand"

A visitor enters a ZIP; the section shows that state's two senators, every House
district the ZIP touches, and national position totals across both chambers.

### Rebuilding the data

Everything under `data/zips/`, `data/house-members.json` and `images/house/` is
generated. The inputs are not in the repo — they live wherever you saved them:

```bash
python3 scripts/build-congress-data.py \
    --xlsx      ~/Downloads/zip_to_congressional_district_119th_with_eo_stance.xlsx \
    --portraits ~/Downloads/house_member_portraits_119th
```

Needs `openpyxl` and `Pillow`. Pass `--skip-portraits` to rebuild only the JSON.
The script aborts on a structural problem — a missing column, a portrait with no
seat, a filled seat with no portrait — rather than writing partial data, and
prints the published baselines (47,925 rows · 441 districts · House 70 Oppose /
2 Support / 367 No stance) next to what it actually found so a refreshed
workbook shows you exactly what moved.

### Things worth knowing

- **The lookup is sharded.** `data/zips/NN.json` is keyed by the ZIP's first two
  digits, so a search fetches ~15KB rather than the full 1.5MB table. Shards are
  fetched on submit and cached for the session; `house-members.json` loads on
  page load because the national totals need it before any search happens.
- **A ZIP is not a district.** 5,829 ZIPs (14%) cross district lines, up to four
  ways. All possible members are shown, primary district first, with a notice
  pointing at house.gov to confirm by full address. Shares are **land area, not
  population**, so they rank the list but should not be read as "most of this
  ZIP lives here."
- **141 ZIPs reach across a state line.** Senators and the map highlight follow
  the ZIP's own state; each House card is labelled with its district's state,
  which is why those two can disagree on one result (try `02861`).
- **119th Congress boundaries** — who represents a ZIP *today*. Ten states
  redrew for the November 2026 election; those lines are not in this data and no
  free consolidated file of them existed when this was built.
- **Two vacant seats**, FL-20 and TX-23. They render a vacancy card and are
  excluded from the totals.
- **DC and the territories** have a delegate or resident commissioner and no
  senators. `geoAlbersUsa` cannot project Puerto Rico, Guam, the Virgin Islands,
  American Samoa or the Northern Marianas, so those ZIPs leave the map neutral
  and show results normally. That is intended, not a bug.
- **Senate positions are editorial in part.** `data/eo-tracker-senators.json`
  carries a `note` field recording which senators were classified by campaign
  direction rather than a public source, and which of those have no source link.
  Read it before quoting the tally.

## Analytics

Umami, loaded in `<head>` on both pages, plus `analytics.js` on top of it.

### Why analytics.js exists

Umami derives **bounce rate and visit duration from pageview events only** —
custom events feed neither. On a one-page site whose nav is all in-page
anchors, that means one pageview per visit and therefore a bounce rate pinned
near 100% no matter how engaged anyone is. It read 82–83% over the first three
days, with most visits recorded at 0s.

`analytics.js` sends a pageview when a section holds the middle of the viewport
for a second (`/#about`, `/#eo`, `/#tracker`, `/#citations`, `/#map`, `/#cyr`),
so bounce and duration measure how far people actually get. It also sends named
custom events for what a visitor can do. The events are the detail; only the
pageviews move bounce rate.

### The baseline break

**Numbers before and after 2026-09-17 are not comparable.** Views counted page
loads (~1.3 per visit) and now counts page loads plus sections reached, so
expect roughly 3–5x. Bounce rate will fall a long way. Nothing about the
audience changed. Any chart spanning that date is two different measures.

### Events

| Event | Fires when | Data |
|---|---|---|
| `nav_click` | An in-page nav anchor is clicked | `to` — the section id |
| `cta_take_action` | The TAKE ACTION button is clicked | `from` — `nav` or `body` |
| `outbound_click` | A link to another domain is clicked | `host` |
| `social_click` | A Facebook, Instagram or X link is clicked | `network` |
| `press_email` | The press mailto is clicked | — |
| `zip_lookup` | The ZIP form is submitted | — (no ZIP, by decision) |
| `music_toggle` | The music button is clicked | `action` — `play` or `pause` |
| `popup_dismiss` | The first-visit popup is closed | `via` — `close` or `skip` |
| `advocacy_start` | First focus inside a Speak4 form | `placement` — `inline` or `popup` |
| `advocacy_submit` | A Speak4 form is submitted | `placement` |
| `advocacy_complete` | The Speak4 form reports success | `placement` |

### Privacy

No field value is read or sent, ever. The advocacy form collects names, emails,
phone numbers and addresses; none of it reaches analytics. We record that a
submission happened and where on the page, never who or what. That is what
keeps the cookieless, no-consent-banner position the tracker comment in
`index.html` claims. Keep it that way: no `.value`, no `FormData`, no input
contents.

### Known gap

`advocacy_complete` is **unverified**. Confirming it needs one real submission,
and the form contacts an actual legislator, so it was not something to test
speculatively. It watches the embed for the form being torn down or a
success-shaped node appearing. Submit once with your own details, watch Umami's
realtime view, and adjust `SUCCESS_HINT` in `analytics.js` if nothing fires.
The embed renders `speak4-embed__bread` elements that look like a step
indicator — if the flow has more than one step, this may be firing on step two
rather than on completion.

## Local preview

```bash
python3 -m http.server 8000
```

Relative `fetch()` calls mean `file://` will not work — serve it.
