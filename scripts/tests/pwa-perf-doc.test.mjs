// Doku↔Config-Vertrag für PWA-Performance/Resilienz (Roadmap 4.3/4.4, Audit P-02/P-03).
// Sperrt (1) die durchgesetzte Precache-Budget-Zahl = dokumentierte Zahl, (2) den
// 5xx-Fallback in der Vite-Config und (3) dass Roadmap/Audit den verifizierten
// Fix-Stand dokumentieren. Rein statisch, kein Build/Netz. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const BUDGET_TEST = read('scripts', 'tests', 'precache-budget.test.mjs');
const VITE = read('app', 'vite.config.js');
const ROADMAP = read('docs', 'production-readiness-roadmap.md');
const AUDIT = read('docs', 'production-readiness-audit.md');

test('P-02: durchgesetztes Precache-Budget ist 800 KiB (Guard-Test-Contract)', () => {
  assert.match(BUDGET_TEST, /BUDGET_BYTES\s*=\s*800\s*\*\s*1024/);
  assert.match(BUDGET_TEST, /latin-ext|devanagari|cyrillic/); // Nicht-Latin-Guard vorhanden
});

test('P-03: Vite-Config hat den 5xx→Cache-Fallback (NetworkFirst/fetchDidSucceed >=500)', () => {
  assert.match(VITE, /handler:\s*'NetworkFirst'/);
  assert.match(VITE, /cacheName:\s*'healrise-api'/);
  assert.match(VITE, /fetchDidSucceed/);
  assert.match(VITE, /status\s*>=\s*500/);
});

test('Roadmap 4.3 (P-02) ist als verifiziert dokumentiert (Precache-Zahl + Datum)', () => {
  assert.match(ROADMAP, /677|Precache 6\d\d,?\d? KiB/);
  assert.match(ROADMAP, /2026-07-16/);
});

test('Roadmap 4.4 (P-03) ist als verifiziert dokumentiert (5xx-Fallback)', () => {
  const row = ROADMAP.match(/\| 4\.4 \|.*/);
  assert.ok(row, '4.4-Zeile gefunden');
  assert.match(row[0], /fetchDidSucceed|5xx|Cache-Fallback/i);
  assert.match(row[0], /✅|verifiziert/i);
});

test('Audit P-02/P-03 spiegeln den behobenen Stand (nicht mehr als offenes Problem)', () => {
  const p02 = AUDIT.match(/\| \*\*P-02\*\*.*/);
  const p03 = AUDIT.match(/\| \*\*P-03\*\*.*/);
  assert.ok(p02 && p03, 'P-02/P-03-Zeilen gefunden');
  assert.match(p02[0], /behoben|verifiziert|677/i);
  assert.match(p03[0], /behoben|verifiziert|fetchDidSucceed/i);
});
