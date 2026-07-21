#!/usr/bin/env node
/**
 * HEALRISE Backend-API-Tests (Plan T1.3.3, T8.2) — läuft gegen ein laufendes Strapi.
 *   node tests/api-tests.mjs [--base http://127.0.0.1:9130]
 *
 * Voraussetzung: Testuser existiert (SEED_DEMO=true) — Testuser/Test2026!, Plan healrise14.
 * Deckt ab: Permissions-Matrix (Public/Auth), Gating-Matrix (Body-Stripping je Plan),
 * Selbst-Upgrade-Schutz, updateMe-Whitelist, changePassword.
 */

import { assertApiTestIsolation } from './test-isolation.mjs';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:9130';

// D-02: Harte Isolation VOR jedem Netzwerkzugriff — schreibende Tests dürfen nie
// versehentlich gegen Prod laufen (siehe strapi/tests/test-isolation.mjs).
assertApiTestIsolation({ env: process.env, base: BASE });

const TESTUSER = { identifier: 'Testuser', password: process.env.SEED_USER_PASSWORD || 'Test2026!' };
const PLAN_ORDER = ['freebie', 'healrise7', 'healrise14', 'premium'];

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function api(path, { method = 'GET', jwt, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* leerer Body ok */ }
  return { status: res.status, json };
}

async function login(identifier, password) {
  const { status, json } = await api('/api/auth/local', { method: 'POST', body: { identifier, password } });
  if (status !== 200) throw new Error(`Login ${identifier} fehlgeschlagen (${status}): ${JSON.stringify(json)}`);
  return json;
}

console.log(`API-Tests gegen ${BASE}\n`);

// ── 1. Permissions-Matrix: Public ────────────────────────────────────────
console.log('1. Public-Rolle (kein Token)');
{
  const progs = await api('/api/programs');
  check('GET /api/programs → 401/403', progs.status === 401 || progs.status === 403, `war ${progs.status}`);
  const me = await api('/api/users/me');
  check('GET /api/users/me → 401/403', me.status === 401 || me.status === 403, `war ${me.status}`);
  const users = await api('/api/users');
  check('GET /api/users → 401/403', users.status === 401 || users.status === 403, `war ${users.status}`);
}

// ── 2. Auth + Gating-Matrix ──────────────────────────────────────────────
console.log('2. Gating (Testuser, Plan healrise14)');
const { jwt, user } = await login(TESTUSER.identifier, TESTUSER.password);
check('Login liefert jwt + user', Boolean(jwt && user), JSON.stringify(user)?.slice(0, 80));

{
  const { status, json } = await api('/api/programs?pagination[pageSize]=100', { jwt });
  check('GET /api/programs → 200', status === 200, `war ${status}`);
  const data = json?.data ?? [];
  check('Alle Pläne sichtbar (auch premium — Metadaten für Paywall-UX)',
    ['freebie', 'healrise7', 'healrise14', 'premium'].every(p => data.some(d => d.plan_required === p)),
    `Pläne: ${[...new Set(data.map(d => d.plan_required))].join(',')}`);

  const userIdx = PLAN_ORDER.indexOf('healrise14');
  for (const p of data) {
    const reqIdx = PLAN_ORDER.indexOf(p.plan_required || 'freebie');
    const shouldLock = reqIdx > userIdx;
    check(`${p.slug} (${p.plan_required}): locked=${shouldLock}`,
      p.locked === shouldLock, `locked war ${p.locked}`);
    if (shouldLock) {
      check(`${p.slug}: body ist null (gestrippt)`, p.body == null, `body: ${String(p.body).slice(0, 40)}`);
    } else {
      check(`${p.slug}: body vorhanden`, typeof p.body === 'string' && p.body.length > 0);
    }
  }

  // findOne per documentId eines gesperrten Programms (Review B1)
  const lockedProg = data.find(d => d.plan_required === 'premium');
  if (lockedProg?.documentId) {
    const one = await api(`/api/programs/${lockedProg.documentId}`, { jwt });
    check('findOne gesperrtes Programm → 200 mit locked=true', one.status === 200 && one.json?.data?.locked === true, `status ${one.status}, locked ${one.json?.data?.locked}`);
    check('findOne gesperrtes Programm: body null', one.json?.data?.body == null);
  }

  // fields-Selektion darf das Gating nicht umgehen (fail-closed)
  const fieldsAttack = await api(`/api/programs?fields[0]=body&fields[1]=slug&pagination[pageSize]=100`, { jwt });
  const leaked = (fieldsAttack.json?.data ?? []).filter(d => d.plan_required === undefined && d.locked === false && d.body);
  const premiumViaFields = (fieldsAttack.json?.data ?? []).find(d => d.slug === lockedProg?.slug);
  check('fields-Selektion: premium body bleibt null', premiumViaFields ? premiumViaFields.body == null : true,
    JSON.stringify(premiumViaFields)?.slice(0, 80));
  check('fields-Selektion: kein fail-open Leak', leaked.length === 0, `${leaked.length} Leaks`);
}

