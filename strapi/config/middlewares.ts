import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['https://services.frigew.ski', 'http://localhost:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  // P4.1/L-02: Brute-Force-Schutz — begrenzt POST /api/auth/* pro IP.
  // Früh in der Kette (vor Routing/Controller), damit die Sperre greift, bevor
  // teure Auth-Logik läuft. Konfiguration: AUTH_RATE_LIMIT_* (s. .env.example).
  'global::auth-rate-limit',
  // 'strapi::poweredBy' bewusst entfernt (Härtung): kein „X-Powered-By: Strapi"-
  // Info-Leak mehr. Greift beim nächsten Strapi-Neustart (Launch-Restart).
  'strapi::query',
  {
    // Roh-Body zusätzlich bereitstellen — für die Stripe-Signaturprüfung (T9)
    name: 'strapi::body',
    config: { includeUnparsed: true },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
