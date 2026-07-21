// Test-first für die Kaufbestätigungs-Mail nach erfolgreichem Checkout (P3.5, §312f BGB).
// Rein lokal/gestubbt: KEIN echter SMTP-/Postal-/Stripe-Aufruf, keine realen
// Empfänger, keine Secrets. Geprüft werden (1) der reine Mail-Builder (Inhalt,
// Empfänger, Preis, Pflichthinweise), (2) der Sender über den gestubbten
// Strapi-email-Service und (3) dass der Webhook-Pfad processCheckoutCompleted
// die Bestätigung auslöst und ein Mailfehler den Kauf NICHT umwirft (best effort).
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import {
  buildPurchaseConfirmationEmail,
  sendPurchaseConfirmation,
  notifyPurchaseCreated,
  formatEuro,
} from '../../strapi/src/api/stripe-webhook/purchase-confirmation.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function makeEnv(vars = {}) {
  return (key, def) => (key in vars ? vars[key] : def);
}

/** Gestubbter Strapi mit email-Service-Capture + optionalem Send-Fehler. */
function makeStrapi({ user, failSend = false } = {}) {
  const sent = [];
  const calls = [];
  return {
    sent,
    calls,
    log: { info() {}, warn() {}, error() {} },
    db: {
      query: (uid) => ({
        findOne: async () => {
          calls.push({ uid, op: 'findOne' });
          if (uid === 'plugin::users-permissions.user') return user;
          return null;
        },
      }),
    },
    plugin: () => ({
      service: () => ({
        send: async (msg) => {
          if (failSend) throw new Error('SMTP down (stub)');
          sent.push(msg);
        },
      }),
    }),
  };
}

test('formatEuro: Cent → deutsche EUR-Darstellung', () => {
  assert.equal(formatEuro(16900), '169,00 €');
  assert.equal(formatEuro(6900), '69,00 €');
});

test('buildPurchaseConfirmationEmail: Empfänger, Plan, Preis und Pflichthinweise', () => {
  const msg = buildPurchaseConfirmationEmail({
    email: 'kundin@example.com',
    plan: 'healrise14',
    amountTotal: 16900,
    currency: 'eur',
    from: 'no-reply@example.com',
    replyTo: 'support@example.com',
    appUrl: 'https://services.frigew.ski/healrise/app',
  });
  assert.equal(msg.to, 'kundin@example.com');
  assert.equal(msg.from, 'no-reply@example.com');
  assert.equal(msg.replyTo, 'support@example.com');
  assert.match(msg.subject, /HEALRISE 14/);
  assert.match(msg.text, /169,00 €/);
  assert.match(msg.html, /169,00 €/);
  // §312f/§356 Abs. 5: Vertragsinhalt + Hinweis auf sofortige Bereitstellung/Widerruf
  assert.match(msg.text, /sofortige[nr]? Bereitstellung/i);
  assert.match(msg.text, /Widerrufsrecht/i);
  assert.match(msg.text, /services\.frigew\.ski\/healrise\/app/);
});

test('buildPurchaseConfirmationEmail: ungültige Eingaben werfen (keine Mail an Niemand)', () => {
  assert.throws(() => buildPurchaseConfirmationEmail({ email: '', plan: 'healrise14', amountTotal: 16900 }));
  assert.throws(() => buildPurchaseConfirmationEmail({ email: 'x@example.com', plan: 'freebie', amountTotal: 0 }));
});

test('buildPurchaseConfirmationEmail: fehlender Betrag (amountTotal=null) → "siehe Zahlungsbeleg"', () => {
  // Realistischer Stripe-Fall: amount_total kann null sein — die Mail darf NICHT
  // "0,00 €" o. Ä. behaupten, sondern verweist auf den Zahlungsbeleg. Kein Wurf.
  const msg = buildPurchaseConfirmationEmail({
    email: 'kundin@example.com',
    plan: 'healrise14',
    amountTotal: null,
    from: 'no-reply@example.com',
  });
  assert.match(msg.text, /siehe Zahlungsbeleg/);
  assert.match(msg.html, /siehe Zahlungsbeleg/);
  assert.doesNotMatch(msg.text, /0,00 €/, 'kein erfundener Nullpreis');
  // Pflichthinweise bleiben auch ohne Betrag erhalten.
  assert.match(msg.text, /Widerrufsrecht/i);
});

