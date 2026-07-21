// Test-first für die Live-CMS-Claims-Prüfung (Roadmap 0.6 / Audit R-03).
// Geprüft wird die reine Detektor-Logik `findClaimViolations` aus
// scripts/claims-check.mjs: sie bekommt Programm-Datensätze (wie sie der
// Live-CMS-Dump liefert) und meldet jede sichtbare Formulierung, die gegen
// die ❌-Liste in docs/claims-richtlinie.md verstößt. Kein DB-/Netzzugriff.
// Ausführen: node --test scripts/tests/claims-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClaimViolations, loadPg } from '../claims-check.mjs';

// Ein sauberes, bereits bereinigtes Wellness-Programm (Safe Harbor).
const clean = {
  slug: 'willkommen',
  title: 'Willkommen bei HEALRISE',
  description: 'Sanfte Bewegung und Selfcare für deinen aktiven Alltag.',
  body: 'Dieses Programm unterstützt dein allgemeines Wohlbefinden.',
  category: 'allgemein',
};

test('saubere Programme → keine Violations', () => {
  assert.deepEqual(findClaimViolations([clean]), []);
});

test('Therapie-Claim in description wird erkannt', () => {
  const v = findClaimViolations([
    { ...clean, slug: 'reha', description: 'Dieses Programm lindert und entspannt.' },
  ]);
  assert.equal(v.length, 1, 'genau eine Violation erwartet');
  assert.equal(v[0].slug, 'reha');
  assert.equal(v[0].field, 'description');
  assert.match(v[0].match, /lindert/i);
});

test('verbotene Formulierung nur im body wird erkannt', () => {
  const v = findClaimViolations([
    { ...clean, slug: 'post-op', body: 'Ideal für dein Recovery-Programm nach der Operation.' },
  ]);
  assert.ok(v.length >= 1, 'body muss gescannt werden');
  assert.ok(v.every((x) => x.slug === 'post-op'));
  assert.ok(v.some((x) => x.field === 'body'));
});

test('interne Keys/Slugs (category=narbenpflege) lösen KEINE Violation aus', () => {
  // Sichtbares Label ist „Hautpflege"; der interne Enum-Key bleibt „narbenpflege"
  // und darf die Prüfung nicht rot färben (siehe Guard-Note in landing.test.js).
  const v = findClaimViolations([
    {
      slug: 'narbenpflege-basics',
      title: 'Hautpflege-Basics',
      description: 'Sanfte Routinen für gepflegte Haut.',
      body: 'Tipps für deine tägliche Hautpflege-Routine.',
      category: 'narbenpflege',
    },
  ]);
  assert.deepEqual(v, [], 'interne category darf nicht gescannt werden');
});

test('loadPg löst pg unabhängig vom Arbeitsverzeichnis auf (portabel)', async () => {
  // Der Check läuft aus dem Repo-Root (`node scripts/claims-check.mjs`), aber
  // `pg` liegt nur in strapi/node_modules. Ein nacktes `import('pg')` scheitert
  // dort mit ERR_MODULE_NOT_FOUND. loadPg muss pg deshalb an strapi/ verankert
  // laden — hier ohne DB-Zugriff, nur die Modulauflösung wird geprüft.
  const pg = await loadPg();
  assert.equal(typeof pg.Client, 'function', 'pg.Client muss aufgelöst werden');
});

test('mehrere Programme: nur das verletzende wird gemeldet', () => {
  const v = findClaimViolations([
    clean,
    { ...clean, slug: 'heilung', title: 'Heilt deine Beschwerden' },
    { ...clean, slug: 'ok2' },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].slug, 'heilung');
});
