// Test-first für das PWA-Precache-Budget (Audit P-02, Roadmap P4.3).
// Der Service-Worker-Precache muss < 800 KiB bleiben, sonst zieht die PWA-
// Installation unnötige Bytes (nicht-lateinische Font-Subsets: devanagari,
// cyrillic, vietnamese, math, symbols) — für eine rein deutschsprachige App
// überflüssig. Gemessen wird das reale Build-Artefakt app/dist/sw.js.
// Voraussetzung: vorheriger `npm run build`. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, statSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', '..', 'app', 'dist');
const SW = join(DIST, 'sw.js');

const BUDGET_BYTES = 800 * 1024; // < 800 KiB

/** Liest die vom Workbox-Precache erfassten URLs aus dem gebauten sw.js. */
function precacheUrls() {
  const sw = readFileSync(SW, 'utf8');
  const urls = [];
  const re = /\{url:"([^"]+)",revision:/g;
  let m;
  while ((m = re.exec(sw)) !== null) urls.push(m[1]);
  return urls;
}

test('app/dist/sw.js existiert (Build gelaufen)', () => {
  assert.ok(existsSync(SW), `Kein Build-Artefakt: ${SW} — zuerst npm run build`);
});

test('SW-Precache bleibt unter 800 KiB (P-02)', () => {
  const urls = precacheUrls();
  assert.ok(urls.length > 0, 'Precache-Manifest im sw.js gefunden');

  let total = 0;
  const missing = [];
  for (const url of urls) {
    const p = join(DIST, url);
    if (!existsSync(p)) { missing.push(url); continue; }
    total += statSync(p).size;
  }
  assert.equal(missing.length, 0, `Precache-Einträge ohne Datei: ${missing.join(', ')}`);

  const kib = (total / 1024).toFixed(1);
  assert.ok(
    total < BUDGET_BYTES,
    `Precache ${kib} KiB überschreitet Budget 800 KiB (${urls.length} Einträge)`,
  );
});

test('keine nicht-lateinischen Font-Subsets im Precache (P-02)', () => {
  const nonLatin = precacheUrls().filter((u) =>
    /\.woff2$/.test(u) && /(devanagari|cyrillic|vietnamese|greek|-math-|symbols|latin-ext)/.test(u),
  );
  assert.equal(nonLatin.length, 0, `Überflüssige Subsets im Precache: ${nonLatin.join(', ')}`);
});
