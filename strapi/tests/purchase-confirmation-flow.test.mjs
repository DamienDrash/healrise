/**
 * P3.5: End-to-End-Flow Stripe-Webhook → Kaufbestätigungs-Mail (§ 312f).
 *   node --test strapi/tests/purchase-confirmation-flow.test.mjs
 *
 * KEIN echter Stripe-Call (gültige Signatur lokal per HMAC), KEIN echter
 * Mailversand: der Strapi-email-Service wird als CAPTURING-Stub überschrieben
 * (der korrekte Mock-Layer — er greift vor nodemailer). Geprüft wird der volle
 * Weg: signierter `checkout.session.completed` → Purchase-Create → (afterCreate-
 * Lifecycle simuliert) `notifyPurchaseCreated` → genau eine Mail mit korrekter
 * Adresse UND korrektem §312f-Template-Inhalt. Plus Idempotenz (kein Doppelversand).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

import controller from '../src/api/stripe-webhook/controllers/stripe-webhook.ts';
import { notifyPurchaseCreated } from '../src/api/stripe-webhook/purchase-confirmation.ts';

const SECRET = 'whsec_test_flow_p35';
const PURCHASE_UID = 'api::purchase.purchase';
const USER_UID = 'plugin::users-permissions.user';

const COMPLETED = {
  id: 'evt_flow_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_flow',
      amount_total: 16900,
      currency: 'eur',
      metadata: { userId: '7', plan: 'healrise14', consent_immediate_delivery: 'true' },
    },
  },
};

function makeCtx(event, { signature } = {}) {
  const payload = JSON.stringify(event);
  const header = signature ?? Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return {
    status: undefined,
    body: undefined,
    request: {
      headers: { 'stripe-signature': header },
      body: { [Symbol.for('unparsedBody')]: payload },
    },
  };
}

/** env-Stub für deterministische From-/App-URL im Mail-Builder. */
const MAIL_ENV = (key, def) =>
  ({ EMAIL_DEFAULT_FROM: 'no-reply@healrise.test', APP_PUBLIC_URL: 'https://services.frigew.ski/healrise/app' }[key] ?? def);

/**
 * Mock-strapi: purchase.create löst — wie der reale afterCreate-Lifecycle — die
 * best-effort-Bestätigungsmail über den (gestubbten) email-Service aus.
 * `existing` simuliert einen bereits vorhandenen Purchase (Idempotenz).
 */
function makeStrapi({ user = { id: 7, email: 'kundin@example.com', plan: 'freebie' }, existing = null } = {}) {
  const sent = [];
  const calls = [];
  const strapi = {
    sent,
    calls,
    log: { info() {}, warn() {}, error() {} },
    plugin: () => ({ service: () => ({ send: async (msg) => { sent.push(msg); } }) }),
    db: {
      query: (uid) => ({
        findOne: async () => {
          calls.push({ uid, op: 'findOne' });
          if (uid === PURCHASE_UID) return existing;
          if (uid === USER_UID) return user;
          return null;
        },
        create: async (args) => {
          calls.push({ uid, op: 'create', args });
          // afterCreate-Lifecycle nachbilden (best effort, wirft nie):
          await notifyPurchaseCreated(
            strapi,
            {
              userId: args.data.user,
              plan: args.data.plan,
              amount_total: args.data.amount_total,
              currency: args.data.currency,
            },
            MAIL_ENV,
          );
          return { id: 999, ...args.data };
        },
        update: async (args) => { calls.push({ uid, op: 'update', args }); return {}; },
      }),
    },
  };
  return strapi;
}

async function run(ctx, strapi) {
  const prevStrapi = global.strapi;
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
  global.strapi = strapi;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  try {
    await controller.handle(ctx);
  } finally {
    global.strapi = prevStrapi;
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
  }
}

test('voller Flow: signierter Webhook → 200 + genau eine Bestätigungsmail (Adresse + Inhalt)', async () => {
  const strapi = makeStrapi();
  const ctx = makeCtx(COMPLETED);
  await run(ctx, strapi);

  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, { received: true });
  assert.ok(strapi.calls.some((c) => c.uid === PURCHASE_UID && c.op === 'create'), 'Purchase angelegt');

  assert.equal(strapi.sent.length, 1, 'genau eine Mail');
  const mail = strapi.sent[0];
  assert.equal(mail.to, 'kundin@example.com', 'korrekte Empfängeradresse');
  assert.equal(mail.from, 'no-reply@healrise.test');
  assert.match(mail.subject, /HEALRISE 14/);
  // §312f-Template-Inhalt
  assert.match(mail.text, /169,00 €/);
  assert.match(mail.text, /Widerrufsrecht/i);
  assert.match(mail.text, /sofortige[nr]? Bereitstellung/i);
});

test('Idempotenz: Replay (vorhandener Purchase) → 200, KEINE Mail (kein Doppelversand)', async () => {
  const strapi = makeStrapi({ existing: { id: 1, stripe_session_id: 'cs_test_flow' } });
  const ctx = makeCtx(COMPLETED);
  await run(ctx, strapi);

  assert.equal(ctx.status, 200);
  assert.ok(!strapi.calls.some((c) => c.op === 'create'), 'kein erneuter Create');
  assert.equal(strapi.sent.length, 0, 'keine erneute Mail');
});

test('nicht relevanter Event-Typ → 200, keine Mail, keine Verarbeitung', async () => {
  const strapi = makeStrapi();
  const ctx = makeCtx({ id: 'evt_x', type: 'payment_intent.succeeded', data: { object: {} } });
  await run(ctx, strapi);

  assert.equal(ctx.status, 200);
  assert.equal(strapi.sent.length, 0);
  assert.equal(strapi.calls.length, 0);
});
