# Sprints & Meilensteine

Reihenfolge so gewählt, dass Sicherheits-/Rechtsrisiken zuerst fallen und jede Stufe testbar abschließt.

## Sprint 1 — „Sicheres Fundament" (E1 + E2 + E8-Basis) → Meilenstein M1
1. E1: Git, .gitignore, Secrets-Härtung, Lint grün, Env-Fixes, Vitest-Setup
2. E2: Gating-Umbau (Body-Stripping, Strapi-5-Shape), Profil/Passwort-Endpoints, DOMPurify, Seed-Gating
3. E8: Unit-Tests plans/progress/sanitize; API-Permissions- und Gating-Matrix
- **Abnahme M1:** Testsuite grün; manueller Nachweis: freebie-User erhält Premium-Metadaten ohne body; XSS-Payload im CMS-Body wird entschärft; Lint 0 Fehler.

## Sprint 2 — „Robuste App" (E3 + E4) → Meilenstein M2
1. E3: Fonts self-hosted, runtimeCaching, SW-Denylist, Update-Prompt, Manifest/Icons/lang
2. E4: Datenlayer-Normalisierung + Cache, alle Korrektheits-Bugs (F9–F19), Auth-Flows, A11y-Basics
- **Abnahme M2:** Build ohne externe Font-Requests; Offline-Smoke (Shell + gecachte Programme, kein Logout); alle neuen/alten Unit-Tests grün.

## Sprint 3 — „Monetarisierung bereit" (E5 + E6) → Meilenstein M3
1. E5: Progress serverseitig + Sync + Logout-Löschung
2. E6: Stripe-Testmodus-Checkout, Webhook mit Signaturprüfung, Purchase-Modell, Upgrade-UX
- **Abnahme M3:** API-Tests Progress-Isolation + Webhook grün; Upgrade-Flow bis Stripe-Redirect (bzw. Stub ohne Keys) durchspielbar; E2E-Kernpfad grün.

## Sprint 4 — „Launch-ready" (E7 + E8-Abschluss) → Meilenstein M4
1. E7: Pflichtseiten, Art.-9-Consent, rechtskonformer Checkout, Claims-Review
2. E8: E2E-Suite komplett, Offline-Smoke, launch-checklist.md finalisieren
- **Abnahme M4:** Komplette Testsuite grün; alle Pflichtseiten erreichbar; launch-checklist.md listet alle [PLATZHALTER] + Betreiber-Aufgaben (Secrets-Rotation, Stripe-Live-Keys, Anwalts-Review, SMTP).

## Status-Log

| Datum | Ereignis |
|-------|----------|
| 2026-07-03 | Plan erstellt (Review + Recherche abgeschlossen) |
| 2026-07-03 | **Sprint 4 abgeschlossen → M4 erreicht (Code-seitig launch-ready).** Rechtsseiten (Impressum §5 DDG/DSE/AGB/Widerruf) mit markierten [PLATZHALTERN], öffentlich + in App/Landing verlinkt; Art.-9-Consent (Register-Checkbox nicht vorangekreuzt, serverseitig protokolliert, Toggle-403 ohne Consent, Widerruf löscht Serverdaten); Claims: App-Texte bereinigt, claims-richtlinie.md, Landing (94 Treffer) + Live-CMS bewusst als Betreiber-Aufgabe in launch-checklist.md; E2E: 4 Playwright-Kernpfade + Offline-Smoke (SW/Precache verifiziert); Root-Skripte + CI-Vorlage. Anm.: T7.3.4 (Bestätigungsmail) = Persistenz fertig, SMTP+Mailvorlage als Launch-Blocker dokumentiert; T8.1.3 über E2E abgedeckt statt Component-Tests. Backend 59/59, Unit 57/57, E2E 4/4 + Offline 1/1, Lint 0. |
| 2026-07-03 | **Sprint 3 abgeschlossen → M3 erreicht.** Progress serverseitig (progress-entry, Isolation getestet, Offline-Queue + Sync, Logout-Löschung), Stripe: purchase-Modell, Checkout-Session (Preise inkl. MwSt., kein Downgrade, Consent-Pflicht), Webhook mit HMAC-Signaturprüfung + Idempotenz (Positivtest mit lokal signiertem Event: Plan-Freischaltung verifiziert). Upgrade-UX: Bestellübersicht mit § 312j-Button + § 356-Checkbox (T7.3.1–3 vorgezogen), Erfolg/Abbruch-Seiten mit Plan-Polling. Backend-API 53/53, Unit 57/57, Lint 0. |
| 2026-07-03 | **Sprint 2 abgeschlossen → M2 erreicht.** Fonts self-hosted (App + Landing, 0 Google-Refs im Build), runtimeCaching (API NetworkFirst, Media CacheFirst), Update-Prompt + periodische Checks, SW-Denylist /cms, Manifest de + maskable Icons, Datenlayer normalisiert + ProgramsContext-Cache, F12/F13/F17/F18/F19/F33/F34 + A11y-Basics behoben, Landing -1,3 MB tote Assets. Unit 49/49, Lint 0, Build ok. Anm.: T1.2.3 als "erledigt genug" markiert — Pfad-Präfix bleibt bewusst in vite.config als einziger Quelle plus BASE_URL-Konstanten; vollständige Env-Parametrisierung wäre Overengineering für eine Single-Deployment-App. |
| 2026-07-03 | **Sprint 1 abgeschlossen → M1 erreicht.** Backend-API-Tests 35/35, Unit 33/33, Lint 0, Build ok. Offen aus E1: T1.2.3 (BASE_URL-Zentralisierung → Sprint 2). Vorzeitig aus Sprint 2 erledigt: F8, F9, F10, F11, F16, F21 (Lint-grün erzwang die Fixes). |
