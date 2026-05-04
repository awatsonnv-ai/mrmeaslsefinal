# Claude Code: implement SEO foundation for mrmeasles.com

You're being asked to implement a complete SEO foundation for the mrmeasles.com homepage. The site is a satirical pro-vaccine awareness campaign personifying measles as a 2026 presidential candidate. It's a single-page site, likely built in Next.js on Vercel, currently with no meta description, no Open Graph, no robots.txt, and no sitemap — so it's effectively invisible to search engines.

The files in this folder hold the implementation:

- `head-metadata.html` — meta tags for `<head>`
- `structured-data.html` — JSON-LD blocks (Organization, WebSite, FAQPage)
- `robots.txt` — for public root
- `sitemap.xml` — for public root
- `plank-component.html` — modal-overlay pattern for platform planks (uses native `<dialog>`)
- `plank-the-more-the-merrier.md` — Plank 1 essay
- `plank-protect-the-vaccine-schedule-reforms.md` — Plank 2 essay
- `plank-cement-the-loss-of-elimination-status.md` — Plank 3 essay
- `plank-defund-the-cdc.md` — Plank 4 essay
- `plank-defund-school-vaccination-requirements.md` — Plank 5 essay
- `plank-end-vaccine-mandates.md` — Plank 6 essay

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

## Step 5: Build the modal-overlay plank pattern

This site is required to remain a single-page microsite — no separate route per plank. To rank for the keywords inside the six platform essays without adding pages, each plank becomes a clickable button on the homepage that opens a modal overlay containing the full essay. User scrolls inside the modal; the page underneath stays still.

`plank-component.html` shows the full pattern in two flavors (vanilla HTML/CSS/JS and a React/Next.js component using `useRef` + native `<dialog>`). Use whichever matches the existing codebase style.

Each plank gets its own dialog element and a stable id, mapped to its essay file:

| Plank (in homepage order) | Essay file | Dialog id |
| --- | --- | --- |
| The More the Merrier | `plank-the-more-the-merrier.md` | `plank-the-more-the-merrier` |
| Protect the Vaccine Schedule Reforms | `plank-protect-the-vaccine-schedule-reforms.md` | `plank-protect-the-vaccine-schedule-reforms` |
| Cement the Loss of Elimination Status | `plank-cement-the-loss-of-elimination-status.md` | `plank-cement-the-loss-of-elimination-status` |
| Defund the CDC | `plank-defund-the-cdc.md` | `plank-defund-the-cdc` |
| Defund School Vaccination Requirements | `plank-defund-school-vaccination-requirements.md` | `plank-defund-school-vaccination-requirements` |
| End Vaccine Mandates | `plank-end-vaccine-mandates.md` | `plank-end-vaccine-mandates` |

### CRITICAL: do NOT lazy-load the essay content

This is the single biggest implementation trap with the modal pattern. For SEO to work, every essay must be **fully rendered in the initial server-rendered HTML** — Google indexes static HTML and does not click buttons or run "open modal" interactions. If the essay text is fetched or mounted only after click, Googlebot will never see it.

Anti-patterns to AVOID:

- ❌ `dynamic(() => import('./PlankDialog'), { ssr: false })` — strips the dialog content from the server render entirely.
- ❌ `{isOpen && <PlankDialog>{essay}</PlankDialog>}` — children only mount when state flips, missing the initial HTML.
- ❌ Fetching essay text via `fetch()` / React Query / SWR inside the dialog — content arrives client-side, after Googlebot has moved on.
- ❌ Conditionally rendering children inside the `<dialog>` — same problem one level down.

The correct pattern: ALWAYS render the dialog and its essay children in the JSX tree. Control visibility by calling `.showModal()` / `.close()` via a ref on the dialog element. Children must be present in the initial render.

```jsx
// ✅ CORRECT
function PlankCard({ id, title, children }) {
  const ref = useRef(null);
  return (
    <>
      <button onClick={() => ref.current?.showModal()}>{title}</button>
      <dialog ref={ref}>
        <button onClick={() => ref.current?.close()}>×</button>
        {children}  {/* essay always rendered, always in SSR HTML */}
      </dialog>
    </>
  );
}
```

If the codebase uses React Portals (`createPortal`), portals are fine — they render server-side as long as the portal target exists in the SSR output. If unsure, just keep the dialog in the same component tree without portaling.

### Render the markdown essays

Two acceptable approaches:

1. Add a markdown renderer like `react-markdown` and pass the parsed `.md` file as children of the `PlankCard`. Lightest editorial footprint going forward.
2. Convert each `.md` to inline JSX/HTML at build time and bake into the components. Slightly more boilerplate but zero runtime cost and cleaner SSR.

Either works for SEO. Choose whichever matches existing codebase patterns.

### SSR sanity check before deploy

Run a local production build (`next build && next start`) and:
1. Open the homepage in an Incognito window with JavaScript disabled.
2. Search the rendered HTML for a unique phrase from each essay (e.g., `"my fellow viral particles"`, `"Cement the Loss"`, `"the procrastination gap"`).
3. All six essay phrases must appear, even though no modal is visible.

If a phrase is missing, the dialog content is being conditionally rendered — fix it before pushing.

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
- **Critical SSR check**: View Page Source on the homepage and search for `my fellow viral particles`. Phrase must appear in the source HTML even with no modal open. Repeat the search for each essay's distinctive phrase. If any phrase is missing, the modal is lazy-loading and Google will not index the essays.
- Click each platform plank on the homepage → opens modal with essay, scroll works inside the modal, page beneath stays fixed
- Press Escape inside an open modal → closes it
- Click backdrop outside the modal → closes it
- View on mobile → modal goes full-screen, scroll works, no layout regression

If anything fails, fix and re-verify.
