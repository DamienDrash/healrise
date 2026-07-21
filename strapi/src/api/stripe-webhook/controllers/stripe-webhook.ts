import Stripe from 'stripe';

/**
 * Stripe-Webhook (Goldstandard T9/T10, Plan T6.1.3):
 * - Signaturprüfung über Stripe-Signature-Header (HMAC-SHA256) gegen den
 *   ROHEN Body (strapi::body mit includeUnparsed) — ohne gültige Signatur
 *   wird nichts freigeschaltet.
 * - Antwortet schnell mit 2xx; die Verarbeitung ist idempotent
 *   (unique stripe_session_id).
 * - checkout.session.completed hebt den Plan nur an (nie senken).
 * - charge.refunded (Voll-Erstattung) und customer.subscription.deleted stufen
 *   den User bewusst auf 'freebie' zurück (Zugang widerrufen) — der einzige Pfad,
 *   der den Plan senkt. Ebenfalls idempotent (bereits freebie → No-op).
 */
const PLAN_ORDER = ['freebie', 'healrise7', 'healrise14', 'premium'];
const PURCHASE_UID = 'api::purchase.purchase';
const USER_UID = 'plugin::users-permissions.user';

/**
 * Löst den User zu einer Checkout-Session auf (P3.4). Reihenfolge:
 * metadata.userId → client_reference_id (beides = interne User-ID) →
 * customer_email. Gibt den User oder null zurück.
 */
async function resolveSessionUser(session: any): Promise<any> {
  const rawId = session.metadata?.userId || session.client_reference_id || '';
  const userId = parseInt(rawId, 10);
  if (Number.isInteger(userId) && userId > 0) {
    const byId = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
    if (byId) return byId;
  }
  const email = session.customer_email || session.customer_details?.email;
  if (email) {
    const byEmail = await strapi.db.query(USER_UID).findOne({ where: { email } });
    if (byEmail) return byEmail;
  }
  return null;
}

async function processCheckoutCompleted(session: any) {
  const sessionId = session.id;
  const plan = session.metadata?.plan;

  if (!sessionId || !PLAN_ORDER.includes(plan) || plan === 'freebie') {
    strapi.log.warn(`Stripe-Webhook: unvollständige/ungültige Plan-Metadaten in Session ${sessionId}`);
    return;
  }

  // Idempotenz: Replays desselben Events ändern nichts (T6.1.5)
  const existing = await strapi.db.query(PURCHASE_UID).findOne({
    where: { stripe_session_id: sessionId },
  });
  if (existing) return;

  // Fulfillment: User über metadata.userId / client_reference_id / customer_email finden.
  const user = await resolveSessionUser(session);
  if (!user) {
    strapi.log.error(`Stripe-Webhook: kein User zu Session ${sessionId} auflösbar (userId/client_reference_id/email)`);
    return;
  }

  await strapi.db.query(PURCHASE_UID).create({
    data: {
      user: user.id,
      plan,
      stripe_session_id: sessionId,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? 'eur',
      status: 'completed',
      consent_immediate_delivery: session.metadata?.consent_immediate_delivery === 'true',
    },
  });

  // User-Update sammeln: (a) Stripe-Customer-ID für das Billing-Portal (P3.3),
  // (b) Plan-Aktivierung — nur anheben, nie senken (T6.1.4). Pläne laufen über
  // das `plan`-Feld am User (nicht über Rollen); serverseitiges Gating liest es.
  const updateData: any = {};
  if (session.customer && user.stripe_customer_id !== session.customer) {
    updateData.stripe_customer_id = session.customer;
  }
  if (PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(user.plan || 'freebie')) {
    updateData.plan = plan;
    updateData.plan_purchased_at = new Date();
  }
  if (Object.keys(updateData).length > 0) {
    await strapi.db.query(USER_UID).update({ where: { id: user.id }, data: updateData });
    strapi.log.info(`Stripe-Webhook: User ${user.id} aktualisiert [${Object.keys(updateData).join(', ')}] (Session ${sessionId})`);
  }
}

const BASE_PLAN = 'freebie';

/**
 * Refund-/Cancel-Fulfillment: stuft den User bei Voll-Erstattung (charge.refunded)
 * oder gekündigtem Abo (customer.subscription.deleted) auf den Basisplan zurück.
 * User-Auflösung über die Stripe-customer-id (beim Kauf am User gespeichert).
 * Idempotent (bereits Basisplan → No-op); Teil-Refunds lassen den Zugang bestehen.
 */
