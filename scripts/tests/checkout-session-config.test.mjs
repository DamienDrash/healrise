// P3.2/P3.5: Statischer Vertrag der Checkout-Session-Erzeugung.
// Sperrt mode=payment (Einmalkauf, kein subscription), vorausgefüllte
// customer_email aus User-Daten, Währung eur und success/cancel-URLs, die an
// FRONTEND_URL (Fallback APP_PUBLIC_URL) gebunden sind. Rein statisch, kein
// Stripe-Call. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Die Session-Parameter liegen seit dem Refactor im reinen Flow-Modul
// checkout-session.ts (behavioral getestet in checkout-flow.test.mjs); dieser
// statische Vertrag prüft dort weiter die Kern-Strings.
const CHECKOUT = readFileSync(join(ROOT, 'strapi', 'src', 'checkout-session.ts'), 'utf8');

test('Einmalkauf: mode=payment (kein subscription)', () => {
  assert.match(CHECKOUT, /mode:\s*'payment'/);
  assert.doesNotMatch(CHECKOUT, /mode:\s*'subscription'/);
});

test('customer_email wird aus User-Daten vorausgefüllt', () => {
  assert.match(CHECKOUT, /customer_email:\s*user\.email/);
});

test('Customer-Creation: Gast bekommt persistenten Customer (customer_creation "always")', () => {
  // Nötig, damit session.customer im Webhook gespeichert werden kann (P3.3 Billing-Portal).
  assert.match(CHECKOUT, /customer_creation:\s*'always'/);
});

test('Bestehende stripe_customer_id wird wiederverwendet (customer: …), statt neu zu erstellen', () => {
  assert.match(CHECKOUT, /stripe_customer_id/);
  assert.match(CHECKOUT, /customer:\s*\w+/);
});

test('Währung eur, dynamische price_data (kein hartkodierter Price)', () => {
  assert.match(CHECKOUT, /currency:\s*'eur'/);
  assert.match(CHECKOUT, /price_data/);
});

test('success/cancel-URLs sind an FRONTEND_URL (Fallback APP_PUBLIC_URL) gebunden', () => {
  assert.match(CHECKOUT, /FRONTEND_URL/, 'publicBase muss FRONTEND_URL nutzen');
  assert.match(CHECKOUT, /success_url:\s*`\$\{publicBase\}\/upgrade\/erfolg\?session_id=\{CHECKOUT_SESSION_ID\}`/);
  assert.match(CHECKOUT, /cancel_url:\s*`\$\{publicBase\}\/upgrade\/abbruch`/);
});
