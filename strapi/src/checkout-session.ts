/**
 * P3.2/S-01: Reine Checkout-Flow-Logik (ohne Stripe-Call) — node-testbar.
 * Validiert die Kaufanfrage (§312f-Consent, Plan, kein Downgrade/Doppelkauf) und
 * baut die Stripe-Checkout-Session-Parameter. Der Controller (api/checkout) ruft
 * damit nur noch `new Stripe(...).checkout.sessions.create(params)`. KEIN
 * 'stripe'-Import, keine relativen Imports → per node --test stubbar (Analog M-01).
 *
 * Preise kommen aus Env (Cent, inkl. MwSt. — PAngV R10) mit Code-Fallback; die
 * Parität zu Landing/App ist über scripts/tests/*-price-parity.test.mjs gesperrt.
 */
type EnvGet = (key: string) => string | undefined;

export const PLAN_ORDER = ['freebie', 'healrise7', 'healrise14', 'premium'];

export const PLAN_PRICES: Record<string, { name: string; amountEnv: string; fallback: number }> = {
  healrise7: { name: 'HEALRISE 7', amountEnv: 'STRIPE_PRICE_HEALRISE7', fallback: 6900 },
  healrise14: { name: 'HEALRISE 14', amountEnv: 'STRIPE_PRICE_HEALRISE14', fallback: 16900 },
  premium: { name: 'HEALRISE Premium', amountEnv: 'STRIPE_PRICE_PREMIUM', fallback: 39900 },
};

const DEFAULT_APP_URL = 'https://services.frigew.ski/healrise/app';

export interface CheckoutInput {
  user: { id: number | string; email?: string; plan?: string; stripe_customer_id?: string };
  plan: string;
  consentImmediateDelivery: unknown;
}

export type CheckoutResult = { ok: false; message: string } | { ok: true; params: any };

export function buildCheckoutSession(input: CheckoutInput, env: EnvGet): CheckoutResult {
  const { user, plan, consentImmediateDelivery } = input;

  const priceInfo = PLAN_PRICES[plan];
  if (!priceInfo) return { ok: false, message: 'Unbekannter Plan' };

  // Kein Downgrade/Doppelkauf derselben Stufe (Plan T6.1.4).
  if (PLAN_ORDER.indexOf(plan) <= PLAN_ORDER.indexOf(user.plan || 'freebie')) {
    return { ok: false, message: 'Dieser Plan ist bereits freigeschaltet.' };
  }

  // § 356 Abs. 5 BGB: ohne dokumentierte Zustimmung zur sofortigen Bereitstellung
  // keine sofortige Freischaltung digitaler Inhalte (R8).
  if (!consentImmediateDelivery) {
    return {
      ok: false,
      message: 'Bitte bestätige die sofortige Bereitstellung und das Erlöschen des Widerrufsrechts.',
    };
  }

  const amount = parseInt(env(priceInfo.amountEnv) || '', 10) || priceInfo.fallback;
  // Frontend-Basis für success/cancel-Redirects — FRONTEND_URL bevorzugt,
  // APP_PUBLIC_URL als Fallback (konsistent mit Reset-/Mail-Links).
  const publicBase = (env('FRONTEND_URL') || env('APP_PUBLIC_URL') || DEFAULT_APP_URL).replace(/\/$/, '');

  // Persistenten Stripe-Customer sicherstellen (Billing-Portal P3.3). Bestehende
  // stripe_customer_id wiederverwenden; sonst Stripe zum Anlegen zwingen. `customer`
  // und `customer_email` schließen sich gegenseitig aus.
  const existingCustomer = user.stripe_customer_id;
  const customerParams = existingCustomer
    ? { customer: existingCustomer }
    : { customer_creation: 'always' as const, customer_email: user.email };

  const params = {
    mode: 'payment' as const,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount, // inkl. MwSt. (PAngV)
          product_data: {
            name: priceInfo.name,
            description: 'Digitaler Inhalt — Zugang wird sofort nach Zahlung freigeschaltet.',
          },
        },
      },
    ],
    ...customerParams,
    metadata: {
      userId: String(user.id),
      plan,
      consent_immediate_delivery: 'true',
    },
    success_url: `${publicBase}/upgrade/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicBase}/upgrade/abbruch`,
  };

  return { ok: true, params };
}
