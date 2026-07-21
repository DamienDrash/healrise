// Test-first für HEALRISE Caddy Cache-Control (Audit P-01, Roadmap P4.2).
// Analog zu athletik-movement sollen die HEALRISE-App- und Landing-Handles
// deterministische Cache-Header setzen: SPA-Shell/Manifest revalidieren
// (Deploys sofort sichtbar), Vite-gehashte Bundles unveränderlich (1 Jahr),
// ungehashte Statics beschränkt (1 Tag). Der Service-Worker bleibt no-cache.
// Gelesen wird die reale Caddyfile (CADDYFILE überschreibt den Pfad, für Tests).
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CADDYFILE = process.env.CADDYFILE || '/etc/caddy/Caddyfile';
const caddy = readFileSync(CADDYFILE, 'utf8');

/** Extrahiert den klammerbalancierten Block ab `handle <pattern> {`. */
function handleBlock(text, header) {
  const start = text.indexOf(header);
  assert.ok(start !== -1, `Handle-Block nicht gefunden: ${header}`);
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  throw new Error(`Unbalancierte Klammern ab ${header}`);
}

const appBlock = handleBlock(caddy, 'handle /healrise/app/* {');
const landingBlock = handleBlock(caddy, 'handle /healrise/* {');
const swBlock = handleBlock(caddy, 'handle /healrise/app/sw.js {');

test('HEALRISE App: Vite-gehashte Bundles unveränderlich (1 Jahr, immutable)', () => {
  assert.match(appBlock, /max-age=31536000,\s*immutable/);
  // deckt /assets/* (js/css/woff2) ab
  assert.match(appBlock, /assets/);
});

test('HEALRISE App: SPA-Shell + Manifest revalidieren (no-cache)', () => {
  assert.match(appBlock, /\/index\.html/);
  assert.match(appBlock, /manifest\.webmanifest/);
  assert.match(appBlock, /no-cache/);
});

test('HEALRISE App: ungehashte Statics beschränkt (max-age=86400)', () => {
  assert.match(appBlock, /max-age=86400/);
});

test('HEALRISE Landing: Shell/ungehashter Code revalidieren (no-cache)', () => {
  assert.match(landingBlock, /\/index\.html/);
  assert.match(landingBlock, /no-cache/);
});

test('HEALRISE Landing: statische Assets beschränkt (max-age=86400)', () => {
  assert.match(landingBlock, /max-age=86400/);
});

test('HEALRISE Service-Worker bleibt no-cache (Regression, unverändert)', () => {
  assert.match(swBlock, /no-cache,\s*no-store,\s*must-revalidate/);
});

test('athletik-movement Cache-Regeln bleiben unangetastet (Nachbar-Guard)', () => {
  // Neighbor darf durch den HEALRISE-Slice nicht verloren gehen.
  assert.match(caddy, /handle \/athletik-movement\/\* \{/);
  assert.match(caddy, /@am_hashed path_regexp \^\/assets\/\.\+\\\.\(js\|css\)\$/);
});
