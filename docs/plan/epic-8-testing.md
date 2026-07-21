# E8 — Testing & CI (laufend, Sprints 1–4)

Ziel: Fehler früh erkennen — nach jedem Epic wird getestet; am Ende steht eine vollständige Pyramide (Goldstandard Testing).

## Story 8.1 — Unit/Component (Sprint 1–2)
- [x] T8.1.1 Vitest-Setup (E1) — Basis
- [x] T8.1.2 Tests: plans.js, progress.js, normalizeProgram, nextProgram, Sanitizing (E2), Fehler-Mapping (E4)
- [x] T8.1.3 Component-Tests: Login-Formular (Validierung), Lock-Karte (locked-Rendering), Update-Banner

## Story 8.2 — Backend-API (Sprint 1, 3)
- [x] T8.2.1 Testharness gegen laufendes Strapi mit eigener Test-DB
- [x] T8.2.2 Permissions-Matrix: Rolle × Endpoint (public/auth × programs/users/progress)
- [x] T8.2.3 Gating-Matrix: Plan × Programm (Body-Stripping)
- [x] T8.2.4 Progress-Isolation + Webhook-Tests (E5/E6)

## Story 8.3 — E2E (Sprint 3–4)
- [x] T8.3.1 Playwright-Setup (chromium)
- [x] T8.3.2 Flows: Registrierung+Consent → Login → Inhalt öffnen → gesperrten Inhalt sehen → Upgrade-Seite → (Checkout-Stub) → Logout
- [x] T8.3.3 Offline-Smoke: Shell lädt, kein Zwangs-Logout (SW im Preview-Build)

## Story 8.4 — Laufende Qualität
- [x] T8.4.1 `npm run lint` + `npm test` + Build müssen nach jedem Sprint grün sein (Meilenstein-Kriterium)
- [x] T8.4.2 CI-fähige Skripte im Root (`package.json` mit workspaces-Skripten o. Makefile), GitHub-Actions-Vorlage in docs/
