/**
 * P3.2 / S-01 / S-04: Lokale Readiness- und Guardrail-Validierung der
 * Stripe-Checkout-Konfiguration (Testmodus zuerst).
 *
 * Zweck: Betreiber/CI können VOR einem echten Testkauf prüfen, ob die
 * Stripe-Env-Konfiguration vollständig und plausibel ist — OHNE Netzwerk-,
 * Stripe- oder Mailaufrufe. Es werden ausschließlich Vorhandensein, Key-Modus
 * (test/live) und Formate geprüft. Secrets werden NIE geloggt oder in Fehler-/
 * Warnmeldungen aufgenommen (nur Env-NAMEN und abgeleitete Klassifizierung).
 *
 * Kontext des Projekt-Checkouts:
 * - src/api/checkout/controllers/checkout.ts nutzt dynamische price_data (Cent
 *   aus STRIPE_PRICE_*-Env + Code-Fallbacks) → KEINE Stripe-Price-IDs.
 * - src/api/stripe-webhook/... verlangt STRIPE_WEBHOOK_SECRET.
 * - success/cancel-Redirects werden aus APP_PUBLIC_URL gebaut.
 *
 * Diese Funktion greift NICHT in den Laufzeit-Checkout ein (kein Runtime-Risiko);
 * sie ist eine reine Validierungs-/Readiness-Hilfe für Doku, CI und Operator.
 */

type EnvGet = (key: string, def?: string) => string | undefined;

export type StripeKeyMode = 'test' | 'live' | 'unknown';

export interface StripeReadiness {
  ready: boolean;
  mode: StripeKeyMode;
  errors: string[];
  warnings: string[];
}

const PRICE_ENVS = ['STRIPE_PRICE_HEALRISE7', 'STRIPE_PRICE_HEALRISE14', 'STRIPE_PRICE_PREMIUM'];

/**
 * Kanonische Brutto-Preise je Kaufstufe in Cent (inkl. MwSt., PAngV). Einzige
 * Quelle der Wahrheit für die Preis-Parität: muss mit den Code-Fallbacks im
 * Checkout-Controller, der Landing-Page (card-price) und der App (utils/plans.js)
 * übereinstimmen — abgesichert durch scripts/tests/price-display-parity.test.mjs.
 */
export const PLAN_PRICE_CENTS: Record<string, number> = {
  healrise7: 6900,
  healrise14: 16900,
  premium: 39900,
};

/**
 * Gepinnte Stripe-API-Version. Serverseitig fixiert (statt „latest"/SDK-Default),
 * damit ein Stripe-seitiges API-Update den Checkout/Portal NICHT unbemerkt ändert
 * — Versions-Upgrades sind so ein bewusster, testbarer Schritt.
 */
export const STRIPE_API_VERSION = '2023-10-16';

/** Options-Objekt für `new Stripe(key, options)` — pinnt die API-Version. */
export function stripeClientOptions(): { apiVersion: string } {
  return { apiVersion: STRIPE_API_VERSION };
}

/**
 * Zentrale Auflösung von Secret-Key (test/live-bewusst) + gepinnten Client-Options
 * für Checkout/Billing-Portal. Reine Funktion (kein 'stripe'-Import) → node-testbar.
 * `secretKey` ist undefined, wenn kein Key gesetzt ist (Controller antwortet 503).
 */
export function resolveStripeClientConfig(
  env: EnvGetter,
  nodeEnv?: string,
): { secretKey: string | undefined; options: { apiVersion: string } } {
  return { secretKey: resolveStripeSecretKey(env, nodeEnv), options: stripeClientOptions() };
}

/** Klassifiziert einen Stripe-Key nach Modus, ohne den Wert preiszugeben. */
export function stripeKeyMode(key?: string): StripeKeyMode {
  if (!key) return 'unknown';
  if (/^(sk|pk|rk|whsec)_test_/.test(key)) return 'test';
  if (/^(sk|pk|rk|whsec)_live_/.test(key)) return 'live';
  return 'unknown';
}

type EnvGetter = (key: string) => string | undefined;

// Kanonische Test-Key-Namen plus akzeptierte Alias-Schreibweise (…_KEY_TEST /
// …_SECRET_TEST). So wirkt der Env-Eintrag auch, wenn der Betreiber die
// _TEST-Suffix-Konvention verwendet (kein still wirkungsloser Key). Die
// kanonische STRIPE_TEST_…-Variante hat Vorrang.
export const STRIPE_TEST_SECRET_KEY_NAMES = ['STRIPE_TEST_SECRET_KEY', 'STRIPE_SECRET_KEY_TEST'];
export const STRIPE_TEST_WEBHOOK_SECRET_NAMES = ['STRIPE_WEBHOOK_TEST_SECRET', 'STRIPE_WEBHOOK_SECRET_TEST'];

