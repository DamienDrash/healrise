# HEALRISE — Postal/SMTP + Passwort-Reset einrichten (Betreiber-Anleitung)

Diese Anleitung beschreibt **genau, welche Werte du in `strapi/.env` einträgst**,
damit HEALRISE E-Mails (Passwort-Reset, § 312f-Kaufbestätigung) über Postal/SMTP
versendet. Der Backend-Code ist fertig (`strapi/config/plugins.ts` = nodemailer-
Provider, Reset-Link env-gesteuert) — es fehlen nur deine echten Zugangsdaten.

> **Sicherheit:** Zugangsdaten **nur** in `strapi/.env` (nie ins Repo committen,
> `chmod 600` via `scripts/harden-env.sh`). Das Passwort wird nie geloggt.
> Diese Datei enthält keine echten Credentials.

---

## 1. Postal-Domain + Absender

Im Postal-Dashboard:
- **Mail-Domain** (z. B. `healrise.de`) anlegen und verifizieren.
- **SMTP-Credentials** erzeugen (Benutzer + Passwort) — nur in Postal, nicht ins Repo.
- **Absenderadresse** festlegen, z. B. `no-reply@healrise.de`.

## 2. DNS: SPF, DKIM & Return-Path (Pflicht für Zustellbarkeit)

Alle Werte gibt Postal unter **Domain → DNS-Setup** exakt vor; hier die Rollen:

- **SPF** (TXT auf der Absenderdomain): `v=spf1 … include:<dein-postal-host> ~all`.
  Autorisiert Postals Sendeserver für deine Domain.
- **DKIM** (TXT, z. B. `<selector>._domainkey.deinedomain`): den von Postal
  bereitgestellten Public-Key setzen. Signiert jede Mail kryptografisch.
- **Return-Path / Bounce-Domain** (envelope-sender, Postals „Return Path"):
  meist ein **CNAME** auf einer Subdomain (z. B. `psrp.deinedomain` bzw. der von
  Postal genannte `rp.`-Host) → Postals Return-Path-Host, oft zusätzlich ein
  **MX**-Record auf dieser Subdomain, damit Bounces zu Postal zurücklaufen.
  Wichtig für **SPF-Alignment**: erst wenn der envelope-Sender (MAIL FROM) auf
  deiner Domain liegt, „aligned" SPF → **DMARC pass**. Ohne Return-Path landen
  Mails eher im Spam und Bounces gehen verloren.
- **DMARC** (TXT `_dmarc.deinedomain`): empfohlen, z. B. `v=DMARC1; p=quarantine;
  rua=mailto:dmarc@deinedomain`. Baut auf SPF-/DKIM-Alignment (s. Return-Path) auf.

In Postal die **Domain-Verifikation** abwarten, bis SPF/DKIM/Return-Path „verified"
bzw. „pass" zeigen. (Open/Click-**Tracking** läuft auf Postals eigener
Tracking-Domain — separater CNAME, siehe §7, nicht über den App-Pfad.)

