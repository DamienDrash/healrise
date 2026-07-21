#!/usr/bin/env node
// HEALRISE Release-Readiness Pre-Flight (lokal, ohne Netz-/Stripe-/SMTP-Aufruf).
// Aggregiert die Guardrail-Validatoren (Stripe + E-Mail) zu einem Go/No-Go-Ergebnis.
// Nutzung (Operator/CI, gegen die aktive Umgebung — Secrets werden NIE ausgegeben):
//   node scripts/release-readiness.mjs            # Testmodus + lokale Zustellung
//   node scripts/release-readiness.mjs --real     # echte Zustellung (SPF/DKIM/Auth-Pflicht)
// Exit-Code 0 = ready, 1 = Blocker vorhanden.
import { pathToFileURL } from 'node:url';

import { validateStripeConfig } from '../strapi/src/stripe-config.ts';
import { validateEmailConfig } from '../strapi/src/email-config.ts';

/**
 * Aggregiert Stripe- und E-Mail-Readiness. `env(key, def)` ist der Strapi-artige
 * Env-Getter. Gibt die Teilergebnisse (nur Namen/Booleans, keine Secrets) +
 * `ready` (alle Teilbereiche ready) zurück.
 */
export function collectReadiness(env, opts = {}) {
  const stripe = validateStripeConfig(env, { expectedMode: opts.stripeMode ?? 'test' });
  const email = validateEmailConfig(env, { forRealDelivery: opts.forRealDelivery ?? false });
  return { ready: stripe.ready && email.ready, stripe, email };
}

/** Menschlich lesbarer Report — enthält ausschließlich Namen/Booleans, keine Werte. */
export function formatReport(report) {
  const lines = [];
  const mark = (ok) => (ok ? 'READY' : 'BLOCKED');
  lines.push(`HEALRISE Release-Readiness: ${mark(report.ready)}`);
  lines.push(`  Stripe: ${mark(report.stripe.ready)} (mode=${report.stripe.mode})`);
  for (const e of report.stripe.errors) lines.push(`    ✖ ${e}`);
  for (const w of report.stripe.warnings) lines.push(`    ⚠ ${w}`);
  lines.push(`  E-Mail: ${mark(report.email.ready)}`);
  for (const b of report.email.blockers) lines.push(`    ✖ ${b}`);
  for (const w of report.email.warnings) lines.push(`    ⚠ ${w}`);
  return lines.join('\n');
}

// CLI nur bei direktem Aufruf (nicht beim Import in Tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = (key, def) => (process.env[key] ?? def);
  const report = collectReadiness(env, { forRealDelivery: process.argv.includes('--real') });
  // eslint-disable-next-line no-console
  console.log(formatReport(report));
  process.exit(report.ready ? 0 : 1);
}
