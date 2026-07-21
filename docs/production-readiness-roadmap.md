# HEALRISE — Production-Readiness-Roadmap

**Basis:** `docs/production-readiness-audit.md` (main @ 5ebb0ba, Audit vom 12.07.2026).
Finding-IDs (B-01 …) referenzieren den Audit. Diese Roadmap ist das Arbeitsdokument für
Phase 2; Status wird hier fortgeschrieben.

**Leitplanken (gelten für alle Meilensteine):**
- Keine Secrets committen oder in Logs/Doku ausgeben; Env-Prüfungen nur über Namen.
- Keine Datenlöschung ohne dokumentierten, freigegebenen Cleanup-Plan (P2).
- Keine Stripe-Live-Aktionen und kein Mailversand an echte Adressen ohne Freigabe.
- Caddy: immer `caddy validate` vor `reload`; Rollback = alte Datei zurück + reload.
- Commits thematisch sauber, verifiziert; kein Push ohne Freigabe (es gibt noch kein Remote → O-02).

**Definition of Done (global):** Acceptance Criteria des Meilensteins erfüllt **und**
real verifiziert (Live-Smoke/Test-Output im Commit- oder Doku-Text festgehalten),
Doku aktualisiert, `npm run check` grün, Working Tree sauber committet.

---

## P0 — Betrieb herstellen (freigegeben, in Umsetzung)

**Ziel:** Strapi läuft dauerhaft (reboot-fest), API/Admin öffentlich korrekt erreichbar,
Build/Deploy reproduzierbar ohne root, Basis-Logging + Healthcheck.

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 0.1 | Admin-Panel-Build (`NODE_ENV=production npm run build` in `strapi/`) | B-02 | ✅ **live-verifiziert (2026-07-18):** `strapi/dist/build/index.html` vorhanden; Live-Smoke `/healrise/app/cms/admin` → 200 (Admin-HTML) + Admin-Asset 200. |
| 0.2 | systemd-Unit `healrise-strapi.service` (NODE_ENV=production, Restart=always, journald) + `enable` | B-01, L-01 (teilw.) | ✅ **live (2026-07-18):** `systemctl is-enabled` = **enabled**, `is-active` = **active**; `/_health` → **204**; Unit-Contract geguardet (`scripts/tests/systemd-units.test.mjs`). |
| 0.3 | Caddy-Route `/healrise/app/cms/*` → 127.0.0.1:9130 (strip prefix), vor den SPA-Handlern | B-03 | ✅ **live (2026-07-18):** `caddy validate /etc/caddy/Caddyfile` → **„Valid configuration"**; `/cms/admin` 200, PWA/Landing 200; versioniert `deploy/caddy/healrise-cms-proxy.caddy` (`scripts/tests/cms-proxy-caddy.test.mjs`). |
| 0.4 | Deploy reproduzierbar: `scripts/deploy.sh` (Builds ohne root + Service-Restart + Smoke), Ownership konsistent | B-04 | ✅ **erledigt (2026-07-18):** `deploy.sh` gehärtet (flock-Lock, `.env`-Preflight, root-Guard, bounded Health-Wait) + geguardet (`scripts/tests/deploy-hardening.test.mjs`, 10); Live-Smoke **7/7** grün. |
| 0.5 | Healthcheck: systemd-Timer curlt `/_health` alle 5 min, Restart bei Fail; `scripts/smoke.sh` für Live-Checks | L-01 (teilw.) | ✅ **live (2026-07-18):** `healrise-strapi-health.timer` **enabled+active**, `systemctl list-timers` zeigt 5-min-Takt; Restart-/Alarm-Verhalten verhaltensgetestet (`smoke-and-health`, `monitoring-readiness`). |
| 0.6 | Live-CMS-Claims-Check: published Programme via API gegen ❌-Liste (claims-richtlinie) | R-03 | ✅ **live-verifiziert (2026-07-16):** `node scripts/claims-check.mjs` → 9 published Programme geprüft, **0 Treffer** gegen die ❌-Liste (Exit 0). Detektor unit-getestet (`scripts/tests/claims-check.test.mjs`), Doku↔Skript-Vertrag gesperrt (`scripts/tests/claims-check-doc.test.mjs`) |
| 0.7 | `docs/deployment.md` = Realität (Caddy statt nginx, Unit, Healthcheck, Smoke) | B-05 | ✅ **erledigt (2026-07-18):** Doku↔Realität-Vertrag geguardet (`scripts/tests/b05_deployment_doc.test.mjs`, 7/7: Caddy/systemd/Healthcheck/Backup, kein nginx/PM2). |

