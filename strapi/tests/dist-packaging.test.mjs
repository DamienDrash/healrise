/**
 * Build-Artefakt-Regression (P1.2 / Produktionsblocker): der produktive
 * dist-Start muss das Account-Deletion-Modul enthalten und auflösen können.
 *
 * Hintergrund: `strapi-server` macht `require('./account-deletion')`. Wird die
 * Implementierung als handgeschriebene `.js` gepflegt, kompiliert der Strapi-
 * Server-Build sie NICHT nach `dist/` → Laufzeitfehler `Cannot find module
 * './account-deletion'` und Strapi startet nicht (öffentliche API/Admin 502).
 *
 * Voraussetzung: ein vorheriger `NODE_ENV=production npm run build` (bzw. der
 * Strapi-Server-Build), der `dist/src/...` erzeugt hat.
 *
 *   node --test strapi/tests/dist-packaging.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distExtDir = resolve(here, '../dist/src/extensions/users-permissions');
const distServer = resolve(distExtDir, 'strapi-server.js');
const distModule = resolve(distExtDir, 'account-deletion.js');

test('das kompilierte Account-Deletion-Modul liegt neben strapi-server.js im dist', () => {
  assert.ok(existsSync(distServer), `Erwartet kompiliertes ${distServer} (Strapi-Build gelaufen?)`);
  assert.ok(existsSync(distModule), `FEHLT im dist: ${distModule} — wird vom Server-Build nicht mitkopiert`);
});

test('strapi-server.js kann ./account-deletion zur Laufzeit auflösen', () => {
  // Genau die Auflösung, die Strapi beim Start durchführt.
  const requireFromServer = createRequire(distServer);
  assert.doesNotThrow(
    () => requireFromServer.resolve('./account-deletion'),
    'require("./account-deletion") aus strapi-server.js muss auflösen',
  );
});

test('das kompilierte Modul exportiert die erwartete API (deleteAccount, makeDeleteMeController)', async () => {
  assert.ok(existsSync(distModule), `FEHLT im dist: ${distModule}`);
  const requireDist = createRequire(distServer);
  const mod = requireDist('./account-deletion');
  assert.equal(typeof mod.deleteAccount, 'function', 'deleteAccount exportiert');
  assert.equal(typeof mod.makeDeleteMeController, 'function', 'makeDeleteMeController exportiert');
});
