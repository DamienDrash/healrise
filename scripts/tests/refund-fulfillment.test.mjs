// P3.x: Statischer Guard für das Refund-/Cancel-Fulfillment im Stripe-Webhook.
// Sperrt den Vertrag: charge.refunded (Voll) + customer.subscription.deleted →
// Plan-Downgrade auf den Basisplan, User-Auflösung über stripe_customer_id,
// Fehler → 5xx (Stripe-Retry). Rein statisch, kein Stripe-Call. Das Verhalten
// selbst ist behavioral getestet in strapi/tests/stripe-webhook.test.mjs.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(
  join(ROOT, 'strapi', 'src', 'api', 'stripe-webhook', 'controllers', 'stripe-webhook.ts'),
  'utf8',
);

test('Webhook behandelt charge.refunded UND customer.subscription.deleted', () => {
  assert.match(SRC, /event\.type === 'charge\.refunded'/);
  assert.match(SRC, /event\.type === 'customer\.subscription\.deleted'/);
  assert.match(SRC, /processRefundOrCancel\(/);
});

test('Downgrade auf den Basisplan (freebie), User-Lookup via stripe_customer_id', () => {
  assert.match(SRC, /BASE_PLAN\s*=\s*'freebie'/);
  assert.match(SRC, /stripe_customer_id:\s*customerId/);
  assert.match(SRC, /data:\s*\{\s*plan:\s*BASE_PLAN/);
});

test('Zugehörige Käufe werden auf status "refunded" storniert (updateMany, idempotent)', () => {
  assert.match(SRC, /updateMany\(/);
  assert.match(SRC, /where:\s*\{\s*user:\s*user\.id,\s*status:\s*'completed'\s*\}/);
  assert.match(SRC, /data:\s*\{\s*status:\s*'refunded'\s*\}/);
});

test('Nur Voll-Erstattung senkt den Plan (Teil-Refund lässt Zugang)', () => {
  assert.match(SRC, /charge\.refunded'\s*&&\s*object\.refunded !== true/);
});

test('Idempotenz: Plan-Downgrade nur, wenn nicht schon Basisplan', () => {
  assert.match(SRC, /\(user\.plan \|\| BASE_PLAN\) !== BASE_PLAN/);
});

test('Refund-/Cancel-Verarbeitungsfehler → 5xx (Stripe-Retry, kein received:true)', () => {
  // Der else-if-Zweig für Refund/Cancel setzt bei Fehler status 500 und returned.
  const branch = SRC.slice(SRC.indexOf("charge.refunded' || event.type === 'customer.subscription.deleted'"));
  assert.match(branch, /ctx\.status = 500/);
});

test('GUARDRAIL: Downgrade ist der EINZIGE Pfad, der den Plan senkt (dokumentiert)', () => {
  assert.match(SRC, /bewusst auf 'freebie' zurück|Zugang widerrufen/i);
});
