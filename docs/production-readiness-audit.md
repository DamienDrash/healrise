# HEALRISE — Production-Readiness-Audit

**Datum:** 2026-07-12 · **Phase 1: evidenzbasierter Read-only-Audit** (keine Änderungen am System, keine Secrets eingesehen/ausgegeben, keine Zahlungen/Mails ausgelöst, kein Deploy)
**Stand des Repos:** `main @ 95dbea1`, Working Tree clean.

---

## 1. Executive Summary

Der **Code ist in ungewöhnlich gutem Zustand** (serverseitiges Content-Gating fail-closed, Art.-9-Consent-Mechanik, Webhook-Signaturprüfung + Idempotenz, saubere PWA mit Update-Prompt, Claims-Guard-Test). Die Launch-Blocker liegen fast vollständig **im Betrieb und im Rechtlichen**:

1. **Strapi läuft nicht und hat keinerlei Startmechanismus** — kein systemd, kein pm2, kein Cron, kein Docker. Es lief nie als Dienst (journalctl ohne Historie). Caddy proxied `/healrise/app/api/*` ins Leere → **API liefert 502**, Landing/PWA-Statics laufen (200).
2. **Rechtsseiten (Impressum/Datenschutz/AGB/Widerruf) bestehen aus `[PLATZHALTER: …]`** — abmahnfähig, da öffentlich verlinkt.
3. **E-Mail-Versand ist nicht angebunden** (kein Provider, `email_reset_password=null`) → Passwort-Reset und §-312f-Kaufbestätigung funktionieren nicht.
4. **Stripe ist bewusst degradiert** (`STRIPE_SECRET_KEY` fehlt → Checkout 503), keine Test/Live-Trennung eingerichtet.
5. **Kein Backup-Konzept, kein Git-Remote, kein Monitoring** — die einzige Code-Kopie liegt auf diesem Server.
6. **Prod-DB enthält Testdaten** (15 User, davon 12 Test-Artefakte inkl. `Testuser` mit im Code sichtbarem Default-Passwort; 7 `cs_test_*`-Purchases).

Die eigene `docs/launch-checklist.md` ist ehrlich: alle Betreiber-Items sind als offen markiert — der Audit bestätigt, dass keines davon umgesetzt wurde. Es gibt keine falschen „erledigt"-Behauptungen in der Doku.

---

## 2. Methodik

- Read-only-Checks auf dem Host: `ss`, `systemctl`, `journalctl`, `crontab`, `docker ps`, `curl` gegen Caddy (lokal mit SNI), Datei-/Timestamps, `git log`.
- Read-only SQL (SELECT/count) gegen `healrise_strapi` (Postgres 16.14, nur 127.0.0.1:5434 — gut).
- Statische Code-Analyse von `strapi/`, `app/`, `landing/`, `scripts/`, `docs/`, `/etc/caddy/Caddyfile`.
- Env-Prüfung ausschließlich über Variablen-**Namen** und Nicht-leer-Checks; keine Werte eingesehen oder ausgegeben.
- ESLint lief read-only (ohne `--fix`) und war sauber. Keine Builds, keine E2E-Läufe, kein Strapi-Start.

---

## 3. Ist-Zustand Betrieb (verifiziert)

| Komponente | Zustand | Evidenz |
|---|---|---|
| Landing `/healrise/` | ✅ 200, aus `/opt/healrise/dist` (root-owned, byte-identisch zu `landing/`, in git) | curl via Caddy |
| PWA `/healrise/app/` | ✅ 200, aus `app/dist` (frisch, Build 11.07. 19:37 ≥ letzter Commit) | curl, Timestamps |
| API `/healrise/app/api/*` | ❌ **502** — Proxy-Ziel 127.0.0.1:9130 tot | curl, `ss -tlnp` |
| Strapi-Prozess | ❌ existiert nicht; kein systemd/pm2/cron/docker; keine journal-Historie | `systemctl`, `pm2`, `crontab -l`, `docker ps`, `journalctl` |
| Strapi-Admin `/cms` | ❌ keine Caddy-Route (deployment.md:21 sieht sie vor); `/admin` nur via localhost erreichbar (sicherheitlich ok, aber Remote-Pflege unmöglich) | Caddyfile:41–76 |
| Postgres | ✅ `postgresql@16-main` läuft, DB `healrise_strapi` erreichbar, 46 Tabellen, nur localhost:5434 | psql read-only |
| Caddy | ✅ läuft (systemd), TLS automatisch; keine Security-Header, keine Access-Logs für services.frigew.ski | Caddyfile |
| Mail-Infrastruktur | ✅ Host kann senden (Postal-Docker auf :25, SPF/MX/DMARC vorhanden) — aber Strapi nicht angebunden | `docker ps`, `dig` |

