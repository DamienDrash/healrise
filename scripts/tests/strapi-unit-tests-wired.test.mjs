// Vertrag: die server-freien Strapi-Unit-Tests (Stripe-Webhook-Fulfillment,
// Refund/Cancel, §312f-Kaufbestätigungs-Mail-Flow P3.5, Account-Deletion) MÜSSEN
// im `test:strapi`-npm-Skript verdrahtet sein und `test:strapi` MUSS Teil von
// `npm run check` (DoD-Gate) sein.
//
// Hintergrund: `test:scripts` globt nur `scripts/tests/*.test.mjs`, `test:api`
// startet einen Live-Server. Die gestubbten `strapi/tests/*.test.mjs` liefen
// dadurch in KEINEM npm-Skript und wären still aus der Pipeline gefallen — der
// P3.5-Mail-Flow / Webhook-Goldstandard hätte unbemerkt regredieren können.
//
// Dieser Guard erzwingt: jede `strapi/tests/*.test.mjs` ist entweder in
// `test:strapi` verdrahtet ODER eine dokumentierte, build-/server-abhängige
// Ausnahme. Ein neuer Webhook-/Mail-Test fällt damit auf, bis er eingehängt ist.
//
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

// Build-/server-abhängige Tests laufen bewusst NICHT im schnellen `test:strapi`:
//  - dist-packaging.test.mjs: braucht einen vorherigen Strapi-`dist`-Build
//    (Deploy-/CI-mit-Build-Pfad), sonst existSync-Fehler auf frischem Checkout.
const BUILD_OR_SERVER_DEPENDENT = new Set(['dist-packaging.test.mjs']);

test('test:strapi ist definiert und ruft `node --test`', () => {
  assert.ok(scripts['test:strapi'], 'npm-Skript "test:strapi" fehlt');
  assert.match(scripts['test:strapi'], /node --test/, 'test:strapi startet keinen node --test-Runner');
});

test('check läuft test:strapi (DoD-Gate deckt den Webhook/§312f-Goldstandard)', () => {
  assert.ok(scripts.check, 'npm-Skript "check" fehlt');
  assert.match(scripts.check, /\btest:strapi\b/, 'check enthält test:strapi nicht');
});

test('jede server-freie strapi/tests/*.test.mjs ist in test:strapi verdrahtet', () => {
  const files = readdirSync(join(ROOT, 'strapi', 'tests')).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(files.length > 0, 'keine strapi/tests/*.test.mjs gefunden — Pfad falsch?');

  const wired = scripts['test:strapi'];
  const missing = [];
  for (const f of files) {
    if (BUILD_OR_SERVER_DEPENDENT.has(f)) continue;
    if (!wired.includes(`strapi/tests/${f}`)) missing.push(f);
  }
  assert.deepEqual(
    missing,
    [],
    `Nicht in test:strapi verdrahtet: ${missing.join(', ')} — einhängen oder als build-/server-abhängig dokumentieren.`,
  );
});

test('dokumentierte Ausnahmen existieren wirklich (kein toter Eintrag)', () => {
  const files = new Set(readdirSync(join(ROOT, 'strapi', 'tests')).filter((f) => f.endsWith('.test.mjs')));
  for (const f of BUILD_OR_SERVER_DEPENDENT) {
    assert.ok(files.has(f), `Ausnahme "${f}" existiert nicht mehr in strapi/tests — Guard-Eintrag aktualisieren`);
  }
});

// Nicht-Vakuum: der Kern-P3.5-Mail-Flow MUSS namentlich verdrahtet sein — ein
// leeres/generisches test:strapi soll diesen Guard nicht bestehen.
test('P3.5-Mail-Flow-Test ist namentlich in test:strapi verdrahtet', () => {
  assert.match(
    scripts['test:strapi'],
    /strapi\/tests\/purchase-confirmation-flow\.test\.mjs/,
    'purchase-confirmation-flow.test.mjs (P3.5 §312f) fehlt in test:strapi',
  );
});
