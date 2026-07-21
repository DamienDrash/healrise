// D-02: Harte Test-Isolation für den schreibenden API-Test-Runner.
// strapi/tests/api-tests.mjs SCHREIBT in die Ziel-DB (User/Progress/Passwort).
// Der Guard muss Läufe blockieren, solange keine bewusste Test-Freigabe gesetzt
// ist, und den Produktions-Port zusätzlich schützen. Reine Funktion, kein Netz/DB.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { assertApiTestIsolation } from '../../strapi/tests/test-isolation.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_TESTS = readFileSync(join(ROOT, 'strapi', 'tests', 'api-tests.mjs'), 'utf8');
const PROD = 'http://127.0.0.1:9130';

test('blockiert ohne bewusste Freigabe (Default = sicher)', () => {
  assert.throws(() => assertApiTestIsolation({ env: {}, base: PROD }), /API_TESTS_ALLOW/);
});

test('blockiert den Produktions-Port auch mit API_TESTS_ALLOW=1', () => {
  assert.throws(
    () => assertApiTestIsolation({ env: { API_TESTS_ALLOW: '1' }, base: PROD }),
    /9130|Produktions-Port/i,
  );
});

test('erlaubt ein Nicht-Prod-Ziel mit API_TESTS_ALLOW=1', () => {
  assert.doesNotThrow(() =>
    assertApiTestIsolation({ env: { API_TESTS_ALLOW: '1' }, base: 'http://127.0.0.1:9999' }),
  );
});

test('erlaubt den Prod-Port nur mit doppelter bewusster Freigabe', () => {
  assert.doesNotThrow(() =>
    assertApiTestIsolation({
      env: { API_TESTS_ALLOW: '1', API_TESTS_ALLOW_PROD_PORT: '1' },
      base: PROD,
    }),
  );
});

test('Fehlermeldung leakt keine Secrets', () => {
  try {
    assertApiTestIsolation({ env: { DATABASE_PASSWORD: 'supersecret-value' }, base: PROD });
    assert.fail('sollte werfen');
  } catch (e) {
    assert.ok(!String(e.message).includes('supersecret-value'), 'Secret im Fehlertext geleakt');
  }
});

test('api-tests.mjs ruft den Isolations-Guard auf (vor Netzwerkzugriff)', () => {
  assert.match(API_TESTS, /assertApiTestIsolation/, 'Guard nicht in api-tests.mjs verdrahtet');
});
