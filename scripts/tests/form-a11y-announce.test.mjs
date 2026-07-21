// A11y-Guard: Formular-Status-/Fehlermeldungen müssen Screenreadern angekündigt
// werden (WCAG 4.1.3 Status Messages / 3.3.1 Error Identification). Für die
// verkaufsrelevanten Flows Login/Registrierung, Passwort-Reset-Anfrage, Konto
// und Kauf (Upgrade). Statisches Parsen der JSX-Quellen, kein Render/Netz.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const page = (name) => readFileSync(join(ROOT, 'app', 'src', 'pages', `${name}.jsx`), 'utf8');

test('Account: jede form-error-Meldung ist als role="alert" angekündigt', () => {
  const src = page('Account');
  const lines = src.split('\n').filter((l) => l.includes('className="form-error"'));
  assert.ok(lines.length >= 3, 'erwartet mehrere form-error-Meldungen');
  for (const l of lines) {
    assert.match(l, /role="alert"/, `form-error ohne role="alert": ${l.trim()}`);
  }
});

test('Login: Fehler-Banner ist role="alert", Info-Banner role="status"', () => {
  const src = page('Login');
  assert.match(src, /role="alert"/, 'Fehler-Banner nicht angekündigt');
  assert.match(src, /role="status"/, 'Info-Banner nicht angekündigt');
});

test('ForgotPassword: Fehler role="alert", Erfolg/Info role="status"', () => {
  const src = page('ForgotPassword');
  assert.match(src, /role="alert"/, 'Fehler nicht angekündigt');
  assert.match(src, /role="status"/, 'Erfolg/Info nicht angekündigt');
});

test('Upgrade (Kauf): Checkout-Fehler ist role="alert" angekündigt', () => {
  const src = page('Upgrade');
  assert.match(src, /role="alert"/, 'Checkout-Fehler nicht angekündigt');
});