// ── 3. Selbst-Upgrade-Schutz + updateMe-Whitelist (Review B3/F3) ─────────
console.log('3. User-Endpoints');
{
  const put = await api(`/api/users/${user.id}`, { method: 'PUT', jwt, body: { plan: 'premium' } });
  check('PUT /api/users/:id (plan) → 401/403 (user.update bleibt zu)',
    put.status === 401 || put.status === 403, `war ${put.status}`);

  const up1 = await api('/api/users/me', { method: 'PUT', jwt, body: { username: 'Testuser', plan: 'premium' } });
  check('PUT /api/users/me → 200 (Whitelist)', up1.status === 200, `war ${up1.status}: ${JSON.stringify(up1.json).slice(0, 100)}`);
  const me = await api('/api/users/me', { jwt });
  check('plan unverändert trotz plan im Payload', me.json?.plan === 'healrise14', `plan: ${me.json?.plan}`);

  const up2 = await api('/api/users/me', { method: 'PUT', jwt, body: { username: 'x' } });
  check('PUT /api/users/me username zu kurz → 400', up2.status === 400, `war ${up2.status}`);
}

// ── 4. Passwortänderung validiert currentPassword (Review F5) ────────────
console.log('4. changePassword');
{
  const wrong = await api('/api/auth/change-password', {
    method: 'POST', jwt,
    body: { currentPassword: 'falsch!', password: 'NeuesPw2026!', passwordConfirmation: 'NeuesPw2026!' },
  });
  check('falsches currentPassword → 400', wrong.status === 400, `war ${wrong.status}`);

  const right = await api('/api/auth/change-password', {
    method: 'POST', jwt,
    body: { currentPassword: TESTUSER.password, password: 'NeuesPw2026!', passwordConfirmation: 'NeuesPw2026!' },
  });
  check('korrektes currentPassword → 200', right.status === 200, `war ${right.status}: ${JSON.stringify(right.json).slice(0, 100)}`);

  // zurücksetzen, damit der Test idempotent bleibt
  if (right.status === 200) {
    const back = await api('/api/auth/change-password', {
      method: 'POST', jwt: right.json?.jwt || jwt,
      body: { currentPassword: 'NeuesPw2026!', password: TESTUSER.password, passwordConfirmation: TESTUSER.password },
    });
    check('Passwort zurückgesetzt', back.status === 200, `war ${back.status}`);
  }
}

// ── 5. Progress: Consent + Isolation je User (T5.1.5, T7.2, Art.-9) ──────
console.log('5. Progress');
{
  // Art.-9-Consent-Gate (Plan T7.2.2): ohne Einwilligung kein Tracking
  const revoke = await api('/api/users/me/health-consent', { method: 'PUT', jwt, body: { consent: false } });
  check('Consent-Widerruf → 200', revoke.status === 200, `war ${revoke.status}`);
  const denied = await api('/api/progress/willkommen', { method: 'PUT', jwt, body: { completed: true } });
  check('Toggle ohne Consent → 403', denied.status === 403, `war ${denied.status}`);
  const grant = await api('/api/users/me/health-consent', { method: 'PUT', jwt, body: { consent: true } });
  check('Consent erteilen → 200', grant.status === 200, `war ${grant.status}`);
  const meConsent = await api('/api/users/me', { jwt });
  check('health_consent_at am User gesetzt (protokolliert)', Boolean(meConsent.json?.health_consent_at));

  const suffix = Date.now().toString(36);
  const reg = await api('/api/auth/local/register', {
    method: 'POST',
    body: { username: `iso_${suffix}`, email: `iso_${suffix}@test.healrise.de`, password: 'IsoTest2026!', health_consent: true },
  });
  const jwtB = reg.json?.jwt;
  check('Zweituser registriert (jwt vorhanden)', Boolean(jwtB), `status ${reg.status}`);
  if (jwtB) {
    const meB = await api('/api/users/me', { jwt: jwtB });
    check('Register mit health_consent=true → Consent protokolliert', Boolean(meB.json?.health_consent_at));
  }

  const set = await api('/api/progress/willkommen', { method: 'PUT', jwt, body: { completed: true } });
  check('PUT /api/progress/:slug → 200', set.status === 200, `war ${set.status}`);

  const mine = await api('/api/progress', { jwt });
  check('GET /api/progress enthält eigenen Eintrag', Boolean(mine.json?.data?.willkommen), JSON.stringify(mine.json).slice(0, 80));

  if (jwtB) {
    const theirs = await api('/api/progress', { jwt: jwtB });
    check('User B sieht Eintrag von User A NICHT', !theirs.json?.data?.willkommen, JSON.stringify(theirs.json).slice(0, 80));

    const overwrite = await api('/api/progress/willkommen', { method: 'PUT', jwt: jwtB, body: { completed: true } });
    check('User B kann eigenen Eintrag anlegen (kein Konflikt mit A)', overwrite.status === 200);
    const mineAfter = await api('/api/progress', { jwt });
    check('Eintrag von A unverändert', Boolean(mineAfter.json?.data?.willkommen));
  }

  const unauth = await api('/api/progress');
  check('GET /api/progress ohne Token → 401/403', unauth.status === 401 || unauth.status === 403, `war ${unauth.status}`);

  const cleanup = await api('/api/progress/willkommen', { method: 'PUT', jwt, body: { completed: false } });
  check('Toggle off → 200 (idempotenter Cleanup)', cleanup.status === 200);

  // Widerruf löscht serverseitige Daten (T7.2.3)
  await api('/api/progress/consent-test', { method: 'PUT', jwt, body: { completed: true } });
  await api('/api/users/me/health-consent', { method: 'PUT', jwt, body: { consent: false } });
  const afterRevoke = await api('/api/progress', { jwt });
  check('Widerruf löscht alle Progress-Einträge', Object.keys(afterRevoke.json?.data ?? { x: 1 }).length === 0,
    JSON.stringify(afterRevoke.json).slice(0, 80));
  await api('/api/users/me/health-consent', { method: 'PUT', jwt, body: { consent: true } }); // wiederherstellen
}