**Entscheidung B-03 (CMS-Route: ja):** `PUBLIC_URL` ist seit jeher auf
`…/healrise/app/cms` gesetzt, deployment.md sieht die Route vor, Remote-Content-Pflege
ist für P1/D-03 nötig. Schutz: Strapi-Admin-Auth (kein Fallback-Secret, starke Passwörter
laut Checkliste); zusätzlicher IP-/Rate-Limit-Schutz → P4.

**Risiken:** Admin-Build speicherintensiv auf Host ohne Swap (Y-01) → Build beobachten,
notfalls `NODE_OPTIONS=--max-old-space-size`. Erststart könnte Migrationen fahren →
vorher kurzer `pg_dump` als Sicherung (read-only-Risikominimierung, kein Ersatz für O-01).
**Rollback:** Unit stoppen/disablen, Caddyfile-Backup zurückspielen + reload — Zustand wie vor P0.

## P1 — Recht (Blocker für öffentliche Sichtbarkeit)

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 1.1 | Rechtsseiten-Platzhalter durch echte Betreiberdaten ersetzen | R-01 | `grep -r PLATZHALTER app/src` = 0; Freigabe durch Damien dokumentiert |
| 1.2 | Kontolöschung: Server-Endpoint + UI („Gefahrenzone“) | R-02 | ✅ **erledigt (2026-07-18), Commit `810d5b0`:** `DELETE /api/users/me/delete` (self-only via `ctx.state.user`, 204, atomar) löscht User, entfernt Progress, **anonymisiert Purchases** (`user → null`, plan/amount/date bleiben, § 147 AO); UI-Bestätigung durch Eintippen von „LÖSCHEN" → Logout + Redirect zur Landing; Datenschutz nennt Art. 17 + realen Weg. Tests: `account-deletion.test.mjs`/`.jsx`, `account-deletion-contract.test.mjs`. |

**Blocker 1.1:** benötigt Zulieferung Damien (Name/Anschrift/USt-IdNr./Widerrufsadresse).
**Empfohlener Default:** Bis zur Zulieferung Landing/App **nicht bewerben**; Seiten bleiben
technisch erreichbar (bereits öffentlich), daher Zulieferung höchste Priorität nach P0.
1.2 ist autonom umsetzbar und wird nicht auf 1.1 warten.

## P2 — Datenhygiene, Backup/DR, Git-Remote (High)

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 2.1 | Testdaten-Cleanup Prod-DB (dokumentierter Plan, dann Ausführung) | D-01 | **Plan lokal vorbereitet (2026-07-16):** `scripts/db-cleanup-plan.mjs` = read-only Dry-Run (nur SELECT/COUNT, kein DELETE/UPDATE; Guard `scripts/tests/db-cleanup-plan.test.mjs`). ⛔ **Betreiber-Blocker:** echte Ausführung nur mit Damien-Go + Backup (separates Löschskript); AC bleibt `cs_test%`-Purchases = 0 |
| 2.2 | Backup: täglicher `pg_dump` + Rotation + Off-Site; Restore einmal real getestet | O-01 | **LIVE (2026-07-16):** `healrise-backup.timer` läuft täglich 03:10 Europe/Berlin; erstellt `/backups/healrise/healrise-*.dump`, rotiert 30 Tage, restored jedes Backup in `healrise_restore_test`, kopiert offsite nach `server-zwei:/backups/healrise-offsite/server-eins/` und prüft Remote-Dateigröße. Letzter Status: `restore=PASS`, `tables=46`, `offsite=OK`. |
| 2.3 | Privates Git-Remote + Push; CI aus `docs/ci-github-actions.yml` aktiv | O-02 | **Lokal vorbereitet (2026-07-16):** CI-Vorlage (secret-frei, Pflicht-Jobs/-Schritte) + Readiness-Report `scripts/ci-remote-readiness.mjs`; Guard `scripts/tests/ci-remote-readiness.test.mjs`. ⛔ **Betreiber-Blocker:** Remote anlegen, Vorlage → `.github/workflows/ci.yml`, Actions/Secrets, erster Push/CI nur mit Damien-Go |
| 2.4 | Monitoring ausbauen: Caddy-Access-Log für /healrise, Alerting auf Healthcheck-Fail | L-01 | **Lokal vorbereitet (2026-07-17):** `scripts/healthcheck.sh` löst bei `/_health`-Fail einen env-konfigurierbaren Alarm (`HEALTH_ALERT_CMD`, best effort) aus UND restartet — verhaltensgetestet (`scripts/tests/monitoring-readiness.test.mjs`). Caddy-Access-Log-Artefakt `deploy/caddy/healrise-access-log.caddy` (Datei-Output + Rotation, pfad-scoped /healrise, nachbar-sicher). ⛔ **Betreiber/Damien-Go:** `HEALTH_ALERT_CMD` in der systemd-Unit setzen (Webhook/ntfy) + Access-Log in den Caddyfile einfügen → `validate` → `reload` |
| 2.5 | `chmod 600 strapi/.env` | O-03 | ✅ **live (2026-07-18):** `stat -c %a strapi/.env` = **600**; `scripts/harden-env.sh` (idempotent, im Deploy-Pfad) + Guard `scripts/tests/env-permissions.test.mjs`. |

