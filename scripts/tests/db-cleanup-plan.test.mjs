// D-01: Read-only Dry-Run-Plan für die Prod-Testdaten-Bereinigung.
// Der Plan IDENTIFIZIERT nur (SELECT/COUNT) — er führt KEIN DELETE/UPDATE aus.
// Echte Bereinigung erfordert explizites Damien-Go (Operator-Blocker). Dieser
// Guard stellt sicher, dass der Plan ausschließlich lesende SQL enthält.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCleanupPlan, CLEANUP_TARGETS } from '../db-cleanup-plan.mjs';

const DESTRUCTIVE = /\b(DELETE|UPDATE|DROP|TRUNCATE|INSERT|ALTER)\b/i;

test('Plan ist standardmäßig Dry-Run (kein automatisches Löschen)', () => {
  const plan = buildCleanupPlan();
  assert.equal(plan.mode, 'dry-run');
  assert.match(plan.requiresExplicitGo, /Damien-Go|DB_CLEANUP_CONFIRM/);
  assert.ok(plan.steps.every((s) => s.action === 'REPORT_ONLY'));
});

test('JEDE Identifikations-Query ist read-only (kein DELETE/UPDATE/…)', () => {
  assert.ok(CLEANUP_TARGETS.length >= 3, 'mehrere Zielmuster erwartet');
  for (const t of CLEANUP_TARGETS) {
    assert.match(t.identify, /^\s*SELECT\b/i, `nicht-SELECT: ${t.id}`);
    assert.doesNotMatch(t.identify, DESTRUCTIVE, `destruktive SQL in ${t.id}`);
  }
});

test('deckt die bekannten Testdaten-Muster ab (cs_test, Testuser, buyer_/iso_)', () => {
  const blob = CLEANUP_TARGETS.map((t) => t.identify).join('\n');
  assert.match(blob, /cs_test/i);
  assert.match(blob, /Testuser/);
  assert.match(blob, /buyer|iso_/i);
});

test('kein destruktives SQL im gesamten Modul (nur Identifikation)', () => {
  const plan = buildCleanupPlan();
  const all = JSON.stringify(plan);
  assert.doesNotMatch(all, DESTRUCTIVE);
});
