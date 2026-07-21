// P3.1 / M-01: Guard für die Postal/SMTP-Betreiber-Doku + Env-Vollständigkeit.
// Stellt sicher, dass docs/postal_setup.md alle nötigen Env-Keys, den
// Reset-Link-Aufbau, den lokalen Verify-Weg und Postal/SPF/DKIM dokumentiert —
// secret-frei (keine echten Zugangsdaten). Rein statisch. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const GUIDE = read('docs', 'postal_setup.md');
const ENV = read('strapi', '.env.example');

test('Setup-Guide dokumentiert alle SMTP/Mail/Reset-Env-Keys', () => {
  for (const key of [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USERNAME', 'SMTP_PASSWORD',
    'DEFAULT_FROM', 'DEFAULT_REPLY_TO', 'FRONTEND_URL', 'PASSWORD_RESET_PATH',
  ]) {
    assert.match(GUIDE, new RegExp(key), `Guide nennt ${key} nicht`);
  }
});

test('Setup-Guide beschreibt Postal, SPF/DKIM und den Reset-Link', () => {
  assert.match(GUIDE, /Postal/i);
  assert.match(GUIDE, /SPF/);
  assert.match(GUIDE, /DKIM/);
  assert.match(GUIDE, /reset-password/);
});

test('Setup-Guide dokumentiert Return-Path/Bounce-Domain (SPF-Alignment/DMARC)', () => {
  assert.match(GUIDE, /Return-Path/i, 'Return-Path/Bounce-Domain fehlt in der DNS-Sektion');
  // Bounce-Domain braucht in Postal typ. einen CNAME (+ ggf. MX) und begründet
  // das SPF-Alignment für DMARC-Pass.
  assert.match(GUIDE, /CNAME/i);
  assert.match(GUIDE, /Alignment|DMARC/i);
});

test('Setup-Guide erklärt From-Header-Verhalten bei Postal-Override (kein Code-Eingriff)', () => {
  assert.match(GUIDE, /From-Header/i, 'From-Header/Override-Verhalten fehlt');
  assert.match(GUIDE, /DEFAULT_FROM/);
  assert.match(GUIDE, /verifizier/i, 'Domain-Verifikation als Bedingung fehlt');
});

test('Setup-Guide nennt den lokalen Verify-Weg (kein echter Mailversand)', () => {
  assert.match(GUIDE, /test_email_config\.mjs/);
  assert.match(GUIDE, /SMTP_PING/);
});

test('GUARDRAIL: Guide enthält keine echten Zugangsdaten/Secrets', () => {
  assert.doesNotMatch(GUIDE, /tobemodified/);
  assert.doesNotMatch(GUIDE, /SMTP_PASSWORD\s*=\s*['"]?[A-Za-z0-9]{6,}/);
  assert.doesNotMatch(GUIDE, /-----BEGIN [A-Z ]*PRIVATE KEY/);
});

test('.env.example enthält die Mail-Keys (Konsistenz)', () => {
  for (const key of ['SMTP_HOST', 'EMAIL_DEFAULT_FROM', 'FRONTEND_URL']) {
    assert.match(ENV, new RegExp(`^#?\\s*${key}=`, 'm'), `${key} fehlt in .env.example`);
  }
});
