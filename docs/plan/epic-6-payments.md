# E6 — Payments & Upgrade-Flow (Sprint 3)

Ziel: Echter Checkout statt mailto (F30) — Stripe im Testmodus, serverseitige Freischaltung via Webhook (T9, T10, B9).

## Story 6.1 — Als Betreiber will ich Käufe abwickeln und Pläne automatisch freischalten
- [x] T6.1.1 Content-Type `purchase` (user, plan, stripe_session_id, amount, status, timestamps)
- [x] T6.1.2 Endpoint `POST /api/checkout/session`: erstellt Stripe-Checkout-Session (Testmodus, Preise aus Env/Config) für eingeloggte User
- [x] T6.1.3 Webhook `POST /api/stripe/webhook`: Signatur-Verifikation (T9), schnelles 2xx + asynchrone Verarbeitung (T10), setzt `user.plan` + legt `purchase` an, idempotent
- [x] T6.1.4 Kein Downgrade durch erneuten Kauf niedrigerer Stufe; Plan-Hierarchie respektieren
- [x] T6.1.5 API-Tests: Webhook ohne/mit falscher Signatur → 400; gültiges Event → Plan gesetzt; Replay idempotent

## Story 6.2 — Als Nutzerin will ich in der App upgraden können (F30, U2, U3, U-Ableitung)
- [x] T6.2.1 Upgrade-Seite: Checkout-Aufruf statt mailto; Erfolg/Abbruch-Rückkehrseiten (`/upgrade/erfolg`, `/upgrade/abbruch`)
- [x] T6.2.2 Nach Erfolg: User-Refresh → neuer Plan sofort sichtbar
- [x] T6.2.3 Upgrade-CTA direkt aus gesperrten Inhalten (Lock-Karte → /upgrade mit vorausgewählter Stufe)
- [x] T6.2.4 Stripe.js/Redirect nur im Checkout-Kontext laden (R15)

Hinweis: läuft mit Platzhalter-Test-Keys (`STRIPE_SECRET_KEY=sk_test_...`); ohne Keys wird der Checkout-Endpoint mit klarer Fehlermeldung deaktiviert. Rechtliche Checkout-Elemente (Button-Text, Widerrufs-Checkbox, Bestätigungsmail) → E7.
