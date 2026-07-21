// P3.3 / M-02: Stripe Customer/Billing-Portal-Endpoint (POST /api/users/me/billing-portal).
// Gesichert (nur eigener User), erstellt eine Stripe-Billing-Portal-Session und
// gibt die URL zurück. KEIN echter Stripe-Call: die Session-Erzeugung wird per
// Dependency injiziert (Mock). Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeBillingPortalController,
  portalReturnUrl,
} from '../../strapi/src/api/stripe-webhook/billing-portal.ts';

function makeCtx(user) {
  const ctx = {
    state: { user },
    status: undefined,
    body: undefined,
    unauthorized() { ctx._unauthorized = true; return 'UNAUTH'; },
    badRequest(msg) { ctx._badRequest = msg; return 'BAD'; },
  };
  return ctx;
}

function makeStrapi(fullUser) {
  return {
    db: { query: () => ({ findOne: async () => fullUser }) },
    log: { info() {}, warn() {}, error() {} },
  };
}

test('portalReturnUrl: FRONTEND_URL/konto (Fallback APP_PUBLIC_URL)', () => {
  assert.equal(
    portalReturnUrl((k) => ({ FRONTEND_URL: 'https://app.healrise.de' }[k])),
    'https://app.healrise.de/konto',
  );
  assert.equal(
    portalReturnUrl((k) => ({ APP_PUBLIC_URL: 'https://x/healrise/app/' }[k])),
    'https://x/healrise/app/konto',
  );
});

test('nicht eingeloggt → unauthorized', async () => {
  const ctrl = makeBillingPortalController(makeStrapi(null), { createPortalSession: async () => ({ url: 'x' }) });
  const ctx = makeCtx(null);
  await ctrl(ctx);
  assert.equal(ctx._unauthorized, true);
});

test('User ohne stripe_customer_id → badRequest (kein Portal)', async () => {
  const strapi = makeStrapi({ id: 7, stripe_customer_id: null });
  let called = false;
  const ctrl = makeBillingPortalController(strapi, { createPortalSession: async () => { called = true; return { url: 'x' }; } });
  const ctx = makeCtx({ id: 7 });
  await ctrl(ctx);
  assert.ok(ctx._badRequest, 'badRequest erwartet');
  assert.equal(called, false, 'keine Portal-Session ohne Customer');
});

test('User mit stripe_customer_id → Portal-URL + korrekte customer/return_url', async () => {
  const strapi = makeStrapi({ id: 7, stripe_customer_id: 'cus_123' });
  const captured = [];
  const ctrl = makeBillingPortalController(strapi, {
    createPortalSession: async (a) => { captured.push(a); return { url: 'https://billing.stripe.test/s/abc' }; },
  });
  const ctx = makeCtx({ id: 7 });
  await ctrl(ctx);
  assert.equal(ctx.body.data.url, 'https://billing.stripe.test/s/abc');
  assert.equal(captured[0].customer, 'cus_123');
  assert.match(captured[0].return_url, /\/konto$/);
});

test('ohne Stripe-Config und ohne Injection → 503', async () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const ctrl = makeBillingPortalController(makeStrapi({ id: 7, stripe_customer_id: 'cus_1' }));
    const ctx = makeCtx({ id: 7 });
    await ctrl(ctx);
    assert.equal(ctx.status, 503);
  } finally {
    if (prev === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prev;
  }
});
