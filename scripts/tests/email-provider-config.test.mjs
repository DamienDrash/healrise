// Test-first für die Strapi-E-Mail-Provider-Konfiguration (Audit M-01).
// Strapi braucht einen konfigurierten E-Mail-Provider, damit Passwort-Reset-
// und spätere Pflicht-Mails (§312f) überhaupt versendet werden können. Dieser
// Slice legt nur den Konfig-/Env-Pfad an (kein echter Versand): geprüft wird,
// dass config/plugins.ts den nodemailer-Provider aus SMTP_*-Env aufbaut, der
// users-permissions-jwtSecret erhalten bleibt, .env.example die SMTP_*-
// Platzhalter dokumentiert und die Provider-Dependency eingetragen ist.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import pluginsConfig from '../../strapi/config/plugins.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV_EXAMPLE = join(ROOT, 'strapi', '.env.example');
const PKG = join(ROOT, 'strapi', 'package.json');

const SMTP_ENVS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USERNAME',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'SMTP_REPLY_TO',
  'SMTP_SECURE',
];

/** Mock des Strapi-env-Helfers (env(key, def) + env.int + env.bool). */
function makeEnv(vars = {}) {
  const env = (key, def) => (key in vars ? vars[key] : def);
  env.int = (key, def) => (key in vars ? parseInt(vars[key], 10) : def);
  env.bool = (key, def) =>
    key in vars ? vars[key] === true || vars[key] === 'true' : def;
  return env;
}

function build(vars) {
  return pluginsConfig({ env: makeEnv(vars) });
}

test('users-permissions jwtSecret bleibt erhalten (aus JWT_SECRET)', () => {
  const cfg = build({ JWT_SECRET: 'secret-xyz' });
  assert.equal(cfg['users-permissions'].config.jwtSecret, 'secret-xyz');
});

test('email-Plugin nutzt den nodemailer-Provider', () => {
  const cfg = build({});
  assert.ok(cfg.email, 'email-Plugin-Konfiguration fehlt (M-01)');
  assert.equal(cfg.email.config.provider, 'nodemailer');
});

test('providerOptions kommen aus SMTP_*-Env', () => {
  const cfg = build({
    SMTP_HOST: 'smtp.internal',
    SMTP_PORT: '587',
    SMTP_SECURE: 'true',
    SMTP_USERNAME: 'mailer',
    SMTP_PASSWORD: 'pw',
  });
  const opts = cfg.email.config.providerOptions;
  assert.equal(opts.host, 'smtp.internal');
  assert.equal(opts.port, 587);
  assert.equal(opts.secure, true);
  assert.equal(opts.auth.user, 'mailer');
  assert.equal(opts.auth.pass, 'pw');
});

test('SMTP_SECURE ist boolean-ish (Default false, "true" → true)', () => {
  assert.equal(build({}).email.config.providerOptions.secure, false);
  assert.equal(build({ SMTP_SECURE: 'true' }).email.config.providerOptions.secure, true);
});

test('unkritische localhost-Defaults ohne gesetzte Env (kein Secret)', () => {
  const opts = build({}).email.config.providerOptions;
  assert.equal(opts.host, 'localhost');
  assert.equal(opts.port, 25);
});

test('settings.defaultFrom/defaultReplyTo kommen aus SMTP_FROM/SMTP_REPLY_TO', () => {
  const cfg = build({ SMTP_FROM: 'no-reply@h.test', SMTP_REPLY_TO: 'support@h.test' });
  assert.equal(cfg.email.config.settings.defaultFrom, 'no-reply@h.test');
  assert.equal(cfg.email.config.settings.defaultReplyTo, 'support@h.test');
});

test('settings.defaultFrom/replyTo: DEFAULT_FROM/DEFAULT_REPLY_TO haben Vorrang', () => {
  const cfg = build({
    DEFAULT_FROM: 'from@a.test',
    DEFAULT_REPLY_TO: 'reply@a.test',
    EMAIL_DEFAULT_FROM: 'from@b.test',
    SMTP_FROM: 'from@c.test',
  });
  assert.equal(cfg.email.config.settings.defaultFrom, 'from@a.test');
  assert.equal(cfg.email.config.settings.defaultReplyTo, 'reply@a.test');
});

test('.env.example dokumentiert alle SMTP_*-Platzhalter', () => {
  const env = readFileSync(ENV_EXAMPLE, 'utf8');
  for (const name of SMTP_ENVS) {
    assert.match(env, new RegExp(`^#?\\s*${name}=`, 'm'), `${name} fehlt in .env.example`);
  }
});

test('Provider-Dependency @strapi/provider-email-nodemailer ist eingetragen', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
  assert.ok(
    pkg.dependencies?.['@strapi/provider-email-nodemailer'],
    'Dependency @strapi/provider-email-nodemailer fehlt in strapi/package.json',
  );
});
