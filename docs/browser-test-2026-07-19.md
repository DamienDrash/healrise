# Browser-Vollcheck — Landing & App (Desktop + Mobile)

**Datum:** 2026-07-19 · **Durchführung:** automatisiert (Playwright/Chromium) gegen frische Prod-Builds
(`app/dist` + `dist/`), serviert über kombinierten Static+Proxy-Server (spiegelt die Caddy-Prod-Route),
API-Proxy → laufendes Strapi (9130). Viewports: **Desktop 1280×800** und **Mobile iPhone 13 (390×844)**.

## Ergebnis: 66/66 funktionale Checks bestanden

Keine funktionalen Defekte. Zwei „Fails" im Log sind **erwartete Pre-Launch-Zustände** (Operator-Blocker),
beide sauber mit Fallback abgefangen — kein Absturz, keine kaputte UI.

### Abgedeckte Flows (Desktop + Mobile, je identisch grün)
- **Landing:** Titel/H1/Meta, 6 App-CTAs, alle Sektionen (#programme, #so-funktionierts, #faq, #ueber-uns),
  Preistabelle (Freebie/7/14/Premium), FAQ-Akkordeon, Newsletter, Footer — Darstellung sauber & responsiv.
- **Registrierung:** Art.-9-Consent **nicht** vorangekreuzt → ankreuzen → Dashboard mit Begrüßung + Username.
- **Backend↔Frontend:** JWT in localStorage, Programme werden aus Strapi geladen, `/users/me` korrekt.
- **Content-Gating:** freier Inhalt offen, Premium-Inhalt für Freebie gesperrt, Upgrade-Pfad `?plan=premium`.
- **Bestellstrecke (§312j BGB):** „Deine Bestellung", Preis inkl. MwSt., Button **erst nach Widerrufs-Consent**
  aktiv, „Sichere Zahlung über Stripe", AGB-/Widerruf-Links.
- **Plan-Wechsel (echter Fulfillment-Pfad):** signierter `checkout.session.completed`-Webhook →
  Strapi → DB-Plan `freebie`→`premium` → Dashboard/Konto zeigen **HEALRISE Premium**, zuvor gesperrter
  Inhalt jetzt frei. Voller Stack verifiziert, ohne Live-Stripe.
- **Fortschritt:** Erledigt-Toggle persistiert.
- **Rechtsseiten:** /impressum, /datenschutz, /agb, /widerruf öffentlich erreichbar.
- **Logout:** → /login, lokale Fortschrittsdaten gelöscht.

## Sicherheits-Check
| Prüfung | Ergebnis |
|---|---|
| API-Auth-Gating (programs/users/users-me/progress ohne Token) | ✅ 403 |
| IDOR (`/api/users/1` ohne Token) | ✅ 403 |
| purchases-Collection öffentlich? | ✅ 404 (nicht exponiert) |
| Secret-Scan im App-Bundle (sk_/whsec_/JWT_SECRET/APP_KEYS/DB) | ✅ keine |
| XSS: CMS-HTML via `dangerouslySetInnerHTML` | ✅ immer durch `sanitizeHtml` (DOMPurify-Whitelist); Test 7/7 |
| Security-Header (X-Frame/X-Content-Type/Referrer/Permissions/HSTS) | ✅ gesetzt (Caddy) |
| CORS | ✅ auf `services.frigew.ski` + localhost:5173 beschränkt (kein Wildcard) |
| Brute-Force-Schutz auf /api/auth/* | ✅ `global::auth-rate-limit` aktiv |

### Härtung umgesetzt
- **`strapi::poweredBy` entfernt** (`strapi/config/middlewares.ts`) → kein `X-Powered-By: Strapi`-Info-Leak.
  ⚠️ Greift erst beim **nächsten Strapi-Neustart** (der laufende Prozess ist `strapi start`, kein Watcher).
  Fällt mit dem ohnehin anstehenden Launch-Restart (Damien-Keys) zusammen.

### Empfehlungen (kein Blocker, Operator-Entscheidung)
- **CSP:** aktuell nur `Content-Security-Policy-Report-Only` aktiv; die enforcing-Variante ist auskommentiert.
  Vor/kurz nach Launch scharfschalten (nach Report-Auswertung).

## Erwartete Pre-Launch-Zustände (keine Bugs)
- `GET /api/legal` → **404**: Single-Type noch nicht redaktionell gepflegt (Blocker **BL-1**). App fällt sauber
  auf gebündelte statische Rechtstexte zurück (alle 4 Seiten rendern korrekt). Verschwindet, sobald Damien
  die Texte im Admin pflegt.
- `POST /api/checkout/session` → **503**: kein Stripe-Key (Blocker **BL-3**). UI zeigt sauberen Hinweis statt
  Absturz. Verschwindet mit den Live-Keys.

## Offener Aufräumpunkt (Rückfrage nötig)
Während des Tests entstanden **5 Test-User** in der Prod-DB (Registrierungs-/Plan-Wechsel-Flow ließ sich nur
durch echte Anlage prüfen). Automatisches Löschen wurde vom Sicherheits-Guard blockiert (Schutz geteilter
DB-Daten). Fertiges Cleanup (nach Freigabe):
```sql
-- ids: 18 (btest_*), 19–22 (bt_desktop_*/bt_mobile_*), alle @test.healrise.de
DELETE FROM purchases WHERE id IN (SELECT purchase_id FROM purchases_user_lnk WHERE user_id IN (18,19,20,21,22));
DELETE FROM progress_entries WHERE id IN (SELECT progress_entry_id FROM progress_entries_user_lnk WHERE user_id IN (18,19,20,21,22));
DELETE FROM up_users WHERE id IN (18,19,20,21,22);
```

## Artefakte
- 32 Flow-Screenshots + 2 akkurate Full-Landing-Shots: `/tmp/htest/shots/`
- Roh-Ergebnisse: `/tmp/htest/results.json`
- Test-Skripte (reusable): `scripts/test-serve.mjs`, `scripts/browser-test.mjs`, `scripts/webhook-upgrade.mjs`
