// P4.1 / L-02: Guard für das In-Memory-Rate-Limiting der Auth-Endpunkte
// (Brute-Force-Schutz für POST /api/auth/* — Login/Registrierung/Passwort-Reset).
// Reines Modul, KEIN Strapi-Lauf, KEIN Netz. Die Uhr wird injiziert → deterministisch.
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRateLimitConfig,
  createRateLimiter,
  isAuthPath,
  clientKey,
  createAuthRateLimitHandler,
} from '../../strapi/src/rate-limit.ts';

// --- Konfigurations-Auflösung (Env-gesteuert, sichere Defaults) ---
test('resolveRateLimitConfig: sichere Defaults ohne Env', () => {
  const c = resolveRateLimitConfig(() => undefined);
  assert.equal(c.enabled, true);
  assert.equal(c.windowMs, 60_000);
  assert.equal(c.max, 10);
});

test('resolveRateLimitConfig: Env übersteuert Fenster/Max und Schalter', () => {
  const env = (k) => ({ AUTH_RATE_LIMIT_MAX: '3', AUTH_RATE_LIMIT_WINDOW_MS: '5000', AUTH_RATE_LIMIT_ENABLED: 'false' }[k]);
  const c = resolveRateLimitConfig(env);
  assert.equal(c.max, 3);
  assert.equal(c.windowMs, 5000);
  assert.equal(c.enabled, false);
});

test('resolveRateLimitConfig: ungültige/negative Env fällt auf Default zurück', () => {
  const env = (k) => ({ AUTH_RATE_LIMIT_MAX: 'abc', AUTH_RATE_LIMIT_WINDOW_MS: '-5' }[k]);
  const c = resolveRateLimitConfig(env);
  assert.equal(c.max, 10);
  assert.equal(c.windowMs, 60_000);
});

// --- Kern-Limiter (Fixed-Window pro Key) ---
test('createRateLimiter: erlaubt bis max, blockt ab max+1', () => {
  const limiter = createRateLimiter({ enabled: true, windowMs: 1000, max: 3 }, () => 0);
  assert.equal(limiter.check('k').allowed, true); // 1
  assert.equal(limiter.check('k').allowed, true); // 2
  const third = limiter.check('k'); // 3
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  const fourth = limiter.check('k'); // 4 → blockiert
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.retryAfterSec > 0, 'Retry-After muss gesetzt sein');
});

test('createRateLimiter: Fenster-Reset gibt nach Ablauf wieder frei', () => {
  let now = 0;
  const limiter = createRateLimiter({ enabled: true, windowMs: 1000, max: 1 }, () => now);
  assert.equal(limiter.check('k').allowed, true);
  assert.equal(limiter.check('k').allowed, false); // gleiches Fenster
  now = 1000; // Fenster abgelaufen
  assert.equal(limiter.check('k').allowed, true, 'nach Fensterablauf wieder erlaubt');
});

test('createRateLimiter: verschiedene Keys sind unabhängig', () => {
  const limiter = createRateLimiter({ enabled: true, windowMs: 1000, max: 1 }, () => 0);
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, true, 'zweiter Key eigenes Budget');
  assert.equal(limiter.check('a').allowed, false);
});

test('createRateLimiter: disabled lässt immer durch', () => {
  const limiter = createRateLimiter({ enabled: false, windowMs: 1000, max: 1 }, () => 0);
  for (let i = 0; i < 5; i++) assert.equal(limiter.check('k').allowed, true);
});

test('createRateLimiter: prune entfernt abgelaufene Einträge (kein Speicherleck)', () => {
  let now = 0;
  const limiter = createRateLimiter({ enabled: true, windowMs: 1000, max: 5 }, () => now);
  limiter.check('a');
  limiter.check('b');
  assert.equal(limiter.size(), 2);
  now = 2000;
  limiter.prune();
  assert.equal(limiter.size(), 0, 'abgelaufene Einträge werden entfernt');
});

