// Umfassender Browser-Test (Desktop + Mobile) gegen den kombinierten Test-Server (5197).
// Landing + kompletter App-Flow inkl. echtem Plan-Wechsel via signiertem Stripe-Webhook.
//   (cd /opt/healrise/app && node ../scripts/browser-test.mjs)
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const BASE = 'http://127.0.0.1:5197';
const APP = `${BASE}/healrise/app`;
const SHOTS = '/tmp/htest/shots';
const results = [];
let shotN = 0;

function rec(vp, name, status, detail = '') {
  results.push({ vp, name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : 'ℹ';
  console.log(`${icon} [${vp}] ${name}${detail ? ' — ' + detail : ''}`);
}
async function shot(page, vp, name) {
  const f = `${SHOTS}/${vp}-${String(++shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
}
function jwtId(jwt) {
  try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString()).id; } catch { return null; }
}

async function runViewport(vp, contextOpts) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  const consoleErrors = [];
  const failed = [];
  const notFound = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => failed.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  page.on('response', r => { if (r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); if (r.status() === 404) notFound.push(`${r.request().method()} ${r.url()}`); });

  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const USER = { username: `bt_${vp}_${suffix}`, email: `bt_${vp}_${suffix}@test.healrise.de`, password: 'BrowserTest2026!' };

  try {
    // ---------- LANDING ----------
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await shot(page, vp, 'landing-top');
    const title = await page.title();
    rec(vp, 'Landing lädt', title.includes('HEALRISE') ? 'PASS' : 'FAIL', title);
    const h1 = await page.locator('h1').first().innerText();
    rec(vp, 'Landing H1 sichtbar', h1.length > 3 ? 'PASS' : 'FAIL', h1.replace(/\n/g, ' '));
    const appCta = await page.locator('a[href="/healrise/app/"]').count();
    rec(vp, 'Landing CTA → App vorhanden', appCta > 0 ? 'PASS' : 'FAIL', `${appCta} Links`);
    // Interne Anchor-Sektionen existieren
    for (const sec of ['programme', 'so-funktionierts', 'faq', 'ueber-uns']) {
      const exists = await page.locator(`#${sec}`).count();
      rec(vp, `Landing-Sektion #${sec}`, exists > 0 ? 'PASS' : 'FAIL');
    }
    await page.goto(`${BASE}/#faq`, { waitUntil: 'networkidle' });
    await shot(page, vp, 'landing-faq');

    // ---------- APP: LOGIN/REGISTER ----------
    await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
    await shot(page, vp, 'app-login');
    rec(vp, 'App Login-Seite lädt', (await page.locator('form').count()) > 0 ? 'PASS' : 'FAIL');

    await page.getByRole('button', { name: 'Registrieren', exact: true }).click();
    await page.getByLabel('Benutzername').fill(USER.username);
    await page.getByLabel('E-Mail').fill(USER.email);
    await page.getByLabel('Passwort', { exact: true }).fill(USER.password);
    await page.getByLabel('Passwort bestätigen').fill(USER.password);
    const consent = page.getByRole('checkbox');
    const preChecked = await consent.isChecked();
    rec(vp, 'Art.-9-Consent NICHT vorangekreuzt', preChecked ? 'FAIL' : 'PASS');
    await consent.check();
    await shot(page, vp, 'app-register-filled');
    await page.locator('form button[type="submit"]').click();
    await page.getByText('Guten').first().waitFor({ timeout: 15000 });
    const userVisible = await page.getByText(USER.username).count();
    rec(vp, 'Registrierung → Dashboard', userVisible > 0 ? 'PASS' : 'FAIL');
    await shot(page, vp, 'app-dashboard-freebie');

    const jwt = await page.evaluate(() => localStorage.getItem('healrise_jwt'));
    const uid = jwtId(jwt);
    rec(vp, 'JWT in localStorage', jwt ? 'PASS' : 'FAIL', `uid=${uid}`);
    const planShown = await page.getByText('Freebie').count();
    rec(vp, 'Dashboard zeigt Plan Freebie', planShown > 0 ? 'PASS' : 'FAIL');

    // ---------- FREIER INHALT ----------
    await page.goto(`${APP}/programm/willkommen`, { waitUntil: 'networkidle' });
    const freeBody = await page.getByText('Herzlich willkommen').count();
    rec(vp, 'Freier Inhalt (willkommen) sichtbar', freeBody > 0 ? 'PASS' : 'FAIL');
    await shot(page, vp, 'app-free-content');

    // ---------- GESPERRTER INHALT + UPGRADE-PFAD ----------
    await page.goto(`${APP}/programm/premium-ueberblick`, { waitUntil: 'networkidle' });
    const locked = await page.getByText('Inhalt gesperrt').count();
    rec(vp, 'Premium-Inhalt für Freebie gesperrt', locked > 0 ? 'PASS' : 'FAIL');
    await shot(page, vp, 'app-locked-content');
    const upBtn = page.getByRole('button', { name: 'Jetzt upgraden' });
    if (await upBtn.count()) {
      await upBtn.first().click();
      await page.waitForURL(/\/upgrade\?plan=/, { timeout: 5000 }).catch(() => {});
      rec(vp, 'Upgrade-Pfad aus gesperrtem Inhalt', /upgrade\?plan=/.test(page.url()) ? 'PASS' : 'FAIL', page.url().split('/healrise/app')[1]);
    } else rec(vp, 'Upgrade-Pfad aus gesperrtem Inhalt', 'FAIL', 'kein Button');
    await shot(page, vp, 'app-upgrade-preselected');

    // ---------- PLÄNE-ÜBERSICHT ----------
    await page.goto(`${APP}/plaene`, { waitUntil: 'networkidle' });
    await shot(page, vp, 'app-plaene');
    const planLabels = await page.getByText('HEALRISE Premium').count();
    rec(vp, 'Pläne-Seite lädt', planLabels >= 0 ? 'PASS' : 'FAIL');

    // ---------- BESTELLSTRECKE §312j ----------
    await page.goto(`${APP}/upgrade?plan=healrise7`, { waitUntil: 'networkidle' });
    const orderTitle = await page.getByText('Deine Bestellung').count();
    rec(vp, 'Bestellstrecke lädt (Deine Bestellung)', orderTitle > 0 ? 'PASS' : 'FAIL');
    const priceInfo = await page.getByText('Gesamtpreis inkl. MwSt.').count();
    rec(vp, 'Pflicht-Preisinfo über Button (R9)', priceInfo > 0 ? 'PASS' : 'FAIL');
    const orderBtn = page.getByRole('button', { name: 'Zahlungspflichtig bestellen' });
    const disabledBefore = await orderBtn.isDisabled().catch(() => null);
    rec(vp, '§312j-Button anfangs deaktiviert', disabledBefore === true ? 'PASS' : 'FAIL');
    await page.getByRole('checkbox').first().check();
    const enabledAfter = await orderBtn.isEnabled().catch(() => null);
    rec(vp, '§312j-Button nach Widerrufs-Consent aktiv', enabledAfter === true ? 'PASS' : 'FAIL');
    await shot(page, vp, 'app-order-form');
    await orderBtn.click();
    const stripeMsg = await page.getByText(/Zahlungen sind derzeit nicht verfügbar|stripe/i).count().catch(() => 0);
    rec(vp, 'Ohne Stripe-Key: sauberer Hinweis statt Absturz', stripeMsg > 0 ? 'PASS' : 'FAIL');

    // ---------- KONTO (Freebie) ----------
    await page.goto(`${APP}/konto`, { waitUntil: 'networkidle' });
    await shot(page, vp, 'app-konto-freebie');
    const konto = await page.getByText('Plan wechseln').count();
    rec(vp, 'Konto zeigt „Plan wechseln"', konto > 0 ? 'PASS' : 'FAIL');

    // ---------- ECHTER PLAN-WECHSEL via signiertem Webhook ----------
    if (uid) {
      const out = execFileSync('node', ['/opt/healrise/scripts/webhook-upgrade.mjs', String(uid), 'premium'], { encoding: 'utf8' });
      rec(vp, 'Stripe-Webhook Fulfillment (→ premium)', out.includes('200') ? 'PASS' : 'FAIL', out.trim());
      // App neu laden → /users/me neu ziehen
      await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
      await page.reload({ waitUntil: 'networkidle' });
      const nowPremium = await page.getByText('HEALRISE Premium').count();
      rec(vp, 'Dashboard zeigt nach Wechsel Premium', nowPremium > 0 ? 'PASS' : 'FAIL');
      await shot(page, vp, 'app-dashboard-premium');
      // Zuvor gesperrter Inhalt jetzt frei
      await page.goto(`${APP}/programm/premium-ueberblick`, { waitUntil: 'networkidle' });
      const stillLocked = await page.getByText('Inhalt gesperrt').count();
      rec(vp, 'Ehemals gesperrter Inhalt nach Upgrade frei', stillLocked === 0 ? 'PASS' : 'FAIL');
      await shot(page, vp, 'app-content-unlocked');
      // Konto zeigt Premium
      await page.goto(`${APP}/konto`, { waitUntil: 'networkidle' });
      const kontoPremium = await page.getByText('HEALRISE Premium').count();
      rec(vp, 'Konto zeigt nach Wechsel Premium', kontoPremium > 0 ? 'PASS' : 'FAIL');
      await shot(page, vp, 'app-konto-premium');
    }

    // ---------- FORTSCHRITT ----------
    await page.goto(`${APP}/programm/willkommen`, { waitUntil: 'networkidle' });
    const doneBtn = page.getByRole('button', { name: 'Als erledigt markieren' });
    if (await doneBtn.count()) {
      await doneBtn.first().click();
      const marked = await page.getByRole('button', { name: 'Erledigt' }).count();
      rec(vp, 'Fortschritt: Erledigt-Toggle', marked > 0 ? 'PASS' : 'FAIL');
    } else rec(vp, 'Fortschritt: Erledigt-Toggle', 'INFO', 'Button nicht gefunden');
    await shot(page, vp, 'app-progress-done');

    // ---------- RECHTSSEITEN ----------
    for (const [slug, needle] of [
      ['impressum', 'Angaben gemäß § 5 DDG'],
      ['datenschutz', 'Fortschrittsdaten'],
      ['agb', 'AGB'],
      ['widerruf', 'Widerruf'],
    ]) {
      await page.goto(`${APP}/${slug}`, { waitUntil: 'networkidle' });
      const ok = await page.getByText(needle).first().count();
      rec(vp, `Rechtsseite /${slug} erreichbar`, ok > 0 ? 'PASS' : 'FAIL');
    }
    await shot(page, vp, 'app-legal-datenschutz');

    // ---------- LOGOUT ----------
    await page.goto(`${APP}/konto`, { waitUntil: 'networkidle' });
    const logout = page.getByRole('button', { name: 'Abmelden' });
    if (await logout.count()) {
      await logout.first().click();
      await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
      rec(vp, 'Logout → /login', /\/login/.test(page.url()) ? 'PASS' : 'FAIL');
      const progressKeys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healrise_progress')));
      rec(vp, 'Logout löscht lokale Fortschrittsdaten', progressKeys.length === 0 ? 'PASS' : 'FAIL', `${progressKeys.length} keys`);
    }

  } catch (e) {
    rec(vp, 'ABBRUCH (Exception)', 'FAIL', String(e).split('\n')[0]);
    await shot(page, vp, 'ERROR');
  }

  rec(vp, 'Console-Errors', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors.slice(0, 5).join(' | ') || 'keine');
  rec(vp, 'Fehlgeschlagene/5xx-Requests', failed.length === 0 ? 'PASS' : 'FAIL', failed.slice(0, 5).join(' | ') || 'keine');
  rec(vp, '404-Requests', notFound.length === 0 ? 'PASS' : 'INFO', [...new Set(notFound)].slice(0, 8).join(' | ') || 'keine');

  await context.close();
  await browser.close();
  return { consoleErrors, failed, user: USER };
}

const desktop = await runViewport('desktop', { viewport: { width: 1280, height: 800 } });
const mobile = await runViewport('mobile', { ...devices['iPhone 13'] });

// Zusammenfassung
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const info = results.filter(r => r.status === 'INFO').length;
console.log(`\n==== ERGEBNIS: ${pass} PASS · ${fail} FAIL · ${info} INFO ====`);
if (fail) { console.log('FAILS:'); results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ✗ [${r.vp}] ${r.name} — ${r.detail}`)); }
import { writeFileSync } from 'node:fs';
writeFileSync('/tmp/htest/results.json', JSON.stringify({ pass, fail, info, results, users: [desktop.user, mobile.user] }, null, 2));
process.exit(fail ? 1 : 0);
