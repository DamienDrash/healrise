// P4.3 / L-03/L-04: Guard für die reduzierte Strapi-Admin-Rolle „HEALRISE
// Betrieb" (Damien als NICHT-Super-Admin, nur Kunden + Produkte). Prüft (1) den
// Scope als Allowlist (nur Content-Manager auf User/Purchase/Program, KEINE
// Settings/Media/CTB/Admin-Rechte) und (2) das idempotente, best-effort Seeding
// gegen einen gestubbten admin::role-Service — KEIN echter Strapi-Lauf, kein
// Admin-Login. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  BETRIEB_ROLE,
  SUPER_ADMIN_CODE,
  ALLOWED_SUBJECTS,
  SCOPED_PERMISSIONS,
  FORBIDDEN_ACTION_PREFIXES,
  validateAdminRoleScope,
  applyBetriebAdminRole,
} from '../../strapi/src/admin-role-scope.ts';

const CM = 'plugin::content-manager.explorer';

// --- Rollen-Metadaten ---
test('Rolle ist unprivilegiert (nicht der Super-Admin-Code)', () => {
  assert.equal(BETRIEB_ROLE.code, 'healrise-betrieb');
  assert.notEqual(BETRIEB_ROLE.code, SUPER_ADMIN_CODE);
  assert.match(BETRIEB_ROLE.name, /HEALRISE Betrieb/);
});

// --- Scope-Allowlist ---
test('Scope: nur Content-Manager-Actions auf erlaubten Subjects (Kunden + Produkte)', () => {
  const { ok, violations } = validateAdminRoleScope(SCOPED_PERMISSIONS);
  assert.equal(ok, true, `Scope-Verletzungen: ${violations.join(', ')}`);
  for (const p of SCOPED_PERMISSIONS) {
    assert.ok(p.action.startsWith(`${CM}.`), `nicht-CM-Action: ${p.action}`);
    assert.ok(ALLOWED_SUBJECTS.includes(p.subject), `fremdes Subject: ${p.subject}`);
  }
});

test('Scope: exakt die drei Subjects Kunden(User+Purchase) + Produkte(Program)', () => {
  const subjects = new Set(SCOPED_PERMISSIONS.map((p) => p.subject));
  assert.deepEqual(
    [...subjects].sort(),
    ['api::program.program', 'api::purchase.purchase', 'plugin::users-permissions.user'].sort(),
  );
});

test('Scope: Produkte editierbar (CRUD+publish), Käufe nur lesbar, Nutzer ohne Löschen', () => {
  const actionsFor = (subj) =>
    SCOPED_PERMISSIONS.filter((p) => p.subject === subj).map((p) => p.action.replace(`${CM}.`, '')).sort();
  assert.deepEqual(actionsFor('api::program.program'), ['create', 'delete', 'publish', 'read', 'update'].sort());
  assert.deepEqual(actionsFor('api::purchase.purchase'), ['read']);
  assert.deepEqual(actionsFor('plugin::users-permissions.user'), ['read', 'update'].sort());
});

test('Scope enthält KEINE verbotenen Rechte (Settings/Media/CTB/Admin/Rollen)', () => {
  for (const p of SCOPED_PERMISSIONS) {
    for (const pre of FORBIDDEN_ACTION_PREFIXES) {
      assert.ok(!p.action.startsWith(pre), `verbotene Action im Scope: ${p.action}`);
    }
  }
});

test('GUARDRAIL nicht vakuum: Validator fängt Settings-/Upload-Rechte', () => {
  const bad = [
    { action: 'admin::settings.read', subject: 'api::program.program' },
    { action: 'plugin::upload.read', subject: 'plugin::upload.file' },
  ];
  const { ok, violations } = validateAdminRoleScope(bad);
  assert.equal(ok, false);
  assert.ok(violations.some((v) => v.includes('admin::settings.read')));
  assert.ok(violations.some((v) => v.includes('plugin::upload.read')));
});

