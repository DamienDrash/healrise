// P3.2 / S-01: Guard für die dedizierte Stripe-Client-Konfiguration.
// Die Stripe-API-Version MUSS serverseitig gepinnt sein (nicht „latest"), damit
// ein Stripe-seitiges API-Update den Checkout/Portal nicht unbemerkt verändert.
// Reine Konfig-Funktionen (kein 'stripe'-Import, kein Netz) — node-testbar.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  STRIPE_API_VERSION,
  stripeClientOptions,
  resolveStripeClientConfig,
} from '../../strapi/src/stripe-config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');
const env = (vars) => (key) => vars[key];

test('STRIPE_API_VERSION ist fixiert (datiertes Format, nicht latest/leer)', () => {
  assert.ok(STRIPE_API_VERSION, 'API-Version fehlt');
  assert.match(STRIPE_API_VERSION, /^\d{4}-\d{2}-\d{2}/, 'erwartet ein datiertes Format YYYY-MM-DD');
});

test('stripeClientOptions pinnt genau diese API-Version', () => {
  assert.equal(stripeClientOptions().apiVersion, STRIPE_API_VERSION);
});

test('resolveStripeClientConfig: Testmodus zieht den Test-Key + gepinnte Options', () => {
  const cfg = resolveStripeClientConfig(
    env({ STRIPE_TEST_SECRET_KEY: 'sk_test_EXAMPLE', STRIPE_SECRET_KEY: 'sk_live_EXAMPLE' }),
    'development',
  );
  assert.equal(cfg.secretKey, 'sk_test_EXAMPLE', 'außerhalb Production hat der Test-Key Vorrang');
  assert.equal(cfg.options.apiVersion, STRIPE_API_VERSION);
});

test('resolveStripeClientConfig: Production zieht den Live-Key', () => {
  const cfg = resolveStripeClientConfig(
    env({ STRIPE_TEST_SECRET_KEY: 'sk_test_EXAMPLE', STRIPE_SECRET_KEY: 'sk_live_EXAMPLE' }),
    'production',
  );
  assert.equal(cfg.secretKey, 'sk_live_EXAMPLE');
});

test('resolveStripeClientConfig: ohne Key → secretKey undefined (Controller 503)', () => {
  const cfg = resolveStripeClientConfig(env({}), 'development');
  assert.equal(cfg.secretKey, undefined);
  assert.equal(cfg.options.apiVersion, STRIPE_API_VERSION);
});

test('Checkout konstruiert Stripe über die zentrale Client-Config (gepinnte Options)', () => {
  const src = read('strapi', 'src', 'api', 'checkout', 'controllers', 'checkout.ts');
  assert.match(src, /resolveStripeClientConfig/, 'checkout.ts nutzt nicht die zentrale Client-Config');
  assert.match(src, /new Stripe\([^)]*,[\s\S]*?\)/, 'checkout.ts konstruiert Stripe ohne Options (kein Versions-Pin)');
});

test('Billing-Portal pinnt die API-Version inline UND synchron zu STRIPE_API_VERSION', () => {
  // Inline (kein Import), weil dieser Controller per node --test geladen wird —
  // der Guard hält den Wert mit der zentralen Konstante synchron.
  const src = read('strapi', 'src', 'api', 'stripe-webhook', 'billing-portal.ts');
  assert.match(src, new RegExp(`STRIPE_API_VERSION\\s*=\\s*'${STRIPE_API_VERSION}'`), 'billing-portal.ts pinnt nicht dieselbe Version wie stripe-config.ts');
  assert.match(src, /apiVersion:\s*STRIPE_API_VERSION/, 'billing-portal.ts nutzt die gepinnte Version nicht im Stripe-Konstruktor');
  assert.match(src, /new Stripe\([^)]*,[\s\S]*?apiVersion[\s\S]*?\)/, 'billing-portal.ts konstruiert Stripe ohne Options');
});
