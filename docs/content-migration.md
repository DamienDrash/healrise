# HEALRISE Content-Migration (safe MVP)

## Ziel

Dieser Pfad übernimmt nicht die rohen Notion-Inhalte direkt in die Produktionsdatenbank. Stattdessen entsteht ein kleiner, review-fähiger Content-Pack:

1. Notion-Quelle lesen und fachlich riskante Formulierungen entfernen.
2. Sanitisierten JSON-Pack unter `strapi/data/healrise-content-pack-v1.json` pflegen.
3. Mit `node scripts/validate-content-pack.mjs` trocken validieren.
4. Erst nach redaktioneller, rechtlicher und fachlicher Prüfung über einen separaten Importpfad in Strapi übernehmen.

Der aktuelle Validator schreibt keine Datenbankdaten und verbindet sich nicht mit Strapi. Er prüft Form, Enums, Slug-Eindeutigkeit, bekannte Risiko-Formulierungen und rohe Platzhalter.

## Claim-Schutz

Notion enthielt teils medizinisch starke Sprache. Der Pack nutzt bewusst Wellness-, Bildungs- und Organisationssprache. Nicht erlaubt sind direkte Zusagen wie beschleunigte Heilung, schmerzlindernde Wirkung, Risikoreduktion, Aussagen zu Kapselfibrose-Wahrscheinlichkeit oder exakte Supplement-Dosierungen.

Wo passend steht im Inhalt: „Ersetzt keine medizinische Beratung; halte dich an ärztliche Vorgaben.“

## Medien-MVP

Die Datensätze sind zunächst textbasiert und setzen `media_source: "none"`. Für externe Medien wäre als Zwischenlösung nur unlisted/externe Verlinkung denkbar, aber nicht als Datenschutz- oder Zugriffsschutz zu verstehen.

Zielbild für Premium-/private Medien: Strapi/Objektspeicher mit geprüften Zugriffsregeln oder signierten kurzlebigen URLs. Das sollte separat umgesetzt und getestet werden, bevor geschützte Medien produktiv genutzt werden.
