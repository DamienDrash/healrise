#!/usr/bin/env node
// P3.1: SMTP/Postal-Verbindungs-Check via nodemailer — SENDET KEINE MAIL.
//
// Liest die SMTP_*-Env, baut eine nodemailer-Transport-Config und pingt den
// Server per `transporter.verify()` (SMTP-Handshake + ggf. Auth) — ohne eine
// Nachricht zu versenden. Das Passwort wird NIE ausgegeben (maskiert).
//
// Verhalten:
//   - ohne Pflicht-Env (SMTP_HOST/SMTP_PORT) → Exit 1 (fehlende Keys, nur Namen)
//   - mit Env (auch Dummy) → Konfig-Gate ok; echter Ping NUR mit SMTP_PING=1
//     (sonst wird nur die Config bestätigt, kein Netzwerk).
//
// Nutzung:
//   node scripts/tests/test_email_config.mjs            # Config-Check (kein Netz)
//   SMTP_PING=1 node scripts/tests/test_email_config.mjs # echter SMTP-Ping (Betreiber)
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const REQUIRED_SMTP = ['SMTP_HOST', 'SMTP_PORT'];

/**
 * Reine Env→nodemailer-Transport-Ableitung (kein Netzwerk, kein Import von
 * nodemailer). `env` ist ein einfaches Objekt (z. B. process.env).
 */
export function smtpConfigFromEnv(env = {}) {
  const missing = REQUIRED_SMTP.filter((k) => !env[k]);
  const hasUser = Boolean(env.SMTP_USERNAME);
  const hasPass = Boolean(env.SMTP_PASSWORD);
  if (hasUser !== hasPass) missing.push('SMTP_USERNAME+SMTP_PASSWORD (Paar)');
  if (missing.length) return { ok: false, missing, transport: null };

  const transport = {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10),
    secure: env.SMTP_SECURE === 'true',
    ...(hasUser ? { auth: { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD } } : {}),
  };
  return { ok: true, missing: [], transport };
}

// CLI — nur bei direktem Aufruf.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = smtpConfigFromEnv(process.env);
  if (!cfg.ok) {
    console.error(`SMTP-Config unvollständig — fehlende Keys: ${cfg.missing.join(', ')}`);
    console.error('Setze SMTP_HOST/SMTP_PORT (und ggf. SMTP_USERNAME/SMTP_PASSWORD).');
    process.exit(1);
  }
  const masked = { ...cfg.transport, auth: cfg.transport.auth ? { user: cfg.transport.auth.user, pass: '***' } : undefined };
  console.log(`SMTP-Config OK: ${JSON.stringify(masked)}`);

  if (process.env.SMTP_PING !== '1') {
    console.log('Kein Netzwerk-Ping (Config-Check). Für echten SMTP-Ping: SMTP_PING=1 (kein Mailversand).');
    process.exit(0);
  }

  // Echter Ping: nodemailer aus strapi/node_modules laden (nicht im Repo-Root).
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const requireFromStrapi = createRequire(join(root, 'strapi', 'package.json'));
  const nodemailer = requireFromStrapi('nodemailer');
  const transporter = nodemailer.createTransport(cfg.transport);
  try {
    await transporter.verify(); // SMTP-Handshake/Auth — sendet KEINE Mail
    console.log('✓ SMTP-Verbindung/Auth erfolgreich (verify) — keine Mail gesendet.');
    process.exit(0);
  } catch (err) {
    console.error(`✗ SMTP-Verbindung fehlgeschlagen: ${err && err.message ? err.message : err}`);
    process.exit(2);
  }
}
