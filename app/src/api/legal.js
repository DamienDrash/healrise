import client from './client';

/**
 * R-01: Lädt die redaktionell pflegbaren Rechtstexte aus dem Strapi-Single-Type
 * `legal`. Öffentlich (kein Login) — die Freigabe von `api::legal.legal.find`
 * für die Public-Rolle passiert beim Strapi-Bootstrap. Liefert ein flaches
 * Objekt { impressum, datenschutz, agb, widerruf } mit HTML-Strings (oder null,
 * wenn ein Feld leer ist). Bei Netzwerk-/Serverfehler wird null zurückgegeben,
 * damit die Seiten auf den eingebauten Platzhalter-Fallback zurückfallen.
 */
export async function getLegal() {
  try {
    const { data } = await client.get('/api/legal', { params: { populate: '*' } });
    const a = data?.data?.attributes ?? data?.data ?? null;
    if (!a) return null;
    const clean = (v) => (typeof v === 'string' && v.trim() ? v : null);
    return {
      impressum: clean(a.impressum),
      datenschutz: clean(a.datenschutz),
      agb: clean(a.agb),
      widerruf: clean(a.widerruf),
    };
  } catch {
    return null;
  }
}
