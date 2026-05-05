# Claude Code: Ship the platform-plank modal overlay

This is the last open piece from the SEO bundle. The site has six platform planks under "The Measles Agenda" rendered as static H3s today. Convert each into a clickable trigger that opens a modal overlay containing the full satirical essay.

The six essays already live in `mrmeasles-seo-handoff/` (or wherever you unzipped the bundle). The modal pattern is already documented in `plank-component.html`. This prompt is a condensed restatement so you have everything in one place.

## Step 1: Recon

Find the homepage component and the existing platform/issues section. It's the section that contains:

- The More the Merrier
- Protect the Vaccine Schedule Reforms
- Cement the Loss of Elimination Status
- Defund the CDC
- Defund School Vaccination Requirements
- End Vaccine Mandates

Show the file paths to the owner before editing.

## Step 2: Build a `<PlankCard>` component

Create one reusable component matching the existing codebase style. Vanilla JSX (Next.js App Router):

```jsx
'use client';
import { useRef } from 'react';

export function PlankCard({ id, title, children }) {
  const dialogRef = useRef(null);
  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();
  const onBackdropClick = (e) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <article className="plank">
      <button
        type="button"
        className="plank-trigger"
        onClick={open}
        aria-haspopup="dialog"
        aria-controls={`plank-${id}`}
      >
        <h3 className="plank-title">{title}</h3>
        <span className="plank-cta">Read the full plank →</span>
      </button>

      <dialog
        ref={dialogRef}
        id={`plank-${id}`}
        className="plank-dialog"
        aria-labelledby={`plank-${id}-title`}
        onClick={onBackdropClick}
      >
        <header className="plank-dialog-header">
          <h3 id={`plank-${id}-title`}>{title}</h3>
          <button type="button" onClick={close} aria-label="Close">×</button>
        </header>
        <div className="plank-dialog-body">{children}</div>
      </dialog>
    </article>
  );
}
```

CSS lives in `mrmeasles-seo-handoff/plank-component.html` (section C). Copy it, adapt to whatever CSS approach the codebase already uses (CSS modules, styled-jsx, Tailwind, etc.).

## Step 3: Render the six planks

Replace the existing six `<h3>` elements in the platform section with `<PlankCard>` calls. Map each to its essay file:

| Plank title | Essay file | Dialog id |
| --- | --- | --- |
| The More the Merrier | `plank-the-more-the-merrier.md` | `the-more-the-merrier` |
| Protect the Vaccine Schedule Reforms | `plank-protect-the-vaccine-schedule-reforms.md` | `protect-the-vaccine-schedule-reforms` |
| Cement the Loss of Elimination Status | `plank-cement-the-loss-of-elimination-status.md` | `cement-the-loss-of-elimination-status` |
| Defund the CDC | `plank-defund-the-cdc.md` | `defund-the-cdc` |
| Defund School Vaccination Requirements | `plank-defund-school-vaccination-requirements.md` | `defund-school-vaccination-requirements` |
| End Vaccine Mandates | `plank-end-vaccine-mandates.md` | `end-vaccine-mandates` |

## Step 4: Convert markdown to JSX (one-time)

Each `.md` file becomes the children of a `<PlankCard>`. Two acceptable approaches:

1. **Build-time conversion** (recommended): write a small script that reads each `.md` file and emits a `.jsx` or `.tsx` component. Run once. No runtime markdown dep.
2. **Runtime markdown**: install `react-markdown` and pass the markdown string as children. Simpler maintenance, ~10kb runtime cost.

Either way works for SEO as long as the resulting HTML lives in the initial server-rendered page.

## ⚠️ CRITICAL: do NOT lazy-load the essay content

This is the single biggest implementation trap with the modal pattern. For SEO to work, every essay must be **fully rendered in the initial server-rendered HTML**. Google indexes static HTML and does not click buttons or trigger "open modal" actions. If the essay arrives client-side after click, Googlebot will never see it.

Anti-patterns to AVOID:

- ❌ `dynamic(() => import('./PlankDialog'), { ssr: false })` — strips the dialog content from the SSR pass entirely.
- ❌ `{isOpen && <PlankDialog>{essay}</PlankDialog>}` — children only mount when state flips true. Initial HTML is missing the essay.
- ❌ Fetching essay text via `fetch()` / React Query / SWR inside the dialog — content arrives client-side, after Googlebot has moved on.
- ❌ Conditionally rendering children inside the `<dialog>` — same problem one level down.

Correct pattern (verified above): always render the dialog and its essay children in the JSX tree. Control visibility by calling `.showModal()` / `.close()` via a ref on the dialog. Children must be present in the initial render.

## Step 5: SSR sanity check before deploy

Run a local production build and verify the essays are in the SSR HTML:

```bash
npm run build && npm run start
```

Then in another terminal:

```bash
curl -s http://localhost:3000/ | grep -c "my fellow viral particles"   # expect: 6
curl -s http://localhost:3000/ | grep -c "Cement the Loss"             # expect: 1+
curl -s http://localhost:3000/ | grep -c "the procrastination gap"      # expect: 1
```

All counts must be ≥1 (and "viral particles" should appear 6 times — once in each essay's opening line). If any count is 0, the dialog is being conditionally rendered or lazy-loaded — fix before pushing.

## Step 6: Manual UX check

Run the dev server, then:

- Click each plank trigger → opens modal with full essay
- Press Escape → closes modal
- Click backdrop (outside the modal) → closes modal
- Click "×" → closes modal
- On mobile (DevTools responsive mode at 375px wide) → modal goes full-screen, scroll works inside the modal, page beneath stays still

## Step 7: Don't deploy

Make changes on a branch, show the owner the diff and a screenshot of one open modal before pushing.

## After deploy

The owner has someone (Alex/Claude in chat) ready to re-run the live SSR check and confirm Google can see all six essays. They'll need ~30 seconds.