**Warum ist Port 9130 down?** Es gibt keinen Defekt — Strapi wurde nie als Dienst eingerichtet. Startvoraussetzungen sind erfüllt (node_modules vorhanden, `dist/` kompiliert und aktueller als `src/`, Node v22 erfüllt `engines`, `PORT=9130` gesetzt, DB erreichbar). Es fehlt allein der Prozessmanager. Zusätzlich fehlt das Admin-Panel-Build (`dist/build/`), d. h. `strapi start` würde auf das Default-Admin-Build zurückfallen, das den Subpfad hinter dem Proxy nicht kennt.

---

## 4. Findings

Severity: **Blocker** = verhindert Launch · **High** = vor Launch zwingend · **Medium** = kurz nach Launch / vor Verkaufsstart · **Low** = Hygiene.

### 4.1 Betrieb & Deployment

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **B-01** | Kein Prozessmanagement für Strapi; Dienst läuft nicht, startet nach Reboot nicht | `ss`, `systemctl`, `~/.pm2/dump.pm2`=[], `crontab -l` leer, `docker ps`; deployment.md:37 (Soll nie umgesetzt) | **Blocker** |
| **B-02** | Admin-Panel-Build fehlt (`strapi/dist/build/` existiert nicht) → Admin hinter `PUBLIC_URL`-Subpfad kaputt | `ls strapi/dist` (nur config/src/tsbuildinfo) | High |
| **B-03** | Keine Caddy-Route für Strapi-Admin (`/healrise/app/cms/*` laut deployment.md:21 vorgesehen) → CMS-Pflege remote unmöglich | Caddyfile:41–76 | High |
| **B-04** | `dist/` (Landing) und `app/dist/` teilweise **root-owned**; Arbeits-User `claude` — `npm run build`/`build:landing` schlagen fehl, Deploy nicht reproduzierbar | `ls -la`, `scripts/build-landing.mjs:22–23` (rmSync/cpSync) | High |
| **B-05** | deployment.md beschreibt nginx statt Caddy und eine nicht existente CMS-Route | deployment.md:10,21–26,43 vs. Caddyfile | Medium |
| **B-06** | Basis-Pfad `/healrise/app` an 4 Stellen hart kodiert | `client.js:3`, `App.jsx:118`, `vite.config.js:6`, Manifest | Low |

