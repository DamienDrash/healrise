import { defineConfig } from '@playwright/test';

/**
 * Offline-Smoke (Plan T8.3.3): läuft gegen den Produktions-Build mit echtem
 * Service Worker (`vite preview`). Vorher `npm run build` ausführen.
 */
export default defineConfig({
  testDir: './e2e-offline',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:5198/healrise/app/',
    headless: true,
  },
  webServer: {
    command: 'npx vite preview --port 5198 --strictPort',
    url: 'http://localhost:5198/healrise/app/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
