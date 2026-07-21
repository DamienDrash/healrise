// Test-first für die Stripe-Preis-Parität (Audit S-03, Roadmap P3 3.4).
// Die in strapi/.env.example dokumentierten Preis-Defaults müssen mit den
// Code-Fallbacks im Checkout-Controller UND den Brutto-Preisen aus Landing/App
// übereinstimmen (Cent, inkl. MwSt.). Stale Beispielwerte (9900/19900) würden
// Operatoren zu falschen Preisen verleiten. Reines Text-Parsing beider Dateien —
// kein Stripe-Call, keine Secrets, kein Controller-Import.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV_EXAMPLE = join(ROOT, 'strapi', '.env.example');
const CHECKOUT = join(ROOT, 'strapi', 'src', 'checkout-session.ts');

// Quelle der Wahrheit: Brutto-Preise aus Landing/App (EUR) → Cent.
const EXPECTED_CENTS = {
  STRIPE_PRICE_HEALRISE7: 69 * 100, // 6900
  STRIPE_PRICE_HEALRISE14: 169 * 100, // 16900
  STRIPE_PRICE_PREMIUM: 399 * 100, // 39900
};

const envText = readFileSync(ENV_EXAMPLE, 'utf8');
const checkoutText = readFileSync(CHECKOUT, 'utf8');

/** Liest den (ggf. auskommentierten) Beispielwert eines Env-Namens aus .env.example. */
function envSample(name) {
  const m = envText.match(new RegExp(`^#?\\s*${name}\\s*=\\s*(\\d+)`, 'm'));
  assert.ok(m, `${name} fehlt (auch als Beispiel) in strapi/.env.example`);
  return parseInt(m[1], 10);
}

/** Liest den Code-Fallback (fallback: N) zum Env-Namen aus dem Checkout-Controller. */
function codeFallback(name) {
  const m = checkoutText.match(new RegExp(`amountEnv:\\s*'${name}',\\s*fallback:\\s*(\\d+)`));
  assert.ok(m, `Fallback für ${name} nicht im Checkout-Controller gefunden`);
  return parseInt(m[1], 10);
}

for (const [name, expected] of Object.entries(EXPECTED_CENTS)) {
  test(`${name}: Code-Fallback == Brutto-Preis (${expected} Cent)`, () => {
    assert.equal(codeFallback(name), expected);
  });

  test(`${name}: .env.example dokumentiert ${expected} Cent (Parität)`, () => {
    assert.equal(
      envSample(name),
      expected,
      `.env.example nennt ${envSample(name)}, erwartet ${expected} (Landing/App-Brutto)`,
    );
  });
}

test('alle drei Stripe-Preis-Envs sind in .env.example dokumentiert', () => {
  for (const name of Object.keys(EXPECTED_CENTS)) {
    assert.match(envText, new RegExp(name), `${name} nicht in .env.example dokumentiert`);
  }
});
