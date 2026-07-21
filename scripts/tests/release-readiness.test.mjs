// Test-first für das konsolidierte Release-Readiness-Pre-Flight (P3/P4-Go-Gate).
// Aggregiert die lokalen Guardrail-Validatoren (Stripe + E-Mail) zu EINEM
// Ergebnis, das Operator/CI vor Go-Live prüfen können — ohne Netz-/Stripe-/SMTP-
// Aufruf, ohne Secrets im Output. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { collectReadiness } from '../release-readiness.mjs';

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

const STRIPE_TEST = {
  STRIPE_SECRET_KEY: 'sk_test_EXAMPLE',
  STRIPE_WEBHOOK_SECRET: 'whsec_EXAMPLE',
  APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
};
const EMAIL_LOCAL = {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '25',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'no-reply@example.com',
  SMTP_REPLY_TO: 'support@example.com',
};
const FULL_OK = { ...STRIPE_TEST, ...EMAIL_LOCAL };

test('vollständige Testmodus-Konfiguration ist insgesamt ready', () => {
  const r = collectReadiness(makeEnv(FULL_OK));
  assert.equal(r.ready, true, `Blocker: stripe=${r.stripe.errors}; email=${r.email.blockers}`);
  assert.equal(r.stripe.ready, true);
  assert.equal(r.email.ready, true);
});

test('fehlender STRIPE_SECRET_KEY macht das Gesamtergebnis not-ready', () => {
  const env = makeEnv({ ...FULL_OK, STRIPE_SECRET_KEY: undefined });
  const r = collectReadiness(env);
  assert.equal(r.ready, false);
  assert.equal(r.stripe.ready, false);
  assert.equal(r.email.ready, true);
});

test('fehlendes SMTP_FROM macht das Gesamtergebnis not-ready', () => {
  const r = collectReadiness(makeEnv({ ...FULL_OK, SMTP_FROM: '' }));
  assert.equal(r.ready, false);
  assert.equal(r.email.ready, false);
});

test('forRealDelivery threadet zur E-Mail-Prüfung durch (Loopback blockt)', () => {
  const local = collectReadiness(makeEnv(FULL_OK), { forRealDelivery: true });
  assert.equal(local.email.ready, false, 'Loopback ist für echte Zustellung ein Blocker');
  assert.equal(local.ready, false);
});

test('GUARDRAIL: der serialisierte Report enthält keine Secret-Werte', () => {
  const r = collectReadiness(
    makeEnv({
      ...FULL_OK,
      STRIPE_SECRET_KEY: 'sk_live_LEAKME',
      SMTP_USERNAME: 'realuser',
      SMTP_PASSWORD: 'p@ss-LEAKME',
    }),
  );
  const blob = JSON.stringify(r);
  assert.ok(!blob.includes('LEAKME'), 'Secret-Wert im Report geleakt');
  assert.ok(!blob.includes('realuser'), 'Username im Report geleakt');
});