> **From-Header vs. Postal-Override:** Solange die Absenderdomain in Postal NICHT
> verifiziert ist, kann Postal den gesetzten `DEFAULT_FROM` ablehnen oder durch
> eine eigene Adresse ersetzen. Nach der Domain-Verifikation (SPF/DKIM/Return-Path
> „pass") wird der in `strapi/.env` gesetzte `DEFAULT_FROM` unverändert als
> From-Header verwendet; den **envelope-Sender (Return-Path/MAIL FROM)** setzt
> Postal auf die Bounce-Domain — genau so gehört es für SPF-Alignment. Es ist also
> KEIN Code-Eingriff nötig: `DEFAULT_FROM` bleibt der sichtbare Absender, die
> Bounce-/Return-Path-Behandlung übernimmt Postal via DNS.

## 3. `strapi/.env` — benötigte Variablen

| Variable | Bedeutung | Beispiel |
|---|---|---|
| `SMTP_HOST` | Postal-SMTP-Host | `smtp.postal.example` |
| `SMTP_PORT` | SMTP-Port | `587` (TLS) oder `25` |
| `SMTP_SECURE` | TLS an? (`true`/`false`) | `true` |
| `SMTP_USERNAME` | Postal-SMTP-Benutzer | `<postal-user>` |
| `SMTP_PASSWORD` | Postal-SMTP-Passwort | `<geheim, nur in .env>` |
| `DEFAULT_FROM` | Standard-Absender | `no-reply@healrise.de` |
| `DEFAULT_REPLY_TO` | Antwortadresse | `support@healrise.de` |
| `FRONTEND_URL` | Basis für den Reset-Link | `https://services.frigew.ski/healrise/app` |
| `PASSWORD_RESET_PATH` | Pfad der Reset-Seite | `reset-password` |

Absender-Auflösung: **`DEFAULT_FROM/DEFAULT_REPLY_TO`** haben Vorrang, dann
`EMAIL_DEFAULT_FROM/REPLY_TO`, dann `SMTP_FROM/SMTP_REPLY_TO` (Rückwärtskompatibilität) —
es reicht, eine Variante zu setzen. Für lokales Postal ohne Auth können
`SMTP_USERNAME/SMTP_PASSWORD` leer bleiben.

## 4. Passwort-Reset-Link

Der Reset-Link wird als **`FRONTEND_URL/<PASSWORD_RESET_PATH>?code=…`** gebaut
(Default `…/reset-password?code=…`) und beim Strapi-Bootstrap idempotent in
`users-permissions.advanced.email_reset_password` gesetzt — er zeigt auf die
App, **nicht** auf `/cms` oder das Admin-Backend. Den `?code=…`-Token hängt Strapi
selbst an (`strapi/src/password-reset-url.ts`).

**Reset-Mail-Template (Betreff/Body/Absender):** Strapi seedet ein englisches
Dummy-Template mit Absender `Administration Panel <no-reply@strapi.io>`. HEALRISE
ersetzt es beim Bootstrap idempotent durch ein sauberes **deutsches** Template
(`strapi/src/password-reset-email-template.ts`); der Absender kommt aus der
M-01-Env-Kette (`DEFAULT_FROM/DEFAULT_REPLY_TO` → `EMAIL_DEFAULT_*` → `SMTP_*`).
Es sind **keine** manuellen Schritte im Admin-Panel nötig — setzt nur die echten
Absender-Env-Werte, das Template zieht automatisch nach.

## 5. Lokal verifizieren (ohne echten Mailversand)

- **Config-Gate + SMTP-Ping (kein Mailversand, Passwort maskiert):**
  - `node scripts/tests/test_email_config.mjs` → prüft nur die Env-Config (kein Netz).
  - `SMTP_PING=1 node scripts/tests/test_email_config.mjs` → echter SMTP-Handshake
    (`transporter.verify()`), **sendet keine Mail**.
- **Readiness/Guardrails:** `validateEmailConfig` (`strapi/src/email-config.ts`).
- **Gesamter Skript-Test-Lauf:** `npm run test:scripts`.

## 6. Kontrollierter Reset-Mail-Test (nach Deploy/Restart — Betreiber, mit Freigabe)

Erst nach Setzen der echten `.env`-Werte + Deploy/Restart: „Passwort vergessen"
mit einer **eigenen** Adresse auslösen → Mail kommt an (SPF/DKIM pass) → Link zeigt
auf die App-Reset-Seite → neues Passwort greift.

## 7. Postal-Webhook (Zustell-/Bounce-Events) — optional, empfohlen

Damit fehlgeschlagene Zustellungen (Bounces) sichtbar werden, kann Postal
Zustell-Events an HEALRISE melden. Der Empfänger ist bereits implementiert:

- **Route:** `POST /healrise/app/api/mail/webhook` (Strapi, `auth:false`).
- **Authentizität:** Postal signiert den Body per RSA; der Controller prüft die
  Signatur (`X-Postal-Signature`) gegen den **öffentlichen** Postal-Schlüssel aus
  `POSTAL_WEBHOOK_PUBLIC_KEY` (Digest `POSTAL_WEBHOOK_SIGN_ALGO`, Default `sha256`).
  Ohne gültige Signatur → 400; ohne Key ist der Webhook deaktiviert (503).
- **Verarbeitung:** best effort, **kein** Mailversand. Bounces werden PII-sicher
  geloggt (maskierte Adresse + Message-ID), Zustellungen als Info. Code:
  `strapi/src/mail-webhook.ts` + `strapi/src/api/mail-webhook/`.

**Einrichtung (Betreiber, nach Deploy):**
1. Caddy-Route freischalten: `deploy/caddy/healrise-postal-webhook.caddy` in den
   Caddyfile übernehmen (VOR dem `/healrise/app/*`-SPA-Handle), `caddy validate`,
   nach Freigabe `reload`.
2. In Postal den Webhook-Endpoint eintragen:
   `https://services.frigew.ski/healrise/app/api/mail/webhook`.
3. Postals **öffentlichen** Schlüssel als `POSTAL_WEBHOOK_PUBLIC_KEY` in
   `strapi/.env` setzen (nur der Public Key — kein Secret).

**Tracking (Open/Click):** läuft auf Postals **eigener** Tracking-Domain (eigener
DNS-/Postal-Schritt), NICHT über den App-Pfad — bewusst getrennt gehalten.

---

## Betreiber-Blocker (Damien-Go, extern)

- Postal-Domain + Absender mit **SPF/DKIM + Return-Path** (Bounce-Domain) einrichten.
- **Echte** `SMTP_*`/`EMAIL_DEFAULT_*` in `strapi/.env` (nie im Repo, `chmod 600`).
- Deploy/Restart, dann kontrollierter Reset-Mail-Test.
- Optional: Postal-Webhook-Route (Caddy) + `POSTAL_WEBHOOK_PUBLIC_KEY` setzen.
- **Kein echter Mailversand an reale Adressen ohne ausdrückliche Freigabe.**
