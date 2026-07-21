// Test-first für die Entfernung der toten Legacy-Seite (Audit D-08).
// app/src/pages/Programs.jsx ist nicht geroutet, wird von App.jsx nicht
// importiert und enthält veraltete required_plan-Logik. Dieser Guard stellt
// sicher, dass die Datei entfernt bleibt, nicht erneut importiert wird und der
// Legacy-Redirect /programme → /plaene erhalten bleibt (statisch, kein Build).
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROGRAMS = join(ROOT, 'app', 'src', 'pages', 'Programs.jsx');
const APP = join(ROOT, 'app', 'src', 'App.jsx');

const appText = readFileSync(APP, 'utf8');

test('Legacy-Seite app/src/pages/Programs.jsx existiert nicht mehr (D-08)', () => {
  assert.ok(!existsSync(PROGRAMS), 'Programs.jsx ist toter Code und muss entfernt sein');
});

test('App.jsx importiert ./pages/Programs nicht (nur ProgramDetail erlaubt)', () => {
  assert.doesNotMatch(
    appText,
    /from\s+['"]\.\/pages\/Programs['"]/,
    'App.jsx darf die Legacy-Seite nicht importieren',
  );
});

test('Legacy-Redirect /programme → /plaene bleibt erhalten', () => {
  assert.match(appText, /path=["']\/programme["']/, '/programme-Route fehlt');
  assert.match(
    appText,
    /path=["']\/programme["']\s+element=\{<Navigate\s+to=["']\/plaene["']\s+replace\s*\/>\}/,
    'Redirect /programme → /plaene (Navigate replace) muss bestehen bleiben',
  );
});
