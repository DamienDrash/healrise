# HEALRISE — Release-Readiness-Summary (Stand 2026-07-18)

Tabellarische Gesamtübersicht aller Roadmap-Punkte (`docs/production-readiness-roadmap.md`)
mit klarer Trennung: **autonom erledigt** (Code/Deploy/Tests) vs. **Damien-Blocker**
(externe Aktionen, die nur der Betreiber tun kann). Details/Belege stehen jeweils
in der Roadmap.

## Legende
- ✅ **erledigt** — code-seitig fertig, getestet, ggf. live verifiziert.
- 🟡 **code-fertig / extern blockiert** — lokal vollständig + getestet; wartet nur
  auf eine externe Betreiber-Aktion (Keys, DNS, Deploy-Reload, GUI-Klick).
- ⛔ **Damien** — reine Betreiber-/Rechts-/Content-Aufgabe, nicht autonom lösbar.

## P0 — Betrieb (LIVE)

| # | Punkt | Status | Beleg (2026-07-18) |
|---|---|---|---|
| 0.1 | Admin-Panel-Build | ✅ | `strapi/dist/build/index.html` da; Smoke `/cms/admin` 200 + Asset 200 |
| 0.2 | systemd `healrise-strapi.service` | ✅ | `is-enabled`=enabled, `is-active`=active; `/_health` 204 |
| 0.3 | Caddy CMS/API-Proxy-Route | ✅ | `caddy validate` = „Valid configuration"; `/cms/admin` 200 |
| 0.4 | Reproduzierbarer Deploy (`deploy.sh`) | ✅ | gehärtet+geguardet; Live-Smoke 7/7 grün |
| 0.5 | Healthcheck-Timer (5 min) | ✅ | `health.timer` enabled+active, `list-timers` 5-min-Takt |
| 0.6 | Live-CMS-Claims-Check | ✅ | 9 published Programme, 0 Treffer (2026-07-16) |
| 0.7 | `docs/deployment.md` = Realität | ✅ | Doku↔Realität-Guard 7/7 |

## P1 — Recht

