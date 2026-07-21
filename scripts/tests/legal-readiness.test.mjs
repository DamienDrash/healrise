// R-01: Legal-Placeholder-Readiness-Guard. Erkennt verbleibende Rechtsseiten-
// Platzhalter ([PLATZHALTER: …] via <PH>-Komponente) und fehlende Pflicht-
// Rechtslinks (Impressum/Datenschutz/AGB/Widerruf). Meldet nur sichere
// Feldnamen/Pfade/Zeilen/Counts — NIE echte Daten/Secrets, ERSETZT KEINE
// Platzhalter. Rein statisch. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { scanPlaceholders, assessLegalReadiness } from '../legal-readiness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

test('scanPlaceholders findet <PH>-Feldnamen mit Zeilennummern', () => {
  const fixture = 'a\n<p><PH>Firma</PH><br /><PH>USt-IdNr.</PH></p>\n';
  const found = scanPlaceholders(fixture);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((f) => f.field), ['Firma', 'USt-IdNr.']);
  assert.equal(found[0].line, 2);
});

test('assessLegalReadiness: echte Legal.jsx ist NICHT ready (Platzhalter vorhanden)', () => {
  const files = [
    { path: 'app/src/pages/Legal.jsx', kind: 'legal-page', text: read('app', 'src', 'pages', 'Legal.jsx') },
    { path: 'landing/index.html', kind: 'landing', text: read('landing', 'index.html') },
  ];
  const r = assessLegalReadiness(files);
  assert.equal(r.ready, false);
  assert.ok(r.placeholderCount >= 10, `erwartet viele Platzhalter, war ${r.placeholderCount}`);
  assert.equal(r.missingRefs.length, 0, 'Landing verlinkt alle 4 Pflichtseiten');
});

test('clean Fixture (keine Platzhalter + alle Pflichtlinks) → ready true (nicht vakuum)', () => {
  const files = [
    { path: 'legal.fixture', kind: 'legal-page', text: '<h2>Impressum</h2><p>Echte Firma GmbH, Musterstr. 1</p>' },
    { path: 'landing.fixture', kind: 'landing', text: 'impressum datenschutz agb widerruf' },
  ];
  const r = assessLegalReadiness(files);
  assert.equal(r.ready, true, `Blocker: ${JSON.stringify(r)}`);
  assert.equal(r.placeholderCount, 0);
});

test('fehlender Pflicht-Rechtslink in Landing → Blocker', () => {
  const files = [
    { path: 'landing.fixture', kind: 'landing', text: 'impressum datenschutz agb' }, // widerruf fehlt
  ];
  const r = assessLegalReadiness(files);
  assert.equal(r.ready, false);
  assert.ok(r.missingRefs.some((m) => m.missing === 'widerruf'));
});

test('Report enthält nur Feldnamen/Pfad/Zeile — kein value/Datenfeld', () => {
  const found = scanPlaceholders('<PH>Straße und Hausnummer</PH>');
  for (const f of found) {
    assert.deepEqual(Object.keys(f).sort(), ['field', 'line']);
    assert.ok(!('value' in f), 'kein Datenwert im Report');
  }
});

test('Docs referenzieren den Guard und halten R-01 als Betreiber-Blocker', () => {
  const audit = read('docs', 'production-readiness-audit.md');
  const checklist = read('docs', 'launch-checklist.md');
  const o01 = audit.match(/\| \*\*R-01\*\*.*/);
  assert.ok(o01, 'R-01-Zeile im Audit');
  assert.match(o01[0], /legal-readiness/);
  assert.match(o01[0], /Betreiber|Damien|Blocker/i);
  assert.match(checklist, /legal-readiness/);
});
