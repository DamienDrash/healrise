import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * P4.5 / A-02: globale Route-A11y innerhalb des BrowserRouter.
 *  - setzt für jede deklarierte Route/Familie einen deterministischen deutschen
 *    document.title mit Suffix " | HEALRISE",
 *  - verschiebt nach einem echten pathname-Wechsel den Fokus programmatisch auf
 *    das erste <h1> der Zielansicht, ersatzweise auf <main> — damit Screenreader-
 *    und Tastaturnutzer nach jeder Navigation am Anfang der neuen Ansicht landen,
 *  - stiehlt den Fokus NICHT beim initialen Mount oder bei bloßen Re-Renders.
 * Rendert nichts (Nebenwirkungs-Komponente).
 */

const BRAND = 'HEALRISE';

// Explizite deutsche Titel für alle in App.jsx deklarierten statischen Routen.
// (Basename /healrise/app wird von useLocation entfernt → Pfade ohne Präfix.)
const ROUTE_TITLES = {
  '/': 'Übersicht',
  '/login': 'Anmelden',
  '/passwort-vergessen': 'Passwort vergessen',
  '/impressum': 'Impressum',
  '/datenschutz': 'Datenschutz',
  '/agb': 'AGB',
  '/widerruf': 'Widerruf',
  '/plaene': 'Mein Plan',
  '/programme': 'Mein Plan', // Legacy-Redirect → /plaene
  '/konto': 'Konto',
  '/upgrade': 'Upgrade',
  '/upgrade/erfolg': 'Upgrade erfolgreich',
  '/upgrade/abbruch': 'Upgrade abgebrochen',
};

/** Deterministischer document.title für einen Pfad; sicherer Marken-Fallback. */
function titleForPath(pathname) {
  let name = ROUTE_TITLES[pathname];
  if (!name && pathname.startsWith('/programm/')) name = 'Programm';
  return name ? `${name} | ${BRAND}` : BRAND;
}

export default function RouteAccessibility() {
  const { pathname } = useLocation();
  const prevPath = useRef(null);

  useEffect(() => {
    document.title = titleForPath(pathname);

    // Fokus nur nach einem echten Pfadwechsel verschieben — nicht beim ersten
    // Mount (kein Steal beim Laden) und nicht bei Re-Renders ohne Pfadwechsel.
    const isRealChange = prevPath.current !== null && prevPath.current !== pathname;
    prevPath.current = pathname;
    if (!isRealChange) return;

    const target = document.querySelector('h1') || document.querySelector('main');
    if (!target) return;
    // Nur das jeweilige Fokusziel bei Bedarf programmatisch fokussierbar machen.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  }, [pathname]);

  return null;
}
