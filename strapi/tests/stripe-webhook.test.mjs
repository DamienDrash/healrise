/**
 * Unit-Tests für den Stripe-Webhook-Handler (Audit S-02).
 *   node --test strapi/tests/stripe-webhook.test.mjs
 *
 * Kein laufendes Strapi, kein echter Stripe-Call, keine Zahlungen: die gültige
 * Signatur wird lokal per HMAC (Stripe.webhooks.generateTestHeaderString) erzeugt,
 * `strapi` ist ein Mock. Geprüft wird, dass checkout.session.completed erst nach
 * ERFOLGREICHER Verarbeitung mit 2xx bestätigt wird und ein DB-/Business-Fehler
 * zu 5xx führt (damit Stripe retryen kann), während Signatur-/Secret-/Idempotenz-
 * verhalten erhalten bleibt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

import controller from '../src/api/stripe-webhook/controllers/stripe-webhook.ts';
import { notifyPurchaseCreated } from '../src/api/stripe-webhook/purchase-confirmation.ts';

const SECRET = 'whsec_test_s02_unit';
const PURCHASE_UID = 'api::purchase.purchase';
const USER_UID = 'plugin::users-permissions.user';

const COMPLETED_EVENT = {
  id: 'evt_test_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_s02',
      amount_total: 1400,
      currency: 'eur',
      metadata: { userId: '7', plan: 'healrise14', consent_immediate_delivery: 'true' },
    },
  },
};

/** ctx mit gültiger Signatur über den rohen Payload (unparsedBody). */
function makeCtx(event, { secret = SECRET, signature } = {}) {
  const payload = JSON.stringify(event);
  const header = signature ?? Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return {
    status: undefined,
    body: undefined,
    request: {
      headers: signature === null ? {} : { 'stripe-signature': header },
      body: { [Symbol.for('unparsedBody')]: payload },
    },
  };
}

/** Mock-strapi mit konfigurierbarer Idempotenz-/Fehler-Injektion. */
function makeStrapi({ existing = null, user = { id: 7, plan: 'freebie' }, failCreate = false, failUpdate = false } = {}) {
  const calls = [];
  const query = (uid) => ({
    findOne: async ({ where }) => {
      calls.push({ uid, op: 'findOne', where });
      if (uid === PURCHASE_UID) return existing;
      if (uid === USER_UID) return user;
      return null;
    },
    create: async (args) => {
      calls.push({ uid, op: 'create', args });
      if (failCreate) throw new Error('injected DB failure: purchase.create');
      return { id: 999 };
    },
    update: async (args) => {
      calls.push({ uid, op: 'update', args });
      if (failUpdate) throw new Error('injected DB failure: user.update');
      return {};
    },
    updateMany: async (args) => {
      calls.push({ uid, op: 'updateMany', args });
      return { count: 1 };
    },
  });
  return { calls, db: { query }, log: { info() {}, warn() {}, error() {} } };
}

/** Handler mit gesetztem Mock-strapi + Secret ausführen; global sauber restaurieren. */
async function run(ctx, { strapi = makeStrapi(), secret = SECRET } = {}) {
  const prevStrapi = global.strapi;
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
  global.strapi = strapi;
  if (secret === null) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = secret;
  try {
    await controller.handle(ctx);
  } finally {
    global.strapi = prevStrapi;
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
  }
  return strapi;
}

// ── Kern-Bug S-02 ────────────────────────────────────────────────────────────
test('checkout.session.completed: DB-Fehler → 5xx, kein received:true', async () => {
  const ctx = makeCtx(COMPLETED_EVENT);
  await run(ctx, { strapi: makeStrapi({ failCreate: true }) });
  assert.ok(ctx.status >= 500, `erwartet 5xx bei Verarbeitungsfehler, war ${ctx.status}`);
  assert.notEqual(ctx.body?.received, true, 'kein falsches received:true bei Fehler');
});

test('checkout.session.completed: Erfolg → 200 received:true erst NACH Verarbeitung', async () => {
  const ctx = makeCtx(COMPLETED_EVENT);
  const strapi = await run(ctx);
  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, { received: true });
  // Verarbeitung ist tatsächlich gelaufen (Purchase angelegt) BEVOR bestätigt wurde.
  assert.ok(
    strapi.calls.some((c) => c.uid === PURCHASE_UID && c.op === 'create'),
    'processCheckoutCompleted muss vor der 2xx-Antwort ausgeführt worden sein',
  );
});

