import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { getHeadingViolations } from '../test/headingHierarchy';

/**
 * A11y-Guard (WCAG 1.3.1 / 2.4.6): Heading-Hierarchie über die Seiten.
 * Kontext zählt: geschützte Seiten liegen in der AppShell, die den Routen-Titel
 * als EINZIGES <h1> rendert — Seiten-Inhalt beginnt bei <h2>. Öffentliche Seiten
 * (Login/Passwort-Reset) stehen standalone und brauchen ihr eigenes <h1>.
 */

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, username: 'Tester', email: 't@example.com', plan: 'freebie' },
    login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
  }),
}));

vi.mock('../api/auth', () => ({
  register: vi.fn(), login: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(),
  updateMe: vi.fn(), changePassword: vi.fn(), setHealthConsent: vi.fn(),
  deleteAccount: vi.fn(), getBillingPortalUrl: vi.fn(), exportMyData: vi.fn(),
}));

vi.mock('../api/checkout', () => ({ createCheckoutSession: vi.fn() }));

import AppShell from '../components/layout/AppShell';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import Upgrade from './Upgrade';
import { UpgradeSuccess, UpgradeCancel } from './UpgradeResult';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

// Geschützte Seite im AppShell-Layout rendern (Shell liefert das <h1>).
function inShell(child) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={child} />
        </Route>
      </Routes>
    </MemoryRouter>,
  ).container;
}
// Öffentliche Seite standalone rendern.
function standalone(child) {
  return render(<MemoryRouter initialEntries={['/x']}>{child}</MemoryRouter>).container;
}

describe('Heading-Hierarchie (A11y)', () => {
  it('AppShell liefert genau ein <h1>; Inhalts-<h2/h3> ergeben eine valide Hierarchie', () => {
    const c = inShell(<section><h2>Abschnitt</h2><h3>Unterpunkt</h3></section>);
    expect(getHeadingViolations(c)).toEqual([]);
  });

  it('UpgradeSuccess im AppShell: kein doppeltes <h1>', () => {
    expect(getHeadingViolations(inShell(<UpgradeSuccess />))).toEqual([]);
  });

  it('UpgradeCancel im AppShell: kein doppeltes <h1>', () => {
    expect(getHeadingViolations(inShell(<UpgradeCancel />))).toEqual([]);
  });

  it('Upgrade im AppShell: keine übersprungene Ebene (h1 → h2 → h3)', () => {
    expect(getHeadingViolations(inShell(<Upgrade />))).toEqual([]);
  });

  it('Login (standalone) hat genau ein <h1>', () => {
    expect(getHeadingViolations(standalone(<Login />))).toEqual([]);
  });

  it('ForgotPassword (standalone) hat genau ein <h1>', () => {
    expect(getHeadingViolations(standalone(<ForgotPassword />))).toEqual([]);
  });
});
