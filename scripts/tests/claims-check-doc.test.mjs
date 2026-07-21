// Doku↔Skript-Vertrag für den Live-CMS-Claims-Check (Roadmap 0.6 / Audit R-03).
// Sperrt (1) den Output-/Exit-Vertrag von scripts/claims-check.mjs, auf den die
// Release-Doku verweist, und (2) dass die Doku R-03 als live-verifiziert
// dokumentiert (Befehl + 0 Treffer + Datum). Rein statisch, kein DB-/Netz-Zugriff.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = readFileSync(join(ROOT, 'scripts', 'claims-check.mjs'), 'utf8');
const ROADMAP = readFileSync(join(ROOT, 'docs', 'production-readiness-roadmap.md'), 'utf8');
const AUDIT = readFileSync(join(ROOT, 'docs', 'production-readiness-audit.md'), 'utf8');

test('claims-check Output-/Exit-Vertrag ist stabil (Doku-Referenz)', () => {
  assert.match(SCRIPT, /0 Treffer gegen die .* \(docs\/claims-richtlinie\.md\)/);
  assert.match(SCRIPT, /✅/);
  assert.match(SCRIPT, /process\.exit\(0\)/, 'Erfolg → Exit 0');
  assert.match(SCRIPT, /process\.exit\(1\)/, 'Verstoß → Exit 1');
});

test('Roadmap dokumentiert R-03 als live-verifiziert (Befehl + 0 Treffer + Datum)', () => {
  assert.match(ROADMAP, /scripts\/claims-check\.mjs/);
  assert.match(ROADMAP, /0 Treffer/);
  assert.match(ROADMAP, /2026-07-16/);
});

test('Audit-R-03-Zeile spiegelt die Live-Verifikation', () => {
  const row = AUDIT.match(/\| \*\*R-03\*\*.*/);
  assert.ok(row, 'R-03-Zeile im Audit gefunden');
  assert.match(row[0], /live[- ]?verifiziert|2026-07-16|0 Treffer/i);
});
