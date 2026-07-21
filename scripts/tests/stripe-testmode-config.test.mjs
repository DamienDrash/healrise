// Test-first für die lokale Stripe-Testmodus-Readiness/Guardrails (P3.2, S-01/S-04).
// KEINE Netzwerk-/Stripe-Aufrufe, KEINE echten Keys — nur offensichtliche
// Platzhalter-Token (…_EXAMPLE). Geprüft werden zentrale Validierung der
// Checkout-Konfiguration, Test-vs-Live-Key-Guard, Webhook-Secret-Pflicht,
// success/cancel-URLs und dass Secrets NIE in Fehlermeldungen auftauchen.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  validateStripeConfig,
  stripeKeyMode,
  checkoutRedirectUrls,
} from '../../strapi/src/stripe-config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECKOUT = join(ROOT, 'strapi', 'src', 'checkout-session.ts');

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

// Vollständig gültige Testmodus-Konfiguration (nur Platzhalter).
const VALID_TEST = {
  STRIPE_SECRET_KEY: 'sk_test_EXAMPLE',
  STRIPE_WEBHOOK_SECRET: 'whsec_EXAMPLE',
  APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
};

test('stripeKeyMode erkennt test/live/unknown ohne Wert-Leak', () => {
  assert.equal(stripeKeyMode('sk_test_EXAMPLE'), 'test');
  assert.equal(stripeKeyMode('pk_test_EXAMPLE'), 'test');
  assert.equal(stripeKeyMode('whsec_test_EXAMPLE'), 'test');
  assert.equal(stripeKeyMode('sk_live_EXAMPLE'), 'live');
  assert.equal(stripeKeyMode('rk_live_EXAMPLE'), 'live');
  assert.equal(stripeKeyMode('garbage'), 'unknown');
  assert.equal(stripeKeyMode(undefined), 'unknown');
});

test('gültige Testmodus-Konfiguration ist ready ohne Fehler', () => {
  const r = validateStripeConfig(makeEnv(VALID_TEST));
  assert.equal(r.ready, true, `unerwartete Fehler: ${r.errors.join('; ')}`);
  assert.equal(r.mode, 'test');
  assert.equal(r.errors.length, 0);
});

test('fehlende Pflicht-Envs blockieren Readiness (nur Namen im Fehler)', () => {
  const r = validateStripeConfig(makeEnv({}));
  assert.equal(r.ready, false);
  assert.ok(r.errors.some((e) => e.includes('STRIPE_SECRET_KEY')));
  assert.ok(r.errors.some((e) => e.includes('STRIPE_WEBHOOK_SECRET')));
  assert.ok(r.errors.some((e) => e.includes('APP_PUBLIC_URL')));
});

test('GUARDRAIL: Live-Secret-Key im Testmodus wird abgelehnt', () => {
  const r = validateStripeConfig(makeEnv({ ...VALID_TEST, STRIPE_SECRET_KEY: 'sk_live_EXAMPLE' }));
  assert.equal(r.ready, false);
  assert.equal(r.mode, 'live');
  assert.ok(r.errors.some((e) => /live/i.test(e) && e.includes('STRIPE_SECRET_KEY')));
});

test('GUARDRAIL: Fehlermeldungen enthalten niemals den Secret-Wert', () => {
  const secrets = ['sk_live_EXAMPLE', 'whsec_WRONGFORMAT', 'sk_test_EXAMPLE'];
  const r = validateStripeConfig(
    makeEnv({
      STRIPE_SECRET_KEY: 'sk_live_EXAMPLE',
      STRIPE_WEBHOOK_SECRET: 'whsec_WRONGFORMAT'.replace('whsec_', 'nope_'),
      APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
    }),
  );
  const blob = [...r.errors, ...r.warnings].join('\n');
  for (const s of secrets) assert.ok(!blob.includes(s), `Secret ${s} im Output geleakt`);
});

test('Webhook-Secret mit falschem Format blockiert', () => {
  const r = validateStripeConfig(makeEnv({ ...VALID_TEST, STRIPE_WEBHOOK_SECRET: 'nope_EXAMPLE' }));
  assert.equal(r.ready, false);
  assert.ok(r.errors.some((e) => e.includes('STRIPE_WEBHOOK_SECRET')));
});

test('APP_PUBLIC_URL auf /cms wird abgelehnt; relative URL ebenso', () => {
  const cms = validateStripeConfig(makeEnv({ ...VALID_TEST, APP_PUBLIC_URL: 'https://x/healrise/app/cms' }));
  assert.ok(cms.errors.some((e) => e.includes('APP_PUBLIC_URL')));
  const rel = validateStripeConfig(makeEnv({ ...VALID_TEST, APP_PUBLIC_URL: '/healrise/app' }));
  assert.ok(rel.errors.some((e) => e.includes('APP_PUBLIC_URL')));
});

