# E5 — Fortschritt serverseitig (Sprint 3)

Ziel: Fortschrittsdaten (Art.-9-relevant!) liegen pro User serverseitig, lokal nur als Cache, Löschung bei Logout (F6, F14, R1–R4).

## Story 5.1 — Als Nutzerin will ich meinen Fortschritt geräteübergreifend behalten
- [x] T5.1.1 Content-Type `progress-entry` (user-Relation, program-Slug/Relation, completed_at) + Policies (nur eigene Einträge lesbar/schreibbar)
- [x] T5.1.2 Custom Routes: GET /api/progress (meine), PUT /api/progress/:slug (togglen)
- [x] T5.1.3 Frontend: progress.js auf Server-Sync umstellen (optimistic update, localStorage als Offline-Cache mit user-ID-Namespace)
- [x] T5.1.4 Logout: lokalen Progress-Cache löschen (F6)
- [x] T5.1.5 API-Tests: User A sieht/ändert nie Fortschritt von User B; unauthentifiziert → 401/403
- [x] T5.1.6 Unit-Tests Sync-Logik (offline-Queue: lokal markiert → bei Reconnect gesynct)
