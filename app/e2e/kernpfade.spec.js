import { test, expect } from '@playwright/test';

/**
 * E2E-Kernpfade (Plan T8.3.2): Registrierung mit Art.-9-Consent → Inhalte →
 * Gating-UX → Upgrade-Bestellstrecke (rechtliche Elemente) → Logout.
 */

const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const USER = {
  username: `e2e_${suffix}`,
  email: `e2e_${suffix}@test.healrise.de`,
  password: 'E2eTest2026!',
};

test.describe.configure({ mode: 'serial' });

test('Registrierung mit Consent führt ins Dashboard', async ({ page }) => {
  await page.goto('login');
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click();
  await page.getByLabel('Benutzername').fill(USER.username);
  await page.getByLabel('E-Mail').fill(USER.email);
  await page.getByLabel('Passwort', { exact: true }).fill(USER.password);
  await page.getByLabel('Passwort bestätigen').fill(USER.password);
  // Art.-9-Checkbox ist NICHT vorangekreuzt (R3)
  const consent = page.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await consent.check();
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText('Guten')).toBeVisible({ timeout: 15_000 }); // Begrüßung
  await expect(page.getByText(USER.username)).toBeVisible();
});

test('Freebie-User: freier Inhalt offen, Premium-Inhalt gesperrt mit Upgrade-Pfad', async ({ page }) => {
  await page.goto('login');
  await page.getByLabel('E-Mail oder Benutzername').fill(USER.email);
  await page.getByLabel('Passwort', { exact: true }).fill(USER.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText('Guten')).toBeVisible({ timeout: 15_000 });

  // Freier Inhalt: Body sichtbar
  await page.goto('programm/willkommen');
  await expect(page.getByText('Herzlich willkommen')).toBeVisible();

  // Premium-Inhalt: Metadaten sichtbar, Body gesperrt (Gating T8/B2)
  await page.goto('programm/premium-ueberblick');
  await expect(page.getByText('Inhalt gesperrt')).toBeVisible();
  await expect(page.getByText('Dein 6-Wochen-Weg')).toHaveCount(0);

  // Upgrade-Pfad aus dem gesperrten Inhalt heraus (U-Ableitung), Plan vorausgewählt
  await page.getByRole('button', { name: 'Jetzt upgraden' }).click();
  await expect(page).toHaveURL(/\/upgrade\?plan=premium/);
  await expect(page.getByText('Deine Bestellung')).toBeVisible();
});

test('Bestellstrecke: § 312j-Button erst nach Widerrufs-Checkbox aktiv', async ({ page }) => {
  await page.goto('login');
  await page.getByLabel('E-Mail oder Benutzername').fill(USER.email);
  await page.getByLabel('Passwort', { exact: true }).fill(USER.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText('Guten')).toBeVisible({ timeout: 15_000 });

  await page.goto('upgrade?plan=healrise7');
  await expect(page.getByText('Deine Bestellung')).toBeVisible();
  // Pflichtinfos direkt über dem Button (R9)
  await expect(page.getByText('Gesamtpreis inkl. MwSt.')).toBeVisible();

  const orderBtn = page.getByRole('button', { name: 'Zahlungspflichtig bestellen' });
  await expect(orderBtn).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(orderBtn).toBeEnabled();
  // Ohne Stripe-Key: sauberer Hinweis statt Absturz
  await orderBtn.click();
  await expect(page.getByText(/Zahlungen sind derzeit nicht verfügbar|stripe/i)).toBeVisible({ timeout: 10_000 });
});

test('Fortschritt: Erledigt-Toggle, Rechtsseiten, Logout löscht lokale Daten', async ({ page }) => {
  await page.goto('login');
  await page.getByLabel('E-Mail oder Benutzername').fill(USER.email);
  await page.getByLabel('Passwort', { exact: true }).fill(USER.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText('Guten')).toBeVisible({ timeout: 15_000 });

  // Erledigt markieren (Consent liegt vor)
  await page.goto('programm/willkommen');
  await page.getByRole('button', { name: 'Als erledigt markieren' }).click();
  await expect(page.getByRole('button', { name: 'Erledigt' })).toBeVisible();

  // Pflichtseiten öffentlich erreichbar (R6)
  await page.goto('impressum');
  await expect(page.getByText('Angaben gemäß § 5 DDG')).toBeVisible();
  await page.goto('datenschutz');
  await expect(page.getByText('Fortschrittsdaten (Gesundheitsdaten)')).toBeVisible();

  // Logout: lokale Fortschrittsdaten weg (F6)
  await page.goto('konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login/);
  const progressKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(k => k.startsWith('healrise_progress'))
  );
  expect(progressKeys).toEqual([]);
});
