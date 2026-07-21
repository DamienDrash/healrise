// Test-first für die Passwort-Reset-Link-Konfiguration (Roadmap P3.1).
// Der users-permissions-forgotPassword-Flow baut den Reset-Link aus
// advancedSettings.email_reset_password (server/controllers/auth.js). Das
// Plugin seedet diesen Wert als null → Links zeigen ins Leere / auf falsche
// Admin-URLs. Dieser Slice leitet die URL deterministisch aus APP_PUBLIC_URL +
// PASSWORD_RESET_PATH ab und schreibt sie beim Bootstrap idempotent in den
// Plugin-Store, sodass Reset-Links auf die App-Reset-Seite zeigen.
// Rein lokal, kein Strapi-Lauf, kein Mailversand, keine echten Adressen.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { passwordResetUrl, applyPasswordResetUrl } from '../../strapi/src/password-reset-url.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV_EXAMPLE = join(ROOT, 'strapi', '.env.example');

/** env-Helfer-Mock: env(key, default). */
function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

/** Mock-Plugin-Store, der advanced-Settings hält und set()-Aufrufe protokolliert. */
function makeStrapi(advanced = {}) {
  const state = { advanced };
  const sets = [];
  return {
    _state: state,
    _sets: sets,
    log: { info() {} },
    store: () => ({
      get: async ({ key }) => state[key],
      set: async ({ key, value }) => {
        state[key] = value;
        sets.push({ key, value });
      },
    }),
  };
}

test('passwordResetUrl: sichere Defaults (App-URL + Reset-Pfad reset-password)', () => {
  assert.equal(
    passwordResetUrl(makeEnv()),
    'https://services.frigew.ski/healrise/app/reset-password',
  );
});

test('passwordResetUrl: FRONTEND_URL (P3.1) hat Vorrang vor APP_PUBLIC_URL', () => {
  const url = passwordResetUrl(
    makeEnv({ FRONTEND_URL: 'https://app.healrise.de', APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app' }),
  );
  assert.equal(url, 'https://app.healrise.de/reset-password');
});

test('passwordResetUrl: aus APP_PUBLIC_URL + PASSWORD_RESET_PATH, Slashes normalisiert', () => {
  const url = passwordResetUrl(
    makeEnv({ APP_PUBLIC_URL: 'https://example.com/healrise/app/', PASSWORD_RESET_PATH: '/reset' }),
  );
  assert.equal(url, 'https://example.com/healrise/app/reset');
});

test('passwordResetUrl zeigt auf die App, nicht auf CMS/Admin', () => {
  const url = passwordResetUrl(makeEnv({ APP_PUBLIC_URL: 'https://example.com/healrise/app' }));
  assert.doesNotMatch(url, /\/cms|\/admin/);
});

test('applyPasswordResetUrl schreibt die env-URL idempotent in den Plugin-Store', async () => {
  const strapi = makeStrapi({ email_reset_password: null, unique_email: true, default_role: 'authenticated' });
  const url = await applyPasswordResetUrl(strapi, makeEnv({ APP_PUBLIC_URL: 'https://example.com/healrise/app' }));

  assert.equal(url, 'https://example.com/healrise/app/reset-password');
  assert.equal(strapi._state.advanced.email_reset_password, url);
  // andere advanced-Settings bleiben erhalten
  assert.equal(strapi._state.advanced.unique_email, true);
  assert.equal(strapi._state.advanced.default_role, 'authenticated');
  assert.equal(strapi._sets.length, 1, 'genau ein set-Aufruf beim ersten Setzen');
});

test('applyPasswordResetUrl ist idempotent: kein erneutes set bei gleichem Wert', async () => {
  const env = makeEnv({ APP_PUBLIC_URL: 'https://example.com/healrise/app' });
  const url = passwordResetUrl(env);
  const strapi = makeStrapi({ email_reset_password: url, unique_email: true });
  await applyPasswordResetUrl(strapi, env);
  assert.equal(strapi._sets.length, 0, 'unveränderter Wert → kein Store-Write');
});

test('.env.example dokumentiert APP_PUBLIC_URL und PASSWORD_RESET_PATH', () => {
  const env = readFileSync(ENV_EXAMPLE, 'utf8');
  assert.match(env, /^#?\s*APP_PUBLIC_URL=/m, 'APP_PUBLIC_URL fehlt');
  assert.match(env, /^#?\s*PASSWORD_RESET_PATH=/m, 'PASSWORD_RESET_PATH fehlt');
});