// ── Erhaltene Verhaltensweisen ───────────────────────────────────────────────
test('fehlendes STRIPE_WEBHOOK_SECRET → 503', async () => {
  const ctx = makeCtx(COMPLETED_EVENT);
  await run(ctx, { secret: null });
  assert.equal(ctx.status, 503);
});

test('fehlende Signatur → 400', async () => {
  const ctx = makeCtx(COMPLETED_EVENT, { signature: null });
  await run(ctx);
  assert.equal(ctx.status, 400);
});

test('ungültige Signatur → 400', async () => {
  const ctx = makeCtx(COMPLETED_EVENT, { signature: 't=1,v1=deadbeef' });
  await run(ctx);
  assert.equal(ctx.status, 400);
});

test('nicht relevanter Event-Typ → 200 received:true ohne Business-Verarbeitung', async () => {
  const ctx = makeCtx({ id: 'evt_x', type: 'payment_intent.succeeded', data: { object: {} } });
  const strapi = await run(ctx);
  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, { received: true });
  assert.equal(strapi.calls.length, 0, 'keine DB-Verarbeitung für irrelevante Events');
});

test('Idempotenz: vorhandene stripe_session_id → 200, kein erneuter Create', async () => {
  const ctx = makeCtx(COMPLETED_EVENT);
  const strapi = await run(ctx, { strapi: makeStrapi({ existing: { id: 1, stripe_session_id: 'cs_test_s02' } }) });
  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, { received: true });
  assert.ok(
    !strapi.calls.some((c) => c.op === 'create'),
    'Replay darf keinen neuen Purchase anlegen',
  );
});

// ── P3.3 / AC1.4: Kaufbestätigungs-Mail darf die Retry-Semantik nicht kippen ──
// Simuliert die Laufzeit-Kopplung: purchase.create feuert (wie der afterCreate-
// Lifecycle) die best-effort-Bestätigungsmail. Selbst wenn der email-Service
// wirft, muss der erfolgreiche Kauf am Webhook 2xx bleiben (kein falscher Retry).
test('P3.3: fehlgeschlagene Bestätigungsmail kippt den erfolgreichen Webhook NICHT', async () => {
  const mailAttempts = [];
  const user = { id: 7, email: 'kundin@example.com', plan: 'freebie' };
  const strapi = {
    calls: [],
    log: { info() {}, warn() {}, error() {} },
    plugin: () => ({
      service: () => ({
        send: async () => { mailAttempts.push(1); throw new Error('SMTP down (stub)'); },
      }),
    }),
    db: {
      query: (uid) => ({
        findOne: async () => (uid === USER_UID ? user : null),
        create: async (args) => {
          strapi.calls.push({ uid, op: 'create', args });
          // wie Strapis afterCreate-Lifecycle: best-effort-Mail nach dem Anlegen
          await notifyPurchaseCreated(strapi, {
            userId: user.id, plan: 'healrise14', amount_total: 16900, currency: 'eur',
          });
          return { id: 999 };
        },
        update: async () => ({}),
      }),
    },
  };

  const ctx = makeCtx(COMPLETED_EVENT);
  await run(ctx, { strapi });

  assert.equal(ctx.status, 200, 'erfolgreicher Kauf bleibt 2xx trotz Mailfehler');
  assert.deepEqual(ctx.body, { received: true });
  assert.equal(mailAttempts.length, 1, 'Mailversuch fand statt (best effort)');
  assert.ok(strapi.calls.some((c) => c.op === 'create'), 'Kauf wurde gebucht');
});

// ── Refund-/Cancel-Fulfillment: Plan-Downgrade (bewusste Absenkung) ───────────
const PREMIUM_USER = { id: 7, plan: 'premium', stripe_customer_id: 'cus_123' };
const REFUND_FULL = {
  id: 'evt_refund_full',
  type: 'charge.refunded',
  data: { object: { id: 'ch_1', customer: 'cus_123', refunded: true, amount: 39900, amount_refunded: 39900 } },
};
const REFUND_PARTIAL = {
  id: 'evt_refund_part',
  type: 'charge.refunded',
  data: { object: { id: 'ch_2', customer: 'cus_123', refunded: false, amount: 39900, amount_refunded: 5000 } },
};
const SUB_DELETED = {
  id: 'evt_sub_del',
  type: 'customer.subscription.deleted',
  data: { object: { id: 'sub_1', customer: 'cus_123' } },
};