| # | Punkt | Status | Was fehlt |
|---|---|---|---|
| 1.1 | Rechtsseiten mit echten Betreiberdaten | ⛔ Damien | **BL-1:** Name/Anschrift/USt-IdNr./Widerrufsadresse liefern; anwaltliche Prüfung. Code/Platzhalter + Guards fertig. |
| 1.2 | Kontolöschung (GDPR Art. 17) | ✅ | erledigt, Commit `810d5b0` (Endpoint self-only, Purchase-Anonymisierung, „LÖSCHEN"-Bestätigung, Landing-Redirect) |

## P2 — Daten & Infrastruktur

| # | Punkt | Status | Was fehlt |
|---|---|---|---|
| 2.1 | Testdaten-Cleanup Prod-DB | 🟡 | Dry-Run-Plan + Guard fertig; ⛔ echte Ausführung nur mit Damien-Go + Backup |
| 2.2 | Backup + Off-Site + Restore-Drill | ✅ LIVE | täglich 03:10, restore=PASS, offsite=OK |
| 2.3 | Git-Remote + CI | 🟡 | Vorlage + Readiness-Report fertig; ⛔ **BL-2:** privates Remote anlegen, Push, Actions/Secrets |
| 2.4 | Monitoring (Access-Log, Alerting) | 🟡 | Skript+Artefakt fertig; ⛔ `HEALTH_ALERT_CMD` in Unit + Access-Log in Caddyfile → reload |
| 2.5 | `chmod 600 strapi/.env` | ✅ | `stat` = 600 (live) |

## P3 — Verkaufsfähigkeit (Stripe & Mail)

| # | Punkt | Status | Was fehlt |
|---|---|---|---|
| 3.1 | E-Mail-Provider/Postal + Passwort-Reset | 🟡 | Provider/Templates/Readiness/Doku fertig; ⛔ **BL-4:** Postal-Domain + SPF/DKIM/Return-Path + `SMTP_*` in `.env` |
| 3.2 | Stripe Testmodus (Checkout+Webhook) | 🟡 | Checkout/Webhook/Resolver/API-Pin/Doku fertig; ⛔ **BL-3:** Test-Keys + Webhook-Endpoint im Dashboard |
| 3.3 | Webhook: 2xx erst nach Verarbeitung | ✅ | erledigt (S-02 Retry-Safety) |
| 3.4 | Preise als `STRIPE_PRICE_*`-Env | ✅ | erledigt (Preis-Parität geguardet) |
| 3.5 | §312f-Kaufbestätigungs-Mail | 🟡 | Builder/Lifecycle/Tests fertig; ⛔ echter Versand hängt an BL-4 (ausgelöst durch Testkauf BL-3) |
| 3.6 | Live-Keys + Live-Testkauf/Refund | ⛔ Damien | erst nach 3.1–3.5; Live-Key-Eintrag + manueller Testkauf/Refund |
| — | Refund-/Cancel-Fulfillment (Extra) | ✅ | `charge.refunded`/`subscription.deleted` → Plan-Downgrade + Purchase-Storno (autonom, `d2ca5be`+) |

## P4 — Performance, A11y, Security

| # | Punkt | Status | Was fehlt |
|---|---|---|---|
| 4.1 | Security-Header/HSTS/CSP + Rate-Limit | 🟡 | Rate-Limit ✅ code-live-fähig; Header-Snippet fertig; ⛔ in Caddyfile einfügen → reload |
| 4.2 | Caddy-Cache-Header | ✅ LIVE | live + versioniert |
| 4.3 | Font-Subsets latin-only | ✅ | Precache < 800 KB |
| 4.4 | SW 5xx-Fallback (NetworkFirst) | ✅ | erledigt |
| 4.5 | A11y/Metadata (Kontrast/Titel/Fokus/Forms) | ✅ | erledigt (+ Skip-Link, Heading-Hierarchie-Guard autonom ergänzt) |
| 4.6 | Admin UI & Rollen (Damien scoped) | 🟡 | Scope+Seed+Doku fertig; ⛔ GUI: Damien einladen + Rolle „HEALRISE Betrieb" zuweisen |
| 4.7 | React-ErrorBoundary | ✅ | erledigt |

## P5 — Qualitätssicherung & Abschluss

| # | Punkt | Status | Was fehlt |
|---|---|---|---|
| 5.1 | Staging-/Test-DB | 🟡 | Isolations-Guard fertig; ⛔ Staging-DB bereitstellen |
| 5.2 | Kleinkram (D-08/D-05/D-06/T-03/D-04) | ✅ | erledigt; ⛔ optional Object-Storage/CDN (D-04), M-02-Entscheidung (BL-5) |
| 5.3 | Redaktionelles Content-Sign-off | ⛔ Damien | Freigabe der 9 Programme als Live-Content |

## Zusätzlich autonom umgesetzt (über die Roadmap hinaus)
- **DSGVO-Selbstauskunft** (Art. 15/20): `GET /users/me/export` + „Daten herunterladen"-Button.
- **A11y:** Skip-to-Content-Link (+ Fokus ins `<main>`), Heading-Hierarchie-Guard über die Seiten.
- **UI-Resilienz:** ErrorBoundary. **Payment:** Refund-/Cancel-Fulfillment.
- **Betrieb:** deploy.sh-Härtung, systemd-Unit-Guard, CMS-Proxy-Caddy-Artefakt (versioniert), Rate-Limit `/api/auth/*`.

---

## Was muss Damien noch tun für den Launch?

**Rechtlich (P1, Pflicht vor öffentlichem Verkauf):**
1. **BL-1** — Betreiberdaten liefern (Name, Anschrift, USt-IdNr., Widerrufsadresse) und Impressum/AGB/Datenschutz/Widerruf **anwaltlich prüfen** lassen; im Strapi-Admin eintragen.
2. **Content-Sign-off** (P5.3) der 9 Programme; ggf. AVV mit Hoster + Stripe-DPA.

**Verkauf (P3, Pflicht für Zahlungen):**
3. **BL-3 Stripe:** Konto → Testmodus → Test-API-Keys → Webhook-Endpoint `…/healrise/app/api/stripe/webhook` registrieren → Secret; Werte in `strapi/.env`. Danach `validateStripeConfig` grün + Testkauf. Erst dann Live-Keys (3.6).
4. **BL-4 Postal/Mail:** Absenderdomain (z. B. `no-reply@healrise.de`) in Postal, **SPF/DKIM/Return-Path** setzen, `SMTP_*`/`DEFAULT_FROM`/`FRONTEND_URL` in `strapi/.env`; kontrollierter Reset-/Kaufmail-Test.

**Deploy/Betrieb (Caddyfile + Unit-Reloads):**
5. **Security-Header** (4.1) + **Access-Log** (2.4) aus `deploy/caddy/*.caddy` in den geteilten Caddyfile einfügen → `caddy validate` → `reload`; `HEALTH_ALERT_CMD` (Webhook/ntfy) in der systemd-Unit setzen.
6. **Admin-Rolle** (4.6): Damien als Admin **einladen** + Rolle „HEALRISE Betrieb" zuweisen (GUI); Menü-Reduktion verifizieren.

**Infrastruktur (empfohlen, früh):**
7. **BL-2 Git-Remote** (privates GitHub) anlegen + Push + CI aktivieren (die einzige Code-Kopie liegt auf server-eins).
8. **Prod-Secrets** rotieren (`JWT_SECRET`, `APP_KEYS`, `ADMIN_JWT_SECRET`, …); Staging-DB (5.1) bereitstellen; Testdaten-Cleanup (2.1) mit Backup ausführen.

**Fazit:** Der **code-/betriebsseitige** Teil der Produktionsreife ist erledigt und live
(P0 vollständig, Backups laufen). Für den **öffentlichen Verkaufsstart** fehlen nur noch
die externen Betreiber-Aktionen oben — im Kern **Recht (BL-1)**, **Stripe (BL-3)** und
**Postal/Mail (BL-4)**.
