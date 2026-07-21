# HEALRISE — Umsetzungsplan (erstellt 03.07.2026)

Basis: `docs/review-2026-07.md` (Findings F/B/I) + `docs/goldstandard.md` (Erkenntnisse U/T/R).

## Struktur

- **Epics** (`epic-*.md`): fachliche Großthemen mit Stories und Tasks. Jeder Task referenziert Findings/Goldstandard-IDs.
- **Sprints** (`sprints.md`): Reihenfolge der Umsetzung mit Meilensteinen und Abnahmekriterien.
- Status wird direkt in den Checkboxen der Epic-Dateien gepflegt: `[ ]` offen, `[x]` erledigt.

## Epics-Übersicht

| Epic | Titel | Ziel | Sprint |
|------|-------|------|--------|
| E1 | Fundament & Repo-Hygiene | Git, Secrets, Env-Handling, Lint grün, Test-Infrastruktur | 1 |
| E2 | Sicherheit & serverseitiges Gating | Paywall serverseitig korrekt, XSS dicht, Auth-Härtung | 1 |
| E3 | PWA & Offline | Fonts self-hosted, Runtime-Caching, Update-Flow, Manifest | 2 |
| E4 | Frontend-Qualität | Bugfixes, Datenlayer-Normalisierung, Error-States, A11y | 2 |
| E5 | Fortschritt serverseitig | Progress-API je User, Sync, Logout-Löschung (Art.-9-Daten) | 3 |
| E6 | Payments & Upgrade-Flow | Stripe-Checkout (Testmodus), Purchase-Modell, Webhook | 3 |
| E7 | Recht & Compliance | Pflichtseiten, Art.-9-Einwilligung, Claims-Review | 4 |
| E8 | Testing & CI | Unit-, API- und E2E-Tests, Permissions-Matrix, CI-Skripte | 1–4 (laufend) |

## Meilensteine

| MS | Titel | Kriterium | nach Sprint |
|----|-------|-----------|-------------|
| M1 | **Sicheres Fundament** | Git-Repo mit sauberem Verlauf; keine Secrets im Code; Gating serverseitig verifiziert (Body gesperrter Inhalte wird nie ausgeliefert, Metadaten schon); XSS-Sanitizing aktiv; Lint grün; erste Unit-/API-Tests laufen | 1 |
| M2 | **Robuste App** | App offline nutzbar (Shell + gecachte Inhalte + kein Zwangs-Logout); keine externen Font-Requests; alle Hoch-Prio-Frontend-Bugs behoben; Unit-Test-Suite grün | 2 |
| M3 | **Monetarisierung bereit** | Stripe-Checkout im Testmodus durchspielbar (Kauf → Webhook → Plan-Freischaltung); Fortschritt serverseitig, geräteübergreifend; E2E-Kernpfade grün | 3 |
| M4 | **Launch-ready** | Pflichtseiten erreichbar (Platzhalter für Firmendaten markiert); Art.-9-Consent im Onboarding; Checkout rechtskonform (Button, Widerrufs-Checkbox); komplette Testsuite grün; Restpunkte-Liste für Anwalt/Betreiber dokumentiert | 4 |

## Nicht im Scope (bewusst)

- Echte Stripe-Live-Keys, echte Firmendaten in Rechtstexten (→ `[PLATZHALTER]`, siehe `launch-checklist.md` nach Sprint 4)
- Push-Notifications (Fake-Toggle wird entfernt, echtes Feature später)
- TypeScript-Migration des Frontends (zu großer Umbau; Datenlayer wird aber testbar gekapselt)
- Redesign der Landing-Page (nur: tote Assets raus, Fonts self-hosted, Rechtsseiten-Links)