**Abhängigkeit:** 2.1 vor erstem echten Nutzer-Onboarding; 2.2/2.3 so früh wie möglich
(einzige Code-Kopie liegt auf diesem Server!). **Blocker 2.3:** Wahl des Remotes (GitHub privat?
Org?) = Betreiber-Entscheidung; Default-Empfehlung: privates GitHub-Repo unter Damiens Account.

## P3 — Verkaufsfähigkeit (vor erstem echten Verkauf)

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 3.1 | E-Mail-Provider (nodemailer → lokales Postal), `email_reset_password` setzen | M-01 | **vorbereitet/teilw. blockiert** (s. Status unten): Reset-Mail kommt an (SPF/DKIM pass), Link funktioniert, neues Passwort greift |
| 3.2 | Stripe Test-Modus: Test-Key + Dashboard-Webhook, kompletter Testkauf grün | S-01, S-04 | **lokal vorbereitet/extern blockiert** (s. Status unten): Kauf→Webhook→Plan-Upgrade E2E im Test-Modus |
| 3.3 | Webhook-Fix: 2xx erst **nach** erfolgreicher Verarbeitung | S-02 | ✅ **erledigt (lokal verifiziert):** DB-Fehler → 5xx/Retry; Bestätigungsmail-Fehler kippt 2xx nicht (Retry-Safety-Test) |
| 3.4 | Preise als `STRIPE_PRICE_*`-Env, Abgleich mit Landing (PAngV) | S-03 | ✅ **erledigt (lokal verifiziert):** kanonische `PLAN_PRICE_CENTS` == Checkout-Fallback == Landing == App; ungültige Env geguarded |
| 3.5 | Kaufbestätigungs-Mail (§ 312f) nach erfolgreichem Webhook | M-01 | **lokal vorbereitet/extern blockiert** (s. Status unten): Testkauf erzeugt Bestätigungsmail mit Pflichtinhalten |
| 3.6 | Erst nach 3.1–3.5: Live-Keys, manueller Live-Testkauf + Refund | S-04 | Dokumentierter Live-Test; nur mit ausdrücklicher Freigabe |

**Blocker:** Stripe-Konto/Key-Zugang + Webhook-Registrierung = Betreiber-Aktion (Anleitung
liegt in launch-checklist.md). 3.3/3.4 sind autonom vorbereitbar.

**P3.1-Status (vorbereitet, nicht live erledigt):**
- ✅ Lokal vorbereitet: E-Mail-Provider `nodemailer` env-gesteuert (`SMTP_*`, `strapi/config/plugins.ts`),
  Reset-Link env-gesteuert auf die App-Reset-Seite (`APP_PUBLIC_URL` + `PASSWORD_RESET_PATH` →
  `strapi/src/password-reset-url.ts`, idempotent im Bootstrap in
  `users-permissions.advanced.email_reset_password` geschrieben). `.env.example` dokumentiert alle Werte.
  Zentrale Readiness-/Blocker-Validierung `strapi/src/email-config.ts` (`validateEmailConfig`) prüft
  SMTP/Postal-Env lokal **ohne SMTP-Verbindung** (Auth-Paar-Guard, FROM/Port/Secure, Reset-Basis-URL,
  `forRealDelivery`-Verschärfung) und **leakt nie Secrets**.
  Tests: `scripts/tests/email-provider-config.test.mjs`, `scripts/tests/password-reset-config.test.mjs`,
  `scripts/tests/email-readiness-config.test.mjs`.
