// P3.2/S-01: Stubbed Unit-Tests der Checkout-Flow-Logik (Analog zu M-01/
// purchase-confirmation). buildCheckoutSession ist rein — KEIN Stripe-Call, kein
// Netz: es validiert die Kaufanfrage (§312f-Consent, Plan, kein Downgrade) und
// baut die Stripe-Session-Parameter. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCheckoutSession, PLAN_PRICES, PLAN_ORDER } from '../../strapi/src/checkout-session.ts';

const env = (vars = {}) => (k) => vars[k];
const USER = { id: 42, email: 'kundin@example.com', plan: 'freebie' };

test('unbekannter Plan → ok:false (400-Meldung)', () => {
  const r = buildCheckoutSession({ user: USER, plan: 'gibtsnicht', consentImmediateDelivery: true }, env());
  assert.equal(r.ok, false);
  assert.match(r.message, /Unbekannter Plan/);
});

test('bereits freigeschalteter/niedrigerer Plan → ok:false (kein Downgrade/Doppelkauf)', () => {
  const premiumUser = { ...USER, plan: 'premium' };
  const r = buildCheckoutSession({ user: premiumUser, plan: 'healrise7', consentImmediateDelivery: true }, env());
  assert.equal(r.ok, false);
  assert.match(r.message, /bereits freigeschaltet/);
  // Gleiche Stufe zählt ebenfalls als bereits freigeschaltet.
  const same = buildCheckoutSession({ user: { ...USER, plan: 'healrise14' }, plan: 'healrise14', consentImmediateDelivery: true }, env());
  assert.equal(same.ok, false);
});

test('fehlende §312f-Zustimmung → ok:false', () => {
  const r = buildCheckoutSession({ user: USER, plan: 'healrise14', consentImmediateDelivery: false }, env());
  assert.equal(r.ok, false);
  assert.match(r.message, /sofortige Bereitstellung|Widerrufsrecht/i);
});

test('gültiger Kauf → ok:true mit korrekten Session-Parametern', () => {
  const r = buildCheckoutSession({ user: USER, plan: 'healrise14', consentImmediateDelivery: true }, env());
  assert.equal(r.ok, true);
  const p = r.params;
  assert.equal(p.mode, 'payment');
  assert.equal(p.line_items[0].price_data.currency, 'eur');
  assert.equal(p.line_items[0].price_data.unit_amount, 16900); // Fallback ohne Env
  assert.equal(p.line_items[0].price_data.product_data.name, 'HEALRISE 14');
  assert.equal(p.metadata.userId, '42');
  assert.equal(p.metadata.plan, 'healrise14');
  assert.equal(p.metadata.consent_immediate_delivery, 'true');
});

test('Preis kommt aus STRIPE_PRICE_*-Env, sonst Code-Fallback', () => {
  const withEnv = buildCheckoutSession({ user: USER, plan: 'healrise7', consentImmediateDelivery: true }, env({ STRIPE_PRICE_HEALRISE7: '5000' }));
  assert.equal(withEnv.params.line_items[0].price_data.unit_amount, 5000);
  const fallback = buildCheckoutSession({ user: USER, plan: 'healrise7', consentImmediateDelivery: true }, env());
  assert.equal(fallback.params.line_items[0].price_data.unit_amount, 6900);
});

test('Neuer Kunde: customer_creation "always" + customer_email; kein customer', () => {
  const r = buildCheckoutSession({ user: { id: 7, email: 'neu@example.com' }, plan: 'premium', consentImmediateDelivery: true }, env());
  assert.equal(r.params.customer_creation, 'always');
  assert.equal(r.params.customer_email, 'neu@example.com');
  assert.equal(r.params.customer, undefined);
});

test('Bestehender Stripe-Kunde wird wiederverwendet (customer), kein customer_creation', () => {
  const r = buildCheckoutSession({ user: { id: 7, email: 'x@example.com', stripe_customer_id: 'cus_123' }, plan: 'premium', consentImmediateDelivery: true }, env());
  assert.equal(r.params.customer, 'cus_123');
  assert.equal(r.params.customer_creation, undefined);
  assert.equal(r.params.customer_email, undefined);
});

test('success/cancel-URL: FRONTEND_URL bevorzugt (Fallback APP_PUBLIC_URL)', () => {
  const r = buildCheckoutSession(
    { user: USER, plan: 'healrise14', consentImmediateDelivery: true },
    env({ FRONTEND_URL: 'https://x/healrise/app/', APP_PUBLIC_URL: 'https://ignored' }),
  );
  assert.equal(r.params.success_url, 'https://x/healrise/app/upgrade/erfolg?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(r.params.cancel_url, 'https://x/healrise/app/upgrade/abbruch');
});

test('Preis-Map + Plan-Reihenfolge exportiert (Konsistenz mit Parität)', () => {
  assert.deepEqual(Object.keys(PLAN_PRICES).sort(), ['healrise14', 'healrise7', 'premium']);
  assert.deepEqual(PLAN_ORDER, ['freebie', 'healrise7', 'healrise14', 'premium']);
});