// --- Pfad-/Key-Helfer ---
test('isAuthPath: nur echte /api/auth-Pfade', () => {
  assert.equal(isAuthPath('/api/auth/local'), true);
  assert.equal(isAuthPath('/api/auth/local/register'), true);
  assert.equal(isAuthPath('/api/auth/forgot-password'), true);
  assert.equal(isAuthPath('/api/auth'), true);
  assert.equal(isAuthPath('/api/program'), false);
  assert.equal(isAuthPath('/api/legal'), false);
  assert.equal(isAuthPath('/api/authenticators'), false, 'kein Präfix-Fehltreffer');
});

test('clientKey: kombiniert IP und Pfad', () => {
  const key = clientKey({ ip: '1.2.3.4', request: { path: '/api/auth/local' } });
  assert.match(key, /1\.2\.3\.4/);
  assert.match(key, /\/api\/auth\/local/);
});

// --- Strapi-agnostischer Handler (429-Verhalten) ---
function fakeCtx({ ip = '1.2.3.4', path = '/api/auth/local', method = 'POST' } = {}) {
  const headers = {};
  return {
    ip,
    method,
    request: { path, method, ip },
    status: 200,
    body: undefined,
    set(k, v) { headers[k] = v; },
    _headers: headers,
  };
}

test('Handler: POST /api/auth/* über Limit → 429 + Retry-After, next NICHT aufgerufen', async () => {
  const env = (k) => ({ AUTH_RATE_LIMIT_MAX: '2', AUTH_RATE_LIMIT_WINDOW_MS: '1000' }[k]);
  const handler = createAuthRateLimitHandler(env, () => 0);
  let nextCalls = 0;
  const next = async () => { nextCalls++; };
  await handler(fakeCtx(), next); // 1
  await handler(fakeCtx(), next); // 2
  const ctx = fakeCtx();
  await handler(ctx, next);       // 3 → blockiert
  assert.equal(ctx.status, 429);
  assert.equal(ctx._headers['Retry-After'] !== undefined, true);
  assert.equal(nextCalls, 2, 'die blockierte Anfrage ruft next NICHT auf');
});

test('Handler: Nicht-Auth-Pfad wird nie limitiert', async () => {
  const handler = createAuthRateLimitHandler((k) => ({ AUTH_RATE_LIMIT_MAX: '1' }[k]), () => 0);
  let nextCalls = 0;
  const next = async () => { nextCalls++; };
  for (let i = 0; i < 5; i++) await handler(fakeCtx({ path: '/api/program' }), next);
  assert.equal(nextCalls, 5, 'Nicht-Auth-Pfade laufen immer durch');
});

test('Handler: GET auf Auth-Pfad wird nicht limitiert (nur POST)', async () => {
  const handler = createAuthRateLimitHandler((k) => ({ AUTH_RATE_LIMIT_MAX: '1' }[k]), () => 0);
  let nextCalls = 0;
  const next = async () => { nextCalls++; };
  for (let i = 0; i < 3; i++) await handler(fakeCtx({ method: 'GET' }), next);
  assert.equal(nextCalls, 3);
});

test('Handler: disabled lässt alles durch (kein 429)', async () => {
  const handler = createAuthRateLimitHandler((k) => ({ AUTH_RATE_LIMIT_ENABLED: 'false', AUTH_RATE_LIMIT_MAX: '1' }[k]), () => 0);
  let nextCalls = 0;
  const next = async () => { nextCalls++; };
  const ctx = fakeCtx();
  await handler(ctx, next);
  await handler(ctx, next);
  assert.equal(nextCalls, 2);
  assert.notEqual(ctx.status, 429);
});

test('GUARDRAIL nicht vakuum: identische Anfragen laufen ohne Limiter in echte Sperre', () => {
  // Beweis, dass der Block-Test echt greift: ein „immer erlaubt"-Limiter würde
  // die Sperre NIE auslösen — hier MUSS die 3. Anfrage bei max=2 scheitern.
  const limiter = createRateLimiter({ enabled: true, windowMs: 1000, max: 2 }, () => 0);
  limiter.check('x'); limiter.check('x');
  assert.equal(limiter.check('x').allowed, false);
});
