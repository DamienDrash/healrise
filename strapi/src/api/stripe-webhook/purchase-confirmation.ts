/**
 * P3.5 (§ 312f BGB): Kaufbestätigungs-Mail nach erfolgreichem Stripe-Checkout.
 *
 * Reiner Builder + gestubbt testbarer Sender — KEINE Secrets, kein Log von
 * Zugangsdaten. Der eigentliche Versand läuft über den Strapi-email-Service
 * (nodemailer/Postal, konfiguriert in config/plugins.ts). Im Webhook-Pfad ist
 * der Versand best effort: ein Mailfehler darf den bereits gebuchten Kauf/das
 * Plan-Upgrade NICHT umwerfen (S-02: 2xx hängt an der DB-Integrität, nicht an
 * der Mail). Echter Versand ist erst mit P3.1-Runtime-Secrets + Deploy möglich.
 */

type EnvGet = (key: string, def?: string) => string | undefined;

export interface EmailMessage {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export interface PurchaseConfirmationInput {
  email: string;
  plan: string;
  amountTotal: number | null;
  currency?: string;
  from?: string;
  replyTo?: string;
  appUrl?: string;
}

const PLAN_LABELS: Record<string, string> = {
  healrise7: 'HEALRISE 7',
  healrise14: 'HEALRISE 14',
  premium: 'HEALRISE Premium',
};

const DEFAULT_FROM = 'no-reply@localhost';
const DEFAULT_APP_URL = 'https://services.frigew.ski/healrise/app';

/** Cent → deutsche EUR-Darstellung (z. B. 16900 → "169,00 €"). */
export function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/**
 * Baut die §312f-konforme Bestätigungs-Mail. Wirft bei fehlender Empfänger-
 * adresse oder unbekanntem/kostenlosem Plan (keine Mail „an Niemand").
 */
export function buildPurchaseConfirmationEmail(input: PurchaseConfirmationInput): EmailMessage {
  const { email, plan, amountTotal, currency = 'eur' } = input;
  if (!email || !email.includes('@')) {
    throw new Error('Kaufbestätigung: gültige Empfängeradresse fehlt');
  }
  const label = PLAN_LABELS[plan];
  if (!label) {
    throw new Error(`Kaufbestätigung: unbekannter/kostenloser Plan "${plan}"`);
  }

  const from = input.from || DEFAULT_FROM;
  const replyTo = input.replyTo || from;
  const appUrl = (input.appUrl || DEFAULT_APP_URL).replace(/\/+$/, '');
  const priceLine =
    typeof amountTotal === 'number' && amountTotal > 0
      ? `${formatEuro(amountTotal)} (inkl. MwSt., ${currency.toUpperCase()})`
      : 'siehe Zahlungsbeleg';

  const subject = `Deine HEALRISE-Kaufbestätigung — ${label}`;

  const text = [
    'Vielen Dank für deinen Kauf bei HEALRISE.',
    '',
    'Bestätigung deines Vertrags (§ 312f BGB):',
    `• Leistung: ${label} — digitaler Inhalt (sofortiger Zugang)`,
    '• Zugang: dauerhaft — einmaliger Kauf, kein Abo, keine wiederkehrende Zahlung',
    `• Preis: ${priceLine}`,
    '',
    'Du hast der sofortigen Bereitstellung ausdrücklich zugestimmt und zur',
    'Kenntnis genommen, dass dein Widerrufsrecht mit Beginn der Ausführung',
    'erlischt (§ 356 Abs. 5 BGB).',
    '',
    `Melde dich in der App an, um deine Inhalte dauerhaft zu nutzen: ${appUrl}`,
    'Fragen? Antworte einfach auf diese E-Mail.',
    '',
    'HEALRISE — Anbieterangaben siehe Impressum in der App.',
  ].join('\n');

  const html =
    `<p>Vielen Dank für deinen Kauf bei HEALRISE.</p>` +
    `<p><strong>Bestätigung deines Vertrags (§ 312f BGB):</strong></p>` +
    `<ul><li>Leistung: <strong>${label}</strong> — digitaler Inhalt (sofortiger Zugang)</li>` +
    `<li>Zugang: <strong>dauerhaft</strong> — einmaliger Kauf, kein Abo, keine wiederkehrende Zahlung</li>` +
    `<li>Preis: ${priceLine}</li></ul>` +
    `<p>Du hast der sofortigen Bereitstellung ausdrücklich zugestimmt und zur Kenntnis genommen, ` +
    `dass dein Widerrufsrecht mit Beginn der Ausführung erlischt (§ 356 Abs. 5 BGB).</p>` +
    `<p>Melde dich in der App an, um deine Inhalte dauerhaft zu nutzen: <a href="${appUrl}">${appUrl}</a><br>` +
    `Fragen? Antworte einfach auf diese E-Mail.</p>` +
    `<p>HEALRISE — Anbieterangaben siehe Impressum in der App.</p>`;

  return { to: email, from, replyTo, subject, text, html };
}

/**
 * Versendet die Bestätigungsmail über den Strapi-email-Service. Empfänger/Plan/
 * Preis werden aus User + Stripe-Session abgeleitet; From/ReplyTo/AppUrl aus Env
 * (SMTP_FROM/SMTP_REPLY_TO/APP_PUBLIC_URL). Kein Secret-Logging.
 */
export async function sendPurchaseConfirmation(
  strapi: any,
  args: { user: any; plan: string; session: any },
  env: EnvGet = (key, def) => (process.env[key] ?? def),
): Promise<void> {
  const { user, plan, session } = args;
  // Absender-Auflösung konsistent mit config/plugins.ts + email-config.ts (M-01):
  // DEFAULT_FROM/DEFAULT_REPLY_TO bevorzugt, dann EMAIL_DEFAULT_*, dann SMTP_*.
  // `env(key)` ohne Default liefert undefined, wenn der Key fehlt → nächste Stufe.
  const from =
    env('DEFAULT_FROM') || env('EMAIL_DEFAULT_FROM') || env('SMTP_FROM') || DEFAULT_FROM;
  const replyTo =
    env('DEFAULT_REPLY_TO') || env('EMAIL_DEFAULT_REPLY_TO') || env('SMTP_REPLY_TO') || from;
  const msg = buildPurchaseConfirmationEmail({
    email: user?.email,
    plan,
    amountTotal: session?.amount_total ?? null,
    currency: session?.currency ?? 'eur',
    from,
    replyTo,
    appUrl: env('FRONTEND_URL') || env('APP_PUBLIC_URL') || DEFAULT_APP_URL,
  });
  await strapi.plugin('email').service('email').send(msg);
}

const USER_UID = 'plugin::users-permissions.user';

/**
 * Best-effort-Orchestrator für den Kauf-Lifecycle (afterCreate): lädt den User
 * anhand der Purchase, baut und versendet die Bestätigungsmail. Wirft NIE — ein
 * Mailfehler darf den bereits gebuchten Kauf nicht beeinträchtigen; er wird
 * geloggt (ohne Secrets). Gibt zurück, ob eine Mail versendet wurde.
 */
export async function notifyPurchaseCreated(
  strapi: any,
  purchase: { userId?: number; plan?: string; amount_total?: number | null; currency?: string },
  env: EnvGet = (key, def) => (process.env[key] ?? def),
): Promise<boolean> {
  try {
    const { userId, plan } = purchase;
    if (!userId || !plan) return false;
    const user = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
    if (!user?.email) {
      strapi.log?.warn?.(`Kaufbestätigung: kein E-Mail-Empfänger für User ${userId} — übersprungen`);
      return false;
    }
    await sendPurchaseConfirmation(
      strapi,
      { user, plan, session: { amount_total: purchase.amount_total ?? null, currency: purchase.currency ?? 'eur' } },
      env,
    );
    return true;
  } catch (err) {
    strapi.log?.error?.(`Kaufbestätigungs-Mail fehlgeschlagen (Kauf gebucht, best effort): ${err}`);
    return false;
  }
}
