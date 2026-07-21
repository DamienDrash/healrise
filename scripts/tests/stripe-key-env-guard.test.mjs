// P3.2: Safety-Check für Stripe-Key ↔ Umgebung. Warnt, wenn Test-Keys in
// Production laufen (echte Zahlungen finden nicht statt) oder — gefährlicher —
// Live-Keys in Nicht-Production (echte Zahlungen im Dev/Test!). Reine Funktion,
// KEIN Stripe-Call, KEINE Secret-Werte im Output. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stripeKeyEnvironmentWarnings } from '../../strapi/src/stripe-config.ts';

const env = (vars) => (key) => vars[key];

test('Test-Key in Production → Warnung', () => {
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_SECRET_KEY: 'sk_test_EXAMPLE' }), 'production');
  assert.ok(w.some((m) => /test/i.test(m) && /production/i.test(m)));
});

test('Live-Key in Nicht-Production → (kritische) Warnung', () => {
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_SECRET_KEY: 'sk_live_EXAMPLE' }), 'development');
  assert.ok(w.some((m) => /live/i.test(m)));
});

test('Test-Key in development → keine Warnung', () => {
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_SECRET_KEY: 'sk_test_EXAMPLE' }), 'development');
  assert.equal(w.length, 0);
});

test('Live-Key in production → keine Warnung', () => {
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_SECRET_KEY: 'sk_live_EXAMPLE' }), 'production');
  assert.equal(w.length, 0);
});

test('kein Key gesetzt → keine Warnung', () => {
  assert.equal(stripeKeyEnvironmentWarnings(env({}), 'production').length, 0);
});

test('Publishable-Key-Mismatch wird ebenfalls gewarnt', () => {
  const w = stripeKeyEnvironmentWarnings(
    env({ STRIPE_SECRET_KEY: 'sk_live_EXAMPLE', STRIPE_PUBLISHABLE_KEY: 'pk_test_EXAMPLE' }),
    'production',
  );
  assert.ok(w.some((m) => /publishable/i.test(m)));
});

test('GUARDRAIL: Warnungen enthalten keinen Secret-Wert', () => {
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_SECRET_KEY: 'sk_live_LEAKME999' }), 'development');
  assert.ok(w.length > 0);
  assert.ok(w.every((m) => !m.includes('sk_live_LEAKME999')));
});

// --- resolver-bewusst: der Warner beurteilt den EFFEKTIV genutzten Key ---
test('Dual-Key in development: aktiver Test-Key, Live parallel gesetzt → KEIN Fehlalarm', () => {
  // Außerhalb Production zieht der Resolver STRIPE_TEST_SECRET_KEY; der parallel
  // hinterlegte Live-Key in STRIPE_SECRET_KEY ist inert und darf NICHT warnen.
  const w = stripeKeyEnvironmentWarnings(
    env({
      STRIPE_TEST_SECRET_KEY: 'sk_test_EXAMPLE',
      STRIPE_SECRET_KEY: 'sk_live_EXAMPLE',
      STRIPE_TEST_PUBLISHABLE_KEY: 'pk_test_EXAMPLE',
      STRIPE_PUBLISHABLE_KEY: 'pk_live_EXAMPLE',
    }),
    'development',
  );
  assert.equal(w.length, 0, `Fehlalarm im Dual-Key-Dev-Setup: ${w.join('; ')}`);
});

test('Live-Key VERSEHENTLICH im Test-Slot (development) → kritische Warnung', () => {
  // Wird der Live-Key in den TEST-Slot gelegt, ist er außerhalb Production
  // tatsächlich aktiv → echte Zahlungsgefahr → muss warnen.
  const w = stripeKeyEnvironmentWarnings(env({ STRIPE_TEST_SECRET_KEY: 'sk_live_EXAMPLE' }), 'development');
  assert.ok(w.some((m) => /live/i.test(m)), 'Live-Key im aktiven Test-Slot muss warnen');
});