// ── 6. Stripe: Checkout + Webhook-Signatur (Plan T6.1.5) ─────────────────
console.log('6. Stripe');
{
  const noConsent = await api('/api/checkout/session', { method: 'POST', jwt, body: { plan: 'premium' } });
  check('Checkout ohne Widerrufs-Consent → 400', noConsent.status === 400, `war ${noConsent.status}`);

  const downgrade = await api('/api/checkout/session', { method: 'POST', jwt, body: { plan: 'healrise7', consent_immediate_delivery: true } });
  check('Kauf niedrigerer Stufe → 400 (kein Downgrade)', downgrade.status === 400, `war ${downgrade.status}`);

  const session = await api('/api/checkout/session', { method: 'POST', jwt, body: { plan: 'premium', consent_immediate_delivery: true } });
  check('Checkout ohne STRIPE_SECRET_KEY → 503 (sauber deaktiviert) oder 200 (Key gesetzt)',
    session.status === 503 || session.status === 200, `war ${session.status}`);

  const noSig = await api('/api/stripe/webhook', { method: 'POST', body: { type: 'checkout.session.completed' } });
  check('Webhook ohne Signatur → 400', noSig.status === 400, `war ${noSig.status}`);

  const badSig = await fetch(`${BASE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=deadbeef' },
    body: JSON.stringify({ type: 'checkout.session.completed' }),
  });
  check('Webhook mit falscher Signatur → 400', badSig.status === 400, `war ${badSig.status}`);

  // Gültig signiertes Event (lokales whsec aus .env) → Plan-Freischaltung
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (whsec) {
    const { createHmac } = await import('node:crypto');
    const suffix = Date.now().toString(36);
    const reg = await api('/api/auth/local/register', {
      method: 'POST',
      body: { username: `buyer_${suffix}`, email: `buyer_${suffix}@test.healrise.de`, password: 'BuyerTest2026!' },
    });
    const buyer = reg.json?.user;
    const buyerJwt = reg.json?.jwt;
    check('Käufer-Testuser registriert', Boolean(buyer && buyerJwt));

    const sessionId = `cs_test_${suffix}`;
    const payload = JSON.stringify({
      id: `evt_test_${suffix}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          amount_total: 39900,
          currency: 'eur',
          metadata: { userId: String(buyer.id), plan: 'premium', consent_immediate_delivery: 'true' },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', whsec).update(`${t}.${payload}`).digest('hex');

    const send = () => fetch(`${BASE}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${v1}` },
      body: payload,
    });

    const ok = await send();
    check('Webhook mit gültiger Signatur → 200', ok.status === 200, `war ${ok.status}`);

    await new Promise(r => setTimeout(r, 500)); // asynchrone Verarbeitung
    const me = await api('/api/users/me', { jwt: buyerJwt });
    check('Käufer-Plan nach Webhook = premium', me.json?.plan === 'premium', `plan: ${me.json?.plan}`);

    const replay = await send();
    check('Replay desselben Events → 200, idempotent', replay.status === 200);
    await new Promise(r => setTimeout(r, 300));
    const me2 = await api('/api/users/me', { jwt: buyerJwt });
    check('Plan nach Replay unverändert', me2.json?.plan === 'premium');
  } else {
    console.log('  (STRIPE_WEBHOOK_SECRET nicht gesetzt — Signatur-Positivtest übersprungen)');
  }
}

console.log(`\nErgebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed > 0 ? 1 : 0);
