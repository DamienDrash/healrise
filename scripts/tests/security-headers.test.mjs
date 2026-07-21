// P4.1 / L-02 / M-03: Security-Header-Hardening (lokal prüfbarer Teil).
// Die öffentlichen Header für die HEALRISE-App/Landing kommen vom GETEILTEN
// Caddy-vHost services.frigew.ski (Nachbarprojekte!) — Live-Anwendung ist ein
// Deploy/Damien-Go-Schritt. Lokal vorbereitet: ein PFAD-SCOPED Header-Snippet
// (deploy/caddy/…) + die Strapi-Security-Middleware (CSP für CMS/API). Dieser
// Guard sperrt die erwartete Header-Menge statisch, ohne das Live-System zu
// verändern. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SNIPPET = readFileSync(join(ROOT, 'deploy', 'caddy', 'healrise-security-headers.caddy'), 'utf8');
const MW = readFileSync(join(ROOT, 'strapi', 'config', 'middlewares.ts'), 'utf8');

const REQUIRED_HEADERS = [
  /Strict-Transport-Security/,
  /X-Content-Type-Options\s+"?nosniff/i,
  /Referrer-Policy/,
  /X-Frame-Options/,
  /Permissions-Policy/,
];

test('Caddy-Header-Snippet enthält alle Kern-Security-Header', () => {
  for (const re of REQUIRED_HEADERS) assert.match(SNIPPET, re, `fehlender Header: ${re}`);
});

test('Snippet enthält eine CSP (mind. Report-Only) mit frame-ancestors/default-src', () => {
  assert.match(SNIPPET, /Content-Security-Policy(-Report-Only)?/);
  assert.match(SNIPPET, /frame-ancestors|default-src/);
});

test('Snippet ist pfad-scoped für healrise (Nachbar-vHost-Schutz) + Deploy-Gate-Hinweis', () => {
  assert.match(SNIPPET, /healrise/i);
  assert.match(SNIPPET, /reload|Damien|Deploy|validate/i);
});

test('Strapi-Security-Middleware (CSP) bleibt für CMS/API aktiv', () => {
  assert.match(MW, /strapi::security/);
  assert.match(MW, /contentSecurityPolicy/);
});
