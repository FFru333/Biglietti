// Genera le icone dell'app: freccia "→" in inchiostro su carta. Eseguire con `npm run icons`.
// Le PNG generate sono versionate in public/icons, quindi non serve in CI.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

const PAPER = '#F4F2EE', INK = '#141413';
mkdirSync('public/icons', { recursive: true });

// Geometria su griglia 100×100; `inset` riduce il disegno per la zona sicura maskable.
function draw(size, inset = 1) {
  const c = createCanvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);
  const k = (size / 100) * inset, o = (size - 100 * k) / 2;
  const P = (x, y) => [o + x * k, o + y * k];
  g.strokeStyle = INK;
  g.lineWidth = 7.2 * k;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.miterLimit = 10;
  g.beginPath();
  g.moveTo(...P(22, 50)); g.lineTo(...P(74, 50));
  g.moveTo(...P(57, 32)); g.lineTo(...P(75, 50)); g.lineTo(...P(57, 68));
  g.stroke();
  return c.toBuffer('image/png');
}

writeFileSync('public/icons/icon-192.png', draw(192));
writeFileSync('public/icons/icon-512.png', draw(512));
writeFileSync('public/icons/apple-touch-icon-180.png', draw(180));
writeFileSync('public/icons/icon-maskable-512.png', draw(512, 0.78));
writeFileSync('public/icons/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="${PAPER}"/><path d="M22 50h52M57 32l18 18-18 18" fill="none" stroke="${INK}" stroke-width="7.2" stroke-miterlimit="10"/></svg>\n`);
console.log('icone generate');
