/**
 * P3.1 (Postal): reine Logik für den Mail-Webhook-Empfänger — Signaturprüfung,
 * Event-Klassifizierung und best-effort-Verarbeitung von Zustell-/Bounce-Events.
 *
 * KEIN Strapi-/Netz-Import (nur node:crypto) → node-testbar. Der dünne Strapi-
 * Controller (`api/mail-webhook`) verifiziert damit die Postal-Webhook-Signatur
 * gegen den ROHEN Body und den öffentlichen Postal-Schlüssel (Env
 * POSTAL_WEBHOOK_PUBLIC_KEY) — analog zur Stripe-Signaturprüfung. Es werden
 * KEINE Mails versendet; Bounces werden nur PII-sicher geloggt (kein Empfänger-
 * Klartext), damit Zustellprobleme sichtbar werden, ohne den Betrieb zu stören.
 */
import crypto from 'node:crypto';

export interface PostalEventInfo {
  type: string;
  isBounce: boolean;
  isDelivery: boolean;
  messageId?: string | number;
  /** Maskierte Empfängeradresse (kein PII-Klartext), z. B. "k***@example.com". */
  recipientMasked?: string;
}

const BOUNCE_EVENTS = new Set(['MessageBounced', 'MessageDeliveryFailed']);
const DELIVERY_EVENTS = new Set(['MessageSent', 'MessageDelivered']);

/**
 * Prüft die Postal-Webhook-Signatur (RSA über den ROHEN Body, base64) gegen den
 * öffentlichen Postal-Schlüssel (PEM). `algo` = Signatur-Digest (Default sha256;
 * per POSTAL_WEBHOOK_SIGN_ALGO im Controller übersteuerbar). Gibt bei fehlenden/
 * ungültigen Eingaben false zurück und wirft nie.
 */
export function verifyPostalSignature(
  rawBody: string | Buffer,
  signatureB64: string,
  publicKeyPem: string,
  algo = 'sha256',
): boolean {
  if (!rawBody || !signatureB64 || !publicKeyPem) return false;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(signatureB64)) return false; // kein gültiges base64
  try {
    const verifier = crypto.createVerify(algo);
    verifier.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
    verifier.end();
    return verifier.verify(publicKeyPem, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

/** Empfängeradresse für Logs maskieren (kein PII-Klartext). */
function maskEmail(email?: string): string | undefined {
  if (!email || typeof email !== 'string' || !email.includes('@')) return undefined;
  const [local, domain] = email.split('@');
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}

/** Klassifiziert ein Postal-Webhook-Payload (`{ event, payload: { message } }`). */
export function classifyPostalEvent(payload: any): PostalEventInfo {
  const type = (payload && payload.event) || 'Unknown';
  const message = (payload && payload.payload && payload.payload.message) || {};
  return {
    type,
    isBounce: BOUNCE_EVENTS.has(type),
    isDelivery: DELIVERY_EVENTS.has(type),
    messageId: message.id ?? message.token ?? undefined,
    recipientMasked: maskEmail(message.to),
  };
}

export interface HandleResult {
  handled: boolean;
  type?: string;
  isBounce?: boolean;
}

/**
 * Best-effort-Verarbeitung: loggt Bounces als Warnung (PII-sicher, nur maskierte
 * Adresse + Message-ID), Zustellungen als Info. Wirft NIE — ein kaputtes Payload
 * oder Log-Fehler darf die Webhook-Antwort nicht kippen.
 */
export function handlePostalEvent(strapi: any, payload: any): HandleResult {
  try {
    const info = classifyPostalEvent(payload);
    const ref = info.messageId !== undefined ? `#${info.messageId}` : '(ohne ID)';
    if (info.isBounce) {
      strapi?.log?.warn?.(`Postal ${info.type}: Zustellung fehlgeschlagen ${ref}${info.recipientMasked ? ` an ${info.recipientMasked}` : ''}`);
      return { handled: true, type: info.type, isBounce: true };
    }
    if (info.isDelivery) {
      strapi?.log?.info?.(`Postal ${info.type}: Zustellung bestätigt ${ref}`);
      return { handled: true, type: info.type, isBounce: false };
    }
    // Tracking-/Sonstige Events: nicht relevant, still übergehen.
    return { handled: false, type: info.type, isBounce: false };
  } catch (err) {
    strapi?.log?.error?.(`Postal-Webhook-Handling fehlgeschlagen (best effort): ${err}`);
    return { handled: false };
  }
}
