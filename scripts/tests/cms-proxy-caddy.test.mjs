// B-03 / P4: Guard für das versionierte CMS/Admin+API-Reverse-Proxy-Caddy-Artefakt.
// Rein statisch (Datei-Parsing) — kein Caddy-Lauf. Sichert die korrekten, aus dem
// Repo belegten Werte (Port 9130, path-scoped /healrise/app/…, richtige Strip-
// Prefixe) gegen die Strapi-Defaults (1337, bare /admin,/api). Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CADDY = readFileSync(join(ROOT, 'deploy', 'caddy', 'healrise-cms-proxy.caddy'), 'utf8');

test('CMS/Admin-Route: /healrise/app/cms/* → strip /healrise/app/cms → 127.0.0.1:9130', () => {
  assert.match(CADDY, /handle \/healrise\/app\/cms\/\* \{[\s\S]*?strip_prefix \/healrise\/app\/cms[\s\S]*?reverse_proxy 127\.0\.0\.1:9130[\s\S]*?\}/);
});

test('API-Route: /healrise/app/api/* → strip /healrise/app → 127.0.0.1:9130', () => {
  assert.match(CADDY, /handle \/healrise\/app\/api\/\* \{[\s\S]*?strip_prefix \/healrise\/app\b[\s\S]*?reverse_proxy 127\.0\.0\.1:9130[\s\S]*?\}/);
});

test('proxied auf den ECHTEN Port 9130 — nicht den Strapi-Default 1337', () => {
  assert.match(CADDY, /127\.0\.0\.1:9130/);
  assert.doesNotMatch(CADDY, /reverse_proxy[^\n]*:1337/);
});

test('path-scoped/nachbar-sicher: jeder handle-Block liegt unter /healrise/app', () => {
  const handles = [...CADDY.matchAll(/^handle\s+(\S+)/gm)].map((m) => m[1]);
  assert.ok(handles.length >= 2, 'CMS- und API-handle erwartet');
  for (const h of handles) {
    assert.ok(h.startsWith('/healrise/app'), `nicht path-scoped: ${h}`);
  }
  // KEINE bare /admin- oder /api-Handles (die würden Nachbarprojekte/Site treffen)
  assert.ok(!handles.includes('/admin') && !handles.includes('/api'), 'bare /admin|/api verboten (nicht nachbar-sicher)');
});

test('Deploy-Gate + Reihenfolge-Hinweis (vor dem SPA-Handle) dokumentiert', () => {
  assert.match(CADDY, /Deploy-Gate|Damien-Go/i);
  assert.match(CADDY, /validate/);
  assert.match(CADDY, /VOR .*\/healrise\/app\/\*|spezifischere Pfade zuerst/i);
});

test('enthält keine Secrets/Keys', () => {
  assert.doesNotMatch(CADDY, /-----BEGIN|https?:\/\/\S+:\S+@|whsec_|sk_(test|live)_|ADMIN_JWT/);
});
