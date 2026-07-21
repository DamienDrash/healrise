// P3.2 / S-01 / S-04: Zusammenführender Guard für die Stripe-Testmodus-Readiness.
// Deckt Damiens drei Kernzusagen ab, OHNE je einen echten Stripe-Request zu senden:
//   1. Env wird geladen: validateStripeConfig konsumiert STRIPE_SECRET_KEY und
//      STRIPE_WEBHOOK_SECRET tatsächlich (fehlend → blockierender Fehler; gesetzt
//      im Testmodus → ready). Reine Funktion, kein Netz, kein Stripe-SDK-Aufruf.
//   2. Webhook-Route existiert: POST /stripe/webhook mit auth:false (Signatur statt JWT).
//   3. Doku/Env-Muster: beide Keys sind in strapi/.env.example hinterlegt.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  validateStripeConfig,
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
} from '../../strapi/src/stripe-config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

// Gültige lokale Testmodus-Konfiguration — nur Platzhalter-Keys, KEINE echten Secrets.
const TEST_OK = {
  STRIPE_SECRET_KEY: 'sk_test_PLACEHOLDER',
  STRIPE_WEBHOOK_SECRET: 'whsec_PLACEHOLDER',
  APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
};

test('Env geladen: gültige Testmodus-Config ist ready (keine Fehler)', () => {
  const r = validateStripeConfig(makeEnv(TEST_OK));
  assert.equal(r.ready, true, `unerwartete Fehler: ${r.errors.join('; ')}`);
  assert.equal(r.mode, 'test');
});

test('STRIPE_SECRET_KEY wird konsumiert: fehlend → blockierender Fehler', () => {
  const r = validateStripeConfig(makeEnv({ ...TEST_OK, STRIPE_SECRET_KEY: undefined }));
  assert.equal(r.ready, false);
  assert.ok(
    r.errors.some((e) => e.includes('STRIPE_SECRET_KEY')),
    'Fehler muss STRIPE_SECRET_KEY nennen',
  );
});

test('STRIPE_WEBHOOK_SECRET wird konsumiert: fehlend → blockierender Fehler', () => {
  const r = validateStripeConfig(makeEnv({ ...TEST_OK, STRIPE_WEBHOOK_SECRET: undefined }));
  assert.equal(r.ready, false);
  assert.ok(
    r.errors.some((e) => e.includes('STRIPE_WEBHOOK_SECRET')),
    'Fehler muss STRIPE_WEBHOOK_SECRET nennen',
  );
});

test('Key-Auflösung: Testmodus bevorzugt _TEST_-Keys, Production die Live-Keys', () => {
  const env = makeEnv({
    STRIPE_TEST_SECRET_KEY: 'sk_test_A',
    STRIPE_SECRET_KEY: 'sk_live_B',
    STRIPE_WEBHOOK_TEST_SECRET: 'whsec_test_A',
    STRIPE_WEBHOOK_SECRET: 'whsec_live_B',
  });
  assert.equal(resolveStripeSecretKey(env, 'development'), 'sk_test_A');
  assert.equal(resolveStripeSecretKey(env, 'production'), 'sk_live_B');
  assert.equal(resolveStripeWebhookSecret(env, 'development'), 'whsec_test_A');
  assert.equal(resolveStripeWebhookSecret(env, 'production'), 'whsec_live_B');
});

test('GUARDRAIL: Live-Secret-Key im Testmodus wird abgelehnt', () => {
  const r = validateStripeConfig(makeEnv({ ...TEST_OK, STRIPE_SECRET_KEY: 'sk_live_NOPE' }));
  assert.equal(r.ready, false);
  assert.ok(r.errors.some((e) => e.includes('STRIPE_SECRET_KEY') && /live/i.test(e)));
});

test('GUARDRAIL: validateStripeConfig gibt niemals Secret-Werte in Meldungen aus', () => {
  const r = validateStripeConfig(
    makeEnv({ ...TEST_OK, STRIPE_SECRET_KEY: 'sk_live_LEAKME', STRIPE_WEBHOOK_SECRET: '' }),
  );
  const blob = [...r.errors, ...r.warnings].join('\n');
  assert.ok(!blob.includes('sk_live_LEAKME'), 'Secret-Wert geleakt');
});

test('S-04: Webhook-Route existiert (POST /stripe/webhook, auth:false)', () => {
  const route = read('strapi', 'src', 'api', 'stripe-webhook', 'routes', 'stripe-webhook.ts');
  assert.match(route, /method:\s*'POST'/);
  assert.match(route, /path:\s*'\/stripe\/webhook'/);
  assert.match(route, /handler:\s*'stripe-webhook\.handle'/);
  assert.match(route, /auth:\s*false/);
});

test('S-04: Webhook-Controller prüft die Stripe-Signatur (constructEvent)', () => {
  const ctrl = read('strapi', 'src', 'api', 'stripe-webhook', 'controllers', 'stripe-webhook.ts');
  assert.match(ctrl, /Stripe\.webhooks\.constructEvent/);
  assert.match(ctrl, /STRIPE_WEBHOOK_SECRET/);
  assert.match(ctrl, /stripe-signature/);
});

test('Doku/Env-Muster: .env.example dokumentiert beide Pflicht-Keys', () => {
  const env = read('strapi', '.env.example');
  assert.match(env, /^#?\s*STRIPE_SECRET_KEY=/m, 'STRIPE_SECRET_KEY fehlt in .env.example');
  assert.match(env, /^#?\s*STRIPE_WEBHOOK_SECRET=/m, 'STRIPE_WEBHOOK_SECRET fehlt in .env.example');
});

test('GUARDRAIL: .env.example enthält keine echten Live-Keys', () => {
  const env = read('strapi', '.env.example');
  assert.doesNotMatch(env, /sk_live_[A-Za-z0-9]/);
  assert.doesNotMatch(env, /whsec_[A-Za-z0-9]{16,}/);
});
