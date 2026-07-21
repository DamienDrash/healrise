/**
 * P4.1 / L-02: In-Memory-Rate-Limiting für Auth-Endpunkte (Brute-Force-Schutz).
 *
 * Begrenzt POST /api/auth/* (Login, Registrierung, forgot-/reset-password) pro
 * Client-IP auf `max` Anfragen je `windowMs`. Reines Modul ohne Strapi-/Netz-
 * Import → node-testbar; die Uhr ist injizierbar (deterministische Tests). Der
 * dünne Strapi-Wrapper liegt in `src/middlewares/auth-rate-limit.ts` und wird in
 * `config/middlewares.ts` als `global::auth-rate-limit` registriert.
 *
 * In-Memory ist für den aktuellen Single-Node-Betrieb ausreichend (kein PII, kein
 * Secret, kein externer Store nötig). Bei Mehrknoten-Betrieb wäre ein geteilter
 * Store (Redis) der nächste Schritt — bewusst nicht vorweggenommen.
 */

type EnvGet = (key: string) => string | undefined;

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const DEFAULT_WINDOW_MS = 60_000; // 1 Minute
const DEFAULT_MAX = 10;

function toPositiveInt(raw: string | undefined, def: number): number {
  if (raw === undefined) return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

/** Liest die AUTH_RATE_LIMIT_*-Env mit sicheren Defaults (an, 10/min). */
export function resolveRateLimitConfig(env: EnvGet): RateLimitConfig {
  const enabled = (env('AUTH_RATE_LIMIT_ENABLED') ?? 'true').toLowerCase() !== 'false';
  const windowMs = toPositiveInt(env('AUTH_RATE_LIMIT_WINDOW_MS'), DEFAULT_WINDOW_MS);
  const max = toPositiveInt(env('AUTH_RATE_LIMIT_MAX'), DEFAULT_MAX);
  return { enabled, windowMs, max };
}

/** Fixed-Window-Zähler je Key. `now` injizierbar für deterministische Tests. */
export function createRateLimiter(config: RateLimitConfig, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function check(key: string): RateDecision {
    if (!config.enabled) return { allowed: true, remaining: config.max, retryAfterSec: 0 };
    const t = now();
    let entry = hits.get(key);
    if (!entry || t >= entry.resetAt) {
      entry = { count: 0, resetAt: t + config.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > config.max) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) };
    }
    return { allowed: true, remaining: Math.max(0, config.max - entry.count), retryAfterSec: 0 };
  }

  /** Entfernt abgelaufene Einträge (verhindert unbegrenztes Map-Wachstum). */
  function prune(): void {
    const t = now();
    for (const [k, v] of hits) if (t >= v.resetAt) hits.delete(k);
  }

  return { check, prune, size: () => hits.size };
}

/** Nur echte /api/auth-Pfade (kein Präfix-Fehltreffer wie /api/authenticators). */
export function isAuthPath(path: string): boolean {
  return /^\/api\/auth(\/|$)/.test(path);
}

/** Client-Key aus IP + Pfad (pro Endpunkt eigenes Budget). */
export function clientKey(ctx: any): string {
  const ip = ctx?.ip || ctx?.request?.ip || 'unknown';
  const path = ctx?.request?.path || ctx?.path || '';
  return `${ip}:${path}`;
}

/**
 * Strapi-agnostischer Handler `(ctx, next)`: begrenzt POST /api/auth/* und
 * antwortet bei Überschreitung mit 429 + Retry-After, ohne `next()` zu rufen.
 * Alle anderen Requests laufen unverändert durch.
 */
export function createAuthRateLimitHandler(env: EnvGet, now: () => number = Date.now) {
  const config = resolveRateLimitConfig(env);
  const limiter = createRateLimiter(config, now);
  let served = 0;

  return async function authRateLimit(ctx: any, next: () => Promise<any>): Promise<any> {
    const path = ctx?.request?.path ?? ctx?.path ?? '';
    const method = String(ctx?.request?.method ?? ctx?.method ?? 'GET').toUpperCase();
    if (!config.enabled || method !== 'POST' || !isAuthPath(path)) {
      return next();
    }
    // Gelegentliches Aufräumen abgelaufener Einträge (best effort).
    if (++served % 100 === 0) limiter.prune();

    const decision = limiter.check(clientKey(ctx));
    ctx.set?.('X-RateLimit-Limit', String(config.max));
    ctx.set?.('X-RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      ctx.set?.('Retry-After', String(decision.retryAfterSec));
      ctx.status = 429;
      ctx.body = {
        error: { status: 429, name: 'TooManyRequests', message: 'Zu viele Anfragen — bitte kurz warten.' },
      };
      return; // KEIN next() → Request wird abgebrochen
    }
    return next();
  };
}
