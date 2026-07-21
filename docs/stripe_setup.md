# HEALRISE — Stripe-Testmodus einrichten (Betreiber-Anleitung)

Diese Anleitung beschreibt **genau, welche Werte du im Stripe-Dashboard kopierst**
und in `strapi/.env` einträgst, um HEALRISE-Zahlungen im **Testmodus** lauffähig zu
machen. Der Backend-Code (Checkout + Webhook) ist bereits fertig — es fehlen nur
deine Test-Keys.

> **Sicherheit:** Erst Testmodus (`sk_test_…`), niemals Live-Keys vor der finalen
> Freigabe (Roadmap 3.6). Secrets **nur** in `strapi/.env` (nie ins Repo, `chmod 600`).
> Diese Datei enthält keine echten Keys.

---

## 0. Voraussetzung

- Stripe-Konto vorhanden, oben rechts im Dashboard **„Testmodus"** aktiviert.

## 1. API-Keys kopieren

Dashboard → **Entwickler → API-Schlüssel** (Testmodus):

| Stripe-Feld | `.env`-Variable | Format |
|---|---|---|
| Geheimer Schlüssel | `STRIPE_SECRET_KEY` | `sk_test_…` |
| Veröffentlichbarer Schlüssel | `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |

> Der aktuelle Redirect-to-Checkout-Flow braucht den Publishable-Key **nicht**
> serverseitig (der Server erzeugt die Session, der Client redirectet auf
> `session.url`). Für spätere clientseitige Stripe.js gehört der Public Key ins
> **App-Frontend** — HEALRISE ist **Vite, nicht Next.js**, also `VITE_STRIPE_PUBLISHABLE_KEY`
> in `app/.env` (nicht `NEXT_PUBLIC_...`).

> **Test- vs. Live-Keys per Env:** Im Testmodus kannst du die Werte in die
> `_TEST_`-Varianten legen — `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_TEST_SECRET`
> und (optional) `STRIPE_TEST_PUBLISHABLE_KEY`. Die Suffix-Schreibweise
> `STRIPE_SECRET_KEY_TEST` / `STRIPE_WEBHOOK_SECRET_TEST` wird als **Alias**
> ebenfalls akzeptiert (kanonische Variante hat Vorrang).
> Außerhalb von `NODE_ENV=production` haben diese Vorrang (siehe
> `resolveStripeSecretKey`/`resolveStripeWebhookSecret`), in Production greifen
> `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (Live). So bleibt der Live-Key im
> Testbetrieb unangetastet — du kannst Test- und Live-Keys dauerhaft **parallel**
> pflegen und nur über `NODE_ENV` umschalten.

> **Readiness respektiert die Trennung:** `validateStripeConfig(env, { expectedMode: 'test' })`
> prüft im Testmodus genau die Keys, die zur Laufzeit gezogen würden (bevorzugt die
> `_TEST_`-Varianten, Fallback auf die Basiskeys). Ein Setup mit dedizierten
> Test-Keys **und** parallel gesetzten Live-Keys gilt daher korrekt als
> `ready` — kein falsch-negatives „STRIPE_SECRET_KEY fehlt". Meldungen enthalten
> nur Env-Namen, nie Key-Werte.

> **Test/Live-Safety-Check:** Beim Strapi-Start warnt der Bootstrap laut, wenn ein
> `sk_test_`/`pk_test_`-Key mit `NODE_ENV=production` läuft (echte Zahlungen finden
> nicht statt) oder — kritisch — ein `sk_live_`/`pk_live_`-Key außerhalb von
> Production (Gefahr echter Zahlungen). Siehe `strapi/src/stripe-config.ts`
> (`stripeKeyEnvironmentWarnings`, Log ohne Key-Werte).

## 2. Preise

HEALRISE nutzt **dynamische `price_data`** (Beträge in Cent aus Env, mit
Code-Fallback) — **keine** Stripe-Price-IDs nötig. Setze die Preise passend zur
Landing/App (69/169/399 € inkl. MwSt.):

```
STRIPE_PRICE_HEALRISE7=6900
STRIPE_PRICE_HEALRISE14=16900
STRIPE_PRICE_PREMIUM=39900
```

(Weglassen = Code-Fallback greift; die Parität Env ↔ Landing ↔ App ist per Test
`scripts/tests/price-display-parity.test.mjs` gesperrt.)

## 3. Webhook registrieren

Dashboard → **Entwickler → Webhooks → Endpunkt hinzufügen**:

- **Endpoint-URL:** `https://services.frigew.ski/healrise/app/api/stripe/webhook`
  (Strapi-Route: `POST /api/stripe/webhook`)
- **Event:** `checkout.session.completed`
- Nach dem Anlegen: **Signing secret** kopieren → `STRIPE_WEBHOOK_SECRET` (`whsec_…`)

Der Webhook prüft die Stripe-Signatur gegen den rohen Body (kein JWT) und schaltet
den Plan **erst nach erfolgreicher Verarbeitung** frei (idempotent über
`stripe_session_id`).

## 4. Werte in `strapi/.env` eintragen

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_HEALRISE7=6900
STRIPE_PRICE_HEALRISE14=16900
STRIPE_PRICE_PREMIUM=39900
# success/cancel-Redirects (Checkout) nutzen FRONTEND_URL, Fallback APP_PUBLIC_URL:
FRONTEND_URL=https://services.frigew.ski/healrise/app
APP_PUBLIC_URL=https://services.frigew.ski/healrise/app
```

Danach `chmod 600 strapi/.env` (bzw. `scripts/harden-env.sh`).

## 5. Lokal verifizieren (ohne echten Zahlungslauf)

- **Config-Readiness:** `validateStripeConfig` (`strapi/src/stripe-config.ts`) prüft
  Test-vs-Live-Guard, Webhook-Secret-Format, App-URL — z. B. via
  `node scripts/release-readiness.mjs`.
- **Webhook-Signatur (Mock, keine Stripe-Calls):**
  `node --test strapi/tests/stripe-webhook.test.mjs` — erzeugt die Signatur lokal
  per HMAC und prüft 400/503/200/5xx/Idempotenz.
- **Gesamter Skript-Test-Lauf:** `npm run test:scripts`.

## 6. Test-Kauf (Testmodus, nach Deploy/Restart — Betreiber)

Testkarte `4242 4242 4242 4242`, beliebiges künftiges Datum/CVC. Ablauf prüfen:
Kauf → `checkout.session.completed` → Webhook → Plan-Upgrade → Erfolgsseite →
Kaufbestätigungs-Mail (§ 312f).

---

## Betreiber-Blocker (Damien-Go, extern)

- Stripe-Konto/Test-Keys erzeugen, Webhook registrieren, Werte in `strapi/.env`.
- Deploy/Restart von Strapi (setzt Env aktiv) — **nicht** Teil dieses Repos-Slices.
- **Live-Keys + echter Live-Testkauf/Refund erst unter Roadmap 3.6 mit ausdrücklicher
  Freigabe.** Bis dahin ausschließlich Testmodus.
