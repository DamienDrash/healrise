// Test-first für die Entfernung eines toten Schemafeldes (Audit D-05).
// user.plan_expires_at existiert im users-permissions-User-Schema, wird aber
// NIRGENDWO gesetzt oder ausgewertet (kein Ablauf-/Downgrade-Enforcement). Ein
// persistiertes Ablaufdatum ohne Logik weckt falsche Erwartungen. Dieser Guard
// stellt sicher, dass das Feld entfernt bleibt, solange keine Enforcement-Logik
// existiert. Rein statisch (Schema-JSON), kein Strapi-Lauf, keine DB.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = join(
  ROOT,
  'strapi',
  'src',
  'extensions',
  'users-permissions',
  'content-types',
  'user',
  'schema.json',
);
const GENERATED_TYPES = join(ROOT, 'strapi', 'types', 'generated', 'contentTypes.d.ts');

const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));

test('D-05: user.plan_expires_at darf ohne Enforcement-Logik nicht existieren', () => {
  assert.ok(
    !Object.prototype.hasOwnProperty.call(schema.attributes, 'plan_expires_at'),
    'plan_expires_at ist totes Ablauffeld ohne Setz-/Auswertungslogik — entfernen (D-05)',
  );
});

test('D-05: generierte Typen (contentTypes.d.ts) enthalten plan_expires_at nicht', () => {
  const types = readFileSync(GENERATED_TYPES, 'utf8');
  assert.doesNotMatch(
    types,
    /plan_expires_at/,
    'plan_expires_at ist noch in strapi/types/generated/contentTypes.d.ts — Typreferenz entfernen (D-05)',
  );
});

test('verbleibende Plan-Felder bleiben unangetastet', () => {
  // Der Cleanup entfernt NUR das Ablauffeld; plan/plan_purchased_at bleiben.
  assert.ok(schema.attributes.plan, 'plan-Feld muss erhalten bleiben');
  assert.ok(schema.attributes.plan_purchased_at, 'plan_purchased_at muss erhalten bleiben');
});
