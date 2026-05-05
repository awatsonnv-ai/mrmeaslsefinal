# Claude Code: implement SEO foundation for mrmeasles.com

You're being asked to implement a complete SEO foundation for the mrmeasles.com homepage. The site is a satirical pro-vaccine awareness campaign personifying measles as a 2026 presidential candidate. It's a single-page site, likely built in Next.js on Vercel, currently with no meta description, no Open Graph, no robots.txt, and no sitemap — so it's effectively invisible to search engines.

Six files in this folder hold the implementation:

- `head-metadata.html` — meta tags for `<head>`
- `structured-data.html` — JSON-LD blocks (Organization, WebSite, FAQPage)
- `robots.txt` — for public root
- `sitemap.xml` — for public root
- `plank-component.html` — pattern for expandable platform planks
- `plank-defund-the-cdc.md` — the first long-form plank essay

## Step 1: Recon (do this first, don't change anything yet)

- Identify the framework. If `next.config.js` or `next.config.mjs` exists, it's Next.js — figure out App Router vs Pages Router. If Astro, Vite, etc., adapt accordingly.
- Find the homepage component and the existing platform/issues section.
- Report back to the owner with the file paths you'll be touching, before editing.

## Step 2: Drop in robots.txt and sitemap.xml

Place them at the public-static root. In Next.js, that's `/public/robots.txt` and `/public/sitemap.xml`. Don't modify the contents — they're already configured for `https://www.mrmeasles.com/`.

## Step 3: Implement head metadata

Translate `head-metadata.html` into the codebase's conventions:

- **Next.js App Router**: use the `metadata` export in `app/layout.tsx` (and `metadata.icons` for favicons; `metadata.openGraph` for OG; `metadata.twitter` for Twitter; `metadata.alternates.canonical` for canonical).
- **Next.js Pages Router**: use `<Head>` from `next/head` in `_document.tsx` or per-page.
- **Astro**: put them in the `<head>` of the root layout component.

og-image.png will be uploaded to `/public/og-image.png` separately by the owner. Favicons aren't in this folder yet — leave those `<link>` tags in place but add a TODO comment so the owner can drop in the favicon bundle later. Don't break the build by referencing files that don't exist; either comment them out or use placeholder paths the owner can fill.

## Step 4: Add structured data

Inject the three `<script type="application/ld+json">` blocks from `structured-data.html`.

- **Next.js App Router**: render them inline in the layout via `dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}` inside `<script type="application/ld+json">` tags. One component per schema (Organization, WebSite, FAQPage).
- Don't escape the JSON — it must render as a literal `<script>` block.

The `sameAs` array contains placeholder social handles. Leave them as TODOs with a comment.

## Step 5: Build the expandable plank pattern

The homepage already has six platform planks rendered as H3s under "The Measles Agenda":

- The More the Merrier
- Protect the Vaccine Schedule Reforms
- Cement the Loss of Elimination Status
- Defund the CDC
- Defund School Vaccination Requirements
- End Vaccine Mandates

`plank-component.html` shows the pattern: each plank wraps in native `<details>`/`<summary>` so it expands inline. This is fully Google-indexable (collapsed `<details>` content is crawled normally) and accessible by default. Adapt the pattern to match the existing component style — if it's a React/Next codebase, build a `<Plank>` component that takes `title`, `id`, and children.

For "Defund the CDC" use the full essay from `plank-defund-the-cdc.md` as the expanded content. For the other five, leave a placeholder:

> *Full position paper coming soon. In the meantime, [contact your representative](#cyr) and tell them where you stand.*

Each plank needs a stable `id` (e.g., `id="defund-the-cdc"`) so it can be linked to and so JSON-LD anchor links work.

## Step 6: Fix the H1 spacing bug

The current H1 renders as "VoteMr. Measlesfor America" because the styled `<span>` elements collide with no whitespace. Two acceptable fixes:

1. Insert `&nbsp;` (or a real space) between the spans so the rendered text reads "Vote Mr. Measles for America".
2. Add `aria-label="Vote Mr. Measles for America"` on the H1 wrapper. Screen readers and search bots will use the label.

Prefer option 1. Verify the visual layout still looks right.

## Don't deploy

Make the changes on a branch, show the diff, and let the owner review before pushing to production.

## Verification checklist (run after deploy)

When changes are live:

- `https://www.mrmeasles.com/robots.txt` → 200, plain text
- `https://www.mrmeasles.com/sitemap.xml` → 200, valid XML
- `view-source:https://www.mrmeasles.com/` → meta description, OG tags, Twitter card, canonical, three JSON-LD blocks all present
- `https://search.google.com/test/rich-results` against the homepage → should detect the FAQPage
- `https://www.opengraph.xyz/url/https://www.mrmeasles.com/` → OG card preview renders
- Click each platform plank on the homepage → expands to reveal the essay
- View on mobile → no layout regression

If anything fails, fix and re-verify.
