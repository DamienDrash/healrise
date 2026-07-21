# E1 — Fundament & Repo-Hygiene (Sprint 1)

Ziel: Versionierbares, geheimnissicheres, lintbares Projekt mit Test-Infrastruktur als Basis für alle weiteren Epics.

## Story 1.1 — Als Betreiber will ich das Projekt unter Versionskontrolle haben, ohne Secrets zu leaken (I4, I14)
- [x] T1.1.1 Root-`.gitignore` anlegen (node_modules, dist, .env, .strapi, .tmp, .claude/settings.local.json, .agents)
- [x] T1.1.2 `git init` + initialer Commit des Ist-Zustands (ohne Secrets/Artefakte)
- [x] T1.1.3 `strapi/.env.example` vervollständigen (alle Keys inkl. JWT_SECRET, PUBLIC_URL, DATABASE_*)
- [x] T1.1.4 Hartcodierten JWT_SECRET-Fallback aus `config/plugins.ts` entfernen (Pflicht-Env, Fail-fast)
- [x] T1.1.5 Hinweis-Dokument `docs/launch-checklist.md` beginnen: Secrets rotieren, DB-Passwort stärken (kann nur der Betreiber auf dem Server)

## Story 1.2 — Als Entwickler will ich eine grüne Lint-Basis und einheitliche Env-Konfiguration (F22, I10, I3)
- [x] T1.2.1 Alle 14 ESLint-Fehler beheben (unused vars, set-state-in-effect, no-empty, exhaustive-deps) — inhaltliche Fixes teils in E4, hier: Aufräumen toter Variablen
- [x] T1.2.2 Dev-Proxy-Rewrite in `vite.config.js` fixen (`/healrise/app` → `''`, `/api` bleibt) (I3)
- [x] T1.2.3 Pfad-Präfix zentralisieren: `import.meta.env.BASE_URL` statt 10× Hardcode; `.env.example` fürs Frontend (I10)
- [x] T1.2.4 Tote Dateien entfernen: App.css, react.svg, vite.svg, hero.png; README ersetzen (F25)
- [x] T1.2.5 `vite-plugin-pwa`/`workbox-window` nach devDependencies bzw. entfernen (I12)

## Story 1.3 — Als Entwickler will ich Tests ausführen können (F36, I13, Goldstandard Testing)
- [x] T1.3.1 Vitest + React Testing Library + jsdom im Frontend einrichten (`npm test` läuft)
- [x] T1.3.2 Erste Unit-Tests: `utils/plans.js` (canAccess-Matrix), `utils/progress.js`
- [x] T1.3.3 Backend-Testharness: Skript für API-Tests gegen laufendes Strapi (supertest/fetch, eigene Test-DB)
- [x] T1.3.4 `docs/testing.md`: wie man alles startet und testet (App, Strapi, Testsuite)

## Story 1.4 — Als Betreiber will ich Strapi produktionstauglich hinter dem Proxy betreiben (I5)
- [x] T1.4.1 `server.ts`: `url: env('PUBLIC_URL')` + `proxy: true`
- [x] T1.4.2 Reverse-Proxy-Soll-Konfiguration in `docs/deployment.md` dokumentieren
- [x] T1.4.3 `better-sqlite3` + `@strapi/plugin-cloud` entfernen; NPS/EE-Flags aus (I12)
