import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import RouteAccessibility from './RouteAccessibility';

/**
 * P4.5 / A-02: globale Route-A11y.
 * Erwartetes Verhalten der RouteAccessibility-Komponente:
 *  - setzt initial und nach jedem echten pathname-Wechsel einen deterministischen
 *    deutschen document.title mit Suffix " | HEALRISE",
 *  - verschiebt nach einem echten Pfadwechsel den Fokus auf das erste <h1> der
 *    Zielansicht, ersatzweise auf <main>,
 *  - stiehlt den Fokus nicht bei bloßen Re-Renders / unverändertem Pfad,
 *  - unbekannte Pfade fallen sicher auf "HEALRISE" zurück.
 */

// Navigationshilfe: löst echte pathname-Wechsel im MemoryRouter aus.
function Nav() {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/konto')}>go-konto</button>
      <button onClick={() => navigate('/nur-main')}>go-nurmain</button>
      <button onClick={() => navigate('/gibtsnicht/xyz')}>go-unbekannt</button>
    </div>
  );
}

function Harness({ initial = '/login' }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <RouteAccessibility />
      <Nav />
      <Routes>
        <Route path="/login" element={<h1>Anmelden</h1>} />
        <Route path="/konto" element={<section><h1>Konto</h1></section>} />
        <Route path="/nur-main" element={<main>Nur Main ohne Überschrift</main>} />
        <Route path="/gibtsnicht/xyz" element={<h1>Irgendwas</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

// Rendert die Komponente an genau einem Pfad und liefert den gesetzten Titel.
function titleAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteAccessibility />
    </MemoryRouter>,
  );
  return document.title;
}

describe('deterministische deutsche Routentitel (document.title)', () => {
  // Alle in App.jsx deklarierten statischen Routen + Familie /programm/:slug.
  const CASES = [
    ['/', 'Übersicht | HEALRISE'],
    ['/login', 'Anmelden | HEALRISE'],
    ['/passwort-vergessen', 'Passwort vergessen | HEALRISE'],
    ['/impressum', 'Impressum | HEALRISE'],
    ['/datenschutz', 'Datenschutz | HEALRISE'],
    ['/agb', 'AGB | HEALRISE'],
    ['/widerruf', 'Widerruf | HEALRISE'],
    ['/plaene', 'Mein Plan | HEALRISE'],
    ['/programme', 'Mein Plan | HEALRISE'],
    ['/konto', 'Konto | HEALRISE'],
    ['/upgrade', 'Upgrade | HEALRISE'],
    ['/upgrade/erfolg', 'Upgrade erfolgreich | HEALRISE'],
    ['/upgrade/abbruch', 'Upgrade abgebrochen | HEALRISE'],
    ['/programm/schlaf-tief', 'Programm | HEALRISE'],
    ['/programm/fokus', 'Programm | HEALRISE'],
  ];

  for (const [path, expected] of CASES) {
    it(`${path} → "${expected}"`, () => {
      expect(titleAt(path)).toBe(expected);
      expect(expected.endsWith(' | HEALRISE')).toBe(true);
    });
  }

  it('unbekannter Pfad fällt sicher auf "HEALRISE" zurück', () => {
    expect(titleAt('/gibtsnicht/xyz')).toBe('HEALRISE');
    expect(titleAt('/foo/bar/baz')).toBe('HEALRISE');
  });
});

describe('RouteAccessibility — Titel & Fokus', () => {
  it('setzt initial den deterministischen document.title', () => {
    render(<Harness initial="/login" />);
    expect(document.title).toBe('Anmelden | HEALRISE');
  });

  it('aktualisiert document.title nach echtem pathname-Wechsel', () => {
    render(<Harness initial="/login" />);
    fireEvent.click(screen.getByText('go-konto'));
    expect(document.title).toBe('Konto | HEALRISE');
  });

  it('unbekannter Pfad setzt document.title auf "HEALRISE"', () => {
    render(<Harness initial="/login" />);
    fireEvent.click(screen.getByText('go-unbekannt'));
    expect(document.title).toBe('HEALRISE');
  });

  it('stiehlt beim initialen Mount den Fokus NICHT', () => {
    render(<Harness initial="/login" />);
    expect(document.activeElement).toBe(document.body);
  });

  it('verschiebt nach echtem Wechsel den Fokus auf das erste <h1>', () => {
    render(<Harness initial="/login" />);
    fireEvent.click(screen.getByText('go-konto'));
    const active = document.activeElement;
    expect(active.tagName).toBe('H1');
    expect(active.textContent).toBe('Konto');
    expect(active.getAttribute('tabindex')).toBe('-1');
  });

  it('fällt ersatzweise auf <main> zurück, wenn kein <h1> existiert', () => {
    render(<Harness initial="/login" />);
    fireEvent.click(screen.getByText('go-nurmain'));
    expect(document.activeElement.tagName).toBe('MAIN');
  });

  it('stiehlt den Fokus nicht bei Re-Render ohne Pfadwechsel', () => {
    const { rerender } = render(<Harness initial="/login" />);
    const btn = screen.getByText('go-konto');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    rerender(<Harness initial="/login" />);
    expect(document.activeElement).toBe(btn);
  });
});
