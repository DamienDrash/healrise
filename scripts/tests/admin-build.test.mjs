// Regressionstest für den realen P0-Ausfall (B-02, 14.07.26): der produktive
// Strapi-Admin-Build fehlte auf der Platte. Der Dienst startet mit `strapi start`
// aus strapi/ und erwartet das kompilierte Admin-Panel unter dist/build/. Fehlt es,
// antwortet /admin mit `ENOENT: … dist/build/index.html` (öffentlich 404).
//
// Der Smoke-Test (smoke-and-health.test.mjs) fährt gegen einen Mock und kann das
// FEHLENDE Artefakt strukturell nicht sehen — dieser Test prüft daher das REALE
// On-Disk-Ergebnis von `npm --prefix strapi run build`. RED ohne Build, GREEN danach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STRAPI = join(HERE, '..', '..', 'strapi');
const BUILD_DIR = join(STRAPI, 'dist', 'build');
const INDEX = join(BUILD_DIR, 'index.html');

test('Strapi-Admin-Build: dist/build/index.html existiert (produktiver Build gelaufen)', () => {
  assert.ok(
    existsSync(INDEX),
    `Admin-Build fehlt: ${INDEX} nicht vorhanden. ` +
      'Erzeugen mit: (cd strapi && NODE_ENV=production npm run build)',
  );
});

test('Strapi-Admin-Build: index.html lädt mindestens ein JS-Asset (Panel gebündelt)', () => {
  // Ohne Build gibt es keine index.html → dieser Test ist ebenfalls RED und wird
  // erst grün, wenn das kompilierte Panel ein einbindbares <script>-Asset enthält.
  assert.ok(existsSync(INDEX), `Admin-Build fehlt: ${INDEX} nicht vorhanden.`);
  const html = readFileSync(INDEX, 'utf8');
  assert.match(
    html,
    /<script[^>]+src="[^"]+\.js"/i,
    'index.html bindet kein JS-Asset ein — Admin-Panel-Bundle unvollständig',
  );
});
