// P3.1: Guard für das versionierte Postal-Webhook-Caddy-Artefakt. Rein statisch
// (Datei-Parsing) — kein Caddy-Lauf, kein Netz. Sichert: Proxy auf Strapi
// (127.0.0.1:9130), pfad-scoped auf die Webhook-Route (nachbar-sicher),
// Deploy-Gate-Hinweis, keine Secrets. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CADDY = readFileSync(join(ROOT, 'deploy', 'caddy', 'healrise-postal-webhook.caddy'), 'utf8');

test('proxied die Webhook-Route auf Strapi (127.0.0.1:9130)', () => {
  assert.match(CADDY, /handle \/healrise\/app\/api\/mail\/webhook/);
  assert.match(CADDY, /reverse_proxy\s+127\.0\.0\.1:9130/);
  assert.match(CADDY, /strip_prefix \/healrise\/app/);
});

test('pfad-scoped (nachbar-sicher): keine globale Site-Direktive, nur der handle-Block', () => {
  // Der einzige handle-Block adressiert exakt die Webhook-Route.
  const handles = [...CADDY.matchAll(/^handle\s+(\S+)/gm)].map((m) => m[1]);
  assert.deepEqual(handles, ['/healrise/app/api/mail/webhook']);
});

test('Deploy-Gate + Reihenfolge-Hinweis (vor dem SPA-Handle) dokumentiert', () => {
  assert.match(CADDY, /Deploy-Gate|Damien-Go/i);
  assert.match(CADDY, /validate/);
  assert.match(CADDY, /VOR dem generischen \/healrise\/app\/\*|VOR `handle \/healrise\/app\/\*`/);
});

test('enthält keine Secrets/Keys', () => {
  assert.doesNotMatch(CADDY, /-----BEGIN|https?:\/\/\S+:\S+@|whsec_|sk_(test|live)_/);
});

test('Tracking-Domain-Abgrenzung ist dokumentiert (nicht über den App-Pfad)', () => {
  assert.match(CADDY, /Tracking/i);
});
