/**
 * P3.3 / M-02: Stripe Customer/Billing-Portal.
 *
 * Erstellt für den eingeloggten User eine Stripe-Billing-Portal-Session (Abo/
 * Rechnungen verwalten) und liefert die URL zurück. Voraussetzung: der User hat
 * eine `stripe_customer_id` (wird beim Kauf über den Webhook gespeichert).
 *
 * Testbar ohne echten Stripe-Call: die Session-Erzeugung ist als Dependency
 * `createPortalSession` injizierbar; ohne Injection wird der echte Stripe-SDK
 * genutzt (nur zur Laufzeit mit STRIPE_SECRET_KEY).
 */
import Stripe from 'stripe';

const USER_UID = 'plugin::users-permissions.user';
const DEFAULT_APP_URL = 'https://services.frigew.ski/healrise/app';
// Gepinnte Stripe-API-Version — MUSS mit STRIPE_API_VERSION (strapi/src/stripe-config.ts)
// übereinstimmen (per Guard scripts/tests/stripe-client.test.mjs abgesichert). Inline,
// weil dieser Controller direkt per node --test geladen wird und keine extensionlose
// relative .ts-Auflösung erlaubt (gleiches Muster wie der stripe-webhook-Controller).
const STRIPE_API_VERSION = '2023-10-16';

type EnvGet = (key: string) => string | undefined;
type PortalArgs = { customer: string; return_url: string };
type PortalSession = { url: string };

/** Rückkehr-URL des Portals → App-Konto-Seite. FRONTEND_URL, Fallback APP_PUBLIC_URL. */
export function portalReturnUrl(env: EnvGet): string {
  const base = (env('FRONTEND_URL') || env('APP_PUBLIC_URL') || DEFAULT_APP_URL).replace(/\/+$/, '');
  return `${base}/konto`;
}

/**
 * Controller-Factory für POST /api/users/me/billing-portal.
 *  - nicht eingeloggt → 401
 *  - kein `stripe_customer_id` → 400 (noch kein Kauf)
 *  - keine Stripe-Config (und keine Injection) → 503
 *  - sonst: { data: { url } } der Portal-Session (return_url → App-Konto)
 */
export function makeBillingPortalController(
  strapi: any,
  opts: { createPortalSession?: (args: PortalArgs) => Promise<PortalSession> } = {},
) {
  return async (ctx: any) => {
    const authUser = ctx.state && ctx.state.user;
    if (!authUser) return ctx.unauthorized();

    const user = await strapi.db.query(USER_UID).findOne({ where: { id: authUser.id } });
    const customerId = user?.stripe_customer_id;
    if (!customerId) {
      return ctx.badRequest('Noch kein Stripe-Kunde hinterlegt — bitte zuerst einen Kauf abschließen.');
    }

    // Test/Live-bewusste Key-Auflösung (außerhalb Production hat der Test-Key Vorrang).
    const nodeEnv = process.env.NODE_ENV;
    const secretKey =
      (nodeEnv !== 'production' && process.env.STRIPE_TEST_SECRET_KEY) || process.env.STRIPE_SECRET_KEY;
    if (!opts.createPortalSession && !secretKey) {
      ctx.status = 503;
      ctx.body = { error: { message: 'Abo-Verwaltung ist derzeit nicht verfügbar.' } };
      return;
    }

    const create =
      opts.createPortalSession ||
      (async ({ customer, return_url }: PortalArgs) => {
        // Cast: gepinnte STRIPE_API_VERSION vs. Stripes striktes „latest"-Literal
        // (zur Laufzeit gültig) — s. checkout.ts.
        const stripe = new Stripe(secretKey as string, {
          apiVersion: STRIPE_API_VERSION,
        } as unknown as ConstructorParameters<typeof Stripe>[1]);
        return stripe.billingPortal.sessions.create({ customer, return_url });
      });

    const session = await create({
      customer: customerId,
      return_url: portalReturnUrl((k) => process.env[k]),
    });
    ctx.body = { data: { url: session.url } };
  };
}
