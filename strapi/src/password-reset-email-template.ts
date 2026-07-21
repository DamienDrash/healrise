/**
 * P3.1 / M-01: Deutsches Passwort-Reset-Mail-Template (Betreff + Body + Absender).
 *
 * Strapi seedet ein englisches Dummy-Template ("We heard that you lost your
 * password…") mit Absender "Administration Panel <no-reply@strapi.io>"
 * (node_modules/@strapi/plugin-users-permissions/server/bootstrap/index.js).
 * Der forgotPassword-Controller (server/controllers/auth.js) liest das Template
 * aus dem Plugin-Store (key 'email' → reset_password.options), templatet
 * `message`/`object` mit { URL, TOKEN, USER } und versendet über den
 * email-Service. URL = advanced.email_reset_password (via password-reset-url.ts).
 *
 * Hier wird das Template beim Bootstrap idempotent durch eine saubere deutsche
 * Fassung ersetzt und der Absender aus der M-01-Env-Kette abgeleitet
 * (DEFAULT_ > EMAIL_DEFAULT_ > SMTP_). Kein Mailversand hier — nur Konfiguration,
 * keine Secrets. `email_confirmation` und übrige Store-Keys bleiben erhalten.
 */

type EnvGet = (key: string, def?: string) => string | undefined;

const DEFAULT_FROM = 'no-reply@localhost';
const FROM_NAME = 'HEALRISE';

export interface ResetTemplate {
  object: string;
  message: string;
}

/**
 * Löst Absender/Antwortadresse konsistent zu config/plugins.ts + email-config.ts
 * (M-01) auf: DEFAULT_FROM/DEFAULT_REPLY_TO bevorzugt, dann EMAIL_DEFAULT_*, dann
 * SMTP_*; Reply-To fällt auf den Absender zurück. `env(key)` ohne Default liefert
 * undefined, wenn der Key fehlt → nächste Stufe.
 */
export function resolveResetSender(env: EnvGet): { from: string; replyTo: string } {
  const from = env('DEFAULT_FROM') || env('EMAIL_DEFAULT_FROM') || env('SMTP_FROM') || DEFAULT_FROM;
  const replyTo =
    env('DEFAULT_REPLY_TO') || env('EMAIL_DEFAULT_REPLY_TO') || env('SMTP_REPLY_TO') || from;
  return { from, replyTo };
}

/**
 * Baut das deutsche Reset-Template. `message` ist HTML mit dem vom Controller
 * ersetzten Platzhalter `<%= URL %>?code=<%= TOKEN %>` (Reset-Link) — kein echtes
 * Token, kein Secret im Klartext.
 */
export function buildPasswordResetEmailTemplate(): ResetTemplate {
  const object = 'HEALRISE — Passwort zurücksetzen';
  const message = [
    '<p>Hallo,</p>',
    '<p>du (oder jemand mit deiner E-Mail-Adresse) hat angefordert, dein ',
    'HEALRISE-Passwort zurückzusetzen. Über den folgenden Link kannst du ein ',
    'neues Passwort festlegen:</p>',
    '<p><a href="<%= URL %>?code=<%= TOKEN %>">Neues Passwort festlegen</a></p>',
    '<p>Der Link ist aus Sicherheitsgründen nur begrenzt gültig. Falls der Link ',
    'abgelaufen ist, fordere das Zurücksetzen einfach erneut an.</p>',
    '<p>Falls du das <strong>nicht</strong> warst, ignoriere diese E-Mail — dein ',
    'Passwort bleibt dann unverändert.</p>',
    '<p>Herzliche Grüße<br>Dein HEALRISE-Team</p>',
    '<p style="color:#888;font-size:12px">HEALRISE — Anbieterangaben siehe Impressum in der App.</p>',
  ].join('');
  return { object, message };
}

/**
 * Schreibt das deutsche Reset-Template + M-01-Absender idempotent in den
 * Plugin-Store (key 'email' → reset_password.options). Übrige E-Mail-Templates
 * (email_confirmation) und Store-Keys bleiben erhalten. Ist der Wert bereits
 * korrekt, findet kein Store-Write statt. Läuft im Bootstrap nach dem
 * Plugin-Seed. Gibt zurück, ob geschrieben wurde.
 */
export async function applyPasswordResetEmailTemplate(
  strapi: any,
  env: EnvGet = (key, def) => (process.env[key] ?? def),
): Promise<boolean> {
  const { from, replyTo } = resolveResetSender(env);
  const { object, message } = buildPasswordResetEmailTemplate();

  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const emails = (await pluginStore.get({ key: 'email' })) || {};
  const existingReset = emails.reset_password || {};

  const options = {
    ...(existingReset.options || {}),
    from: { name: FROM_NAME, email: from },
    response_email: replyTo,
    object,
    message,
  };

  // Idempotenz: nur schreiben, wenn sich das reset_password-Template ändert.
  if (JSON.stringify(existingReset.options) === JSON.stringify(options)) {
    return false;
  }

  const value = {
    ...emails,
    reset_password: {
      display: existingReset.display || 'Email.template.reset_password',
      icon: existingReset.icon || 'sync',
      options,
    },
  };
  await pluginStore.set({ key: 'email', value });
  strapi.log?.info?.('users-permissions: reset_password E-Mail-Template (DE, M-01-Absender) gesetzt');
  return true;
}