test('buildPurchaseConfirmationEmail: premium-Plan rendert das Label "HEALRISE Premium"', () => {
  const msg = buildPurchaseConfirmationEmail({
    email: 'kundin@example.com',
    plan: 'premium',
    amountTotal: 29900,
    from: 'no-reply@example.com',
  });
  assert.match(msg.subject, /HEALRISE Premium/);
  assert.match(msg.html, /HEALRISE Premium/);
  assert.match(msg.text, /299,00 €/);
});

test('buildPurchaseConfirmationEmail: enthält einen KLICKBAREN Link zum Produkt/App', () => {
  // §312f + UX: die Bestätigung muss den Weg zum gekauften Produkt aufzeigen.
  // Der HTML-Teil MUSS einen echten <a href> auf die App tragen (nicht nur den
  // URL-Text) — sonst wäre der Link in vielen Clients nicht klickbar.
  const appUrl = 'https://services.frigew.ski/healrise/app';
  const msg = buildPurchaseConfirmationEmail({
    email: 'kundin@example.com',
    plan: 'healrise14',
    amountTotal: 16900,
    from: 'no-reply@example.com',
    appUrl,
  });
  // Klickbarer Link (href) auf die App, wo die gekauften Inhalte liegen.
  assert.match(msg.html, new RegExp(`<a href="${appUrl.replace(/\//g, '\\/')}"[^>]*>`), 'kein klickbarer <a href> zum Produkt');
  // Produkt eindeutig benannt (Plan-Label) — der Kunde erkennt, wofür er den Link nutzt.
  assert.match(msg.html, /HEALRISE 14/);
  // Nicht-vakuum: ein reiner Text-Teil ohne <a> würde diesen Guard NICHT bestehen.
  assert.doesNotMatch('nur text ohne link', /<a href=/);
});

test('buildPurchaseConfirmationEmail: nennt Lifetime-/dauerhaften Zugang + Login-Hinweis', () => {
  // Einmalkauf (mode=payment) → dauerhafter Zugang, kein Abo. Die Bestätigung
  // muss das klar sagen und den Weg zum Login/zur App aufzeigen.
  const msg = buildPurchaseConfirmationEmail({
    email: 'kundin@example.com',
    plan: 'premium',
    amountTotal: 39900,
    from: 'no-reply@example.com',
    appUrl: 'https://services.frigew.ski/healrise/app',
  });
  for (const part of [msg.text, msg.html]) {
    assert.match(part, /dauerhaft/i, 'Hinweis auf dauerhaften/Lifetime-Zugang fehlt');
    assert.match(part, /kein Abo|einmaliger Kauf/i, 'Abgrenzung zum Abo/Einmalkauf fehlt');
  }
  // Login-/Anmelde-Hinweis (Weg zum Produkt).
  assert.match(msg.text, /melde dich|anmelden|einloggen/i, 'Login-Hinweis fehlt');
});

test('sendPurchaseConfirmation: nutzt den gestubbten email-Service mit korrektem Payload', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: 'kundin@example.com' } });
  await sendPurchaseConfirmation(
    strapi,
    { user: { id: 7, email: 'kundin@example.com' }, plan: 'healrise14', session: { amount_total: 16900, currency: 'eur' } },
    makeEnv({ SMTP_FROM: 'no-reply@example.com', SMTP_REPLY_TO: 'support@example.com', APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app' }),
  );
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, 'kundin@example.com');
  assert.match(strapi.sent[0].subject, /HEALRISE 14/);
});

test('sendPurchaseConfirmation: DEFAULT_FROM/DEFAULT_REPLY_TO (M-01) haben Vorrang', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: 'kundin@example.com' } });
  await sendPurchaseConfirmation(
    strapi,
    { user: { id: 7, email: 'kundin@example.com' }, plan: 'healrise7', session: { amount_total: 6900, currency: 'eur' } },
    // Nur die M-01-bevorzugten Keys gesetzt (kein EMAIL_DEFAULT_/SMTP_) — der
    // konfigurierte Absender MUSS greifen, nicht der no-reply@localhost-Fallback.
    makeEnv({ DEFAULT_FROM: 'no-reply@healrise.de', DEFAULT_REPLY_TO: 'support@healrise.de', FRONTEND_URL: 'https://services.frigew.ski/healrise/app' }),
  );
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].from, 'no-reply@healrise.de', 'DEFAULT_FROM muss Vorrang haben');
  assert.equal(strapi.sent[0].replyTo, 'support@healrise.de', 'DEFAULT_REPLY_TO muss Vorrang haben');
});

