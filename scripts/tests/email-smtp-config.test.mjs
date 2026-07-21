// P3.1: TDD-Guard für die reine SMTP-Konfig-Logik des Ping-Skripts
// (scripts/tests/test_email_config.mjs). Prüft NUR die Env-Gate-Logik — KEIN
// Netzwerk, KEIN nodemailer-Connect, KEINE Mail. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { smtpConfigFromEnv } from './test_email_config.mjs';

test('ohne Env: schlägt fehl, meldet fehlende Pflicht-Keys (keine Secrets)', () => {
  const r = smtpConfigFromEnv({});
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes('SMTP_HOST'));
  assert.ok(r.missing.includes('SMTP_PORT'));
  assert.equal(r.transport, null);
});

test('mit Env-Dummy (Host+Port): geht durch, baut Transport-Config', () => {
  const r = smtpConfigFromEnv({ SMTP_HOST: 'postal.local', SMTP_PORT: '587', SMTP_SECURE: 'true' });
  assert.equal(r.ok, true);
  assert.equal(r.transport.host, 'postal.local');
  assert.equal(r.transport.port, 587);
  assert.equal(r.transport.secure, true);
});

test('Auth-Paar: nur USERNAME ohne PASSWORD → Blocker', () => {
  const r = smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_PORT: '25', SMTP_USERNAME: 'u' });
  assert.equal(r.ok, false);
});

test('mit Auth: Transport enthält auth.user/pass', () => {
  const r = smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_PORT: '25', SMTP_USERNAME: 'u', SMTP_PASSWORD: 'p' });
  assert.equal(r.ok, true);
  assert.equal(r.transport.auth.user, 'u');
  assert.equal(r.transport.auth.pass, 'p');
});

test('lokales Postal ohne Auth (nur Host+Port) ist erlaubt', () => {
  const r = smtpConfigFromEnv({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '25' });
  assert.equal(r.ok, true);
  assert.equal(r.transport.auth, undefined);
});
