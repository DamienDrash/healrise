// Test-first für die Preis-Anzeige-Parität (P3.4 / S-03, PAngV).
// Erweitert die Env/Code-Parität um die TATSÄCHLICH angezeigten Brutto-Preise:
// die kanonische Cent-Quelle (strapi/src/stripe-config.ts: PLAN_PRICE_CENTS) muss
// mit den Code-Fallbacks im Checkout-Controller, der Landing-Page (card-price)
// UND der App (utils/plans.js) übereinstimmen. Rein statisches Parsen, kein
// Stripe/Netz/Secret. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

import { PLAN_PRICE_CENTS } from '../../strapi/src/stripe-config.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECKOUT = join(ROOT, 'strapi', 'src', 'checkout-session.ts');
const LANDING = join(ROOT, 'landing', 'index.html');
const APP_PLANS = join(ROOT, 'app', 'src', 'utils', 'plans.js');

const ENV_BY_PLAN = {
  healrise7: 'STRIPE_PRICE_HEALRISE7',
  healrise14: 'STRIPE_PRICE_HEALRISE14',
  premium: 'STRIPE_PRICE_PREMIUM',
};

const checkoutSrc = readFileSync(CHECKOUT, 'utf8');
const landingSrc = readFileSync(LANDING, 'utf8');
const appPlansSrc = readFileSync(APP_PLANS, 'utf8');

function checkoutFallback(envName) {
  const m = checkoutSrc.match(new RegExp(`amountEnv:\\s*'${envName}',\\s*fallback:\\s*(\\d+)`));
  assert.ok(m, `Checkout-Fallback für ${envName} nicht gefunden`);
  return parseInt(m[1], 10);
}

function landingCardPrices() {
  const re = /<p class="card-price"><sup>€<\/sup>(\d+)<\/p>/g;
  const out = [];
  let m;
  while ((m = re.exec(landingSrc)) !== null) out.push(parseInt(m[1], 10));
  return out;
}

function appPlanEuro(plan) {
  const m = appPlansSrc.match(new RegExp(`${plan}:[^}]*price:\\s*'(\\d+) €'`));
  assert.ok(m, `App-Preis (plans.js) für ${plan} nicht gefunden`);
  return parseInt(m[1], 10);
}

test('PLAN_PRICE_CENTS ist die kanonische Cent-Quelle für alle Kaufstufen', () => {
  assert.deepEqual(PLAN_PRICE_CENTS, { healrise7: 6900, healrise14: 16900, premium: 39900 });
});

const landing = landingCardPrices();

for (const [plan, cents] of Object.entries(PLAN_PRICE_CENTS)) {
  const euro = cents / 100;

  test(`${plan}: Checkout-Fallback == kanonische Cent-Quelle (${cents})`, () => {
    assert.equal(checkoutFallback(ENV_BY_PLAN[plan]), cents);
  });

  test(`${plan}: App-Anzeige (plans.js) == ${euro} €`, () => {
    assert.equal(appPlanEuro(plan), euro);
  });

  test(`${plan}: Landing-Anzeige (card-price) enthält ${euro} €`, () => {
    assert.ok(landing.includes(euro), `Landing zeigt ${euro} € nicht (gefunden: ${landing.join(', ')})`);
  });
}

test('Landing-Bezahlpreise (ohne Freebie €0) == die drei kanonischen Brutto-Preise', () => {
  const expected = Object.values(PLAN_PRICE_CENTS).map((c) => c / 100).sort((a, b) => a - b);
  const paid = landing.filter((p) => p > 0).sort((a, b) => a - b);
  assert.deepEqual(paid, expected);
});
