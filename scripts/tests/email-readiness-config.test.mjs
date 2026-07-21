// Test-first für die lokale E-Mail-/Postal-Readiness (P3.1).
// Reine Validierung der SMTP/Postal-Env-Konfiguration OHNE echte SMTP-Verbindung,
// kein Mailversand, keine Secrets im Output. Parallel zu validateStripeConfig
// (P3.2): meldet Blocker (fehlende/inkonsistente Pflichtwerte) und Warnungen und
// unterscheidet lokalen Betrieb von „echter Zustellung" (forRealDelivery).
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateEmailConfig } from '../../strapi/src/email-config.ts';

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

// Gültige lokale Postal-Konfiguration (localhost:25, ohne Auth) — nur Platzhalter.
const LOCAL_OK = {
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '25',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'no-reply@example.com',
  SMTP_REPLY_TO: 'support@example.com',
  APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app',
};

test('lokale Postal-Konfiguration ohne Auth ist ready (keine Blocker)', () => {
  const r = validateEmailConfig(makeEnv(LOCAL_OK));
  assert.equal(r.ready, true, `unerwartete Blocker: ${r.blockers.join('; ')}`);
  assert.equal(r.blockers.length, 0);
});

test('DEFAULT_FROM (M-01) wird als Absender akzeptiert (ohne SMTP_FROM/EMAIL_DEFAULT_FROM)', () => {
  const r = validateEmailConfig(makeEnv({
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '25',
    SMTP_SECURE: 'false',
    DEFAULT_FROM: 'no-reply@healrise.de',
    DEFAULT_REPLY_TO: 'support@healrise.de',
    FRONTEND_URL: 'https://services.frigew.ski/healrise/app',
  }));
  assert.equal(r.ready, true, `unerwartete Blocker: ${r.blockers.join('; ')}`);
});

test('P3.1-Keys (EMAIL_DEFAULT_FROM + FRONTEND_URL, ohne SMTP_FROM/APP_PUBLIC_URL) sind ready', () => {
  const r = validateEmailConfig(makeEnv({
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '25',
    SMTP_SECURE: 'false',
    EMAIL_DEFAULT_FROM: 'no-reply@healrise.de',
    EMAIL_DEFAULT_REPLY_TO: 'support@healrise.de',
    FRONTEND_URL: 'https://services.frigew.ski/healrise/app',
  }));
  assert.equal(r.ready, true, `unerwartete Blocker: ${r.blockers.join('; ')}`);
});

test('SMTP_FROM fehlend/ungültig ist ein Blocker (nur Namen im Text)', () => {
  assert.equal(validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_FROM: '' })).ready, false);
  const bad = validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_FROM: 'kaputt' }));
  assert.equal(bad.ready, false);
  assert.ok(bad.blockers.some((b) => b.includes('SMTP_FROM')));
});

test('GUARDRAIL: unvollständiges Auth-Paar (nur User ODER nur Passwort) blockt', () => {
  const onlyUser = validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_USERNAME: 'mailer' }));
  assert.equal(onlyUser.ready, false);
  assert.ok(onlyUser.blockers.some((b) => b.includes('SMTP_USERNAME') || b.includes('SMTP_PASSWORD')));

  const onlyPass = validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_PASSWORD: 'x' }));
  assert.equal(onlyPass.ready, false);

  const both = validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_USERNAME: 'mailer', SMTP_PASSWORD: 'x' }));
  assert.equal(both.ready, true, `unerwartete Blocker: ${both.blockers.join('; ')}`);
});

test('SMTP_PORT muss eine positive Ganzzahl sein', () => {
  const r = validateEmailConfig(makeEnv({ ...LOCAL_OK, SMTP_PORT: 'abc' }));
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => b.includes('SMTP_PORT')));
});

test('Reset-Basis (APP_PUBLIC_URL) muss auf die App zeigen, nicht /cms|/admin', () => {
  assert.equal(validateEmailConfig(makeEnv({ ...LOCAL_OK, APP_PUBLIC_URL: 'https://x/healrise/app/cms' })).ready, false);
  assert.equal(validateEmailConfig(makeEnv({ ...LOCAL_OK, APP_PUBLIC_URL: '/relativ' })).ready, false);
});

test('GUARDRAIL: Secrets tauchen NIE in blockers/warnings auf', () => {
  const r = validateEmailConfig(
    makeEnv({ ...LOCAL_OK, SMTP_USERNAME: 'realuser', SMTP_PASSWORD: 'p@ss-secret-123', SMTP_PORT: 'abc' }),
  );
  const blob = [...r.blockers, ...r.warnings].join('\n');
  assert.ok(!blob.includes('p@ss-secret-123'), 'Passwort geleakt');
  assert.ok(!blob.includes('realuser'), 'Username geleakt');
});

test('forRealDelivery: Loopback-Host ist für echte Zustellung ein Blocker', () => {
  const local = validateEmailConfig(makeEnv(LOCAL_OK), { forRealDelivery: true });
  assert.equal(local.ready, false);
  assert.ok(local.blockers.some((b) => b.includes('SMTP_HOST')));
});

test('forRealDelivery: echter Host OHNE SMTP_USERNAME/PASSWORD ist ein Blocker', () => {
  const r = validateEmailConfig(
    makeEnv({ ...LOCAL_OK, SMTP_HOST: 'postal.example.net', SMTP_PORT: '587', SMTP_SECURE: 'true' }),
    { forRealDelivery: true },
  );
  assert.equal(r.ready, false, 'ohne Auth darf echte Zustellung nicht ready sein');
  assert.ok(
    r.blockers.some((b) => b.includes('SMTP_USERNAME') || b.includes('SMTP_PASSWORD')),
    'Blocker muss SMTP_USERNAME/SMTP_PASSWORD nennen',
  );
});

test('forRealDelivery: echter Host + From ist ready', () => {
  const r = validateEmailConfig(
    makeEnv({ ...LOCAL_OK, SMTP_HOST: 'postal.example.net', SMTP_PORT: '587', SMTP_SECURE: 'true', SMTP_USERNAME: 'u', SMTP_PASSWORD: 'p' }),
    { forRealDelivery: true },
  );
  assert.equal(r.ready, true, `unerwartete Blocker: ${r.blockers.join('; ')}`);
});
