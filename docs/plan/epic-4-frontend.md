# E4 — Frontend-Qualität & Bugfixes (Sprint 2)

Ziel: Alle bekannten Korrektheits-Bugs behoben, ein normalisierter Datenlayer, grundlegende A11y, deutsche Fehlermeldungen.

## Story 4.1 — Als Entwickler will ich einen einheitlichen, getesteten Datenlayer (F23, F24, F15, F20)
- [x] T4.1.1 `normalizeProgram()` im API-Layer; alle Seiten auf normalisierte Objekte umstellen
- [x] T4.1.2 ProgramsContext (einmaliges Laden + Cache, Invalidierung bei Fokus/Reload); Detail nutzt Cache für „Weiter"-Logik
- [x] T4.1.3 Wirkungslosen publishedAt-Filter entfernen (F15); Pagination auswerten mit Nachladen ab 100 (F20)
- [x] T4.1.4 Unit-Tests für Normalisierung + nextProgram-Logik

## Story 4.2 — Als Nutzerin will ich korrekte Navigation und Anzeigen (F9, F11, F12, F16, F17, F18, F19)
- [x] T4.2.1 Plans: activeWeek als derived state aus gefilterter Liste (F9)
- [x] T4.2.2 ProgramDetail: AbortController/ignore-Flag gegen Race (F11)
- [x] T4.2.3 Dashboard „Woche X" aus Fortschritt korrekt ableiten (F12)
- [x] T4.2.4 Erfolgsmeldungen sichtbar machen (Toast/außerhalb Formular) (F16)
- [x] T4.2.5 401-Handling über AuthContext + SPA-Navigation zu /login (F17)
- [x] T4.2.6 Sticky Week-Selector `top: 56px` bzw. Layout-Fix (F18)
- [x] T4.2.7 Zurück-Button-Fallback auf /plaene bei Deep-Link (F19)

## Story 4.3 — Als Nutzerin will ich verständliche Auth-Flows (F10, F33, F34)
- [x] T4.3.1 Registrierung: jwt-Check, E-Mail-Bestätigungs-Hinweis, redundanten Doppel-Login entfernen (F10)
- [x] T4.3.2 Passwort-vergessen-Flow (forgot/reset-password-Seiten + Strapi-Endpoints) (F33)
- [x] T4.3.3 Fehlercode→deutscher-Text-Mapping, generischer Fallback (F34)

## Story 4.4 — Als Nutzerin mit Einschränkungen will ich die App bedienen können (F31, R18)
- [x] T4.4.1 Klickbare Karten als button/Link-Semantik mit Tastatur-Support + aria-Labels (locked-Status!)
- [x] T4.4.2 ProgressRing role="img" + Label; Emojis aria-hidden
- [x] T4.4.3 Fake-Notification-Toggle entfernen (F32); „Nächste Abrechnung"-Zeile entfernen (Teil F30)