- ⛔ Betreiber-Blocker (nach Damien-Go, präzise Schritte in launch-checklist.md §Postal/E-Mail):
  Postal-Domain + Absenderadresse mit **SPF/DKIM** (+ optional DMARC) einrichten, **echte** `SMTP_*`-Werte
  in `strapi/.env` setzen (Modus 600), `validateEmailConfig(env, {forRealDelivery:true})` grün bestätigen,
  Deploy/Restart, dann **kontrollierter** Reset-Mail-Test (echte Zustellung, Link → App-Reset-Seite, neues
  Passwort greift). Bis dahin KEIN echter Mailversand.

**P3.2-Status (lokal vorbereitet, extern blockiert):**
- ✅ Lokal vorbereitet: zentrale Readiness-/Guardrail-Validierung `strapi/src/stripe-config.ts`
  (`validateStripeConfig`) — prüft Pflicht-Envs (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `APP_PUBLIC_URL`), Test-vs-Live-Key-Guard (Live-Key im Testmodus abgelehnt), Webhook-Secret-Format,
  App-scoped success/cancel-URLs und Preis-Env-Plausibilität. **Ohne Netz-/Stripe-Aufruf, Secrets
  werden nie geloggt/gemeldet.** `.env.example` dokumentiert Testmodus + optionalen Publishable-Key.
  Tests: `scripts/tests/stripe-testmode-config.test.mjs` (+ bestehend `stripe-price-parity`,
  `strapi/tests/stripe-webhook`). Der Checkout nutzt dynamische `price_data` (Cent-Env + Fallback),
  daher keine Stripe-Price-IDs nötig.
- ⛔ Betreiber-Blocker (Stripe-Dashboard, nach Go): Test-Secret- + ggf. Publishable-Key erzeugen,
  Webhook-Endpoint `https://…/healrise/app/api/stripe/webhook` registrieren und dessen `whsec_…`
  übernehmen, echte `STRIPE_*` in `strapi/.env`, danach **Testkauf-Smoke** (Kauf→Webhook→Plan-Upgrade)
  im Testmodus. Live-Keys/Live-Testkauf erst unter 3.6 mit ausdrücklicher Freigabe.

**P3.5-Status (lokal vorbereitet, Versand extern/Runtime-blockiert):**
- ✅ Lokal vorbereitet: §312f-Kaufbestätigungsmail (`strapi/src/api/stripe-webhook/purchase-confirmation.ts`)
  — reiner Builder (Empfänger/Plan/Preis, Hinweis auf sofortige Bereitstellung + Erlöschen des
  Widerrufsrechts §356 Abs. 5, App-Link), gestubbter Sender über den Strapi-email-Service. Ausgelöst
  **entkoppelt** über den Purchase-`afterCreate`-Lifecycle
  (`strapi/src/api/purchase/content-types/purchase/lifecycles.ts`) → Webhook-Controller unverändert;
  **best effort** (Mailfehler wirft den gebuchten Kauf nicht um, S-02). Tests:
  `scripts/tests/purchase-confirmation-email.test.mjs` (Builder + Sender + Trigger + best-effort, voll
  gestubbt, kein SMTP/Stripe/Netz).
- ✅ **Pipeline-Härtung (2026-07-18):** Der server-freie Webhook-/§312f-Mail-Goldstandard
  (`strapi/tests/{purchase-confirmation-flow,stripe-webhook,webhook-fulfillment,account-deletion}.test.mjs`)
  lief bisher in **keinem** npm-Skript (`test:scripts` globt nur `scripts/tests/`, `test:api` braucht
  Live-Server) → konnte still regredieren. Jetzt eigenes `test:strapi`-Skript, in `npm run check`
  (DoD-Gate) **und** in die CI-Vorlage (`docs/ci-github-actions.yml`, server-freier Schritt vor
  Server-Start) eingehängt. Selbst-durchsetzender Vertrag `scripts/tests/strapi-unit-tests-wired.test.mjs`
  (jede `strapi/tests/*.test.mjs` verdrahtet oder als build-abhängig dokumentiert — `dist-packaging`).
  Verifiziert: `test:strapi` 31/31, `test:scripts` 392/392, Frontend 219/219.
- ⛔ Runtime-/Betreiber-Blocker (nach Damien-Go, hängt an P3.1): echte `SMTP_*`/Postal mit SPF/DKIM,
  Deploy/Restart, dann **kontrollierter** Testkauf im Stripe-Testmodus → prüfen, dass die
  Bestätigungsmail real zugestellt wird und die Pflichtinhalte enthält. Bis dahin **kein** echter
  Versand; live-Zustellung ist NICHT verifiziert.

