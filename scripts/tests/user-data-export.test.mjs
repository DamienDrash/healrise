// DSGVO-Selbstauskunft (Art. 15/20): Unit-Tests für den Nutzer-Datenexport.
// Reine Logik, gestubbtes Strapi — KEIN laufendes Strapi, kein Netz. Prüft, dass
// der Export die Nutzerdaten (Account/Käufe/Fortschritt) vollständig zusammenträgt
// UND Auth-Secrets (Passwort-Hash/Tokens) NIE enthält. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  sanitizeUserForExport,
  buildUserDataExport,
  SECRET_USER_FIELDS,
} from '../../strapi/src/extensions/users-permissions/user-data-export.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const USER_UID = 'plugin::users-permissions.user';
const PURCHASE_UID = 'api::purchase.purchase';
const PROGRESS_UID = 'api::progress.progress-entry';

const FULL_USER = {
  id: 7,
  username: 'kundin',
  email: 'kundin@example.com',
  provider: 'local',
  password: '$2a$HASH',
  resetPasswordToken: 'reset-xyz',
  confirmationToken: 'conf-xyz',
  confirmed: true,
  blocked: false,
  plan: 'premium',
  plan_purchased_at: '2026-07-01T00:00:00.000Z',
  health_consent_at: '2026-07-01T00:00:00.000Z',
  stripe_customer_id: 'cus_123',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function makeStrapi({ user = FULL_USER, purchases = [], progress = [] } = {}) {
  return {
    log: { info() {}, warn() {}, error() {} },
    db: {
      query: (uid) => ({
        findOne: async ({ where }) => (uid === USER_UID && where.id === user?.id ? user : null),
        findMany: async () => (uid === PURCHASE_UID ? purchases : uid === PROGRESS_UID ? progress : []),
      }),
    },
  };
}

// --- Sanitizer ---
test('sanitizeUserForExport entfernt ALLE Auth-Secrets', () => {
  const out = sanitizeUserForExport(FULL_USER);
  for (const secret of ['password', 'resetPasswordToken', 'confirmationToken']) {
    assert.equal(secret in out, false, `Secret ${secret} darf nicht im Export sein`);
  }
  // Nutzerdaten bleiben erhalten (Art.-15-Vollständigkeit).
  assert.equal(out.email, 'kundin@example.com');
  assert.equal(out.plan, 'premium');
  assert.equal(out.health_consent_at, '2026-07-01T00:00:00.000Z');
});

test('SECRET_USER_FIELDS deckt Passwort + Tokens ab', () => {
  for (const f of ['password', 'resetPasswordToken', 'confirmationToken']) {
    assert.ok(SECRET_USER_FIELDS.includes(f), `${f} muss als Secret gelistet sein`);
  }
});

// --- Aggregation ---
test('buildUserDataExport trägt Account + Käufe + Fortschritt zusammen', async () => {
  const purchases = [{ id: 1, user: { id: 7 }, plan: 'premium', amount_total: 39900, currency: 'eur', status: 'completed', stripe_session_id: 'cs_1' }];
  const progress = [{ id: 1, user: { id: 7 }, program_slug: 'rueckenfit', completed_at: '2026-07-02T00:00:00.000Z' }];
  const data = await buildUserDataExport(makeStrapi({ purchases, progress }), 7);
  assert.ok(data.account, 'account fehlt');
  assert.equal(data.account.password, undefined, 'kein Passwort im Account');
  assert.equal(data.purchases.length, 1);
  assert.equal(data.purchases[0].plan, 'premium');
  assert.equal(data.purchases[0].user, undefined, 'redundante user-Relation entfernt');
  assert.equal(data.progress.length, 1);
  assert.equal(data.progress[0].program_slug, 'rueckenfit');
  assert.equal(data.progress[0].user, undefined);
});

test('buildUserDataExport: unbekannter User → null', async () => {
  const data = await buildUserDataExport(makeStrapi(), 999);
  assert.equal(data, null);
});

test('GUARDRAIL nicht vakuum: Export eines User-Objekts MIT Secret trägt es NICHT', async () => {
  const data = await buildUserDataExport(makeStrapi(), 7);
  const blob = JSON.stringify(data);
  assert.ok(!blob.includes('$2a$HASH'), 'Passwort-Hash geleakt');
  assert.ok(!blob.includes('reset-xyz') && !blob.includes('conf-xyz'), 'Token geleakt');
});

// --- Verdrahtung (statisch) ---
test('Extension: exportMe-Controller + Route GET /users/me/export', () => {
  const ext = read('strapi', 'src', 'extensions', 'users-permissions', 'strapi-server.ts');
  assert.match(ext, /user\.exportMe\s*=/);
  assert.match(ext, /method:\s*'GET'/);
  assert.match(ext, /path:\s*'\/users\/me\/export'/);
  assert.match(ext, /handler:\s*'user\.exportMe'/);
});

test('Bootstrap: exportMe ist authenticated-permission (kein Public)', () => {
  const index = read('strapi', 'src', 'index.ts');
  const authBlock = index.slice(index.indexOf('AUTHENTICATED_ACTIONS'), index.indexOf('PUBLIC_ACTIONS'));
  assert.match(authBlock, /user\.exportMe/);
});
