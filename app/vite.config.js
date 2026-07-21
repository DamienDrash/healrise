import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// P4.4 / Audit P-03: NetworkFirst reicht eine schnelle Server-Fehlerantwort
// (502/503 vom Proxy, wenn Strapi kurz weg ist) standardmäßig an die Seite
// weiter und fällt NICHT auf den Cache zurück. Dieses Plugin wirft bei 5xx,
// wodurch Workbox den Netzwerkversuch als fehlgeschlagen behandelt und
// NetworkFirst den zuvor gecachten Programm-Eintrag aus `healrise-api`
// ausliefert. 4xx (z. B. 403 auth-gated) bleibt eine echte Antwort und wird
// unverändert durchgereicht; 200 wird wie bisher gecacht.
const serverErrorFallbackPlugin = {
  fetchDidSucceed: async ({ response }) => {
    if (response.status >= 500) {
      throw new Error(`HEALRISE SW: ${response.status} -> Fallback auf gecachte Programme (P-03)`)
    }
    return response
  },
}

// Als benannter Export testbar (src/test/pwa-api-5xx-fallback.test.js), ohne die
// undurchsichtige VitePWA-Plugin-Instanz inspizieren zu müssen.
export const workboxOptions = {
  // Fonts sind self-hosted (Review I1) und landen über woff2 im Precache (T3/T4)
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  navigateFallback: '/healrise/app/index.html',
  // /cms nicht vom SW kapern — sonst ist das Strapi-Admin unerreichbar (Review I2)
  navigateFallbackDenylist: [/^\/healrise\/app\/api/, /^\/healrise\/app\/cms/],
  runtimeCaching: [
    {
      // Programm-Inhalte: frisch wenn online, Cache offline (Review I6/F27);
      // bei 5xx Fallback auf den Cache statt Fehlerdurchreichung (P-03).
      urlPattern: /^https?:\/\/[^/]+\/healrise\/app\/api\/programs/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'healrise-api',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 14 },
        cacheableResponse: { statuses: [200] },
        plugins: [serverErrorFallbackPlugin],
      },
    },
    {
      // CMS-Uploads (Thumbnails etc.): Cache zuerst, ändern sich selten
      urlPattern: /^https?:\/\/[^/]+\/healrise\/app\/api\/uploads\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'healrise-media',
        expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
        cacheableResponse: { statuses: [200] },
      },
    },
  ],
}

export default defineConfig({
  base: '/healrise/app/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' + Update-Banner statt stillem autoUpdate (Goldstandard T1, Review I11)
      registerType: 'prompt',
      base: '/healrise/app/',
      manifest: {
        id: '/healrise/app/',
        lang: 'de',
        name: 'HEALRISE',
        short_name: 'HEALRISE',
        description: 'Dein ganzheitliches Wohlfühl-Programm — Ernährung, Bewegung, Selfcare.',
        // Warm Ivory (HEALRISE-CI) — Statusleiste & Splash verschmelzen mit dem App-Grund
        theme_color: '#F6F3EF',
        background_color: '#F6F3EF',
        display: 'standalone',
        start_url: '/healrise/app/',
        scope: '/healrise/app/',
        // Getrennte any/maskable-Icons (Review I8: Kombi-Icon ist ein Anti-Pattern)
        icons: [
          { src: '/healrise/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/healrise/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/healrise/app/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/healrise/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: workboxOptions
    })
  ],
  // Rewrite entfernt nur das Subpfad-Präfix; /api bleibt erhalten, weil
  // Strapi unter /api/... serviert (Review I3) — identisch zur Prod-Proxy-Regel.
  server: { proxy: { '/healrise/app/api': { target: 'http://127.0.0.1:9130', rewrite: p => p.replace('/healrise/app', '') } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Playwright-Specs (eigene Runner) nicht mit Vitest einsammeln
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'e2e-offline/**'],
  },
})
