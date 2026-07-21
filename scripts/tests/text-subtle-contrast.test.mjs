// Test-first für den A11y-Kontrast des Meta-Text-Tokens (Audit A-01, Roadmap P4.5).
// --text-subtle wird für tertiäre Hinweise verwendet (.badge-locked, Input-
// Placeholder) und liegt dabei auf den hellen Flächen der App. WCAG 2.x AA
// verlangt für normalen Text ein Kontrastverhältnis >= 4,5:1. Gemessen werden
// die REALEN Tokens aus app/src/index.css gegen jede definierte helle Fläche
// (--ivory Grundfläche, --ivory-2 Karten-Highlight, --surface Kartenfläche) —
// keine im Test duplizierten Produktionsfarbwerte.
// Ausführen: node --test scripts/tests/text-subtle-contrast.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = join(HERE, '..', '..', 'app', 'src', 'index.css');

const AA_NORMAL = 4.5;

/** Liest den Hex-Wert eines CSS-Custom-Property aus dem :root-Block. */
function token(css, name) {
  const re = new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const m = css.match(re);
  assert.ok(m, `Token ${name} als 6-stelliger Hex-Wert nicht gefunden`);
  return m[1];
}

/** sRGB-Hex → relative Luminanz nach WCAG 2.x (Linearisierung + BT.709). */
function luminance(hex) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Hex-Farben nach WCAG 2.x. */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(CSS, 'utf8');
const subtle = token(css, '--text-subtle');
const SURFACES = ['--ivory', '--ivory-2', '--surface'];

for (const surface of SURFACES) {
  test(`--text-subtle erreicht AA (>= 4,5:1) auf ${surface}`, () => {
    const bg = token(css, surface);
    const ratio = contrast(subtle, bg);
    assert.ok(
      ratio >= AA_NORMAL,
      `Kontrast ${ratio.toFixed(2)}:1 von ${subtle} auf ${surface} (${bg}) ` +
        `unter AA-Schwelle ${AA_NORMAL}:1`,
    );
  });
}
