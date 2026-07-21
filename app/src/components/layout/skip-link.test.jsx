import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// jsdom kennt window.matchMedia nicht (von der App-Shell/InstallPrompt genutzt).
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

/**
 * A11y (WCAG 2.4.1 „Bypass Blocks"): Die App-Shell braucht einen Skip-to-Content-
 * Link, damit Tastatur-/Screenreader-Nutzer die Navigation überspringen können —
 * analog zur Landing. Ziel-Landmark ist das <main id="main-content">.
 */

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'Tester', email: 't@example.com', plan: 'premium' } }),
}));

import AppShell from './AppShell';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<h1>Übersicht</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell – Skip-to-Content (WCAG 2.4.1)', () => {
  it('rendert einen Skip-Link auf #main-content', () => {
    renderShell();
    const skip = screen.getByRole('link', { name: /Zum Inhalt springen/i });
    expect(skip).toBeInTheDocument();
    expect(skip.getAttribute('href')).toBe('#main-content');
  });

  it('das <main> trägt id="main-content" und ist fokussierbar', () => {
    renderShell();
    const main = document.getElementById('main-content');
    expect(main).toBeTruthy();
    expect(main.tagName).toBe('MAIN');
    // tabIndex -1, damit der Sprung den Fokus wirklich ins main setzt.
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('der Skip-Link steht VOR der Navigation im DOM (erster Tab-Stopp)', () => {
    renderShell();
    const skip = screen.getByRole('link', { name: /Zum Inhalt springen/i });
    const nav = document.querySelector('nav');
    expect(nav).toBeTruthy();
    // skip kommt im Dokument vor der Navigation.
    const pos = skip.compareDocumentPosition(nav);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Klick auf den Skip-Link setzt den Fokus programmatisch ins <main>', () => {
    renderShell();
    const skip = screen.getByRole('link', { name: /Zum Inhalt springen/i });
    fireEvent.click(skip);
    const main = document.getElementById('main-content');
    expect(document.activeElement).toBe(main);
  });
});
