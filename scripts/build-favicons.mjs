import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, existsSync } from 'fs';

if (!existsSync('favicon-source.png')) {
  console.error('favicon-source.png not found — run crop-favicon-source.mjs first');
  process.exit(1);
}

// PNG sizes
const pngs = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png',         size: 192 },
  { file: 'icon-512.png',         size: 512 },
  // intermediates needed for ICO
  { file: '_ico16.png',           size: 16  },
  { file: '_ico32.png',           size: 32  },
  { file: '_ico48.png',           size: 48  },
];

for (const { file, size } of pngs) {
  await sharp('favicon-source.png').resize(size, size).png().toFile(file);
  if (!file.startsWith('_')) console.log(`  ✓ ${file} (${size}×${size})`);
}

// Build multi-res favicon.ico from the three intermediate PNGs
const ico = await pngToIco(['_ico16.png', '_ico32.png', '_ico48.png']);
writeFileSync('favicon.ico', ico);
console.log('  ✓ favicon.ico (16+32+48)');

// Clean up intermediates
import { unlinkSync } from 'fs';
for (const f of ['_ico16.png', '_ico32.png', '_ico48.png']) unlinkSync(f);

console.log('\nAll favicon assets written to repo root.');
