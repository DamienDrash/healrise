// P3.1 (Postal): Guard für den Mail-Webhook-Empfänger (Zustell-/Bounce-Events).
// Rein lokal & gestubbt — KEIN Postal, KEINE echte Mail, KEIN Netz. Die
// Signaturprüfung wird mit einem im Test erzeugten RSA-Schlüsselpaar geprüft
// (kein echter Postal-Key). Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  verifyPostalSignature,
  classifyPostalEvent,
  handlePostalEvent,
} from '../../strapi/src/mail-webhook.ts';

// Einmalig ein Schlüsselpaar erzeugen (nur für den Test — nie ein echter Key).
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function sign(body, algo = 'sha256') {
  const s = crypto.createSign(algo);
  s.update(body);
  s.end();
  return s.sign(privateKey).toString('base64');
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

// --- Signaturprüfung ---
test('verifyPostalSignature: gültige Signatur über den Roh-Body → true', () => {
  const body = JSON.stringify({ event: 'MessageDelivered' });
  assert.equal(verifyPostalSignature(body, sign(body), publicKey), true);
});

test('verifyPostalSignature: manipulierter Body → false', () => {
  const body = JSON.stringify({ event: 'MessageDelivered' });
  const sig = sign(body);
  assert.equal(verifyPostalSignature(body + ' ', sig, publicKey), false);
});

test('verifyPostalSignature: falsche Signatur / fremder Key → false', () => {
  const body = JSON.stringify({ event: 'MessageBounced' });
  const other = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const foreignSig = (() => { const s = crypto.createSign('sha256'); s.update(body); s.end(); return s.sign(other.privateKey).toString('base64'); })();
  assert.equal(verifyPostalSignature(body, foreignSig, publicKey), false);
});

test('verifyPostalSignature: fehlende Argumente → false (kein Wurf)', () => {
  assert.equal(verifyPostalSignature('', 'x', publicKey), false);
  assert.equal(verifyPostalSignature('body', '', publicKey), false);
  assert.equal(verifyPostalSignature('body', 'sig', ''), false);
  assert.equal(verifyPostalSignature('body', 'not-base64!!', publicKey), false);
});

// --- Event-Klassifizierung ---
test('classifyPostalEvent: Bounce/Zustellfehler werden als Bounce erkannt', () => {
  for (const t of ['MessageBounced', 'MessageDeliveryFailed']) {
    const c = classifyPostalEvent({ event: t, payload: { message: { to: 'k@example.com', id: 5 } } });
    assert.equal(c.isBounce, true);
    assert.equal(c.isDelivery, false);
    assert.equal(c.type, t);
  }
});

test('classifyPostalEvent: Zustellung wird als Delivery erkannt (kein Bounce)', () => {
  for (const t of ['MessageSent', 'MessageDelivered']) {
    const c = classifyPostalEvent({ event: t, payload: { message: { to: 'k@example.com' } } });
    assert.equal(c.isDelivery, true);
    assert.equal(c.isBounce, false);
  }
});

test('classifyPostalEvent: unbekanntes/Tracking-Event ist weder Bounce noch Delivery', () => {
  const c = classifyPostalEvent({ event: 'MessageLinkClicked', payload: { message: {} } });
  assert.equal(c.isBounce, false);
  assert.equal(c.isDelivery, false);
});

// --- Best-effort-Handling (kein Wurf, PII-sicheres Logging) ---
function makeStrapi() {
  const logs = [];
  return { logs, log: { info: (m) => logs.push(['info', m]), warn: (m) => logs.push(['warn', m]), error: (m) => logs.push(['error', m]) } };
}

test('handlePostalEvent: Bounce wird als Warnung geloggt (handled)', () => {
  const strapi = makeStrapi();
  const res = handlePostalEvent(strapi, { event: 'MessageBounced', payload: { message: { to: 'kundin@example.com', id: 9 } } });
  assert.equal(res.handled, true);
  assert.equal(res.isBounce, true);
  assert.ok(strapi.logs.some(([lvl]) => lvl === 'warn'));
});

test('GUARDRAIL: kein Empfänger-Klartext (PII) im Log', () => {
  const strapi = makeStrapi();
  handlePostalEvent(strapi, { event: 'MessageBounced', payload: { message: { to: 'kundin@example.com', id: 9 } } });
  const blob = strapi.logs.map(([, m]) => m).join('\n');
  assert.ok(!blob.includes('kundin@example.com'), 'Empfänger-Adresse darf nicht im Klartext geloggt werden');
});

test('handlePostalEvent: wirft NIE (best effort) bei kaputtem Payload', () => {
  const strapi = makeStrapi();
  assert.doesNotThrow(() => handlePostalEvent(strapi, null));
  assert.doesNotThrow(() => handlePostalEvent(strapi, { event: 'MessageDelivered' }));
});

// --- Controller/Route/Bootstrap-Verdrahtung (statisch) ---
test('Controller: öffentliche Route (auth:false), Signatur-geprüft, Public-Key aus Env', () => {
  const ctrl = read('strapi', 'src', 'api', 'mail-webhook', 'controllers', 'mail-webhook.ts');
  const route = read('strapi', 'src', 'api', 'mail-webhook', 'routes', 'mail-webhook.ts');
  assert.match(route, /path:\s*'\/mail\/webhook'/);
  assert.match(route, /auth:\s*false/);
  assert.match(ctrl, /POSTAL_WEBHOOK_PUBLIC_KEY/);
  assert.match(ctrl, /verifyPostalSignature/);
  assert.match(ctrl, /unparsedBody/);
});

test('.env.example dokumentiert POSTAL_WEBHOOK_PUBLIC_KEY', () => {
  assert.match(read('strapi', '.env.example'), /POSTAL_WEBHOOK_PUBLIC_KEY/);
});
