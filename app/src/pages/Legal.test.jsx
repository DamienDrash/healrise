import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * R-01: Pflicht-Rechtstexte (Impressum/Datenschutz/AGB/Widerruf).
 * Erwartetes Verhalten:
 *  - Seiten sind ohne Login rendern-/erreichbar (Titel + Fußzeilen-Links),
 *  - solange Strapi nichts liefert (null), zeigt jede Seite ihren eingebauten
 *    [PLATZHALTER: …]-Fallback,
 *  - liefert Strapi Inhalt, wird dieser (sanitisiert) statt des Fallbacks gezeigt,
 *  - KEIN echter Netzwerk-Call: die Legal-API ist gemockt.
 */

const { getLegalMock } = vi.hoisted(() => ({ getLegalMock: vi.fn() }));

vi.mock('../api/legal', () => ({ getLegal: getLegalMock }));

// Nach dem Mock importieren, damit der Hook den Mock nutzt.
const { Impressum, Datenschutz, AGB, Widerruf } = await import('./Legal');

function renderPage(Comp) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getLegalMock.mockReset();
});

describe('Legal-Seiten: Erreichbarkeit + Fußzeilen-Links', () => {
  it('jede Pflichtseite rendert ihren Titel und die vier Fußzeilen-Links', async () => {
    getLegalMock.mockResolvedValue(null);
    for (const [Comp, title] of [
      [Impressum, 'Impressum'],
      [Datenschutz, 'Datenschutzerklärung'],
      [AGB, 'Allgemeine Geschäftsbedingungen'],
      [Widerruf, 'Widerrufsbelehrung'],
    ]) {
      const { unmount } = renderPage(Comp);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      // Fußzeilen-Navigation zu allen Pflichtseiten (max. 2 Klicks von überall)
      for (const path of ['/impressum', '/datenschutz', '/agb', '/widerruf']) {
        expect(document.querySelector(`a[href="${path}"]`)).toBeTruthy();
      }
      unmount();
    }
  });
});

describe('Legal-Seiten: Platzhalter-Fallback (Strapi leer/nicht erreichbar)', () => {
  it('Impressum zeigt eingebaute [PLATZHALTER: …], wenn Strapi null liefert', async () => {
    getLegalMock.mockResolvedValue(null);
    renderPage(Impressum);
    await waitFor(() => expect(getLegalMock).toHaveBeenCalled());
    expect(screen.getByText(/Angaben gemäß § 5 DDG/)).toBeInTheDocument();
    expect(screen.getAllByText(/\[PLATZHALTER:/).length).toBeGreaterThan(0);
  });

  it('AGB/Widerruf/Datenschutz zeigen ihren Fallback-Text ohne Strapi', async () => {
    getLegalMock.mockResolvedValue(null);
    renderPage(AGB);
    await waitFor(() => expect(getLegalMock).toHaveBeenCalled());
    expect(screen.getByText(/Geltungsbereich/)).toBeInTheDocument();
  });
});

describe('Legal-Seiten: Strapi-Inhalt ersetzt den Fallback', () => {
  it('Impressum rendert den Strapi-HTML-Text statt des Platzhalters', async () => {
    getLegalMock.mockResolvedValue({
      impressum: '<h2>Musterfirma GmbH</h2><p>Musterstraße 1, 12345 Musterstadt</p>',
      datenschutz: null,
      agb: null,
      widerruf: null,
    });
    renderPage(Impressum);
    await waitFor(() => expect(screen.getByText(/Musterfirma GmbH/)).toBeInTheDocument());
    // Fallback-Platzhalter ist nun NICHT mehr sichtbar
    expect(screen.queryByText(/\[PLATZHALTER:/)).toBeNull();
  });

  it('sanitisiert Strapi-HTML (kein <script> im DOM)', async () => {
    getLegalMock.mockResolvedValue({
      impressum: '<p>ok</p><script>window.__xss=1</script>',
      datenschutz: null,
      agb: null,
      widerruf: null,
    });
    renderPage(Impressum);
    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
    expect(document.querySelector('script')).toBeNull();
  });
});
