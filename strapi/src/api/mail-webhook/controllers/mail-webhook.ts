/**
 * P3.1 (Postal): Mail-Webhook-Empfänger für Zustell-/Bounce-Events.
 *
 * Authentizität über die Postal-RSA-Signatur (Header `X-Postal-Signature`) gegen
 * den ROHEN Body (strapi::body mit includeUnparsed) und den öffentlichen Postal-
 * Schlüssel aus der Env (POSTAL_WEBHOOK_PUBLIC_KEY) — kein JWT. Ohne gültige
 * Signatur wird nichts verarbeitet. Es werden KEINE Mails versendet; Bounces
 * werden nur PII-sicher geloggt (siehe mail-webhook.ts). Kein Secret im Log.
 */
import { verifyPostalSignature, handlePostalEvent } from '../../../mail-webhook';

export default {
  async handle(ctx: any) {
    const publicKey = process.env.POSTAL_WEBHOOK_PUBLIC_KEY;
    if (!publicKey) {
      ctx.status = 503;
      ctx.body = { error: { message: 'Mail-Webhook nicht konfiguriert' } };
      return;
    }

    const signature = ctx.request.headers['x-postal-signature'];
    const unparsed = ctx.request.body?.[Symbol.for('unparsedBody')];
    if (!signature || !unparsed) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Fehlende Signatur' } };
      return;
    }

    const algo = process.env.POSTAL_WEBHOOK_SIGN_ALGO || 'sha256';
    if (!verifyPostalSignature(unparsed, signature, publicKey, algo)) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Ungültige Signatur' } };
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(typeof unparsed === 'string' ? unparsed : unparsed.toString('utf8'));
    } catch {
      ctx.status = 400;
      ctx.body = { error: { message: 'Ungültiges Payload' } };
      return;
    }

    // Best effort — wirft nie, versendet nichts.
    handlePostalEvent(strapi, payload);
    ctx.status = 200;
    ctx.body = { received: true };
  },
};
