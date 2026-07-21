// R-01: Guard für die Strapi-gepflegten Pflicht-Rechtstexte (Single-Type `legal`).
// Rein statisch (Quell-Parsing) — KEIN Strapi-Lauf, kein Netz, keine echten Daten.
// Stellt sicher, dass (1) der Single-Type mit den vier Rechtstext-Feldern
// existiert, (2) Controller/Route im Factory-Format vorliegen, (3) die
// Public-Rolle `api::legal.legal.find` freigeschaltet bekommt (ohne Login
// erreichbar), (4) der Bootstrap Platzhalter idempotent seedet.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const LEGAL_FIELDS = ['impressum', 'datenschutz', 'agb', 'widerruf'];

test('Single-Type-Schema: kind singleType mit allen vier Rechtstext-Feldern', () => {
  const schema = JSON.parse(read('strapi', 'src', 'api', 'legal', 'content-types', 'legal', 'schema.json'));
  assert.equal(schema.kind, 'singleType');
  assert.equal(schema.info.singularName, 'legal');
  for (const f of LEGAL_FIELDS) {
    assert.ok(schema.attributes[f], `Feld ${f} fehlt im Schema`);
    assert.equal(schema.attributes[f].type, 'richtext', `Feld ${f} sollte richtext sein`);
  }
});

test('Controller + Route liegen im Factory-Format vor', () => {
  const ctrl = read('strapi', 'src', 'api', 'legal', 'controllers', 'legal.ts');
  const route = read('strapi', 'src', 'api', 'legal', 'routes', 'legal.ts');
  assert.match(ctrl, /createCoreController\('api::legal\.legal'\)/);
  assert.match(route, /createCoreRouter\('api::legal\.legal'\)/);
});

test('Public-Freigabe: api::legal.legal.find steht in PUBLIC_ACTIONS', () => {
  const index = read('strapi', 'src', 'index.ts');
  const publicBlock = index.slice(index.indexOf('PUBLIC_ACTIONS'), index.indexOf('async function setPermissions'));
  assert.match(publicBlock, /'api::legal\.legal\.find'/, 'legal.find fehlt in PUBLIC_ACTIONS');
});

test('Bootstrap seedet Platzhalter-Rechtstexte idempotent', () => {
  const index = read('strapi', 'src', 'index.ts');
  // Seed-Funktion existiert, prüft Vorhandensein (Idempotenz) und legt alle Felder an.
  assert.match(index, /seedLegalContent/);
  assert.match(index, /api::legal\.legal.*findOne|findOne.*api::legal\.legal/s);
  assert.match(index, /PLATZHALTER/);
  for (const f of LEGAL_FIELDS) {
    assert.match(index, new RegExp(`${f}:`), `Seed setzt Feld ${f} nicht`);
  }
  // wird im bootstrap aufgerufen
  assert.match(index, /await seedLegalContent\(strapi\)/);
});

test('Frontend-API + Hook laden aus dem Single-Type', () => {
  const api = read('app', 'src', 'api', 'legal.js');
  const hook = read('app', 'src', 'hooks', 'useLegal.js');
  assert.match(api, /\/api\/legal/);
  for (const f of LEGAL_FIELDS) {
    assert.match(api, new RegExp(`${f}:`), `legal.js normalisiert Feld ${f} nicht`);
  }
  assert.match(hook, /getLegal/);
});

test('GUARDRAIL: Rechtstexte-Seiten sind öffentlich (nicht hinter ProtectedRoute)', () => {
  const app = read('app', 'src', 'App.jsx');
  // Die vier Pfade sind als eigenständige Routes außerhalb des ProtectedRoute-Blocks.
  for (const path of ['/impressum', '/datenschutz', '/agb', '/widerruf']) {
    assert.match(app, new RegExp(`path="${path}"`), `Route ${path} fehlt`);
  }
});
