# Claude Code: Generate favicons for mrmeasles.com

Generate a complete favicon bundle from the existing `/public/og-image.png` and wire it up across `<head>` and `site.webmanifest`. Single PR, ships in one deploy.

## Step 1: Confirm prerequisites

Verify `/public/og-image.png` exists in the repo (1200×630 PNG of Mr. Measles at the podium). If it's not there, stop and ask.

Check whether ImageMagick (`convert`) is installed locally:

```bash
which convert || brew install imagemagick
```

If `brew` isn't available either, fall back to the Node-based path (use `sharp`):

```bash
npm install --save-dev sharp
```

## Step 2: Crop the head from og-image.png

The og-image is a 1200×630 wide shot. The Mr. Measles head is centered around (600, 290) in source coordinates with roughly 280–320px diameter. Crop a tight square focused on the head, then resize to 512×512 PNG with transparent background.

ImageMagick:

```bash
convert public/og-image.png \
  -crop 600x600+300+0 \
  -resize 512x512 \
  -background none -alpha set \
  public/favicon-source.png
```

Sharp / Node alternative — create `scripts/build-favicons.mjs`:

```javascript
import sharp from 'sharp';
await sharp('public/og-image.png')
  .extract({ left: 300, top: 0, width: 600, height: 600 })
  .resize(512, 512)
  .toFile('public/favicon-source.png');
```

Open `public/favicon-source.png` and confirm the head is centered and uncropped. If the head is off-center, adjust the `--crop` offset (in ImageMagick) or the `extract.left` (in sharp) and re-run. Show the result to the owner before continuing.

## Step 3: Generate the full favicon set

From `public/favicon-source.png`, generate:

| File | Size | Purpose |
| --- | --- | --- |
| `public/favicon.ico` | 16×16 + 32×32 + 48×48 (multi-resolution) | Legacy browsers, search results, browser tabs |
| `public/icon.svg` | vector (skip if no SVG source) | Modern browsers — cleanest at any scale |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen, Safari pinned tabs |
| `public/icon-192.png` | 192×192 | Android home screen |
| `public/icon-512.png` | 512×512 | PWA splash screen |

ImageMagick commands:

```bash
convert public/favicon-source.png -resize 180x180 public/apple-touch-icon.png
convert public/favicon-source.png -resize 192x192 public/icon-192.png
convert public/favicon-source.png -resize 512x512 public/icon-512.png

# Multi-resolution favicon.ico
convert public/favicon-source.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  -delete 0 public/favicon.ico
```

Skip `icon.svg` for now — vector requires a separate SVG source, not a raster crop. Leave a TODO if you want a vector version.

## Step 4: Create site.webmanifest

Write `public/site.webmanifest`:

```json
{
  "name": "Mr. Measles for America",
  "short_name": "Mr. Measles",
  "description": "Measles is back — running for America in 2026.",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#000000",
  "background_color": "#0a1c3a",
  "display": "standalone",
  "start_url": "/"
}
```

## Step 5: Wire up the `<head>`

The existing `<head>` already has these `<link>` tags from the SEO bundle but they're pointing at files that didn't exist yet. They should now resolve. Verify the layout/component has all of these — add any that are missing:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```

In Next.js App Router, the metadata API does this:

```typescript
export const metadata = {
  // ...existing metadata
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }],
    apple: { url: '/apple-touch-icon.png' },
  },
  manifest: '/site.webmanifest',
};
```

## Step 6: Local sanity check

Run the dev server (`npm run dev` or equivalent) and:

1. Open `http://localhost:3000/favicon.ico` → should download the .ico
2. Open `http://localhost:3000/apple-touch-icon.png` → should display
3. Open `http://localhost:3000/site.webmanifest` → should return JSON
4. Hard-reload the homepage → favicon visible in the browser tab
5. View Page Source → all three `<link>` tags present

## Step 7: Don't deploy

Show the diff and the favicon-source.png crop to the owner before pushing. The crop position is the most likely thing to need tweaking — easier to fix before deploy than after.

## Cleanup

`public/favicon-source.png` is the unscaled master used to generate all the sizes. You can delete it after generation since it's not referenced anywhere — or keep it for re-runs. Owner's choice.
