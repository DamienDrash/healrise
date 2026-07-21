# HEALRISE — Claims-Richtlinie (Medizinprodukte-Abgrenzung)

Basis: Goldstandard R19/R20 (MDCG 2019-11, BfArM). Entscheidend für die MDR-Einstufung ist die
**Zweckbestimmung** — und die ergibt sich aus ALLEN Texten: App, Landing-Page, Ads, App-Store,
Social Media, Testimonials. Ein einziger Therapie-Claim kann die App zum Medizinprodukt machen.

## ❌ Verbotene Formulierungen (Auswahl)

| Kategorie | Beispiele |
|-----------|-----------|
| Heil-/Therapieversprechen | „heilt", „lindert", „behandelt", „therapiert", „medizinisch wirksam" |
| Krankheits-/Symptombezug | „bei Arthrose/Schmerzen/…", „reduziert Symptome", „gegen Verspannungen" |
| Medizinischer Kontext | „nach deiner OP", „Post-OP", „beschleunigt die Heilung/Genesung", „Recovery-Programm nach Operation" |
| Individualisierte Empfehlung nach Beschwerden | „Gib deine Symptome ein und erhalte deinen Plan" |

## ✅ Sichere Formulierungen (Safe Harbor)

- „fördert dein allgemeines Wohlbefinden"
- „unterstützt einen aktiven Lebensstil / deine tägliche Routine"
- „Motivation für gesunde Gewohnheiten"
- „sanfte Bewegung, Ernährungsideen, Selfcare und Mindset"
- reines Dokumentieren („markiere erledigte Inhalte") ohne Auswertung/Empfehlung

## Status (03.07.2026)

| Bereich | Status |
|---------|--------|
| App-UI-Texte | ✅ bereinigt (Upgrade-Features, Manifest, Meta-Beschreibungen) |
| Seed-/Demo-Inhalte (Code) | ✅ auf Wellness-Formulierungen umgestellt (strapi/src/index.ts) |
| **Live-CMS-Inhalte (Datenbank)** | ✅ 11.07.2026 auf die bereinigten Seed-Texte angeglichen (strapi/scripts/clean-cms-claims.mjs, Draft + Published; Backup unter strapi/backups/). Neue CMS-Inhalte weiterhin vor Veröffentlichung gegen die ❌-Liste prüfen |
| **Landing-Page (landing/ → dist/)** | ✅ 11.07.2026 mit Betreiber-Freigabe neu aufgebaut (Wellness-Positionierung, Papercraft-CI); Claim-Guard-Test: app/src/test/landing.test.js prüft die Quelle gegen die ❌-Liste |
| Disclaimer | ✅ „ersetzt keine ärztliche Beratung" in Konto-Footer + AGB §2/§7 |

## Prozess

1. Jeder neue Inhalt (CMS, Landing, Ad) wird vor Veröffentlichung gegen die ❌-Liste geprüft.
2. Zielgruppen-Ansprache („für Frauen nach einer Brust-OP") ist heikler Graubereich: Sie kann
   als Zweckbestimmung gewertet werden (EuGH C-21/23: schon der Kauf beschwerde­bezogener
   Produkte ist ein Gesundheitsdatum!). Vor Launch anwaltlich klären, wie die Zielgruppe
   benannt werden darf.
3. Zusätzlich HWG beachten (Verbot irreführender Heilversprechen in der Werbung).