test('sendPurchaseConfirmation: Absender-Fallback-Kette DEFAULT_ > EMAIL_DEFAULT_ > SMTP_', async () => {
  // EMAIL_DEFAULT_FROM greift, wenn DEFAULT_FROM fehlt (Abwärtskompatibilität).
  const s1 = makeStrapi({ user: { id: 7, email: 'k@example.com' } });
  await sendPurchaseConfirmation(
    s1,
    { user: { id: 7, email: 'k@example.com' }, plan: 'healrise7', session: { amount_total: 6900 } },
    makeEnv({ EMAIL_DEFAULT_FROM: 'email-default@healrise.de', SMTP_FROM: 'smtp@healrise.de' }),
  );
  assert.equal(s1.sent[0].from, 'email-default@healrise.de');

  // SMTP_FROM als letzter Fallback, wenn DEFAULT_/EMAIL_DEFAULT_ fehlen.
  const s2 = makeStrapi({ user: { id: 7, email: 'k@example.com' } });
  await sendPurchaseConfirmation(
    s2,
    { user: { id: 7, email: 'k@example.com' }, plan: 'healrise7', session: { amount_total: 6900 } },
    makeEnv({ SMTP_FROM: 'smtp@healrise.de' }),
  );
  assert.equal(s2.sent[0].from, 'smtp@healrise.de');
});

test('notifyPurchaseCreated (Lifecycle-Pfad): löst genau eine Bestätigungsmail aus', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: 'kundin@example.com' } });
  const sentMail = await notifyPurchaseCreated(
    strapi,
    { userId: 7, plan: 'healrise14', amount_total: 16900, currency: 'eur' },
    makeEnv({ SMTP_FROM: 'no-reply@example.com', APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app' }),
  );
  assert.equal(sentMail, true);
  assert.equal(strapi.sent.length, 1, 'genau eine Bestätigungsmail');
  assert.equal(strapi.sent[0].to, 'kundin@example.com');
  assert.match(strapi.sent[0].subject, /HEALRISE 14/);
});

test('notifyPurchaseCreated: Mailfehler wirft NICHT (best effort, geloggt)', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: 'kundin@example.com' }, failSend: true });
  let result;
  await assert.doesNotReject(async () => {
    result = await notifyPurchaseCreated(strapi, { userId: 7, plan: 'healrise14', amount_total: 16900 });
  });
  assert.equal(result, false, 'best effort: kein Wurf, meldet false');
  assert.equal(strapi.sent.length, 0);
});

test('notifyPurchaseCreated: ohne Empfänger-Mail wird sauber übersprungen', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: null } });
  const sentMail = await notifyPurchaseCreated(strapi, { userId: 7, plan: 'healrise14', amount_total: 16900 });
  assert.equal(sentMail, false);
  assert.equal(strapi.sent.length, 0);
});

// Der Flow-Test simuliert den afterCreate-Hook im Mock. Dieser Guard sperrt die
// REALE Verdrahtung: bräche purchase/lifecycles.ts, bliebe der Flow-Test grün,
// aber Prod verschickte keine Bestätigungsmail mehr.
test('purchase/lifecycles.ts verdrahtet afterCreate → notifyPurchaseCreated (reale Trigger)', () => {
  const src = readFileSync(
    join(ROOT, 'strapi', 'src', 'api', 'purchase', 'content-types', 'purchase', 'lifecycles.ts'),
    'utf8',
  );
  assert.match(src, /import \{ notifyPurchaseCreated \} from ['"].*purchase-confirmation['"]/);
  assert.match(src, /async afterCreate\(/);
  assert.match(src, /notifyPurchaseCreated\(\s*strapi\s*,/);
  // Die Kauf-Daten werden weitergereicht (Empfänger/Plan/Betrag).
  for (const key of ['userId', 'plan', 'amount_total', 'currency']) {
    assert.match(src, new RegExp(`${key}:`), `lifecycles.ts reicht ${key} nicht an notifyPurchaseCreated`);
  }
});
