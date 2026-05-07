import sharp from 'sharp';
import { existsSync } from 'fs';

if (!existsSync('og-image.png')) {
  console.error('og-image.png not found — run from repo root');
  process.exit(1);
}

// og-image is 1200×630. Mr. Measles head is roughly centered at (600, 290).
// Crop a 600×600 square starting at x=300, y=0 to capture head + hat.
await sharp('og-image.png')
  .extract({ left: 300, top: 0, width: 600, height: 600 })
  .resize(512, 512)
  .png()
  .toFile('assets/favicon-source.png');

console.log('assets/favicon-source.png written (512×512)');
