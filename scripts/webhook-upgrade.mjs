// Sendet einen lokal signierten checkout.session.completed an das laufende Strapi,
// um den echten Fulfillment-/Plan-Wechsel-Pfad ohne Live-Stripe zu testen.
//   node scripts/webhook-upgrade.mjs <userId> <plan>
import { createRequire } from 'node:module';
const require = createRequire('/opt/healrise/strapi/');
const Stripe = require('stripe');

const userId = process.argv[2];
const plan = process.argv[3] || 'premium';
// Lokales Test-Webhook-Secret aus der Umgebung (Fallback = lokaler Dev-Testwert).
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_local_test_secret_healrise';
const URL = 'http://127.0.0.1:9130/api/stripe/webhook';
const AMOUNTS = { healrise7: 6900, healrise14: 16900, premium: 39900 };

const event = {
  id: 'evt_browsertest', type: 'checkout.session.completed',
  data: { object: {
    id: `cs_test_bt_${userId}_${plan}`, amount_total: AMOUNTS[plan] ?? 6900,
    currency: 'eur', metadata: { userId: String(userId), plan },
  } },
};
const payload = JSON.stringify(event);
const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });

const res = await fetch(URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  body: payload,
});
console.log('status', res.status, (await res.text()).slice(0, 200));
