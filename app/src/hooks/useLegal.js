import { useEffect, useState } from 'react';
import { getLegal } from '../api/legal';

/**
 * R-01: Lädt die Rechtstexte einmalig aus Strapi (Single-Type `legal`).
 * Gibt `null` zurück, solange geladen wird oder wenn Strapi nicht erreichbar ist
 * — die Seiten zeigen dann ihren eingebauten Platzhalter-Fallback. Sobald echte
 * Inhalte vorliegen, ersetzen sie den Fallback (Damien pflegt sie im Admin).
 */
export function useLegal() {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let alive = true;
    getLegal().then((c) => {
      if (alive) setContent(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return content;
}
