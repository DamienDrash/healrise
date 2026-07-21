/**
 * P3.4 / S-02: Fulfillment — Plan-Aktivierung bei checkout.session.completed.
 *   node --test strapi/tests/webhook-fulfillment.test.mjs
 *
 * KEIN echter Stripe-Call (Signatur lokal per HMAC), KEINE Mail (processCheckout
 * schickt keine — die läuft best-effort über den afterCreate-Lifecycle). Geprüft:
 * User-Auflösung (metadata.userId → client_reference_id → customer_email), Plan-
 * Zuweisung am User (plan + plan_purchased_at) und KEIN Downgrade.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';

import controller from '../src/api/stripe-webhook/controllers/stripe-webhook.ts';

const SECRET = 'whsec_test_fulfillment_p34';
const PURCHASE_UID = 'api::purchase.purchase';
const USER_UID = 'plugin::users-permissions.user';

function buildEvent({ metadata = {}, customer_email, client_reference_id, customer, amount = 16900 } = {}) {
  const object = { id: 'cs_test_ff', amount_total: amount, currency: 'eur', metadata };
  if (customer_email !== undefined) object.customer_email = customer_email;
  if (client_reference_id !== undefined) object.client_reference_id = client_reference_id;
  if (customer !== undefined) object.customer = customer;
  return { id: 'evt_ff', type: 'checkout.session.completed', data: { object } };
}

function makeCtx(event) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return {
    status: undefined,
    body: undefined,
    request: { headers: { 'stripe-signature': header }, body: { [Symbol.for('unparsedBody')]: payload } },
  };
}

/** Mock-strapi: findet User per id ODER email; protokolliert alle Calls. */
function makeStrapi({ user = { id: 7, email: 'kundin@example.com', plan: 'freebie' }, existing = null } = {}) {
  const calls = [];
  const query = (uid) => ({
    findOne: async ({ where }) => {
      calls.push({ uid, op: 'findOne', where });
      if (uid === PURCHASE_UID) return existing;
      if (uid === USER_UID) {
        if (where.id !== undefined && where.id === user.id) return user;
        if (where.email !== undefined && where.email === user.email) return user;
      }
      return null;
    },
    create: async (args) => { calls.push({ uid, op: 'create', args }); return { id: 1, ...args.data }; },
    update: async (args) => { calls.push({ uid, op: 'update', args }); return {}; },
  });
  return { calls, db: { query }, log: { info() {}, warn() {}, error() {} }, plugin: () => ({ service: () => ({ send: async () => {} }) }) };
}

async function run(ctx, strapi) {
  const prevStrapi = global.strapi;
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
  global.strapi = strapi;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  try { await controller.handle(ctx); } finally {
    global.strapi = prevStrapi;
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
  }
}

const upd = (strapi) => strapi.calls.find((c) => c.uid === USER_UID && c.op === 'update');

test('metadata.userId: Plan wird dem User zugewiesen (plan + plan_purchased_at)', async () => {
  const strapi = makeStrapi();
  await run(makeCtx(buildEvent({ metadata: { userId: '7', plan: 'healrise14' } })), strapi);
  const u = upd(strapi);
  assert.ok(u, 'User-Update (Plan-Aktivierung) fehlt');
  assert.equal(u.args.data.plan, 'healrise14');
  assert.ok(u.args.data.plan_purchased_at, 'plan_purchased_at gesetzt');
  assert.ok(strapi.calls.some((c) => c.uid === PURCHASE_UID && c.op === 'create'), 'Purchase gebucht');
});

test('stripe_customer_id (session.customer) wird für das Billing-Portal gespeichert', async () => {
  const strapi = makeStrapi();
  await run(makeCtx(buildEvent({ metadata: { userId: '7', plan: 'healrise14' }, customer: 'cus_ABC' })), strapi);
  const u = upd(strapi);
  assert.ok(u, 'User-Update erwartet');
  assert.equal(u.args.data.stripe_customer_id, 'cus_ABC');
  assert.equal(u.args.data.plan, 'healrise14');
});

test('KEIN Downgrade: höherer Bestandsplan bleibt (premium bleibt premium)', async () => {
  const strapi = makeStrapi({ user: { id: 7, email: 'k@example.com', plan: 'premium' } });
  await run(makeCtx(buildEvent({ metadata: { userId: '7', plan: 'healrise7' } })), strapi);
  assert.ok(strapi.calls.some((c) => c.op === 'create'), 'Purchase gebucht');
  assert.ok(!upd(strapi), 'kein Plan-Update (kein Downgrade)');
});

test('Fallback client_reference_id: User per ID auflösen wenn metadata.userId fehlt', async () => {
  const strapi = makeStrapi();
  await run(makeCtx(buildEvent({ metadata: { plan: 'healrise14' }, client_reference_id: '7' })), strapi);
  const u = upd(strapi);
  assert.ok(u, 'kein Plan-Update über client_reference_id');
  assert.equal(u.args.data.plan, 'healrise14');
});

test('Fallback customer_email: User per E-Mail auflösen wenn keine ID vorhanden', async () => {
  const strapi = makeStrapi();
  await run(makeCtx(buildEvent({ metadata: { plan: 'healrise14' }, customer_email: 'kundin@example.com' })), strapi);
  const u = upd(strapi);
  assert.ok(u, 'kein Plan-Update über customer_email');
  assert.equal(u.args.data.plan, 'healrise14');
  const create = strapi.calls.find((c) => c.uid === PURCHASE_UID && c.op === 'create');
  assert.equal(create.args.data.user, 7, 'Purchase mit aufgelöster User-ID verknüpft');
});
