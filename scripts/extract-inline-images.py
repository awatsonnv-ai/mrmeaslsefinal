#!/usr/bin/env python3
"""
Extract base64-inlined images from index.html, save as JPEG (via sharp),
and replace data URIs with /assets/img/ paths.

Run from repo root:  python3 scripts/extract-inline-images.py
"""

import re, base64, os, subprocess, sys, json

HTML_FILE   = 'index.html'
OUT_DIR     = 'assets/img'
SHARP_SCRIPT = 'scripts/_convert_tmp.mjs'
JPEG_QUALITY = 82   # 0-100; 82 is visually lossless for photos

os.makedirs(OUT_DIR, exist_ok=True)

with open(HTML_FILE, 'r', encoding='utf-8') as f:
    html = f.read()

# Find all base64 data URIs and their enclosing attribute context
# Captures: full match, mime type, base64 data
DATA_URI_RE = re.compile(r'data:image/([a-z]+);base64,([A-Za-z0-9+/=]+)')

matches = list(DATA_URI_RE.finditer(html))
print(f"Found {len(matches)} base64 image(s)\n")

# Assign filenames by inspecting context around each match
def filename_for(i, m, html):
    """Derive a human-readable filename from surrounding HTML context."""
    before = html[max(0, m.start()-600):m.start()]
    after  = html[m.end():m.end()+200]

    # Check for alt attribute after the data URI (img tags)
    alt = re.search(r'alt="([^"]+)"', after)
    if alt and alt.group(1).strip():
        slug = alt.group(1).lower().replace(' ', '-').replace(',', '')
        return f'trail-{slug}'

    # Check for alt attribute before (less common)
    alt_b = re.search(r'alt="([^"]+)"[^<]*$', before)
    if alt_b and alt_b.group(1).strip():
        slug = alt_b.group(1).lower().replace(' ', '-').replace(',', '')
        return slug

    # Identify by structural context
    if 'background-image' in before[-200:]:
        return 'hero-bg'
    if 'about-img' in before[-300:] or 'about-grid' in before[-600:]:
        return 'about'
    if 'trail' in before[-400:]:
        return f'trail-{i+1}'
    if 'bobby' in before[-300:]:
        return 'bobby'
    if 'ic-logo' in before[-200:]:
        return 'ic-logo'
    return f'image-{i+1}'

replacements = []  # (old_data_uri, new_path, tmp_png_path, final_path)

for i, m in enumerate(matches):
    ext      = m.group(1)
    b64_data = m.group(2)
    raw      = base64.b64decode(b64_data + '==')
    kb       = len(raw) // 1024

    name     = filename_for(i, m, html)
    # ic-logo is tiny, keep as PNG
    out_ext  = 'png' if (name == 'ic-logo' or kb < 50) else 'jpg'
    out_name = f'{name}.{out_ext}'
    out_path = os.path.join(OUT_DIR, out_name)
    tmp_png  = os.path.join(OUT_DIR, f'_tmp_{i}.png')

    # Write raw PNG bytes to temp file
    with open(tmp_png, 'wb') as f:
        f.write(raw)

    replacements.append((m.group(0), f'/assets/img/{out_name}', tmp_png, out_path, kb, out_ext))
    print(f"  [{i+1}] {kb}KB  → {out_name}")

print()

# Convert all PNGs to JPEG via sharp (one script call)
sharp_ops = []
for (_, new_path, tmp_png, out_path, kb, out_ext) in replacements:
    if out_ext == 'jpg':
        sharp_ops.append({'input': tmp_png, 'output': out_path, 'quality': JPEG_QUALITY})
    else:
        # just copy PNG as-is
        import shutil
        shutil.copy(tmp_png, out_path)

if sharp_ops:
    sharp_js = 'import sharp from "sharp";\n'
    sharp_js += 'const ops = ' + json.dumps(sharp_ops) + ';\n'
    sharp_js += 'for (const op of ops) {\n'
    sharp_js += '  await sharp(op.input).jpeg({ quality: op.quality, mozjpeg: true }).toFile(op.output);\n'
    sharp_js += '}\nconsole.log("sharp: done");\n'

    with open(SHARP_SCRIPT, 'w') as f:
        f.write(sharp_js)

    result = subprocess.run(['node', SHARP_SCRIPT], capture_output=True, text=True)
    if result.returncode != 0:
        print('sharp error:', result.stderr)
        sys.exit(1)
    print(result.stdout.strip())

# Cleanup temp files
for (_, _, tmp_png, out_path, kb, out_ext) in replacements:
    if os.path.exists(tmp_png):
        os.remove(tmp_png)
if os.path.exists(SHARP_SCRIPT):
    os.remove(SHARP_SCRIPT)

# Report output sizes
print()
total_before = 0
total_after  = 0
for (old_uri, new_path, _, out_path, kb_before, _) in replacements:
    kb_after = os.path.getsize(out_path) // 1024
    total_before += kb_before
    total_after  += kb_after
    print(f"  {os.path.basename(out_path):40s}  {kb_before:>5}KB → {kb_after:>4}KB  ({100*kb_after//kb_before}%)")

print(f"\n  Total images: {total_before//1024}MB → {total_after//1024}MB")

# Rewrite HTML: replace data URIs with file paths
print('\nPatching index.html ...')
new_html = html
for (old_uri, new_path, _, out_path, kb, out_ext) in replacements:
    assert old_uri in new_html, f'URI not found for {new_path}'
    new_html = new_html.replace(old_uri, new_path, 1)

# Also handle the CSS background-image case: url('data:...') → url('/assets/img/...')
# (the replace above already handles the data URI inside the url(), leaving url('') → url('/path')
# but we may have url(' /path') with a space from the quote — fix that)
new_html = new_html.replace("url(' /assets/", "url('/assets/")
new_html = new_html.replace('url(" /assets/', 'url("/assets/')

with open(HTML_FILE, 'w', encoding='utf-8') as f:
    f.write(new_html)

new_size = os.path.getsize(HTML_FILE) // 1024
print(f'index.html: {new_size}KB (was 29MB)')
print('\nDone. Commit assets/img/ and the updated index.html.')