## P4 — Security & Performance (Medium)

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 4.1 | Security-Header + HSTS für services.frigew.ski; Rate-Limit `/api/auth/*`; CSP | L-02, M-03 | **Lokal vorbereitet (2026-07-16):** pfad-scopedes Header-Snippet `deploy/caddy/healrise-security-headers.caddy` (HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy, CSP Report-Only) — nachbar-sicher; Strapi-`strapi::security`-CSP für CMS/API aktiv; Guard `scripts/tests/security-headers.test.mjs`. ⛔ **Deploy/Damien-Go:** Einfügen in den geteilten Caddyfile + `caddy validate` + `reload` (kein Auto-Edit/Reload hier); Rate-Limit `/api/auth/*` ✅ **code-seitig erledigt (2026-07-18):** In-Memory-Limiter pro IP (`strapi/src/rate-limit.ts`) + Strapi-Middleware `global::auth-rate-limit` (früh in `config/middlewares.ts`), env-gesteuert `AUTH_RATE_LIMIT_MAX/WINDOW_MS/ENABLED` (Default 10/min), 429 + Retry-After; Guards `scripts/tests/rate-limit.test.mjs` (+ Handler-Verhalten) & `auth-rate-limit-middleware.test.mjs`; JWT-Risk-Accept (M-03) via CSP mitigiert (Live-Verifikation nach Deploy) |
| 4.2 | Caddy-Cache-Header für App+Landing (analog athletik-movement-Block) | P-01 | ✅ Regeln live (P-01) + **versionierte Quelle der Wahrheit (2026-07-16):** `deploy/caddy/healrise-cache-headers.caddy` (gehashte Assets immutable/1 J, Shell/Manifest/sw.js no-cache, ungehashte Statics ≤ 86400, pfad-scoped/nachbar-sicher). Guard `scripts/tests/p42-cache-headers-artifact.test.mjs`; Live-Guard `scripts/tests/caddy-cache-headers.test.mjs`. Künftige Live-Änderungen: Deploy/Damien-Go |
| 4.3 | Font-Subsets latin-only → SW-Precache < 800 KB | P-02 | ✅ **verifiziert (2026-07-16):** `index.css` importiert nur latin-Subsets (11 Faces); frischer Build → **Precache 677,8 KiB** (23 Einträge, 0 nicht-lateinische woff2). Guard: `scripts/tests/precache-budget.test.mjs` |
| 4.4 | SW: 5xx-Fallback auf Cache (NetworkFirst) | P-03 | ✅ **verifiziert (2026-07-16):** Workbox-Plugin `fetchDidSucceed` wirft bei Status ≥ 500 → NetworkFirst-Fallback auf den gecachten `healrise-api`-Eintrag; im gebauten `sw.js` enthalten. Test: `app/src/test/pwa-api-5xx-fallback.test.js` |
| 4.5 | A11y/Metadata: Kontrast; `document.title`+Fokus pro Route; Formular-Status/Fehler angekündigt; Launch-Metadaten | A-01, A-02 | ✅ **lokal verifiziert (2026-07-16):** A-01 `--text-subtle` #6B6E64 ≥ 4,5:1; A-02 `RouteAccessibility` (deterministischer Titel + Fokus/Route); Formular-Status/Fehler `role="status"/"alert"` in Login/Registrierung/Reset/Konto/Kauf (WCAG 4.1.3); `:focus-visible` global; `index.html` mit `lang=de`, description, og:*, theme-color. Guards: `text-subtle-contrast`, `RouteAccessibility.test.jsx`, `form-a11y-announce`. Rest extern: axe/Lighthouse-Run im Browser |
| 4.7 | UI-Resilienz: React-ErrorBoundary — ein Render-Fehler wirft die App nicht mehr auf einen weißen Bildschirm | — (Release-Härtung) | ✅ **erledigt (2026-07-18):** `app/src/components/ui/ErrorBoundary.jsx` (getDerivedStateFromError/componentDidCatch) umschließt den gesamten App-Baum (`App.jsx`, außerhalb Router/Provider); freundliche deutsche Fallback-UI mit „Seite neu laden" + Impressum-Verweis; Logging-/Reset-Hooks injizierbar (kein PII). Guard `app/src/components/ui/ErrorBoundary.test.jsx` (5). Kein externer Schritt |
| 4.6 | Admin UI & Rollen: reduzierte Strapi-Admin-Views (Damien nur „Kunden" + „Produkte", kein Super-Admin; Settings/Media/CTB versteckt) | L-03, L-04 | **code-seitig erledigt (2026-07-18):** Scope + Best-Effort-Seed `strapi/src/admin-role-scope.ts` (Rolle „HEALRISE Betrieb": User r/u, Purchase r, Program CRUD+publish; Allowlist ohne admin::/upload/content-type-builder), idempotent im Bootstrap (`applyBetriebAdminRole`, wirft nie), Menü-Reduktion folgt aus Permissions, CTB in Prod ohnehin aus. Guard `scripts/tests/admin-role-scope.test.mjs` (12, inkl. Non-Vakuum + Doku-Contract), Anleitung `docs/admin-roles.md`. ⛔ **Betreiber-Blocker (GUI, einmalig):** Damien als Admin einladen + Rolle „HEALRISE Betrieb" zuweisen (kein Passwort/Invite im Repo) + Live-Verifikation der Menü-Reduktion; CE-Fallback = eingebaute Editor-Rolle |

**Risiko 4.1:** Header/Rate-Limit auf dem geteilten vHost betreffen andere Projekte →
vorab prüfen, ggf. pfad-spezifisch setzen.

## P5 — Qualitätssicherung & Abschluss

| # | Aufgabe | Finding | Acceptance Criteria |
|---|---|---|---|
| 5.1 | Staging-/Test-DB für api-tests + E2E (eigene DATABASE_NAME); „nie gegen Prod“ dokumentiert | D-02, T-01 | **D-02 lokal umgesetzt (2026-07-16):** harter Isolations-Guard `strapi/tests/test-isolation.mjs` blockiert `api-tests.mjs` VOR jedem Netzwerkzugriff, außer `API_TESTS_ALLOW=1` (Prod-Port :9130 zusätzlich gesperrt); Guard `scripts/tests/api-test-isolation.test.mjs`. ⛔ **Rest extern:** Staging-DB bereitstellen + frischer grüner `check:all` gegen Staging (T-01) |
| 5.2 | Kleinkram: ✅ `Programs.jsx` gelöscht (D-08), ✅ `plan_expires_at` entfernt (D-05), ✅ 3 Extra-Permissions bestätigt+geguardet (D-06), ✅ `.env.example` um SMTP_*/STRIPE_PRICE_* (T-03), ✅ Upload-`sizeLimit` env-gesteuert + Readiness-Guard (D-04, `strapi/src/upload-config.ts`); offen (extern): Object-Storage/CDN für Medienvolumen (D-04), Swap (Y-01), M-02-Entscheidung | div. | jeweils einzeln abgehakt |
| 5.3 | Redaktionelles Content-Sign-off der 9 Programme als Live-Content | D-03 | Sign-off durch Damien dokumentiert |

---

## Abhängigkeitsgraph (grob)

```
P0 ──► R-03-Check (in P0 enthalten)
P0 ──► P3 (Stripe/Mail-E2E brauchen laufendes Strapi)
P0 ──► P5.1 (E2E braucht laufendes Strapi/Staging)
P1.1 ◄── Zulieferung Betreiberdaten (extern, BLOCKER)
P2.3 ◄── Remote-Entscheidung (extern, Default: privates GitHub)
P3.2/3.6 ◄── Stripe-Konto-Aktionen (extern)
P2/P4 untereinander autonom
```

## Offene Betreiber-Entscheidungen (Blocker-Register)

| ID | Entscheidung | Default-Empfehlung | blockiert |
|---|---|---|---|
| BL-1 | Betreiberdaten für Rechtsseiten (Name, Anschrift, USt-IdNr., Widerrufsadresse) | — (Pflichtangabe, nicht defaultbar) | P1.1 |
| BL-2 | Git-Remote (Anbieter/Konto) | privates GitHub-Repo | P2.3 |
| BL-3 | Stripe-Konto: Test-Key erzeugen, Webhook registrieren | Test-Modus zuerst, launch-checklist §Stripe | P3.2, 3.6 |
| BL-4 | E-Mail-Absenderdomain/-adresse (z. B. no-reply@healrise.de über Postal) | no-reply@healrise.de via Postal | P3.1 |
| BL-5 | Registrierung mit E-Mail-Bestätigung? (M-02) | nein vor Verkaufsstart, ja danach prüfen | P5.2 |

## Status-Log

- **2026-07-13:** Roadmap erstellt; P0 von Damien freigegeben, Umsetzung gestartet.