test('Preis-Envs: ungültig blockiert, fehlend nur Warnung (Fallback greift)', () => {
  const bad = validateStripeConfig(makeEnv({ ...VALID_TEST, STRIPE_PRICE_HEALRISE7: 'abc' }));
  assert.equal(bad.ready, false);
  assert.ok(bad.errors.some((e) => e.includes('STRIPE_PRICE_HEALRISE7')));

  const missing = validateStripeConfig(makeEnv(VALID_TEST));
  assert.equal(missing.ready, true);
  assert.ok(missing.warnings.some((w) => w.includes('STRIPE_PRICE_HEALRISE7')));
});

test('optionaler Publishable-Key: Live im Testmodus blockiert', () => {
  const r = validateStripeConfig(makeEnv({ ...VALID_TEST, STRIPE_PUBLISHABLE_KEY: 'pk_live_EXAMPLE' }));
  assert.equal(r.ready, false);
  assert.ok(r.errors.some((e) => e.includes('STRIPE_PUBLISHABLE_KEY')));
});

// --- Dedizierte Test/Live-Key-Trennung (spiegelt die Runtime-Resolver) ---
// Operator-Setup laut .env.example: Test-Keys separat, Live-Keys parallel
// dauerhaft gesetzt; der Modus schaltet über NODE_ENV. Die Readiness-Prüfung
// MUSS im Testmodus die Test-Keys heranziehen (wie Checkout/Webhook zur Laufzeit),
// sonst meldet sie bei korrekter Konfiguration fälschlich not-ready.
const DUAL_KEYS = {
  STRIPE_TEST_SECRET_KEY: 'sk_test_EXAMPLE',
  STRIPE_TEST_PUBLISHABLE_KEY: 'pk_test_EXAMPLE',
  STRIPE_WEBHOOK_TEST_SECRET: 'whsec_TESTEXAMPLE',
  STRIPE_SECRET_KEY: 'sk_live_EXAMPLE',
  STRIPE_PUBLISHABLE_KEY: 'pk_live_EXAMPLE',
  STRIPE_WEBHOOK_SECRET: 'whsec_LIVEEXAMPLE',
  APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
};

test('Testmodus-Readiness nutzt die dedizierten Test-Keys (Live parallel gesetzt = ok)', () => {
  const r = validateStripeConfig(makeEnv(DUAL_KEYS), { expectedMode: 'test' });
  assert.equal(r.ready, true, `Testmodus mit dedizierten Test-Keys muss ready sein: ${r.errors.join('; ')}`);
  assert.equal(r.mode, 'test');
});

test('Live-Readiness (expectedMode live) nutzt die Live-Keys, ignoriert Test-Keys', () => {
  const r = validateStripeConfig(makeEnv(DUAL_KEYS), { expectedMode: 'live' });
  assert.equal(r.ready, true, `Live-Readiness muss ready sein: ${r.errors.join('; ')}`);
  assert.equal(r.mode, 'live');
});

test('GUARDRAIL: fehlendes STRIPE_WEBHOOK_TEST_SECRET fällt im Testmodus NICHT auf den Live-Webhook zurück, wenn nur Test erwartet ist? (Fallback erlaubt)', () => {
  // Ohne dediziertes Test-Webhook-Secret ist der Fallback auf STRIPE_WEBHOOK_SECRET
  // zulässig (Abwärtskompatibilität) — solange dessen Format stimmt.
  const r = validateStripeConfig(
    makeEnv({ STRIPE_TEST_SECRET_KEY: 'sk_test_EXAMPLE', STRIPE_WEBHOOK_SECRET: 'whsec_EXAMPLE', APP_PUBLIC_URL: 'https://x/healrise/app' }),
    { expectedMode: 'test' },
  );
  assert.equal(r.ready, true, `Fallback auf STRIPE_WEBHOOK_SECRET muss greifen: ${r.errors.join('; ')}`);
});

test('checkoutRedirectUrls stimmen mit dem Checkout-Controller überein', () => {
  const { success_url, cancel_url } = checkoutRedirectUrls('https://x/healrise/app');
  assert.equal(success_url, 'https://x/healrise/app/upgrade/erfolg?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(cancel_url, 'https://x/healrise/app/upgrade/abbruch');
  // Parität zum echten Controller-Quelltext (Suffixe müssen übereinstimmen).
  const src = readFileSync(CHECKOUT, 'utf8');
  assert.match(src, /\/upgrade\/erfolg\?session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(src, /\/upgrade\/abbruch/);
});
