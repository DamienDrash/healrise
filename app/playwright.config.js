import { defineConfig } from '@playwright/test';

/**
 * E2E-Tests (Plan T8.3) — laufen gegen den Vite-Dev-Server (Port 5199),
 * der /healrise/app/api an das lokal laufende Strapi (9130) proxied.
 * Voraussetzung: Strapi läuft mit SEED_DEMO=true (Testuser + Demo-Inhalte).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5199/healrise/app/',
    headless: true,
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199/healrise/app/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
