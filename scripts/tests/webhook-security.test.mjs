// P3.3 / S-03 (+ P3.1 Postal): Statischer Security-Guard für die Webhook-Routen.
// Sperrt den Sicherheitsvertrag gegen Regression: Signaturprüfung gegen den
// ROHEN Body, bewusst auth:false (per Signatur gesichert, kein JWT), 503/400-
// Verhalten — UND die Invariante, dass auth:false NUR auf vetted, signatur-
// geprüften Webhook-Routen existiert (Stripe HMAC, Postal RSA) und jede davon
// nachweislich eine Signatur prüft. Rein statisch. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'strapi', 'src');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const ROUTE = read('strapi', 'src', 'api', 'stripe-webhook', 'routes', 'stripe-webhook.ts');
const CONTROLLER = read('strapi', 'src', 'api', 'stripe-webhook', 'controllers', 'stripe-webhook.ts');
const MIDDLEWARES = read('strapi', 'config', 'middlewares.ts');

test('Route: POST /stripe/webhook, auth:false (signaturgesichert, kein JWT)', () => {
  assert.match(ROUTE, /method:\s*'POST'/);
  assert.match(ROUTE, /path:\s*'\/stripe\/webhook'/);
  assert.match(ROUTE, /handler:\s*'stripe-webhook\.handle'/);
  assert.match(ROUTE, /auth:\s*false/);
});

test('Controller: Signaturprüfung via constructEvent gegen den ROHEN Body', () => {
  assert.match(CONTROLLER, /Stripe\.webhooks\.constructEvent/);
  assert.match(CONTROLLER, /unparsedBody/, 'muss den rohen (unparsed) Body verwenden');
  assert.match(CONTROLLER, /stripe-signature/);
});

test('Controller: fehlendes Secret → 503, fehlende/ungültige Signatur → 400', () => {
  assert.match(CONTROLLER, /ctx\.status\s*=\s*503/);
  assert.match(CONTROLLER, /ctx\.status\s*=\s*400/);
});

test('Roher Body ist verfügbar: strapi::body includeUnparsed=true', () => {
  assert.match(MIDDLEWARES, /includeUnparsed:\s*true/);
});

// Vetted öffentliche Webhook-Routen: auth:false ist NUR zulässig, weil die
// Authentizität über eine kryptografische Signatur (statt JWT) gegen den ROHEN
// Body kommt. Jede Aufnahme hier ist eine bewusste, geprüfte Sicherheits-Freigabe.
const SIGNATURE_GATED = [
  { route: 'api/stripe-webhook/routes/stripe-webhook.ts', controller: ['api', 'stripe-webhook', 'controllers', 'stripe-webhook.ts'], verify: /Stripe\.webhooks\.constructEvent/ },
  { route: 'api/mail-webhook/routes/mail-webhook.ts', controller: ['api', 'mail-webhook', 'controllers', 'mail-webhook.ts'], verify: /verifyPostalSignature/ },
];

test('INVARIANTE: auth:false NUR auf vetted, signaturgeprüften Webhook-Routen (keine Auth-Lücke)', () => {
  const tsFiles = readdirSync(SRC, { recursive: true }).filter((f) => String(f).endsWith('.ts'));
  const authFalse = tsFiles
    .filter((f) => /auth:\s*false/.test(readFileSync(join(SRC, f), 'utf8')))
    .map((f) => String(f).replace(/\\/g, '/'));
  const allowed = SIGNATURE_GATED.map((r) => r.route);
  for (const f of authFalse) {
    assert.ok(allowed.some((a) => f.endsWith(a)), `nicht vetted auth:false-Route: ${f}`);
  }
  assert.equal(authFalse.length, SIGNATURE_GATED.length, `unerwartete Anzahl auth:false-Routen: ${authFalse.join(', ')}`);
});

test('INVARIANTE: jede auth:false-Route prüft eine Signatur gegen den ROHEN Body', () => {
  for (const r of SIGNATURE_GATED) {
    const ctrl = read('strapi', 'src', ...r.controller);
    assert.match(ctrl, r.verify, `${r.route} verifiziert keine Signatur`);
    assert.match(ctrl, /unparsedBody/, `${r.route} nutzt nicht den ROHEN Body`);
  }
});

test('Guard ist nicht vakuum: erkennt auth:false-Muster', () => {
  assert.match('config: { auth: false }', /auth:\s*false/);
});
