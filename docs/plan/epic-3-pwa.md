# E3 — PWA & Offline-Goldstandard (Sprint 2)

Ziel: Das „offline verfügbar"-Versprechen wird wahr (T1–T4), keine externen Font-Requests (I1), Update-Flow nach Goldstandard.

## Story 3.1 — Als Betreiber will ich keine Google-Server-Requests (I1, R-Review)
- [x] T3.1.1 Fonts (Playfair Display, Lora, Poppins) self-hosten via @fontsource; `@import` entfernen
- [x] T3.1.2 Landing-Page `dist/index.html`: Google-Fonts-Links durch self-hosted ersetzen
- [x] T3.1.3 Verifikation: Build enthält keine Referenz auf fonts.googleapis.com/gstatic.com

## Story 3.2 — Als Nutzerin will ich die App offline nutzen können (F8, F27/I6, T3, T4)
- [x] T3.2.1 `runtimeCaching`: NetworkFirst für `/api/programs*`, CacheFirst mit Expiration für Uploads/Bilder
- [x] T3.2.2 AuthContext: Token nur bei 401 löschen; bei Netzwerkfehler letzten bekannten User aus Cache verwenden (F8)
- [x] T3.2.3 Error-State statt Empty-State bei API-Fehlern, Offline-Hinweis (F13)
- [x] T3.2.4 globPatterns um woff2 wirksam machen (self-hosted Fonts precachen)

## Story 3.3 — Als Nutzerin will ich saubere Updates und korrektes App-Verhalten (I2, I11/F28, T1, T2)
- [x] T3.3.1 SW-`navigateFallbackDenylist` um `/healrise/app/cms` erweitern (I2)
- [x] T3.3.2 Update-Flow: `registerType: 'prompt'` + `useRegisterSW` mit „Neue Version — Aktualisieren"-Banner (T1)
- [x] T3.3.3 Periodischer Update-Check (setInterval + registration.update(), online-Check) (T2)

## Story 3.4 — Als Nutzerin will ich eine korrekte Installation/Metadaten (I8, I9, F29)
- [x] T3.4.1 `lang="de"` in index.html + Manifest; description/OG-Meta-Tags
- [x] T3.4.2 Icon-Set: getrennte any/maskable-Icons (192+512, aus vorhandenem Icon generiert), apple-touch-icon 180×180
- [x] T3.4.3 favicon.svg einbinden oder entfernen; deprecated Meta-Tag ersetzen
- [x] T3.4.4 InstallPrompt: Timer-Cleanup, SVG-Prop-Fix, Dismiss mit Ablauf (F21)
