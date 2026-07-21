// P4.2 / Audit P-01: maintainbares HEALRISE-Caddy-Cache-Header-Artefakt.
// Die Cache-Regeln sind bereits live (P-01), aber die versionierte Quelle der
// Wahrheit im Repo fehlte. Dieser Guard sperrt das Artefakt statisch — ohne den
// Live-Caddyfile zu lesen/ändern. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = readFileSync(join(ROOT, 'deploy', 'caddy', 'healrise-cache-headers.caddy'), 'utf8');

test('gehashte Vite-Assets: public, max-age=31536000, immutable', () => {
  assert.match(ART, /public,\s*max-age=31536000,\s*immutable/);
  assert.match(ART, /assets|workbox/); // Hash-Pfad-Matcher vorhanden
});

test('index.html, manifest.webmanifest, sw.js: no-cache / revalidate', () => {
  assert.match(ART, /\/index\.html/);
  assert.match(ART, /manifest\.webmanifest/);
  assert.match(ART, /\/sw\.js/);
  assert.match(ART, /no-cache/);
  // sw.js explizit no-store
  assert.match(ART, /no-cache,\s*no-store,\s*must-revalidate/);
});

test('ungehashte Statics: beschränkter Cache (max-age<=86400), NIE immutable', () => {
  assert.match(ART, /max-age=86400/);
  // keine Zeile kombiniert 86400 mit immutable
  for (const line of ART.split('\n')) {
    if (line.includes('86400')) assert.doesNotMatch(line, /immutable/, `unhashed immutable: ${line.trim()}`);
  }
  // kein 1-Jahres-immutable auf Shell/Manifest-Zeilen
  for (const line of ART.split('\n')) {
    if (/index\.html|manifest\.webmanifest/.test(line)) {
      assert.doesNotMatch(line, /max-age=31536000/, `Shell darf nicht 1 Jahr cachen: ${line.trim()}`);
    }
  }
});

test('Artefakt ist healrise-/path-scoped + Deploy-Gate + Nachbar-Schutz, NICHT global', () => {
  assert.match(ART, /healrise/i);
  assert.match(ART, /handle \/healrise/);
  assert.match(ART, /reload|Damien|Deploy|validate/i);
  // healrise-only — kein Nachbar-ROUTING-Block enthalten (Kommentar-Erwähnungen ok)
  assert.doesNotMatch(ART, /handle \/(fitness|athletik-movement|hermes|pubtender|bs|op|pubtender)/);
  // jeder handle-Block ist ein healrise-Pfad
  for (const m of ART.matchAll(/handle (\/\S+)/g)) {
    assert.match(m[1], /^\/healrise/, `nicht-healrise handle: ${m[1]}`);
  }
});
