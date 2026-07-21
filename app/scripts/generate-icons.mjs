/**
 * Rastert die HEALRISE-Bildmarke (Vektor) zu den PWA-PNG-Icons.
 * Quelle der Wahrheit ist die SVG-Blüte unten (identisch zu components/brand/HealriseMark.jsx
 * und public/favicon.svg). Ausführen nach Logo-Änderungen:
 *
 *   node scripts/generate-icons.mjs
 *
 * Nutzt das lokal installierte Playwright-Chromium. Ist keins vorhanden, bricht das
 * Skript sauber ab (Icons bleiben unverändert) — siehe docs/branding.md.
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public');

// Papercraft-Blüte ohne Hintergrund (120er-Viewbox).
const BLOOM = `
  <circle cx="60" cy="37" r="16.5" fill="none" stroke="url(#cu)" stroke-width="7"/>
  <path d="M59 83 Q83.6 67.2 86 38 Q65.6 56.4 59 83 Z" fill="#97A995"/>
  <path d="M61 83 Q36.4 67.2 34 38 Q54.4 56.4 61 83 Z" fill="#97A995"/>
  <path d="M59 84 Q72.8 60.3 71 33 Q59.2 57.1 59 84 Z" fill="#A7B7A6"/>
  <path d="M61 84 Q47.2 60.3 49 33 Q60.8 57.1 61 84 Z" fill="#A7B7A6"/>
  <g stroke="#E4DDD0" stroke-width="0.8" stroke-linejoin="round">
    <path d="M60 85 Q72.2 56 66.5 25 Q55.8 54.2 60 85 Z" fill="url(#pt)"/>
    <path d="M60 85 Q47.8 56 53.5 25 Q64.2 54.2 60 85 Z" fill="url(#pt)"/>
  </g>
  <path d="M60 84 Q61.6 55 66 26" fill="none" stroke="#E9E2D6" stroke-width="0.7"/>
  <path d="M60 84 Q58.4 55 54 26" fill="none" stroke="#E9E2D6" stroke-width="0.7"/>
  <path d="M41 82 Q60 90 79 82 L77 88 Q60 99 43 88 Z" fill="#F1EBE0" stroke="#E0D8C9" stroke-width="0.8"/>
  <path d="M44 83.5 Q60 90.5 76 83.5" fill="none" stroke="#FBF7F0" stroke-width="0.9"/>
  <g fill="#B7AE9F">
    <circle cx="55" cy="88" r="1.05"/><circle cx="60" cy="87.2" r="1.05"/><circle cx="65" cy="88" r="1.05"/>
    <circle cx="57.5" cy="91" r="1.05"/><circle cx="62.5" cy="91" r="1.05"/>
  </g>`;

// scale = Anteil des Icons, den die Blüte einnimmt (maskable braucht Safe-Zone-Rand)
function svg(px, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${px}" height="${px}">
    <defs>
      <linearGradient id="cu" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#D89A78"/><stop offset="0.55" stop-color="#B8734F"/><stop offset="1" stop-color="#9C5E3D"/>
      </linearGradient>
      <linearGradient id="pt" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0" stop-color="#FDFCFA"/><stop offset="1" stop-color="#EFE9DE"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" fill="#F6F3EF"/>
    <g transform="translate(60 60) scale(${scale}) translate(-60 -59)">${BLOOM}</g>
  </svg>`;
}

const TARGETS = [
  { file: 'icon-192.png', px: 192, scale: 0.9 },
  { file: 'icon-512.png', px: 512, scale: 0.9 },
  { file: 'icon-maskable-192.png', px: 192, scale: 0.66 },
  { file: 'icon-maskable-512.png', px: 512, scale: 0.66 },
  { file: 'apple-touch-icon.png', px: 180, scale: 0.9 },
];

// Installiertes Chromium finden (Version kann von der npm-Erwartung abweichen).
function findChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, `${process.env.HOME}/.cache/ms-playwright`, '/root/.cache/ms-playwright']
    .filter(Boolean);
  const candidates = [];
  for (const r of roots) {
    for (const v of ['1223', '1217', '1228', '1230']) {
      candidates.push(`${r}/chromium-${v}/chrome-linux64/chrome`);
      candidates.push(`${r}/chromium_headless_shell-${v}/chrome-headless-shell-linux64/chrome-headless-shell`);
    }
  }
  return candidates.find(existsSync);
}

const exe = findChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const t of TARGETS) {
  await page.setViewportSize({ width: t.px, height: t.px });
  await page.setContent(
    `<body style="margin:0"><div id="i" style="width:${t.px}px;height:${t.px}px;line-height:0">${svg(t.px, t.scale)}</div></body>`,
    { waitUntil: 'networkidle' },
  );
  await page.locator('#i').screenshot({ path: resolve(OUT, t.file) });
  console.log('✓', t.file, `${t.px}×${t.px}`);
}

await browser.close();
console.log('Icons aktualisiert.');
