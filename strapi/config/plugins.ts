import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      // Kein Fallback: fehlt JWT_SECRET, soll der Start fehlschlagen statt mit
      // einem erratbaren Secret zu laufen (Review I4).
      jwtSecret: env('JWT_SECRET'),
    },
  },
  // E-Mail über SMTP/Postal (M-01) — Voraussetzung für Passwort-Reset und
  // spätere Pflicht-Mails (§312f). Alle Verbindungswerte kommen aus SMTP_*-Env;
  // ohne gesetzte Env greifen nur unkritische localhost-Defaults (kein echter
  // Versand, keine Secrets im Repo). Auth wird nur wirksam, wenn SMTP_USERNAME/
  // SMTP_PASSWORD gesetzt sind.
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'localhost'),
        port: env.int('SMTP_PORT', 25),
        secure: env.bool('SMTP_SECURE', false),
        auth: {
          user: env('SMTP_USERNAME'),
          pass: env('SMTP_PASSWORD'),
        },
      },
      settings: {
        // Absender-Auflösung (M-01): DEFAULT_FROM/DEFAULT_REPLY_TO bevorzugt,
        // dann EMAIL_DEFAULT_FROM/REPLY_TO, dann SMTP_FROM/REPLY_TO
        // (Rückwärtskompatibilität), sonst sicherer localhost-Default.
        defaultFrom: env('DEFAULT_FROM', env('EMAIL_DEFAULT_FROM', env('SMTP_FROM', 'no-reply@localhost'))),
        defaultReplyTo: env(
          'DEFAULT_REPLY_TO',
          env('EMAIL_DEFAULT_REPLY_TO', env('SMTP_REPLY_TO',
            env('DEFAULT_FROM', env('EMAIL_DEFAULT_FROM', env('SMTP_FROM', 'no-reply@localhost'))))),
        ),
      },
    },
  },
  // Upload (D-04): explizites, gebundenes sizeLimit aus Env mit sicherem Default
  // (5 MiB). Lokaler Default-Provider (@strapi/provider-upload-local) — keine
  // Credentials. Externes Object-Storage/CDN für großes Medienvolumen ist ein
  // Betreiber-Schritt. Readiness: strapi/src/upload-config.ts (validateUploadConfig).
  upload: {
    config: {
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT_BYTES', 5 * 1024 * 1024),
    },
  },
});

export default config;