/** Findet den User-Update-Call (Downgrade). */
const userUpdate = (strapi) => strapi.calls.find((c) => c.uid === USER_UID && c.op === 'update');
/** Findet den Purchase-updateMany-Call (Storno der Käufe). */
const purchaseRefund = (strapi) => strapi.calls.find((c) => c.uid === PURCHASE_UID && c.op === 'updateMany');

test('charge.refunded (voll): User wird auf freebie zurückgestuft → 200', async () => {
  const ctx = makeCtx(REFUND_FULL);
  const strapi = await run(ctx, { strapi: makeStrapi({ user: { ...PREMIUM_USER } }) });
  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, { received: true });
  const upd = userUpdate(strapi);
  assert.ok(upd, 'User muss aktualisiert (downgegradet) werden');
  assert.equal(upd.args.data.plan, 'freebie', 'Plan muss auf freebie gesenkt werden');
  // Lookup erfolgt über die Stripe-customer-id.
  assert.ok(strapi.calls.some((c) => c.uid === USER_UID && c.op === 'findOne' && c.where?.stripe_customer_id === 'cus_123'));
  // Zugehörige abgeschlossene Käufe werden auf 'refunded' storniert.
  const pr = purchaseRefund(strapi);
  assert.ok(pr, 'Purchase-Records müssen storniert werden (updateMany)');
  assert.equal(pr.args.where.user, 7);
  assert.equal(pr.args.where.status, 'completed');
  assert.equal(pr.args.data.status, 'refunded');
});

test('charge.refunded (Teil-Refund): KEIN Downgrade, keine Storno → 200', async () => {
  const ctx = makeCtx(REFUND_PARTIAL);
  const strapi = await run(ctx, { strapi: makeStrapi({ user: { ...PREMIUM_USER } }) });
  assert.equal(ctx.status, 200);
  assert.equal(userUpdate(strapi), undefined, 'Teil-Refund darf den Plan nicht senken');
  assert.equal(purchaseRefund(strapi), undefined, 'Teil-Refund darf keine Käufe stornieren');
});

test('customer.subscription.deleted: Downgrade + Purchase-Storno → 200', async () => {
  const ctx = makeCtx(SUB_DELETED);
  const strapi = await run(ctx, { strapi: makeStrapi({ user: { ...PREMIUM_USER } }) });
  assert.equal(ctx.status, 200);
  assert.equal(userUpdate(strapi)?.args.data.plan, 'freebie');
  assert.equal(purchaseRefund(strapi)?.args.data.status, 'refunded');
});

test('Refund für bereits-freebie-User: kein Update (idempotent) → 200', async () => {
  const ctx = makeCtx(REFUND_FULL);
  const strapi = await run(ctx, { strapi: makeStrapi({ user: { id: 7, plan: 'freebie', stripe_customer_id: 'cus_123' } }) });
  assert.equal(ctx.status, 200);
  assert.equal(userUpdate(strapi), undefined, 'bereits freebie → kein erneutes Update');
});

test('Refund ohne auflösbaren User (unbekannter customer) → 200, kein Crash', async () => {
  const ctx = makeCtx(REFUND_FULL);
  const strapi = await run(ctx, { strapi: makeStrapi({ user: null }) });
  assert.equal(ctx.status, 200);
  assert.equal(userUpdate(strapi), undefined);
});

test('Refund: Verarbeitungsfehler (DB-Update) → 5xx (Stripe-Retry), kein received:true', async () => {
  const ctx = makeCtx(REFUND_FULL);
  await run(ctx, { strapi: makeStrapi({ user: { ...PREMIUM_USER }, failUpdate: true }) });
  assert.ok(ctx.status >= 500, `erwartet 5xx bei Downgrade-Fehler, war ${ctx.status}`);
  assert.notEqual(ctx.body?.received, true);
});