/** Erster gesetzter Env-Wert aus einer Namensliste (kanonisch zuerst). */
function firstEnv(env: EnvGetter, names: string[]): string | undefined {
  for (const n of names) {
    const v = env(n);
    if (v) return v;
  }
  return undefined;
}

/**
 * Test/Live-Key-Auflösung: außerhalb von Production hat der Test-Key Vorrang
 * (STRIPE_TEST_SECRET_KEY, Alias STRIPE_SECRET_KEY_TEST), in Production wird
 * STRIPE_SECRET_KEY (Live) genutzt. So kann im Testmodus gefahrlos mit
 * sk_test_-Keys gearbeitet werden, ohne den Live-Key zu setzen.
 */
export function resolveStripeSecretKey(env: EnvGetter, nodeEnv?: string): string | undefined {
  if (nodeEnv !== 'production') {
    const testKey = firstEnv(env, STRIPE_TEST_SECRET_KEY_NAMES);
    if (testKey) return testKey;
  }
  return env('STRIPE_SECRET_KEY');
}

/** Wie resolveStripeSecretKey, für das Webhook-Signatur-Secret. */
export function resolveStripeWebhookSecret(env: EnvGetter, nodeEnv?: string): string | undefined {
  if (nodeEnv !== 'production') {
    const testSecret = firstEnv(env, STRIPE_TEST_WEBHOOK_SECRET_NAMES);
    if (testSecret) return testSecret;
  }
  return env('STRIPE_WEBHOOK_SECRET');
}

/**
 * Safety-Check Key ↔ Umgebung (für Strapi-Bootstrap-Warnungen). Warnt bei
 * Test-Keys in Production und — kritisch — bei Live-Keys in Nicht-Production.
 * Enthält niemals Key-Werte, nur den erkannten Modus. `nodeEnv` = process.env.NODE_ENV.
 */
export function stripeKeyEnvironmentWarnings(env: EnvGetter, nodeEnv?: string): string[] {
  const warnings: string[] = [];
  const isProd = nodeEnv === 'production';
  // Den EFFEKTIV genutzten Key beurteilen (wie zur Laufzeit aufgelöst), nicht den
  // rohen Basiskey — sonst gäbe es im dedizierten Dual-Key-Setup (Test aktiv,
  // Live parallel hinterlegt) einen Fehlalarm auf den inerten Live-Key.
  const effectivePublishable =
    (!isProd ? env('STRIPE_TEST_PUBLISHABLE_KEY') : undefined) || env('STRIPE_PUBLISHABLE_KEY');
  const check = (value: string | undefined, label: string) => {
    const mode = stripeKeyMode(value);
    if (mode === 'test' && isProd) {
      warnings.push(`${label}: TEST-Key (…_test_) in Production-Umgebung — echte Zahlungen finden NICHT statt.`);
    } else if (mode === 'live' && !isProd) {
      warnings.push(`${label}: LIVE-Key (…_live_) in Nicht-Production-Umgebung (NODE_ENV=${nodeEnv || 'unset'}) — Gefahr ECHTER Zahlungen!`);
    }
  };
  check(resolveStripeSecretKey(env, nodeEnv), 'Stripe Secret-Key');
  check(effectivePublishable, 'Stripe Publishable-Key');
  return warnings;
}

/**
 * Checkout-Redirect-URLs aus der App-Basis-URL — identisch zu
 * src/api/checkout/controllers/checkout.ts (Parität wird im Test abgesichert).
 */
export function checkoutRedirectUrls(appBaseUrl: string): { success_url: string; cancel_url: string } {
  const base = (appBaseUrl || '').replace(/\/+$/, '');
  return {
    success_url: `${base}/upgrade/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/upgrade/abbruch`,
  };
}

/**
 * Validiert die Stripe-Checkout-Konfiguration für den erwarteten Modus
 * (Default 'test'). Blockierende Probleme landen in `errors`; `ready` ist true,
 * wenn keine Fehler vorliegen. Meldungen enthalten ausschließlich Env-Namen,
 * niemals Werte/Secrets.
 */
