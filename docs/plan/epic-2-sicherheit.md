# E2 — Sicherheit & serverseitiges Gating (Sprint 1)

Ziel: Die Paywall hält serverseitig (Goldstandard T8), XSS-Kette ist unterbrochen, Auth-Endpunkte sind korrekt und minimal.

## Story 2.1 — Als Betreiber will ich, dass bezahlte Inhalte serverseitig geschützt sind, die UX gesperrter Inhalte aber funktioniert (B1, B2, T8, U-Ableitung)
- [x] T2.1.1 `find`-Controller umbauen: ALLE veröffentlichten Programme ausliefern, aber `body` + `video_url` strippen, wenn `plan_required` > User-Plan (statt Wegfiltern)
- [x] T2.1.2 `findOne`-Controller auf Strapi-5-Shape fixen (flaches `data`), gleiche Stripping-Logik statt 403 (Meta sichtbar, Inhalt zu)
- [x] T2.1.3 Gemeinsame `canAccess`/Plan-Order-Logik in Service auslagern (eine Quelle der Wahrheit im Backend)
- [x] T2.1.4 API-Tests: Permissions-Matrix Plan × Programm (freebie/7/14/premium × je ein Programm) — Body nur bei Berechtigung, Meta immer
- [x] T2.1.5 Frontend: gesperrte Inhalte anhand `body == null` + `locked`-Flag rendern (Upgrade-Pfad aus gesperrtem Inhalt heraus, U-Ableitung)

## Story 2.2 — Als Nutzerin will ich mein Profil sicher verwalten (B3, F3, F5)
- [x] T2.2.1 Custom Route `PUT /api/users-permissions/me` (o.ä.) mit striktem Whitelisting (nur `username`) — kein generisches `user.update` freischalten
- [x] T2.2.2 Passwortänderung auf `POST /api/auth/change-password` umstellen (validiert currentPassword serverseitig) + Permission aktivieren
- [x] T2.2.3 Frontend `updateMe`/Passwort-Flow auf neue Endpoints umstellen; einheitliche Mindestlänge 8 (F35)
- [x] T2.2.4 API-Test: `plan`-Feld ist per User-Request unveränderbar (Selbst-Upgrade unmöglich)

## Story 2.3 — Als Betreiber will ich kein XSS-Risiko durch CMS-Inhalte (F1, F4)
- [x] T2.3.1 DOMPurify einführen; alle `dangerouslySetInnerHTML`-Stellen sanitizen
- [x] T2.3.2 Unit-Test: Script/Event-Handler-Injection wird entfernt
- [x] T2.3.3 `healrise_user`-Toter-Key-Cleanup im Interceptor (F7)
- [x] T2.3.4 (Dokumentiert für später) httpOnly-Cookie-Session als mittelfristiges Ziel in launch-checklist.md (T7)

## Story 2.4 — Als Betreiber will ich keine Hintertüren im Seed/Bootstrap (B5, B11)
- [x] T2.4.1 Testuser-Seed nur bei `NODE_ENV !== 'production'` bzw. `SEED_DEMO=true`; Passwort aus Env
- [x] T2.4.2 Demo-Content-Seed ebenso gaten
- [x] T2.4.3 Permission-Bootstrap-Format zur Laufzeit verifizieren (stimmen die Action-Strings in Strapi 5?) und ggf. fixen; `updateMe`-Eintrag entfernen/ersetzen
- [x] T2.4.4 API-Test: Public-Rolle kann NUR register/callback; unauthentifizierter `GET /api/programs` → 401/403
