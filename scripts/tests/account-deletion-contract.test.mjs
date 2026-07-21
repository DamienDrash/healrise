// Guardrail + Doku-Lock für die Kontolöschung (Roadmap 1.2 / Finding R-02, DSGVO Art. 17).
// Sperrt den Sicherheits-/Datenschutz-Vertrag der Selbst-Löschung statisch und
// stellt sicher, dass die Launch-Doku den realen Weg beschreibt. Kein Strapi-Lauf,
// keine DB. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DELETION = join(ROOT, 'strapi', 'src', 'extensions', 'users-permissions', 'account-deletion.ts');
const SERVER = join(ROOT, 'strapi', 'src', 'extensions', 'users-permissions', 'strapi-server.ts');
const INDEX = join(ROOT, 'strapi', 'src', 'index.ts');
const LAUNCH = join(ROOT, 'docs', 'launch-checklist.md');

const deletion = readFileSync(DELETION, 'utf8');
const server = readFileSync(SERVER, 'utf8');
const index = readFileSync(INDEX, 'utf8');
const launch = readFileSync(LAUNCH, 'utf8');

// ── Sicherheits-/Datenschutz-Vertrag (Regression-Lock, bereits erfüllt) ──
test('Löschung ist atomar in einer DB-Transaktion', () => {
  assert.match(deletion, /strapi\.db\.transaction\(/);
});

test('Fortschrittsdaten (Art. 9) werden restlos gelöscht', () => {
  assert.match(deletion, /PROGRESS_UID\)\.deleteMany\(\{\s*where:\s*\{\s*user:\s*userId/);
});

test('Käufe werden ENTKOPPELT (user→null), NICHT gelöscht (§147 AO Aufbewahrung)', () => {
  assert.match(deletion, /updateMany\(\{[\s\S]*data:\s*\{\s*user:\s*null/);
  // kein Löschen der Purchase-Belege
  assert.doesNotMatch(deletion, /PURCHASE_UID\)\.delete(Many)?\(/);
});

test('SICHERHEIT: nur der eigene Account (ctx.state.user) — kein Body/Param-ID vertraut', () => {
  assert.match(deletion, /ctx\.state[\s.]*user/);
  assert.match(deletion, /deleteAccount\(strapi,\s*user\.id\)/);
  assert.doesNotMatch(deletion, /request\.body/);
  assert.doesNotMatch(deletion, /params\.id/);
});

test('nicht authentifiziert → 401; Erfolg → 204', () => {
  assert.match(deletion, /if\s*\(!user\)\s*return\s*ctx\.unauthorized\(\)/);
  assert.match(deletion, /ctx\.status\s*=\s*204/);
});

test('Route DELETE /users/me/delete (user.deleteMe) ist registriert (unshift)', () => {
  const m = server.match(/routes\.unshift\(([\s\S]*?)\);/);
  assert.ok(m, 'kein routes.unshift-Block gefunden');
  assert.match(m[1], /method:\s*'DELETE',\s*path:\s*'\/users\/me\/delete',\s*handler:\s*'user\.deleteMe'/);
});

test('deleteMe-Permission ist authenticated (nicht public)', () => {
  assert.match(index, /AUTHENTICATED_ACTIONS[\s\S]*plugin::users-permissions\.user\.deleteMe/);
  const pub = index.match(/const PUBLIC_ACTIONS = \[([\s\S]*?)\];/);
  assert.ok(pub && !pub[1].includes('deleteMe'), 'deleteMe darf nicht public sein');
});

// ── Launch-Doku beschreibt den realen Löschweg (DSGVO Art. 17) — RED bis dokumentiert ──
test('Launch-Checkliste dokumentiert den realen Kontolöschungs-Weg', () => {
  assert.match(launch, /Art\.\s*17|Recht auf Löschung/i, 'DSGVO-Löschrecht fehlt in launch-checklist');
  assert.match(launch, /Gefahrenzone/, 'In-App-Pfad (Gefahrenzone) fehlt');
  assert.match(launch, /DELETE \/api\/users\/me\/delete/, 'Endpoint DELETE /api/users/me/delete fehlt');
  assert.match(launch, /entkoppel|§\s*147\s*AO/i, 'Purchase-Entkopplung/Aufbewahrung fehlt');
});
