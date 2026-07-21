# HEALRISE — Launch-Checkliste (Betreiber-Aufgaben)

Dinge, die Code/Doku nicht erledigen können — vor dem Livegang vom Betreiber auszuführen.
Stand: Sprint 4 abgeschlossen (03.07.2026). Technische Details: docs/deployment.md, docs/testing.md.

## 1. Recht (LAUNCH-BLOCKER)

- [ ] **Alle `[PLATZHALTER: …]` füllen** in `app/src/pages/Legal.jsx` (Impressum: Name/Anschrift/
      Telefon/USt-IdNr.; Datenschutz: Verantwortlicher + Hosting-Abschnitt; AGB/Widerruf: Firma/Anschrift).
      Die Platzhalter sind in der App rot markiert — solange sichtbar: NICHT launchen.
      Fortschritt lokal prüfbar: `node scripts/legal-readiness.mjs` (listet offene Platzhalter-Felder +
      fehlende Pflicht-Rechtslinks, Exit 1 bis vollständig; nur Feldnamen, keine Daten). Echte
      Betreiberdaten liefert Damien; Rechtstexte anwaltlich prüfen lassen — kein Auto-Fill.
- [ ] **Rechtstexte anwaltlich prüfen lassen** (oder Generator mit Haftungsübernahme, z. B.
      e-recht24/IT-Recht Kanzlei) — die Vorlagen sind Recherche-basiert, keine Rechtsberatung
