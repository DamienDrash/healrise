import Stripe from 'stripe';
import { resolveStripeClientConfig } from '../../../stripe-config';
import { buildCheckoutSession } from '../../../checkout-session';

/**
 * Stripe-Checkout-Session für Einmalkauf-Stufen (Plan E6, Review F30).
 * Die Flow-Logik (Validierung, Preise, Session-Parameter) liegt in
 * strapi/src/checkout-session.ts und ist dort gestubbt unit-getestet
 * (scripts/tests/checkout-flow.test.mjs) — hier bleibt nur die Stripe-Anbindung.
 * Ohne STRIPE_SECRET_KEY ist der Endpoint sauber deaktiviert (503).
 */
export default {
  async createSession(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Eingaben IMMER zuerst validieren (vor der 503), damit die 503 keine echten
    // Request-Fehler maskiert. Reine, getestete Flow-Logik.
    const { plan, consent_immediate_delivery } = ctx.request.body || {};
    const result = buildCheckoutSession(
      { user, plan, consentImmediateDelivery: consent_immediate_delivery },
      (k) => process.env[k],
    );
    if ('message' in result) return ctx.badRequest(result.message);

    // Test-Key im Testmodus, Live-Key in Production (S-01/S-04) + gepinnte API-Version.
    const { secretKey, options } = resolveStripeClientConfig((k) => process.env[k], process.env.NODE_ENV);
    if (!secretKey) {
      ctx.status = 503;
      ctx.body = { error: { message: 'Zahlungen sind derzeit nicht verfügbar. Bitte kontaktiere den Support.' } };
      return;
    }

    // Cast: Stripes `apiVersion` ist ein striktes Literal auf die SDK-„latest"-
    // Version; wir pinnen bewusst eine ältere, stabile (STRIPE_API_VERSION) —
    // zur Laufzeit gültig, nur der TS-Literaltyp braucht den Cast.
    const stripe = new Stripe(secretKey, options as unknown as ConstructorParameters<typeof Stripe>[1]);
    const session = await stripe.checkout.sessions.create(result.params);

    ctx.body = { data: { url: session.url, id: session.id } };
  },
};
