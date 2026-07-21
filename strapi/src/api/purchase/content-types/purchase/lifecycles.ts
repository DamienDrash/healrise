/**
 * P3.5 (§ 312f BGB): Kaufbestätigungs-Mail nach dem Anlegen eines Purchase.
 *
 * Entkoppelt vom Webhook-Controller: der Stripe-Webhook legt den Purchase per
 * `strapi.db.query('api::purchase.purchase').create()` an (idempotent über
 * unique stripe_session_id) — dieser afterCreate-Hook löst danach die
 * Bestätigungsmail aus. Best effort: `notifyPurchaseCreated` wirft nie, ein
 * Mailfehler beeinträchtigt den gebuchten Kauf nicht (S-02: 2xx hängt an der
 * DB-Integrität, nicht an der Mail). Echter Versand erst mit P3.1-Runtime-
 * Secrets + Deploy; lokal/CI ist der Sender gestubbt getestet.
 */
import { notifyPurchaseCreated } from '../../../stripe-webhook/purchase-confirmation';

export default {
  async afterCreate(event: any) {
    const result = event?.result ?? {};
    const data = event?.params?.data ?? {};
    await notifyPurchaseCreated(strapi, {
      // user-Relation ist im db.query-Ergebnis ggf. nicht populiert → aus den
      // Eingabedaten fallback lesen.
      userId: result.user?.id ?? result.user ?? data.user,
      plan: result.plan ?? data.plan,
      amount_total: result.amount_total ?? data.amount_total ?? null,
      currency: result.currency ?? data.currency ?? 'eur',
    });
  },
};
