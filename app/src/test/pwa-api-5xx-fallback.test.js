import { describe, it, expect } from 'vitest';
import { workboxOptions } from '../../vite.config.js';

/**
 * P4.4 / Audit P-03: Service-Worker 5xx-Fallback für gecachte Programme.
 *
 * Ausgangsproblem: Der programs-Runtime-Cache ist NetworkFirst mit
 * cacheableResponse.statuses [200]. Eine schnelle Fehlerantwort (502/503 vom
 * Proxy, wenn Strapi kurz weg ist) trifft VOR dem networkTimeout ein und wird
 * von NetworkFirst standardmäßig unverändert an die Seite gereicht — es findet
 * KEIN Fallback auf den bereits gecachten Programm-Eintrag statt.
 *
 * Erwartet (P-03): Bei 5xx behandelt der SW den Netzwerkversuch als Fehler
 * (fetchDidSucceed wirft), sodass NetworkFirst den Cache aus `healrise-api`
 * ausliefert. 200 bleibt die einzige cachebare Antwort; 4xx (z. B. 403
 * auth-gated) bleibt eine echte Antwort und wird durchgereicht. CMS-/Uploads-
 * Caching und die navigateFallback-Denylist bleiben unverändert.
 */

function cacheByName(name) {
  return workboxOptions.runtimeCaching.find((r) => r.options?.cacheName === name);
}

function fallbackPlugin(entry) {
  return (entry?.options?.plugins ?? []).find(
    (p) => typeof p.fetchDidSucceed === 'function',
  );
}

describe('P-03: SW 5xx-Fallback für gecachte Programme', () => {
  it('programs-Cache ist NetworkFirst und cached nur 200', () => {
    const api = cacheByName('healrise-api');
    expect(api).toBeTruthy();
    expect(api.handler).toBe('NetworkFirst');
    expect(api.options.cacheableResponse.statuses).toEqual([200]);
  });

  it('programs-Cache weist eine 5xx-Fallback-Logik nach (fetchDidSucceed)', () => {
    const plugin = fallbackPlugin(cacheByName('healrise-api'));
    expect(plugin, 'kein fetchDidSucceed-Plugin → kein 5xx-Fallback (P-03)').toBeTruthy();
  });

  it('5xx wird als Fehler behandelt → NetworkFirst fällt auf Cache zurück', async () => {
    const plugin = fallbackPlugin(cacheByName('healrise-api'));
    for (const status of [500, 502, 503]) {
      await expect(
        plugin.fetchDidSucceed({ response: { status } }),
      ).rejects.toThrow();
    }
  });

  it('200 bleibt gültige, unverändert durchgereichte Netzwerkantwort', async () => {
    const plugin = fallbackPlugin(cacheByName('healrise-api'));
    const response = { status: 200 };
    await expect(plugin.fetchDidSucceed({ response })).resolves.toBe(response);
  });

  it('4xx (z. B. 403 auth-gated) wird NICHT auf Cache umgeleitet', async () => {
    const plugin = fallbackPlugin(cacheByName('healrise-api'));
    for (const status of [400, 403, 404]) {
      const response = { status };
      await expect(plugin.fetchDidSucceed({ response })).resolves.toBe(response);
    }
  });

  it('uploads/media-Caching bleibt unverändert (CacheFirst, nur 200, kein 5xx-Fallback)', () => {
    const media = cacheByName('healrise-media');
    expect(media.handler).toBe('CacheFirst');
    expect(media.options.cacheableResponse.statuses).toEqual([200]);
    expect(fallbackPlugin(media)).toBeFalsy();
  });

  it('navigateFallback-Denylist bleibt unverändert (api + cms ausgenommen)', () => {
    const denylist = workboxOptions.navigateFallbackDenylist;
    expect(denylist).toHaveLength(2);
    const sources = denylist.map((r) => r.source);
    expect(sources.some((s) => s.includes('api'))).toBe(true);
    expect(sources.some((s) => s.includes('cms'))).toBe(true);
  });
});