**Akzeptanzkriterien:** B-01: systemd-Unit mit `NODE_ENV=production`, `Restart=always`, enabled; API antwortet nach Reboot. B-02: `npm run build` erzeugt `dist/build/`; Admin-Login lädt fehlerfrei über die öffentliche URL. B-03: bewusste Entscheidung CMS-Route ja/nein dokumentiert + umgesetzt (bei „ja": Route + ggf. IP-/Auth-Schutz). B-04: Build+Deploy laufen ohne root durch, Ownership konsistent, Deploy-Skript existiert. B-05: Doku = Realität.

### 4.2 Recht & Datenschutz

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **R-01** | Impressum/Datenschutz/AGB/Widerruf voller `[PLATZHALTER: …]` (Name, Anschrift, USt-IdNr., Widerrufsadresse); Landing verlinkt genau darauf → § 5 DDG verletzt, abmahnfähig. **Lokaler Guard (2026-07-16):** `scripts/legal-readiness.mjs` (+ `scripts/tests/legal-readiness.test.mjs`) meldet offene Platzhalter (aktuell **13 Felder**) + fehlende Pflicht-Rechtslinks, Exit 1 bis gefüllt — nur Feldnamen/Zeilen, keine Daten. ⛔ **Betreiber-Blocker bleibt:** echte Betreiberdaten (Damien) einsetzen + anwaltliche Prüfung; **kein Auto-Fill, keine Konformitätsaussage** | `app/src/pages/Legal.jsx`; `landing/index.html`; `scripts/legal-readiness.mjs` | **Blocker** |
| **R-02** | Kontolöschung fehlt in UI und API, obwohl die Datenschutzerklärung sie verspricht („bis zur Löschung deines Kontos") | `Legal.jsx:134–135` vs. `Account.jsx:428–440`, `api/auth.js` | High |
| **R-03** | Claims: Quellen + Builds sauber (Guard-Test, „Hautpflege"-Rename in dist verifiziert). **Live-CMS-Inhalte live-verifiziert (2026-07-16):** `node scripts/claims-check.mjs` → 9 published Programme, **0 Treffer** gegen die ❌-Liste (Exit 0) | `app/src/test/landing.test.js:75–94`; dist-Greps 0 Risiko-Treffer; `scripts/claims-check.mjs` (+ `scripts/tests/claims-check.test.mjs`, `scripts/tests/claims-check-doc.test.mjs`) | Low (live bestätigt; Rest: bei jeder CMS-Änderung erneut prüfen) |
| **R-04** | Positiv: kein Tracking/Analytics, Fonts self-hosted, kein Cookie-Banner nötig (korrekt begründet), Registrierung mit nicht vorangekreuzter Art.-9-Checkbox, Consent-Widerruf löscht Progress serverseitig | grep app/landing; `strapi-server.ts:52–57` | OK |

**Akzeptanzkriterien:** R-01: `grep -r PLATZHALTER app/src` = 0; Freigabe dokumentiert. R-02: Lösch-Endpoint + UI (oder dokumentierter Prozess mit Frist), Datenschutzerklärung beschreibt den realen Weg. R-03: nach Strapi-Start API-Dump aller published Programme gegen ❌-Liste greppen (0 Treffer); Guard-Test auf `dist/` ausweiten.

### 4.3 E-Mail & Auth

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **M-01** | Kein E-Mail-Provider konfiguriert (kein `email`-Block in config/plugins.ts, keine Provider-Dependency, keine SMTP-Env-Vars — auch nicht in .env.example); DB: `email_reset_password=null` → **Passwort-Reset faktisch tot**, §-312f-Kaufbestätigung unmöglich. Host-seitig steht Postal (Docker :25, SPF/MX/DMARC ok) bereit | config/plugins.ts; package.json; DB `plugin_users-permissions_advanced`; `docker ps`, `dig` | **High** (Blocker für Verkaufsstart) |
| **M-02** | `email_confirmation=false` — Registrierung ohne E-Mail-Bestätigung; bewusste Entscheidung? | DB advanced-settings | Low |
| **M-03** | JWT im localStorage (XSS-exfiltrierbar); mitigiert durch DOMPurify-Sanitizing des einzigen `dangerouslySetInnerHTML`. **CSP vorbereitet (2026-07-16):** konservative CSP (Report-Only) im Header-Snippet `deploy/caddy/healrise-security-headers.caddy`; Strapi-CSP für CMS/API aktiv. ⛔ Enforcing-CSP + Live-Verifikation = Deploy/Damien-Go | `client.js:8`, `sanitize.js:8–18`; `deploy/caddy/healrise-security-headers.caddy` | Medium (CSP-Artefakt bereit; Deploy extern) |
| **M-04** | Positiv: JWT ohne Fallback-Secret, `updateMe`-Whitelisting, generisches `user.update` deaktiviert, Anti-Enumeration im Forgot-Password-Flow | config/plugins.ts:8; strapi-server.ts:10–38; ForgotPassword.jsx:31 | OK |

**Akzeptanzkriterien:** M-01: Provider (z. B. nodemailer) gegen Postal konfiguriert, `email_reset_password` auf die App-Route gesetzt; E2E: Mail kommt an (SPF/DKIM pass), Link funktioniert, neues Passwort greift. M-03: dokumentierter Risk-Accept **plus** CSP via Caddy, oder Umstieg auf httpOnly-Cookie.

### 4.4 Stripe / Monetarisierung

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **S-01** | `STRIPE_SECRET_KEY` fehlt in .env (in .env.example vorhanden) → Checkout antwortet sauber 503; keine echten Käufe möglich (sicherer Default, aber Launch-relevant) | Env-Namensvergleich; `checkout.ts:38–43` | High (vor Verkaufsstart) |
| **S-02** | Webhook sendet **200 vor der Verarbeitung** („Stripe wiederholt ohnehin" — falsch: nach 200 kein Retry). DB-Fehler ⇒ bezahlt, aber nie freigeschaltet | `stripe-webhook.ts:88–99` | Medium |
| **S-03** | Keine `STRIPE_PRICE_*`-Env-Vars → hartkodierte Fallback-Preise 69/169/399 € (PAngV-Risiko bei Abweichung zur Landing) | `checkout.ts:10–14` | Medium |
| **S-04** | Keine Test/Live-Trennung eingerichtet (nur ein Key-Paar vorgesehen); aktuelles `whsec` laut Checkliste nur lokaler Testwert; Webhook im Stripe-Dashboard nicht registriert | launch-checklist.md:24–31 | Medium |
| **S-05** | Positiv: Signaturprüfung gegen rohen Body (`includeUnparsed`), Route bewusst `auth:false`, Idempotenz via unique `stripe_session_id`, kein Plan-Downgrade; Client ohne Stripe.js/Key, § 312j-Strecke korrekt (Checkbox, Pflichtinfos am Button) | middlewares.ts:36–39; stripe-webhook.ts:26–86; Upgrade.jsx:181–300 | OK |

**Akzeptanzkriterien:** S-01/S-04: Test-Key + registrierter Test-Webhook → kompletter Testkauf (Kauf→Webhook→Plan-Upgrade) grün; erst dann Live-Keys als getrennte, dokumentierte Werte. S-02: 2xx erst nach erfolgreicher Verarbeitung (oder persistente Retry-Queue); Testfall erzwungener DB-Fehler → Stripe-Retry schaltet nach. S-03: Preise als Env-Vars, gegen Landing-Preise verifiziert.

### 4.5 Daten & Content

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **D-01** | Prod-DB voller Testdaten: 15 User = 1 Seed-`Testuser` + 12 Test-Artefakte (`buyer_*`, `iso_*`); 7 Purchases `cs_test_*`; 7 User auf `premium` via Fake-Webhook. **Dry-Run-Plan lokal vorbereitet (2026-07-16):** `scripts/db-cleanup-plan.mjs` (nur read-only SELECT/COUNT, kein DELETE/UPDATE; Guard `scripts/tests/db-cleanup-plan.test.mjs`). ⛔ **Ausführung = Betreiber-Blocker** (Damien-Go + Backup); Weitere Verschmutzung durch D-02-Guard gestoppt | read-only SQL counts; `scripts/db-cleanup-plan.mjs` | **High** (Ausführung offen; Neuzugang gestoppt) |
| **D-02** | API-Tests (`strapi/tests/api-tests.mjs`) schreiben in die Ziel-DB (registrieren User, erzeugen Purchases, ändern Testuser-Passwort) — Ursache von D-01. **Abgesichert (2026-07-16):** harter Isolations-Guard (`strapi/tests/test-isolation.mjs`) blockiert Läufe vor jedem Netzwerkzugriff, außer bewusst `API_TESTS_ALLOW=1` (Prod-Port :9130 doppelt gesperrt). Rest: Staging-DB extern | api-tests.mjs; `scripts/tests/api-test-isolation.test.mjs` | Low (Guard aktiv; Staging extern) |
| **D-03** | Content = 9 Seed-Programme, alle published (18 Zeilen = 9 Dokumente × Draft+Published, D&P korrekt genutzt); redaktionelle Abnahme als finaler Live-Content steht aus | SQL; src/index.ts:90–100 | Medium |
| **D-04** | ~~Upload-Plugin unkonfiguriert (kein Provider, kein sizeLimit)~~ **Explizit abgesichert (2026-07-16):** `plugins.ts` setzt `upload.config.sizeLimit` env-gesteuert mit sicherem Default (5 MiB, `UPLOAD_SIZE_LIMIT_BYTES`); lokaler Default-Provider (keine Credentials). Readiness-Guard `strapi/src/upload-config.ts` + `scripts/tests/upload-readiness-config.test.mjs` (blockt fehlendes/unbounded Limit und „Object-Storage behauptet ohne Config"). ⛔ Externes Object-Storage/CDN für großes Medienvolumen = Betreiber-Schritt | `config/plugins.ts`; `strapi/src/upload-config.ts` | Low (lokal abgesichert; Object-Storage extern) |
| **D-05** | `plan_expires_at` im User-Schema vorhanden, wird nirgends ausgewertet | user schema.json; grep src/ | Low |
| **D-06** | 3 Public-Permissions in DB ohne Bootstrap-Pendant (`auth.connect`, `auth.refresh`, `auth.sendEmailConfirmation`); sonst Code=DB deckungsgleich (18 Permissions, 2 Rollen, 1 Admin-User). **Bestätigt (2026-07-16):** akzeptierte Strapi-Default-Auth-Flows, bewusst nicht bootstrap-verwaltet; Guard `scripts/tests/permissions-allowlist.test.mjs` sperrt die Code-Allowlists exakt + Rechte-Ausweitungs-Invarianten. | SQL up_permissions vs. src/index.ts:30–56 | Low (bestätigt) |
| **D-07** | Positiv: Content-Gating serverseitig & fail-closed (`stripLockedFields`, `ensurePlanRequiredField`); Progress strikt user-isoliert, Consent-Gate (Art. 9), Widerruf löscht serverseitig | program/controllers+services; progress-entry.ts:15–35 | OK |
| **D-08** | Toter Code `app/src/pages/Programs.jsx` (nicht geroutet) nutzt falsches Feld `required_plan` — bei Reaktivierung UI-seitige Fehl-Freigabe | Programs.jsx:32,219,229,345,361 | Low |

**Akzeptanzkriterien:** D-01: dokumentierter Cleanup; `SELECT count(*) FROM purchases WHERE stripe_session_id LIKE 'cs_test%'`=0; kein User mit bekanntem Passwort. D-02: Tests nur gegen Staging-DB (eigene DATABASE_NAME) oder mit Self-Cleanup; Doku „nie gegen Prod". D-03: redaktionelles Sign-off. D-08: Datei löschen oder Feld fixen.

### 4.6 Backup, DR, CI, Git

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **O-01** | **LIVE (2026-07-16):** täglicher `healrise-backup.timer` 03:10 Europe/Berlin; echter pg_dump nach `/backups/healrise`, Restore-Drill gegen `healrise_restore_test`, Offsite-Sync nach `server-zwei:/backups/healrise-offsite/server-eins/`, Statusdatei `.healrise-backup-status` mit `restore=PASS`, `tables=46`, `offsite=OK`; Rotation 30 Tage. | `scripts/db-backup.sh`; `scripts/db-restore-drill.sh`; `scripts/healrise-backup-offsite-restore.sh`; `deploy/systemd/healrise-backup.*` | **Done / überwachen** |
| **O-02** | Kein Git-Remote (`git remote -v` leer), kein `.github/`; **einzige Code-Kopie liegt auf diesem Server**. **Lokal vorbereitet (2026-07-16):** CI-Vorlage `docs/ci-github-actions.yml` (frontend + backend-api Jobs, lint/test/build, secret-frei) + Readiness-Report `scripts/ci-remote-readiness.mjs` (validiert Vorlage, meldet Remote-Status; kein Netz/Push); Guard `scripts/tests/ci-remote-readiness.test.mjs`. ⛔ **Betreiber-Blocker (Damien-Go):** privates Remote anlegen + `git remote add`, Vorlage → `.github/workflows/ci.yml`, Actions/Secrets aktivieren, erster Push/CI-Lauf | git remote; `scripts/ci-remote-readiness.mjs` | **High** (Remote/Push extern; Verfahren bereit) |
| **O-03** | `strapi/.env` mit Mode 644 (world-readable) auf einem Multi-Projekt-Host | stat | Medium |
| **O-04** | Git-Hygiene sonst sauber: .env git-ignoriert und nie committet, backups ignoriert, Working Tree clean; Secrets-Rotation (Checklist §3) nicht verifizierbar | .gitignore; git log --diff-filter=A | Low |

**Akzeptanzkriterien:** O-01: täglicher pg_dump + Uploads-Sync mit Rotation und Off-Site-Kopie; Restore einmal real getestet und dokumentiert. O-02: privates Remote + Push; CI aus Vorlage aktiv und grün. O-03: `chmod 600`.

### 4.7 Logging, Monitoring, Security-Header

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **L-01** | Kein Logging/Monitoring (Strapi stdout, Caddy ohne `log`, kein Healthcheck/Alerting). **Teils behoben/vorbereitet:** journald via systemd-Unit (P0) + Healthcheck-Timer (P0). **2.4 (2026-07-17):** Healthcheck-Alerting via `HEALTH_ALERT_CMD` (best effort, verhaltensgetestet) + versioniertes Caddy-Access-Log-Artefakt `deploy/caddy/healrise-access-log.caddy` (Rotation, pfad-scoped). Guard `scripts/tests/monitoring-readiness.test.mjs`. ⛔ Live: `HEALTH_ALERT_CMD` in Unit + Access-Log in Caddyfile (Deploy/Damien-Go) | Caddyfile; `scripts/healthcheck.sh`; `deploy/caddy/healrise-access-log.caddy` | Medium (Alarm-/Log-Verfahren bereit; Live extern) |
| **L-02** | Keine Security-Header auf services.frigew.ski (kein HSTS, X-Content-Type-Options, CSP); kein Rate-Limit auf `/api/auth/*`. **Lokal vorbereitet (2026-07-16):** pfad-scopedes, nachbar-sicheres Header-Snippet `deploy/caddy/healrise-security-headers.caddy` + Guard `scripts/tests/security-headers.test.mjs`. ⛔ Einfügen in geteilten Caddyfile + `reload` = Deploy/Damien-Go; Rate-Limit = Serverkonfig | Caddyfile-Vergleich; `deploy/caddy/healrise-security-headers.caddy` | Medium (Snippet bereit; Deploy extern) |
| **L-03** | Positiv: Strapi-Admin nicht öffentlich exponiert (nur `/api/*` geproxied); Postgres nur localhost | Caddyfile; ss | OK |

**Akzeptanzkriterien:** L-01: Logs via journald (systemd-Unit reicht), Caddy-Access-Log für /healrise, Healthcheck (z. B. curl `/api/programs` alle 5 min + Alert). L-02: Header-Block + HSTS; Rate-Limit auf Auth-Endpoints.

### 4.8 Performance & PWA

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **P-01** | ~~Caddy ohne Cache-Header für HEALRISE~~ **Behoben (P-01, live) + versioniert (2026-07-16):** Cache-Regeln live im Caddyfile; versionierte Quelle `deploy/caddy/healrise-cache-headers.caddy` (gehasht immutable/1 J, Shell/Manifest/sw.js no-cache, ungehasht ≤ 86400; pfad-scoped/nachbar-sicher). Guards: `scripts/tests/p42-cache-headers-artifact.test.mjs` (Artefakt) + `scripts/tests/caddy-cache-headers.test.mjs` (live) | `deploy/caddy/healrise-cache-headers.caddy` | Low (behoben) |
| **P-02** | ~~SW-Precache ~2,2 MB: volle @fontsource-Importe ziehen 98 woff2 in den Precache~~ **Behoben/verifiziert (2026-07-16):** `index.css` importiert nur latin-Subsets (11 Faces); frischer Build → Precache **677,8 KiB** (< 800 KiB), 0 nicht-lateinische woff2 | `index.css`; `scripts/tests/precache-budget.test.mjs` | Low (behoben) |
| **P-03** | ~~NetworkFirst fällt bei schnellem 502 nicht auf den Cache zurück → Fehler-UI~~ **Behoben/verifiziert (2026-07-16):** Workbox-Plugin `fetchDidSucceed` wirft bei Status ≥ 500 → NetworkFirst liefert den gecachten `healrise-api`-Eintrag; im gebauten `sw.js` enthalten | `app/vite.config.js`; `app/src/test/pwa-api-5xx-fallback.test.js` | Low (behoben) |
| **P-04** | Positiv: PWA-Goldstandard — Manifest vollständig, `registerType:'prompt'` + Update-Banner, `navigateFallbackDenylist` für /api, sw.js no-cache via Caddy, dist frisch (Build ≥ letzter Commit), JS-Bundle 404 KB/123 KB gzip | vite.config.js; UpdatePrompt.jsx; Caddyfile:47–53 | OK |

**Akzeptanzkriterien:** P-01: Cache-Regeln analog athletik-movement. P-02: nur latin/latin-ext-Subsets, Precache < ~800 KB. P-03: `handlerDidError`-Fallback auf Cache; Test: Strapi stoppen → gecachte Programme lesbar.

### 4.9 Accessibility

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **A-01** | ~~`--text-subtle: #83867D` ≈ 3,3:1~~ **Behoben/verifiziert (2026-07-16):** `#6B6E64` ≥ 4,5:1 auf Ivory/ivory-2/surface | `index.css`; `scripts/tests/text-subtle-contrast.test.mjs` | Low (behoben) |
| **A-02** | ~~Kein `document.title`/Fokus-Management bei Routenwechsel~~ **Behoben/verifiziert (2026-07-16):** `RouteAccessibility` setzt deterministischen `document.title` + Fokus pro Route; zusätzlich Formular-Status/Fehler `role="status"/"alert"` (WCAG 4.1.3) in Login/Registrierung/Reset/Konto/Kauf | `app/src/components/layout/RouteAccessibility.jsx`; `scripts/tests/form-a11y-announce.test.mjs` | Low (behoben) |
| **A-03** | `span role="link"` statt echtem Link (immerhin tabIndex+Enter-Handler) | ProgramDetail.jsx:~250 | Low |
| **A-04** | Positiv: `lang="de"`, Labels+autocomplete an allen Formfeldern, Skip-Link, aria-hidden für Deko-SVGs, `:focus-visible`, `role="alert"` am Update-Banner | app/landing index.html; Login.jsx | OK |

**Akzeptanzkriterien:** A-01: Farbe abdunkeln (~#6B6E64) oder nur ≥18 px/Bold; axe/Lighthouse ohne AA-Fails. A-02: Titel+Fokus pro Route.

### 4.10 Tests & Env-Vollständigkeit

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **T-01** | E2E-Evidenz veraltet: letzter grüner Lauf 03.07., Commits vom 11.07. (Claims, Rename, Rebuild) ungetestet; E2E braucht laufendes Strapi (`SEED_DEMO=true`) — aktuell nicht ausführbar | test-results/.last-run.json (03.07.) vs. 95dbea1 (11.07.) | Medium |
| **T-02** | Testabdeckung solide: Vitest 19 describe-Blöcke (inkl. Claims-Guard), Playwright-Kernpfade (Registrierung/Gating/§312j/Progress), Offline-Suite, API-Tests mit Permissions-/Gating-Matrix + Webhook-Replay — aber keine Page-Level-Unit-Tests | app/src/test/; e2e/; strapi/tests | Low |
| **T-03** | Env: alle kritischen Secrets vorhanden und nicht-leer (Namen: APP_KEYS, ADMIN_JWT_SECRET, API_TOKEN_SALT, TRANSFER_TOKEN_SALT, ENCRYPTION_KEY, JWT_SECRET, DATABASE_*, PUBLIC_URL, APP_PUBLIC_URL, STRIPE_WEBHOOK_SECRET). **Fehlend:** STRIPE_SECRET_KEY (→S-01), STRIPE_PRICE_* (→S-03), sämtliche SMTP_*-Vars (→M-01, auch in .env.example nicht vorgesehen). NODE_ENV wird nirgends erzwungen | Namensvergleich .env / .env.example / grep config+src | Medium |

**Akzeptanzkriterien:** T-01: frischer grüner `check:all` (auf Staging) nach letztem Commit, Report archiviert. T-03: .env.example um SMTP_*/STRIPE_PRICE_* ergänzt; systemd-Unit setzt NODE_ENV=production.

### 4.11 System

| ID | Befund | Evidenz | Sev. |
|---|---|---|---|
| **Y-01** | Kein Swap (0 MB) auf geteiltem Host mit ~20 Containern — OOM-Risiko bei Build-Spitzen | free -m | Low |
| **Y-02** | Positiv: Disk 44 % (220 G frei), unattended-upgrades aktiv, Postgres 16.14 (Support bis 11/2028) | df, apt-config | OK |

---

## 5. Priorisierter Umsetzungsplan (Phase 2)

### P0 — Betrieb herstellen (Blocker; Voraussetzung für alles Weitere)
1. Admin-Panel-Build erzeugen (`NODE_ENV=production npm run build` in strapi/) — **B-02**
2. systemd-Unit `healrise-strapi.service` (NODE_ENV=production, Restart=always, enabled) → API 200 statt 502, reboot-fest — **B-01**
3. Entscheidung + Umsetzung CMS-Route `/healrise/app/cms/*` (empfohlen: ja, ggf. mit zusätzlichem Schutz) — **B-03**
4. Deploy-Ownership fixen (root-Dateien in dist/ übernehmen, Deploy ohne root reproduzierbar) — **B-04**
5. Sofort danach: Live-CMS-Claims-Dump gegen ❌-Liste (0 Treffer) — **R-03**

### P1 — Recht (Blocker für öffentliche Sichtbarkeit)
6. Rechtsseiten-Platzhalter durch echte Betreiberdaten ersetzen (Zulieferung Damien nötig: Name/Anschrift/USt-IdNr.) — **R-01**
7. Kontolöschung: Server-Endpoint + UI in „Gefahrenzone" — **R-02**

### P2 — Datenhygiene & DR (High)
8. Testdaten-Cleanup in Prod-DB (Testuser/buyer_*/iso_*, cs_test-Purchases) — **D-01**
9. Backup-Cron (pg_dump täglich + Rotation + Off-Site) + einmal getesteter Restore, dokumentiert — **O-01**
10. Git-Remote (privat) + Push + CI aus Vorlage aktivieren — **O-02**
11. Healthcheck/Monitoring + Caddy-Access-Log + journald-Logs — **L-01**
12. `chmod 600 strapi/.env` — **O-03**

### P3 — Verkaufsfähigkeit (High/Medium; vor erstem echten Verkauf)
13. E-Mail: Provider gegen Postal, `email_reset_password` setzen, Reset+Kaufbestätigung E2E — **M-01**
14. Stripe Test-Modus: Key + Dashboard-Webhook, Testkauf E2E grün — **S-01/S-04**
15. Webhook-Fix: 2xx erst nach Verarbeitung — **S-02**
16. Preise als `STRIPE_PRICE_*`-Env, Abgleich mit Landing — **S-03**
17. Erst danach: Live-Keys, manueller Live-Testkauf mit Refund — **S-04**

### P4 — Security & Performance (Medium)
18. Security-Header + HSTS auf services.frigew.ski; Rate-Limit `/api/auth/*`; CSP (→ JWT-Risk-Accept dokumentieren) — **L-02/M-03**
19. Caddy-Cache-Header für App+Landing (analog athletik-movement) — **P-01**
20. Font-Subsets latin-only, Precache < 800 KB; 5xx-Cache-Fallback im SW — **P-02/P-03**
21. A11y: Kontrast `--text-subtle`, Titel+Fokus pro Route — **A-01/A-02**

### P5 — Qualitätssicherung & Abschluss
22. Staging-/Test-DB für api-tests + E2E; frischer grüner `check:all`, Report archiviert — **D-02/T-01**
23. deployment.md an Realität angleichen (Caddy, Unit, Backup, Restore) — **B-05**
24. Kleinkram: `Programs.jsx` löschen (D-08), `plan_expires_at` klären (D-05), 3 Extra-Permissions bestätigen (D-06), .env.example ergänzen (T-03), Swap (Y-01), redaktionelles Content-Sign-off (D-03), M-02-Entscheidung

**Abhängigkeiten:** P0 blockiert R-03, S-14ff., T-01/22. R-01 benötigt Zulieferung (Betreiberdaten). Alles andere ist autonom umsetzbar.

---

## 6. Anhang: Nicht ausgeführte Prüfungen

- Kein Strapi-Start (wäre Systemänderung) → Admin-UI-Funktionsprüfung, Live-CMS-Claims und API-/E2E-Testläufe stehen für Phase 2 nach P0 an.
- Secrets-Rotation (launch-checklist §3) ohne Werte-Einsicht nicht verifizierbar.
- DKIM-Selektoren von Postal extern nicht abschließend prüfbar.