// --- Best-effort-Seeding gegen Mock-admin::role-Service ---
function makeStrapi({ existingRole = null, failCreate = false } = {}) {
  const calls = { create: [], assign: [], findOne: [] };
  const roleService = {
    findOne: async (params) => { calls.findOne.push(params); return existingRole; },
    create: async (attrs) => {
      calls.create.push(attrs);
      if (failCreate) throw new Error('create failed (stub)');
      return { id: 42, ...attrs };
    },
    assignPermissions: async (roleId, perms) => { calls.assign.push({ roleId, perms }); },
  };
  return {
    calls,
    log: { info() {}, warn() {}, error() {} },
    service: (uid) => (uid === 'admin::role' ? roleService : undefined),
  };
}

test('Seed: legt Rolle an und weist exakt den Scope zu (created=true)', async () => {
  const strapi = makeStrapi();
  const res = await applyBetriebAdminRole(strapi);
  assert.deepEqual(res, { applied: true, created: true });
  assert.equal(strapi.calls.create.length, 1);
  assert.equal(strapi.calls.create[0].code, 'healrise-betrieb');
  assert.equal(strapi.calls.assign.length, 1);
  assert.equal(strapi.calls.assign[0].roleId, 42);
  assert.deepEqual(strapi.calls.assign[0].perms, SCOPED_PERMISSIONS);
});

test('Seed ist idempotent: existierende Rolle wird nicht neu angelegt (created=false)', async () => {
  const strapi = makeStrapi({ existingRole: { id: 7, code: 'healrise-betrieb' } });
  const res = await applyBetriebAdminRole(strapi);
  assert.deepEqual(res, { applied: true, created: false });
  assert.equal(strapi.calls.create.length, 0, 'kein erneutes create');
  assert.equal(strapi.calls.assign[0].roleId, 7, 'Scope wird erneut (idempotent) zugewiesen');
});

test('Seed best-effort: fehlender admin::role-Service → kein Wurf, applied=false', async () => {
  const strapi = { log: { warn() {}, error() {}, info() {} }, service: () => undefined };
  let res;
  await assert.doesNotReject(async () => { res = await applyBetriebAdminRole(strapi); });
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'no-service');
});

test('Seed best-effort: Fehler beim Anlegen wirft NICHT (Boot nicht gefährdet)', async () => {
  const strapi = makeStrapi({ failCreate: true });
  let res;
  await assert.doesNotReject(async () => { res = await applyBetriebAdminRole(strapi); });
  assert.equal(res.applied, false);
  assert.equal(res.reason, 'error');
});

// --- Bootstrap-Verdrahtung ---
test('Bootstrap ruft applyBetriebAdminRole auf', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const index = readFileSync(join(ROOT, 'strapi', 'src', 'index.ts'), 'utf8');
  assert.match(index, /import \{ applyBetriebAdminRole \} from '\.\/admin-role-scope'/);
  assert.match(index, /await applyBetriebAdminRole\(strapi\)/);
});

// --- Doku↔Code-Contract ---
test('docs/admin-roles.md dokumentiert Scope, Betreiber-Blocker und CE/EE-Realität', () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const doc = readFileSync(join(ROOT, 'docs', 'admin-roles.md'), 'utf8');
  assert.match(doc, /HEALRISE Betrieb/);
  // Betreiber-Blocker: Damien einladen + Rolle zuweisen (GUI)
  assert.match(doc, /Betreiber-Blocker/i);
  assert.match(doc, /Invite new user|einladen/i);
  // Scope-Bereiche + Menü-Reduktion
  for (const kw of [/Kunden/, /Produkte/, /Media Library/, /Content-Type Builder/, /Settings/]) {
    assert.match(doc, kw);
  }
  // CE/EE-Realität + Editor-Fallback
  assert.match(doc, /Community Edition|CE\/EE|Enterprise/);
  assert.match(doc, /Editor/);
});
