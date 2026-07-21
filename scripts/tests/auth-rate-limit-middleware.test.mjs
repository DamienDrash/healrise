// P4.1 / L-02: Guard, dass das Auth-Rate-Limit als Strapi-Middleware verdrahtet
// ist. Rein statisch (Quell-Parsing) — kein Strapi-Lauf, kein Netz.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

test('Middleware-Datei existiert und nutzt den zentralen Handler', () => {
  const mw = read('strapi', 'src', 'middlewares', 'auth-rate-limit.ts');
  assert.match(mw, /createAuthRateLimitHandler/, 'Handler aus rate-limit muss verwendet werden');
  assert.match(mw, /from ['"]\.\.\/rate-limit['"]/, 'importiert das reine Kernmodul');
  assert.match(mw, /export default/, 'Strapi-Middleware braucht default export');
});

test('Middleware ist in config/middlewares.ts registriert', () => {
  const cfg = read('strapi', 'config', 'middlewares.ts');
  assert.match(cfg, /global::auth-rate-limit/, 'global::auth-rate-limit fehlt in der Middleware-Kette');
});

test('Registrierung liegt vor den Routen/Body (früh in der Kette)', () => {
  const cfg = read('strapi', 'config', 'middlewares.ts');
  const idxRateLimit = cfg.indexOf('global::auth-rate-limit');
  const idxPublic = cfg.indexOf('strapi::public');
  assert.ok(idxRateLimit > -1 && idxPublic > -1);
  assert.ok(idxRateLimit < idxPublic, 'Rate-Limit muss vor strapi::public greifen');
});

test('.env.example dokumentiert die AUTH_RATE_LIMIT_*-Schalter', () => {
  const env = read('strapi', '.env.example');
  for (const k of ['AUTH_RATE_LIMIT_MAX', 'AUTH_RATE_LIMIT_WINDOW_MS', 'AUTH_RATE_LIMIT_ENABLED']) {
    assert.match(env, new RegExp(k), `${k} fehlt in .env.example`);
  }
});
