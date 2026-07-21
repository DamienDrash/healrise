// P3.2/S-01/S-04: Guard für die Stripe-Testmodus-Betreiber-Doku + Env-Vollständigkeit.
// Stellt sicher, dass docs/stripe_setup.md alle nötigen Env-Keys, den
// Webhook-Endpoint, den Testmodus-Hinweis und das relevante Event dokumentiert —
// secret-frei (keine echten Keys). Rein statisch, KEINE Stripe-Calls.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const GUIDE = read('docs', 'stripe_setup.md');
const ENV = read('strapi', '.env.example');

test('Setup-Guide dokumentiert alle Pflicht-Env-Keys', () => {
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PRICE_HEALRISE7',
    'STRIPE_PRICE_HEALRISE14',
    'STRIPE_PRICE_PREMIUM',
  ]) {
    assert.match(GUIDE, new RegExp(key), `Guide nennt ${key} nicht`);
  }
});

test('Setup-Guide nennt Webhook-Endpoint, Testmodus-Präfixe und Event', () => {
  assert.match(GUIDE, /\/api\/stripe\/webhook/);
  assert.match(GUIDE, /sk_test_/);
  assert.match(GUIDE, /whsec_/);
  assert.match(GUIDE, /pk_test_/);
  assert.match(GUIDE, /checkout\.session\.completed/);
});

test('Setup-Guide verweist auf lokale Verifikation (Tests/Readiness) und .env-Sicherheit', () => {
  assert.match(GUIDE, /stripe-webhook\.test\.mjs|stripe-testmode-config|validateStripeConfig|test:scripts/);
  assert.match(GUIDE, /strapi\/\.env/);
});

test('GUARDRAIL: Guide enthält keine echten Live-Secrets', () => {
  assert.doesNotMatch(GUIDE, /sk_live_[A-Za-z0-9]{16,}/);
  assert.doesNotMatch(GUIDE, /whsec_[A-Za-z0-9]{24,}/);
  assert.doesNotMatch(GUIDE, /pk_live_[A-Za-z0-9]{16,}/);
});

test('.env.example dokumentiert STRIPE_PUBLISHABLE_KEY (Public Key)', () => {
  assert.match(ENV, /^#?\s*STRIPE_PUBLISHABLE_KEY=/m);
});
