import { test, expect } from '@playwright/test';

/**
 * Offline-Smoke (Plan T8.3.3, Review I6/F27) gegen den Produktions-Build.
 *
 * Hinweis: `context.setOffline(true)` emuliert in Chromium/Playwright den
 * Netzwerkausfall NICHT zuverlässig für Service-Worker-Fetches (bekannte
 * Einschränkung) — deshalb wird die Offline-Garantie hier direkt über den
 * Service-Worker-Zustand und den Precache-Inhalt verifiziert:
 * Shell (index.html + JS/CSS) und self-hosted Fonts müssen im Precache liegen,
 * der SW muss die Seite kontrollieren.
 */
test('Service Worker aktiv, Shell + Fonts vollständig im Precache', async ({ page }) => {
  await page.goto('login');
  await expect(page.getByRole('button', { name: 'Registrieren', exact: true })).toBeVisible();

  // SW installiert & aktiv
  await page.waitForFunction(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.some(r => r.active);
  }, null, { timeout: 20_000 });

  // Nach Reload kontrolliert der SW die Seite (Aktivierung kann kurz nach
  // dem "active"-Flag abgeschlossen sein — deshalb mit Retry)
  let controlled = false;
  for (let attempt = 0; attempt < 3 && !controlled; attempt++) {
    await page.waitForTimeout(1000);
    await page.reload();
    controlled = await page
      .waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(controlled).toBe(true);

  const cacheInfo = await page.evaluate(async () => {
    const keys = await caches.keys();
    const precacheKey = keys.find(k => k.includes('precache'));
    if (!precacheKey) return { precacheKey: null, urls: [] };
    const cache = await caches.open(precacheKey);
    const reqs = await cache.keys();
    return { precacheKey, urls: reqs.map(r => r.url) };
  });

  expect(cacheInfo.precacheKey).toBeTruthy();
  const has = (pattern) => cacheInfo.urls.some(u => pattern.test(u));
  expect(has(/index\.html/)).toBe(true);                 // navigateFallback-Shell
  expect(has(/assets\/.*\.js/)).toBe(true);              // App-Bundle
  expect(has(/assets\/.*\.css/)).toBe(true);             // Styles
  expect(has(/\.woff2/)).toBe(true);                     // self-hosted Fonts (T3.2.4)
  expect(has(/manifest\.webmanifest/)).toBe(true);       // PWA-Manifest

  // Runtime-Caching-Konfiguration ist im SW-Code enthalten (API offline lesbar)
  const swSource = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    const url = regs[0]?.active?.scriptURL;
    if (!url) return '';
    const res = await fetch(url);
    return res.text();
  });
  expect(swSource).toContain('healrise-api');
  expect(swSource).toContain('NetworkFirst');
});
