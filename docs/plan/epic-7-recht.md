# E7 — Recht & Compliance (Sprint 4)

Ziel: Alle MUSS-vor-Launch-Punkte aus Goldstandard §3 (R1–R22) als Code/Inhalt; Firmendaten als `[PLATZHALTER]`.

## Story 7.1 — Als Betreiber brauche ich die Pflichtseiten (R6, R7, R10)
- [x] T7.1.1 Seiten: /impressum (§ 5 DDG!), /datenschutz, /agb, /widerruf — in der App (Footer/Konto) UND Landing verlinkt, ohne Login erreichbar
- [x] T7.1.2 Datenschutzerklärung-Vorlage: Hosting, Stripe (DPF+SCCs, R15), Art.-9-Verarbeitung, localStorage-Hinweis (R12), Betroffenenrechte
- [x] T7.1.3 Alle Vorlagen mit klar markierten `[PLATZHALTER: …]`-Stellen + Abschnitt in launch-checklist.md („anwaltlich prüfen lassen")

## Story 7.2 — Als Betreiberin brauche ich die Art.-9-Einwilligung (R1–R3)
- [x] T7.2.1 Consent-Schritt bei Registrierung: separate, nicht vorangekreuzte Checkbox für Fortschritts-/Gesundheitsdaten
- [x] T7.2.2 Serverseitige Protokollierung (Feld `health_consent_at` am User; ohne Consent kein Progress-Tracking)
- [x] T7.2.3 Widerruf im Konto (Consent entziehen → Progress-Daten serverseitig löschen)

## Story 7.3 — Als Betreiber brauche ich einen rechtskonformen Checkout (R8, R9, R10)
- [x] T7.3.1 Bestellübersicht vor Checkout: Gesamtpreis inkl. MwSt. + wesentliche Merkmale direkt über dem Button
- [x] T7.3.2 Button-Text „zahlungspflichtig bestellen"
- [x] T7.3.3 Widerrufs-Erlöschens-Checkbox (§ 356 Abs. 5 BGB) — ohne Häkchen kein Checkout
- [x] T7.3.4 Bestätigungs-E-Mail nach Kauf (§ 312f BGB) mit Vertragsinhalt + Widerrufsbelehrung + dokumentierter Zustimmung (solange kein SMTP: Persistenz + TODO in launch-checklist)

## Story 7.4 — Als Betreiber will ich kein Medizinprodukt sein (R19, R20)
- [x] T7.4.1 Claims-Review aller Inhalte (Seed-Content, UI-Texte, Landing): „Heilung/OP/lindert"-Formulierungen identifizieren
- [x] T7.4.2 Verbotene-Wörter-Liste in docs/claims-richtlinie.md; kritische UI-Texte entschärfen
- [x] T7.4.3 Seed-/Demo-Inhalte auf Wellness-Formulierungen umstellen; Disclaimer („ersetzt keine ärztliche Beratung") in App-Footer/Detailseiten
