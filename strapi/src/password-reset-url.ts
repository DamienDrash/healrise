/**
 * P3.1: Env-gesteuerte Passwort-Reset-URL.
 *
 * Der users-permissions-forgotPassword-Flow baut den Reset-Link aus
 * `advancedSettings.email_reset_password`
 * (node_modules/@strapi/plugin-users-permissions/server/controllers/auth.js:
 *  `URL: advancedSettings.email_reset_password`). Das Plugin seedet diesen Wert
 * als `null` → Reset-Links zeigen ins Leere bzw. auf falsche Admin-URLs.
 *
 * Hier wird die URL deterministisch aus APP_PUBLIC_URL + PASSWORD_RESET_PATH
 * abgeleitet (sichere Defaults, keine Secrets) und beim Bootstrap idempotent in
 * den Plugin-Store geschrieben, sodass Reset-Links auf die App-Reset-Seite
 * zeigen (nicht CMS/Admin). Kein Mailversand hier — nur Konfiguration.
 */

type EnvGet = (key: string, defaultValue?: string) => string | undefined;

const DEFAULT_APP_URL = 'https://services.frigew.ski/healrise/app';
const DEFAULT_RESET_PATH = 'reset-password';

/**
 * Absolute URL der Frontend-Reset-Seite (ohne Query — den `?code=…`-Token hängt
 * das Strapi-Reset-Template selbst an) → ergibt `FRONTEND_URL/reset-password?code=…`.
 * Basis: FRONTEND_URL (P3.1), Fallback APP_PUBLIC_URL. Slashes werden normalisiert.
 */
export function passwordResetUrl(env: EnvGet): string {
  const rawBase = env('FRONTEND_URL', env('APP_PUBLIC_URL', DEFAULT_APP_URL)) || DEFAULT_APP_URL;
  const base = rawBase.replace(/\/+$/, '');
  const path = (env('PASSWORD_RESET_PATH', DEFAULT_RESET_PATH) || DEFAULT_RESET_PATH).replace(/^\/+/, '');
  return `${base}/${path}`;
}

/**
 * Schreibt die env-basierte Reset-URL idempotent in die users-permissions-
 * advanced-Settings (Plugin-Store). Bestehende advanced-Settings bleiben
 * erhalten; ist der Wert bereits korrekt, findet kein Store-Write statt.
 * Läuft im Bootstrap. Gibt die gesetzte URL zurück.
 */
export async function applyPasswordResetUrl(
  strapi: any,
  env: EnvGet = (key, def) => (process.env[key] ?? def),
): Promise<string> {
  const url = passwordResetUrl(env);
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced = (await pluginStore.get({ key: 'advanced' })) || {};
  if (advanced.email_reset_password !== url) {
    await pluginStore.set({ key: 'advanced', value: { ...advanced, email_reset_password: url } });
    strapi.log?.info?.(`users-permissions: email_reset_password → ${url}`);
  }
  return url;
}
