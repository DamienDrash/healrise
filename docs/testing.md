# HEALRISE — Testen & lokale Entwicklung

## Services starten

```bash
# Backend (Strapi, Port 9130) — SEED_DEMO legt Testuser + Demo-Inhalte an
cd strapi && SEED_DEMO=true npm run develop

# Frontend (Vite-Dev-Server, proxied /healrise/app/api → Strapi)
cd app && npm run dev
```

Testuser (nur mit `SEED_DEMO=true`): `Testuser` / `Test2026!` (Plan: healrise14).
Achtung: Port 5173 wird vom Strapi-Admin-Vite belegt — der App-Dev-Server nimmt automatisch 5174.

## Testsuiten

| Suite | Befehl | Voraussetzung |
|-------|--------|---------------|
| Frontend-Unit (Vitest + RTL) | `cd app && npm test` | — |
| Frontend-Lint | `cd app && npm run lint` | — |
| Backend-API (Permissions/Gating-Matrix) | `cd strapi && node tests/api-tests.mjs` | laufendes Strapi + Seed-Testuser |
| Build-Smoke | `cd app && npm run build` | — |
| E2E-Kernpfade (Playwright) | `cd app && npm run test:e2e` | laufendes Strapi + Seeds |
| Offline-Smoke (SW/Precache) | `cd app && npm run build && npm run test:e2e:offline` | — |

Root-Abkürzungen: `npm run check` (Lint+Unit+Build), `npm run check:all` (alles).

## Was die Backend-API-Tests abdecken (tests/api-tests.mjs)

- **Public-Rolle:** programs/users/me ohne Token → 401/403
- **Gating-Matrix:** alle Programme sichtbar (Metadaten), `body`/`video_url` nur mit ausreichendem Plan;
  `locked`-Flag korrekt je Plan-Stufe; `findOne` per documentId ebenso; `fields`-Selektion kann das
  Gating nicht umgehen (fail-closed)
- **Selbst-Upgrade-Schutz:** `PUT /api/users/:id` bleibt gesperrt; `PUT /api/users/me` ignoriert `plan`
- **changePassword:** validiert das aktuelle Passwort serverseitig

## E2E-Abdeckung (app/e2e/)

- Registrierung mit Art.-9-Consent-Checkbox (nicht vorangekreuzt) → Dashboard
- Gating-UX: freier Inhalt lesbar, Premium gesperrt (Body fehlt), Upgrade-Pfad mit Plan-Vorauswahl
- Bestellstrecke: Pflichtinfos + „Zahlungspflichtig bestellen" erst nach Widerrufs-Checkbox
- Fortschritts-Toggle, öffentliche Rechtsseiten, Logout löscht lokale Gesundheitsdaten

## Faustregeln

- Nach jedem Epic: Lint + Unit + API-Tests + Build müssen grün sein (Meilenstein-Kriterium, docs/plan/sprints.md)
- Neue Backend-Endpoints ⇒ Fall in `tests/api-tests.mjs` ergänzen (insb. Negativ-Fälle: falsche Rolle, fremder User)
- Neue Frontend-Logik in `utils/` ⇒ Unit-Test daneben (`*.test.js`)
