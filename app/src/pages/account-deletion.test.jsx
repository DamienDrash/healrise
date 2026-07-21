import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

/**
 * P1.2 (Finding R-02): Konto-Löschung in der „Gefahrenzone".
 * Erwartetes Verhalten:
 *  - explizite Bestätigung (Checkbox) vor der endgültigen Löschung,
 *  - Fehler löst KEINEN Logout aus (Session bleibt bestehen),
 *  - Erfolg meldet ab (Session + lokaler Fortschritt) und navigiert zu /login,
 *  - die Datenschutzerklärung nennt den realen In-App-Weg und den Retention-Grund.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
// vi.hoisted, weil die Mock-Fns innerhalb der (hochgezogenen) Factories liegen.
const { navigateMock, logoutMock, refreshUserMock, deleteAccountMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  logoutMock: vi.fn(),
  refreshUserMock: vi.fn(),
  deleteAccountMock: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, username: 'Tester', email: 't@example.com', plan: 'healrise7' },
    logout: logoutMock,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock('../api/auth', () => ({
  updateMe: vi.fn(),
  changePassword: vi.fn(),
  setHealthConsent: vi.fn(),
  deleteAccount: deleteAccountMock,
}));

import Account from './Account';
import { Datenschutz } from './Legal';

const assignMock = vi.fn();
beforeEach(() => {
  navigateMock.mockReset();
  logoutMock.mockReset();
  refreshUserMock.mockReset();
  deleteAccountMock.mockReset();
  assignMock.mockReset();
  // Redirect zur Landing ist eine app-fremde Navigation → window.location.assign.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { assign: assignMock, href: 'http://localhost/healrise/app/konto' },
  });
});

describe('Account – Konto löschen (Gefahrenzone)', () => {
  it('zeigt einen „Konto löschen"-Auslöser in der Gefahrenzone', () => {
    render(<Account />);
    expect(screen.getByRole('button', { name: /^Konto löschen$/i })).toBeInTheDocument();
  });

  it('„Endgültig löschen" bleibt gesperrt, bis „LÖSCHEN" eingetippt ist', () => {
    render(<Account />);
    fireEvent.click(screen.getByRole('button', { name: /^Konto löschen$/i }));
    const finalBtn = screen.getByRole('button', { name: /Endgültig löschen/i });
    expect(finalBtn).toBeDisabled();
    // Falscher Text sperrt weiterhin.
    fireEvent.change(screen.getByRole('textbox', { name: /LÖSCHEN/i }), { target: { value: 'loeschen' } });
    expect(finalBtn).toBeDisabled();
    fireEvent.click(finalBtn);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it('Erfolg: „LÖSCHEN" eintippen → löscht, meldet ab und leitet zur Landing', async () => {
    deleteAccountMock.mockResolvedValueOnce(undefined);
    render(<Account />);
    fireEvent.click(screen.getByRole('button', { name: /^Konto löschen$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /LÖSCHEN/i }), { target: { value: 'LÖSCHEN' } });
    fireEvent.click(screen.getByRole('button', { name: /Endgültig löschen/i }));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith('/healrise/');
    // Kein SPA-Navigate — die Landing ist eine eigene Seite außerhalb der App.
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('führt bei zwei sofort ausgelösten Bestätigungen deleteAccount nur einmal aus', async () => {
    let resolveDelete;
    deleteAccountMock.mockImplementationOnce(() => new Promise((res) => { resolveDelete = res; }));
    render(<Account />);
    fireEvent.click(screen.getByRole('button', { name: /^Konto löschen$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /LÖSCHEN/i }), { target: { value: 'LÖSCHEN' } });
    const finalBtn = screen.getByRole('button', { name: /Endgültig löschen/i });

    // Zwei Klicks im selben Tick (vor jedem Re-Render) — nur eine synchrone Sperre hilft.
    await act(async () => {
      finalBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      finalBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(deleteAccountMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolveDelete(undefined); });
  });

  it('Fehler: bleibt eingeloggt (kein Logout, keine Navigation) und zeigt Fehlermeldung', async () => {
    deleteAccountMock.mockRejectedValueOnce(new Error('boom'));
    render(<Account />);
    fireEvent.click(screen.getByRole('button', { name: /^Konto löschen$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /LÖSCHEN/i }), { target: { value: 'LÖSCHEN' } });
    fireEvent.click(screen.getByRole('button', { name: /Endgültig löschen/i }));

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1));
    expect(logoutMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Konto konnte nicht gelöscht werden/i)).toBeInTheDocument();
  });
});

describe('Datenschutzerklärung – realer Löschweg & Retention', () => {
  it('nennt den In-App-Weg (Konto → Gefahrenzone) und den Retention-Grund für Käufe', () => {
    const { container } = render(<Datenschutz />);
    const text = container.textContent;
    expect(text).toMatch(/Gefahrenzone/);
    expect(text).toMatch(/Konto löschen/);
    // Retention-Grund: Kaufbelege bleiben trotz Löschung wegen Aufbewahrungspflicht.
    expect(text).toMatch(/Aufbewahrungspflicht|§ ?147 AO/);
  });
});
