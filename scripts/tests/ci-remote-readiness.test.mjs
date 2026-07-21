// O-02: Git-Remote/CI-Readiness (lokal, ohne GitHub-/Netz-Aktion).
// Sichert die CI-Vorlage (Pflicht-Jobs/-Schritte, secret-frei) statisch ab und
// hält fest, dass das private Remote + der erste Push/CI-Lauf ein Betreiber-
// Schritt (Damien-Go) sind. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { assessCiTemplate, remoteConfigured } from '../ci-remote-readiness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const CI = read('docs', 'ci-github-actions.yml');
const AUDIT = read('docs', 'production-readiness-audit.md');
const CHECKLIST = read('docs', 'launch-checklist.md');

test('CI-Vorlage ist ready: Pflicht-Jobs, -Schritte, secret-frei', () => {
  const r = assessCiTemplate(CI);
  assert.equal(r.ready, true, `Blocker: ${r.blockers.join('; ')}`);
  assert.equal(r.secretFree, true);
});

test('CI-Vorlage hat frontend + backend-api Jobs und lint/test/build', () => {
  assert.match(CI, /^\s{2}frontend:/m);
  assert.match(CI, /^\s{2}backend-api:/m);
  assert.match(CI, /npm run lint/);
  assert.match(CI, /npm test|npm run test/);
  assert.match(CI, /npm run build/);
  assert.match(CI, /on:\s*[\s\S]*push/);
});

test('GUARDRAIL: assessCiTemplate erkennt ein echtes Secret-Muster (nicht vakuum)', () => {
  const poisoned = CI + '\n  token: ghp_' + 'A'.repeat(36) + '\n';
  const r = assessCiTemplate(poisoned);
  assert.equal(r.secretFree, false);
  assert.equal(r.ready, false);
});

test('remoteConfigured: leer = nicht konfiguriert (Betreiber-Schritt)', () => {
  assert.equal(remoteConfigured(''), false);
  assert.equal(remoteConfigured('origin\tgit@github.com:x/y.git (push)'), true);
});

test('Docs markieren O-02 lokal vorbereitet + Betreiber-blockiert', () => {
  const o02 = AUDIT.match(/\| \*\*O-02\*\*.*/);
  assert.ok(o02, 'O-02-Zeile im Audit');
  assert.match(o02[0], /vorbereitet.*ci-remote-readiness|ci-remote-readiness/i, 'Audit nennt das Readiness-Artefakt nicht');
  assert.match(o02[0], /Betreiber|Damien-Go/i, 'Audit markiert Betreiber-Blocker nicht');
  assert.match(CHECKLIST, /ci-remote-readiness/, 'Checkliste nennt den Readiness-Command nicht');
});
