import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * DSGVO-Selbstauskunft (Art. 15/20): „Meine Daten herunterladen"-Button im Konto.
 * Erwartetes Verhalten:
 *  - Button in der Datenschutz-Section vorhanden,
 *  - Klick lädt die Daten (exportMyData) und löst einen JSON-Datei-Download aus
 *    (Blob + Anker mit download="healrise-datenexport.json"),
 *  - Fehler zeigt eine Meldung und stürzt NICHT ab,
 *  - KEIN echter Netzwerk-Call: die API ist gemockt.
 */

const { navigateMock, exportMyDataMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  exportMyDataMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, username: 'Tester', email: 't@example.com', plan: 'premium' },
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock('../api/auth', () => ({
  updateMe: vi.fn(),
  changePassword: vi.fn(),
  setHealthConsent: vi.fn(),
  deleteAccount: vi.fn(),
  getBillingPortalUrl: vi.fn(),
  exportMyData: exportMyDataMock,
}));

import Account from './Account';

let anchors;
beforeEach(() => {
  navigateMock.mockReset();
  exportMyDataMock.mockReset();
  // jsdom kennt URL.createObjectURL nicht — stubben.
  URL.createObjectURL = vi.fn(() => 'blob:fake-url');
  URL.revokeObjectURL = vi.fn();
  // Erzeugte <a>-Elemente einsammeln (für die Download-Prüfung).
  anchors = [];
  const orig = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
    const el = orig(tag, ...args);
    if (tag === 'a') anchors.push(el);
    return el;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const exportButton = () => screen.getByRole('button', { name: /Daten herunterladen|Daten exportieren/i });

describe('Account – DSGVO-Datenexport', () => {
  it('zeigt einen „Meine Daten herunterladen"-Button', () => {
    render(<Account />);
    expect(exportButton()).toBeInTheDocument();
  });

  it('Klick lädt die Daten und löst den JSON-Download aus', async () => {
    exportMyDataMock.mockResolvedValueOnce({ account: { email: 't@example.com' }, purchases: [], progress: [] });
    render(<Account />);
    fireEvent.click(exportButton());

    await waitFor(() => expect(exportMyDataMock).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    // Ein Anker mit korrektem Dateinamen wurde erzeugt (Download).
    const dl = anchors.find((a) => a.download);
    expect(dl).toBeTruthy();
    expect(dl.download).toBe('healrise-datenexport.json');
  });

  it('Fehler beim Export zeigt eine Meldung, ohne Absturz', async () => {
    exportMyDataMock.mockRejectedValueOnce(new Error('boom'));
    render(<Account />);
    fireEvent.click(exportButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