async function processRefundOrCancel(object: any, eventType: string) {
  const customerId = object?.customer;
  if (!customerId) {
    strapi.log.warn(`Stripe-Webhook: ${eventType} ohne customer — kein Downgrade möglich`);
    return;
  }

  // Bei charge.refunded nur bei VOLLER Erstattung zurückstufen; ein Teil-Refund
  // (refunded !== true) lässt den bezahlten Zugang bestehen.
  if (eventType === 'charge.refunded' && object.refunded !== true) {
    strapi.log.info(`Stripe-Webhook: Teil-Refund (customer ${customerId}) — Zugang bleibt bestehen`);
    return;
  }

  const user = await strapi.db.query(USER_UID).findOne({ where: { stripe_customer_id: customerId } });
  if (!user) {
    strapi.log.error(`Stripe-Webhook: ${eventType} — kein User zu customer ${customerId} auflösbar`);
    return;
  }

  // Zugehörige abgeschlossene Käufe stornieren (status → 'refunded'). Idempotent:
  // ein Replay findet keine 'completed'-Einträge mehr und ändert nichts.
  await strapi.db.query(PURCHASE_UID).updateMany({
    where: { user: user.id, status: 'completed' },
    data: { status: 'refunded' },
  });

  // Plan auf den Basisplan senken (Zugang widerrufen) — nur, falls nicht schon dort.
  if ((user.plan || BASE_PLAN) !== BASE_PLAN) {
    await strapi.db.query(USER_UID).update({
      where: { id: user.id },
      data: { plan: BASE_PLAN, plan_purchased_at: null },
    });
    strapi.log.info(`Stripe-Webhook: ${eventType} — User ${user.id} auf ${BASE_PLAN} zurückgestuft, Käufe storniert`);
  } else {
    strapi.log.info(`Stripe-Webhook: ${eventType} — User ${user.id} bereits auf ${BASE_PLAN}; Käufe storniert`);
  }
}

export default {
  async handle(ctx: any) {
    // Test-Webhook-Secret im Testmodus, Live in Production (spiegelt
    // resolveStripeWebhookSecret in stripe-config.ts; hier inline, weil dieser
    // Controller direkt per `node --test` geladen wird und keine relative
    // .ts-Extensionless-Auflösung erlaubt).
    const nodeEnv = process.env.NODE_ENV;
    const webhookSecret =
      (nodeEnv !== 'production' && process.env.STRIPE_WEBHOOK_TEST_SECRET) ||
      process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      ctx.status = 503;
      ctx.body = { error: { message: 'Webhook nicht konfiguriert' } };
      return;
    }

    const signature = ctx.request.headers['stripe-signature'];
    const unparsed = ctx.request.body?.[Symbol.for('unparsedBody')];
    if (!signature || !unparsed) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Fehlende Signatur' } };
      return;
    }

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(unparsed, signature, webhookSecret);
    } catch {
      ctx.status = 400;
      ctx.body = { error: { message: 'Ungültige Signatur' } };
      return;
    }

    // Erst verarbeiten, dann bestätigen (Audit S-02): 2xx nur nach erfolgreicher
    // lokaler Verarbeitung, damit ein DB-/Business-Fehler ein Stripe-Retry auslöst
    // statt fälschlich als erledigt zu gelten. Verarbeitung ist idempotent
    // (unique stripe_session_id), Replays sind daher gefahrlos.
    if (event.type === 'checkout.session.completed') {
      try {
        await processCheckoutCompleted(event.data.object);
      } catch (err) {
        strapi.log.error(`Stripe-Webhook-Verarbeitung fehlgeschlagen: ${err}`);
        ctx.status = 500;
        ctx.body = { error: { message: 'Verarbeitung fehlgeschlagen' } };
        return;
      }
    } else if (event.type === 'charge.refunded' || event.type === 'customer.subscription.deleted') {
      try {
        await processRefundOrCancel(event.data.object, event.type);
      } catch (err) {
        strapi.log.error(`Stripe-Webhook Refund/Cancel fehlgeschlagen: ${err}`);
        ctx.status = 500;
        ctx.body = { error: { message: 'Verarbeitung fehlgeschlagen' } };
        return;
      }
    }

    ctx.status = 200;
    ctx.body = { received: true };
  },
};
