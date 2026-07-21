// P3.2/S-01/S-04: Test/Live-Key-Resolver. In Non-Production hat der Test-Key
// (STRIPE_TEST_SECRET_KEY / STRIPE_WEBHOOK_TEST_SECRET) Vorrang; in Production
// werden STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET (Live) genutzt. Rein statisch,
// KEIN Stripe-Call, keine echten Keys. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { resolveStripeSecretKey, resolveStripeWebhookSecret } from '../../strapi/src/stripe-config.ts';

const env = (vars) => (k) => vars[k];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV = readFileSync(join(ROOT, 'strapi', '.env.example'), 'utf8');

test('dev: STRIPE_TEST_SECRET_KEY hat Vorrang', () => {
  assert.equal(
    resolveStripeSecretKey(env({ STRIPE_TEST_SECRET_KEY: 'sk_test_A', STRIPE_SECRET_KEY: 'sk_test_B' }), 'development'),
    'sk_test_A',
  );
});

test('dev ohne Test-Key: Fallback auf STRIPE_SECRET_KEY', () => {
  assert.equal(resolveStripeSecretKey(env({ STRIPE_SECRET_KEY: 'sk_test_B' }), 'development'), 'sk_test_B');
});

test('production ignoriert Test-Key, nutzt STRIPE_SECRET_KEY (live)', () => {
  assert.equal(
    resolveStripeSecretKey(env({ STRIPE_TEST_SECRET_KEY: 'sk_test_A', STRIPE_SECRET_KEY: 'sk_live_Z' }), 'production'),
    'sk_live_Z',
  );
});

test('undefined NODE_ENV = non-prod → Test-Key bevorzugt', () => {
  assert.equal(
    resolveStripeSecretKey(env({ STRIPE_TEST_SECRET_KEY: 'sk_test_A', STRIPE_SECRET_KEY: 'sk_live_Z' }), undefined),
    'sk_test_A',
  );
});

test('Webhook-Secret analog (Test in dev, Live in prod)', () => {
  assert.equal(
    resolveStripeWebhookSecret(env({ STRIPE_WEBHOOK_TEST_SECRET: 'whsec_T', STRIPE_WEBHOOK_SECRET: 'whsec_S' }), 'development'),
    'whsec_T',
  );
  assert.equal(
    resolveStripeWebhookSecret(env({ STRIPE_WEBHOOK_TEST_SECRET: 'whsec_T', STRIPE_WEBHOOK_SECRET: 'whsec_S' }), 'production'),
    'whsec_S',
  );
});

test('.env.example dokumentiert die Test-spezifischen Keys (ohne Werte)', () => {
  assert.match(ENV, /^#?\s*STRIPE_TEST_SECRET_KEY=/m);
  assert.match(ENV, /^#?\s*STRIPE_WEBHOOK_TEST_SECRET=/m);
});

// Alias-Schreibweise (…_KEY_TEST / …_SECRET_TEST) wird akzeptiert, falls die
// kanonische STRIPE_TEST_…-Variante fehlt — verhindert einen still wirkungslosen
// Env-Eintrag, wenn der Betreiber die _TEST-Suffix-Konvention nutzt.
test('dev: STRIPE_SECRET_KEY_TEST (Alias) wird als Test-Key erkannt', () => {
  assert.equal(resolveStripeSecretKey(env({ STRIPE_SECRET_KEY_TEST: 'sk_test_ALIAS' }), 'development'), 'sk_test_ALIAS');
});

test('dev: kanonisches STRIPE_TEST_SECRET_KEY hat Vorrang vor dem Alias', () => {
  assert.equal(
    resolveStripeSecretKey(env({ STRIPE_TEST_SECRET_KEY: 'sk_test_CANON', STRIPE_SECRET_KEY_TEST: 'sk_test_ALIAS' }), 'development'),
    'sk_test_CANON',
  );
});

test('dev: STRIPE_WEBHOOK_SECRET_TEST (Alias) wird als Webhook-Test-Secret erkannt', () => {
  assert.equal(resolveStripeWebhookSecret(env({ STRIPE_WEBHOOK_SECRET_TEST: 'whsec_ALIAS' }), 'development'), 'whsec_ALIAS');
});

test('production ignoriert die Test-Aliase, nutzt Live-Keys', () => {
  assert.equal(
    resolveStripeSecretKey(env({ STRIPE_SECRET_KEY_TEST: 'sk_test_ALIAS', STRIPE_SECRET_KEY: 'sk_live_Z' }), 'production'),
    'sk_live_Z',
  );
});

test('.env.example nennt auch die Alias-Schreibweise', () => {
  assert.match(ENV, /STRIPE_SECRET_KEY_TEST/);
  assert.match(ENV, /STRIPE_WEBHOOK_SECRET_TEST/);
});
