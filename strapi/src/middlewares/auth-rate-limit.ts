/**
 * P4.1 / L-02: Strapi-Wrapper für das Auth-Rate-Limiting (Brute-Force-Schutz).
 * Registriert als `global::auth-rate-limit` in `config/middlewares.ts`.
 * Die gesamte Logik liegt im reinen, node-getesteten Kernmodul `../rate-limit`.
 * Konfiguration über AUTH_RATE_LIMIT_* (s. strapi/.env.example).
 */
import type { Core } from '@strapi/strapi';
import { createAuthRateLimitHandler } from '../rate-limit';

const middleware = (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const handler = createAuthRateLimitHandler((key) => process.env[key]);
  strapi.log?.info?.('auth-rate-limit: aktiv für POST /api/auth/*');
  return async (ctx: any, next: () => Promise<any>) => handler(ctx, next);
};

export default middleware;