- [x] **Landing-Page umformuliert** (Code erledigt, 2026-07-18 verifiziert): keine
      medizinischen Claims mehr in `landing/` (Heilung/Recovery/OP/Symptom …) — hart
      regressionsgeschützt durch `app/src/test/landing.test.js` (❌-Liste aus
      docs/claims-richtlinie.md, scannt index.html/styles.css/landing.js). App-Seiten
      ebenfalls claim-frei (nur interne Keys wie `narbenpflege` → sichtbares Label „Hautpflege").
      ⛔ **Rest (Betreiber/Recht):** Zielgruppen-Ansprache + finale Formulierungen anwaltlich klären
- [ ] **Live-CMS-Inhalte** im Strapi-Admin nach docs/claims-richtlinie.md überarbeiten
      (Bestand enthält noch „nach deiner Brust-OP", „Heilung" etc.)
- [ ] AVV mit dem Hosting-Anbieter abschließen (Art. 28 DSGVO); Stripe-DPA in der
      Verarbeitungsdokumentation referenzieren
- [x] **Recht auf Löschung (DSGVO Art. 17) — Selbst-Service (P1.2 / R-02, lokal umgesetzt).**
      Realer Weg: In-App **Konto → „Gefahrenzone" → „Konto löschen"** (Bestätigung durch Eintippen von „LÖSCHEN")
      ruft `DELETE /api/users/me/delete` (authentifiziert, nur der eigene Account via `ctx.state.user` —
      **niemals eine fremde ID aus dem Request**). Atomar in einer DB-Transaktion: eigene
      Fortschrittsdaten (Art. 9) werden **gelöscht**, Kaufbelege werden **entkoppelt** (`user → null`),
      nicht gelöscht — steuer-/handelsrechtliche Aufbewahrung (**§ 147 AO**, 10 Jahre) bleibt gewahrt.
      Erfolg → Session-Logout + `/login`, Fehler → kein Logout. Beschrieben auch im Datenschutztext
      (`app/src/pages/Legal.jsx`). Vertrag gesperrt durch `scripts/tests/account-deletion-contract.test.mjs`.
      Betreiber-Rest: nur Löschanfragen per E-Mail (Nicht-Selbst-Service-Fälle) dokumentiert bearbeiten.
- [ ] Bestätigungs-E-Mail nach Kauf (§ 312f BGB). **Lokal vorbereitet (P3.5):** Builder + Versand
      (`strapi/src/api/stripe-webhook/purchase-confirmation.ts`) mit Vertragsinhalt (Plan/Preis),
      Hinweis auf sofortige Bereitstellung + Erlöschen des Widerrufsrechts (§ 356 Abs. 5) und App-Link;
      ausgelöst über den Purchase-`afterCreate`-Lifecycle, best effort (Mailfehler kippt den Kauf nicht).
      Zustimmung wird bereits persistiert (`purchase.consent_immediate_delivery`). Gestubbt getestet
      (`scripts/tests/purchase-confirmation-email.test.mjs`), **live-Zustellung NICHT verifiziert**.
      **Betreiber (nach Go, hängt an P3.1):** echte `SMTP_*`/Postal (SPF/DKIM), Deploy, dann
      kontrollierter Testkauf im Stripe-Testmodus → Bestätigungsmail real prüfen.
      **Bis dahin keine echten Verkäufe freischalten.**

## 2. Stripe (für echte Zahlungen)

**Lokal vorbereitet (P3.2):** Readiness-/Guardrail-Validierung `strapi/src/stripe-config.ts`
(`validateStripeConfig`) prüft die Env-Konfiguration lokal ohne Netz-/Stripe-Aufruf — Pflicht-Envs,
Test-vs-Live-Key-Guard (kein `sk_live_` im Testmodus), Webhook-Secret-Format, App-scoped
success/cancel-URLs, Preis-Plausibilität; Secrets werden nie geloggt. Checkout nutzt dynamische
`price_data` (Cent aus `STRIPE_PRICE_*` + Fallback) → keine Stripe-Price-IDs nötig.

**Pre-Flight (lokal, ohne Netz/Secrets):** `node scripts/release-readiness.mjs` (Testmodus) bzw.
`--real` (echte Zustellung) aggregiert die Stripe- + E-Mail-Guardrails zu einem Go/No-Go-Ergebnis
(Exit 0 = ready, 1 = Blocker). Gibt nur Env-Namen/Booleans aus, **niemals Secret-Werte** — vor jedem
Go-Live gegen die aktive Umgebung ausführen und `READY` bestätigen.

**Erledigt/lokal verifiziert:** P3.3 Webhook-Retry-Safety (2xx erst nach erfolgreicher Verarbeitung;
DB-Fehler → 5xx/Retry; eine fehlgeschlagene Kaufbestätigungsmail kippt den erfolgreichen Kauf nicht)
und P3.4 Preis-Parität (kanonische `PLAN_PRICE_CENTS` == Checkout-Fallback == Landing `card-price` ==
App `utils/plans.js`; ungültige Preis-Env wird geguarded). Tests: `strapi/tests/stripe-webhook.test.mjs`,
`scripts/tests/price-display-parity.test.mjs`, `scripts/tests/stripe-price-parity.test.mjs`.

Betreiber-Aktionen (Stripe-Dashboard, extern blockiert):
- [ ] Stripe-Konto: Produkte/Preise prüfen (aktuell aus Env: 69/169/399 € inkl. MwSt.)
- [ ] `STRIPE_SECRET_KEY` setzen (erst Testmodus `sk_test_…`, dann live) — optional `STRIPE_PUBLISHABLE_KEY`
      (`pk_test_…`) nur falls clientseitige Stripe.js dazukommt
- [ ] Webhook-Endpoint `https://…/healrise/app/api/stripe/webhook` im Stripe-Dashboard registrieren
      (Event: `checkout.session.completed`) und das echte `STRIPE_WEBHOOK_SECRET` in `.env` setzen
      (das aktuelle whsec in `.env` ist nur ein lokaler Testwert!)
- [ ] Vor dem Testkauf: `validateStripeConfig` gegen die echte `.env` grün (ready) bestätigen
- [ ] Testkauf im Testmodus durchspielen: Kauf → Webhook → Plan freigeschaltet → Erfolgsseite

## 3. Sicherheit

- [ ] **Secrets rotieren** auf dem Produktionsserver: `APP_KEYS`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`,
      `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` (alle: `openssl rand -base64 32`) — die bisherigen Werte
      lagen ungeschützt ohne Git-Kontrolle auf der Maschine (Review I4)
- [ ] **JWT_SECRET** ist jetzt Pflicht-Env (Fallback entfernt); auf Prod neu setzen ⇒ Sessions werden ungültig
- [ ] **DB-Passwort stärken** + PostgreSQL nur auf localhost binden
- [ ] Strapi-Admin: starke Passwörter, keine geteilten Konten
- [ ] Mittelfristig (Goldstandard T7): users-permissions auf Refresh-Token-Modus, httpOnly-Cookie evaluieren

## 4. Betrieb

- [ ] `NODE_ENV=production`, `SEED_DEMO` NICHT setzen (Testuser-Backdoor!)
- [ ] Reverse-Proxy nach docs/deployment.md, HTTPS erzwingen (HSTS)
- [ ] E-Mail/Passwort-Reset (P3.1). **Lokal vorbereitet:** nodemailer-Provider env-gesteuert
      (`SMTP_HOST/PORT/SECURE/USERNAME/PASSWORD/FROM/REPLY_TO`, `strapi/config/plugins.ts`); Reset-Link
      wird aus `APP_PUBLIC_URL` + `PASSWORD_RESET_PATH` gebaut und beim Bootstrap in
      `users-permissions.advanced.email_reset_password` gesetzt (zeigt auf die App-Reset-Seite, nicht /cms).
      Readiness lokal prüfbar via `strapi/src/email-config.ts` (`validateEmailConfig`) — ohne SMTP-Verbindung,
      ohne Secret-Leak.

      **Betreiber-Schritte (nach Damien-Go — extern, KEIN echter Versand ohne Freigabe):**
      1. Postal: Mail-Domain (z. B. `healrise.de`) + Absender `no-reply@healrise.de` anlegen; SMTP-
         Credentials erzeugen (nur in Postal, nicht ins Repo).
      2. DNS: **SPF** (`v=spf1 ... include:<postal>`), **DKIM** (von Postal bereitgestellter Key) und
         optional **DMARC** setzen; in Postal Domain-Verifikation abwarten (SPF/DKIM „pass").
      3. `strapi/.env` (Modus 600, nie committen): `SMTP_HOST`=Postal-Host, `SMTP_PORT`/`SMTP_SECURE`
         (587/true oder 25/false je nach Postal), `SMTP_USERNAME`/`SMTP_PASSWORD`=Postal-Credentials,
         `SMTP_FROM=no-reply@healrise.de`, `SMTP_REPLY_TO`=Support-Adresse, `APP_PUBLIC_URL`=Produktions-App-URL.
      4. Readiness bestätigen: `validateEmailConfig(env, { forRealDelivery: true })` muss `ready:true` liefern.
      5. Deploy + Restart (setzt `email_reset_password` env-basiert), dann **kontrollierter** Reset-Mail-Test
         an eine eigene Adresse: „Passwort vergessen" → Mail kommt an (SPF/DKIM pass), Link zeigt auf die
         App-Reset-Seite, neues Passwort greift. Erst danach P3.1 als live abhaken.
- [ ] Backups (O-01). **Lokal vorbereitet:** `scripts/db-backup.sh` (pg_dump, dry-run per Default,
      env-basiert, Rotation `BACKUP_KEEP`, Off-Site-Stub `BACKUP_OFFSITE_CMD`, Passwort nie geloggt) und
      `scripts/db-restore-drill.sh` (Restore in eine explizite Test-DB; Live-DB ist ohne
      `RESTORE_ALLOW_LIVE=1` hart blockiert). **Betreiber (nach Go):** DATABASE_*-Env aus `strapi/.env`
      exportieren, `BACKUP_RUN=1 scripts/db-backup.sh` per systemd-Timer/Cron täglich scharf schalten,
      Off-Site-Kopie + Rotation aktivieren, Uploads-Verzeichnis mitsichern, und **einmal** einen realen
      `RESTORE_RUN=1`-Drill gegen eine Test-DB fahren + dokumentieren. Kein Timer/Off-Site hier aktiviert.
- [ ] Verschlüsselung at rest fürs DB-Volume (Art.-9-Daten! Goldstandard R4)
- [ ] DSFA prüfen/dokumentieren, sobald nennenswert Gesundheitsdaten verarbeitet werden (R4)
- [ ] Git-Remote + CI (O-02). **Lokal vorbereitet:** CI-Vorlage `docs/ci-github-actions.yml` (secret-frei,
      frontend + backend-api, lint/test/build) + Readiness-Report `node scripts/ci-remote-readiness.mjs`
      (prüft die Vorlage lokal, meldet Remote-Status; kein Netz/Push). **Betreiber (Damien-Go):** privates
      Repo/Remote anlegen, `git remote add origin <privat>`, Vorlage → `.github/workflows/ci.yml`, GitHub
      Actions + benötigte Secrets aktivieren, ersten Push/CI-Lauf nur mit ausdrücklicher Freigabe.

## 5. Verifikation vor dem Livegang

```bash
npm run check       # Lint + Unit + Build
npm run test:api    # 59 Backend-Checks (Strapi muss laufen)
npm run test:e2e    # 4 E2E-Kernpfade
npm run test:e2e:offline
```
Zusätzlich manuell: Install-Prompt auf iOS/Android, Kauf im Stripe-Testmodus, Rechtsseiten ohne rote Platzhalter.
