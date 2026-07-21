/**
 * P3.1: Lokale Readiness-/Blocker-Validierung der E-Mail-/Postal-Konfiguration.
 *
 * Zweck: Betreiber/CI können VOR echtem Versand prüfen, ob die SMTP/Postal-Env
 * vollständig und konsistent ist — OHNE eine echte SMTP-Verbindung aufzubauen und
 * OHNE Secrets zu loggen. Reine Funktion (kein Netzwerk, kein nodemailer-Import).
 * Meldungen enthalten ausschließlich Env-NAMEN, niemals Werte/Secrets.
 *
 * Der Provider selbst wird in config/plugins.ts (nodemailer) aus denselben
 * SMTP_*-Env gelesen; der Passwort-Reset-Link aus APP_PUBLIC_URL + PASSWORD_RESET_PATH
 * (strapi/src/password-reset-url.ts).
 */

type EnvGet = (key: string, def?: string) => string | undefined;

export interface EmailReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * Validiert die E-Mail-Konfiguration. `forRealDelivery` (Default false) verschärft
 * die Prüfung für den echten Versand (kein Loopback-Host). `ready` = keine Blocker.
 */
export function validateEmailConfig(
  env: EnvGet,
  opts: { forRealDelivery?: boolean } = {},
): EmailReadiness {
  const forRealDelivery = opts.forRealDelivery ?? false;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const host = env('SMTP_HOST', 'localhost') || 'localhost';
  const isLoopback = LOOPBACK_HOSTS.includes(host.toLowerCase());
  if (forRealDelivery && isLoopback) {
    blockers.push('SMTP_HOST ist ein Loopback-Host — für echte Zustellung Postal/SMTP-Host setzen');
  } else if (isLoopback) {
    warnings.push('SMTP_HOST ist lokal (Loopback) — nur für lokale Tests, keine echte Zustellung');
  }

  // Port: positive Ganzzahl
  const port = env('SMTP_PORT', '25');
  if (port !== undefined && !/^\d+$/.test(port)) {
    blockers.push('SMTP_PORT muss eine positive Ganzzahl sein');
  } else if (port !== undefined && parseInt(port, 10) <= 0) {
    blockers.push('SMTP_PORT muss eine positive Ganzzahl sein');
  }

  // Secure: boolean-ish
  const secure = env('SMTP_SECURE');
  if (secure !== undefined && !/^(true|false)$/i.test(secure)) {
    warnings.push('SMTP_SECURE sollte true/false sein (Default false)');
  }

  // Auth-Paar: entweder beide oder keiner (Postal lokal darf ohne Auth laufen)
  const user = env('SMTP_USERNAME');
  const pass = env('SMTP_PASSWORD');
  const hasUser = !!user;
  const hasPass = !!pass;
  if (hasUser !== hasPass) {
    blockers.push('SMTP_USERNAME/SMTP_PASSWORD nur teilweise gesetzt — beide oder keiner setzen');
  } else if (!hasUser && forRealDelivery && !isLoopback) {
    blockers.push('SMTP_USERNAME/SMTP_PASSWORD fehlen — echte Postal-Zustellung erfordert Auth');
  }

  // Absenderadresse — DEFAULT_FROM bevorzugt (M-01), dann EMAIL_DEFAULT_FROM, dann SMTP_FROM.
  const from = env('DEFAULT_FROM') || env('EMAIL_DEFAULT_FROM') || env('SMTP_FROM');
  if (!from) {
    blockers.push('DEFAULT_FROM/EMAIL_DEFAULT_FROM/SMTP_FROM fehlt (Absenderadresse)');
  } else if (!from.includes('@')) {
    blockers.push('DEFAULT_FROM/EMAIL_DEFAULT_FROM/SMTP_FROM ist keine gültige Adresse');
  }

  // Reply-To optional, aber falls gesetzt gültig (DEFAULT_REPLY_TO / EMAIL_DEFAULT_REPLY_TO / SMTP_REPLY_TO).
  const replyTo = env('DEFAULT_REPLY_TO') || env('EMAIL_DEFAULT_REPLY_TO') || env('SMTP_REPLY_TO');
  if (replyTo && !replyTo.includes('@')) {
    blockers.push('DEFAULT_REPLY_TO/EMAIL_DEFAULT_REPLY_TO/SMTP_REPLY_TO ist keine gültige Adresse');
  }

  // Reset-Link-Basis: absolute App-URL, nicht /cms|/admin. FRONTEND_URL bevorzugt
  // (P3.1), APP_PUBLIC_URL als Fallback.
  const appUrl = env('FRONTEND_URL') || env('APP_PUBLIC_URL');
  if (!appUrl) {
    blockers.push('FRONTEND_URL/APP_PUBLIC_URL fehlt (Basis des Passwort-Reset-Links)');
  } else if (!/^https?:\/\//.test(appUrl)) {
    blockers.push('FRONTEND_URL/APP_PUBLIC_URL muss eine absolute http(s)-URL sein');
  } else if (/\/(cms|admin)(\/|$)/.test(appUrl)) {
    blockers.push('FRONTEND_URL/APP_PUBLIC_URL zeigt auf /cms oder /admin statt auf die App');
  }

  return { ready: blockers.length === 0, blockers, warnings };
}