export function validateStripeConfig(
  env: EnvGet,
  opts: { expectedMode?: StripeKeyMode } = {},
): StripeReadiness {
  const expectedMode: StripeKeyMode = opts.expectedMode ?? 'test';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Effektive Keys je erwartetem Modus — spiegelt die Runtime-Resolver
  // (resolveStripeSecretKey/-WebhookSecret): im Testmodus haben die dedizierten
  // STRIPE_TEST_*-Keys Vorrang, sonst die (Live-)Basiskeys. So bleibt die
  // Readiness konsistent mit dem tatsächlich verwendeten Key, wenn Test- und
  // Live-Keys getrennt/parallel gepflegt werden.
  // testNames: kanonischer Name zuerst, dann akzeptierte Aliase (…_KEY_TEST).
  const pick = (testNames: string[], baseName: string) => {
    if (expectedMode === 'test') {
      for (const n of testNames) {
        const v = env(n);
        if (v) return { value: v, name: n };
      }
    }
    return { value: env(baseName), name: baseName };
  };
  const missingLabel = (testNames: string[], baseName: string) =>
    expectedMode === 'test' ? `${testNames[0]}/${baseName}` : baseName;

  // Secret-Key: Pflicht + Modus-Guard (kein Live-Key im Testmodus).
  const { value: secret, name: secretName } = pick(STRIPE_TEST_SECRET_KEY_NAMES, 'STRIPE_SECRET_KEY');
  const mode = stripeKeyMode(secret);
  if (!secret) {
    errors.push(`${missingLabel(STRIPE_TEST_SECRET_KEY_NAMES, 'STRIPE_SECRET_KEY')} fehlt (Checkout ist ohne Secret-Key deaktiviert)`);
  } else if (mode === 'unknown') {
    errors.push(`${secretName} hat kein gültiges Key-Format (erwartet sk_test_… / sk_live_…)`);
  } else if (mode !== expectedMode) {
    errors.push(
      `${secretName} ist ein ${mode}-Key, erwartet wurde ${expectedMode} — Live-Key im Testmodus abgelehnt`,
    );
  }

  // Publishable-Key optional (Redirect-to-Checkout-Flow braucht ihn nicht),
  // aber falls gesetzt, muss der Modus passen. Ebenfalls Test/Live-getrennt.
  const { value: publishable, name: publishableName } = pick(['STRIPE_TEST_PUBLISHABLE_KEY'], 'STRIPE_PUBLISHABLE_KEY');
  if (publishable) {
    const pMode = stripeKeyMode(publishable);
    if (pMode !== 'unknown' && pMode !== expectedMode) {
      errors.push(`${publishableName} ist ein ${pMode}-Key, erwartet wurde ${expectedMode}`);
    }
  }

  // Webhook-Secret: Pflicht (Signaturprüfung) + Format. Test/Live-getrennt.
  const { value: webhook, name: webhookName } = pick(STRIPE_TEST_WEBHOOK_SECRET_NAMES, 'STRIPE_WEBHOOK_SECRET');
  if (!webhook) {
    errors.push(`${missingLabel(STRIPE_TEST_WEBHOOK_SECRET_NAMES, 'STRIPE_WEBHOOK_SECRET')} fehlt (Webhook-Signaturprüfung nicht möglich)`);
  } else if (!/^whsec_/.test(webhook)) {
    errors.push(`${webhookName} hat kein gültiges Format (erwartet whsec_…)`);
  }

  // App-URL für success/cancel-Redirects: absolut und auf die App (nicht /cms|/admin).
  const appUrl = env('APP_PUBLIC_URL');
  if (!appUrl) {
    errors.push('APP_PUBLIC_URL fehlt (Checkout success/cancel-Redirects)');
  } else if (!/^https?:\/\//.test(appUrl)) {
    errors.push('APP_PUBLIC_URL muss eine absolute http(s)-URL sein');
  } else if (/\/(cms|admin)(\/|$)/.test(appUrl)) {
    errors.push('APP_PUBLIC_URL zeigt auf /cms oder /admin statt auf die App');
  }

  // Preise: dynamische price_data mit Code-Fallback → fehlend = Warnung,
  // gesetzt-aber-ungültig = Fehler (verhindert kaputte Beträge).
  for (const name of PRICE_ENVS) {
    const raw = env(name);
    if (raw === undefined || raw === '') {
      warnings.push(`${name} nicht gesetzt — Code-Fallback-Preis wird verwendet`);
    } else if (!/^\d+$/.test(raw) || parseInt(raw, 10) <= 0) {
      errors.push(`${name} muss eine positive Ganzzahl in Cent sein`);
    }
  }

  return { ready: errors.length === 0, mode, errors, warnings };
}
