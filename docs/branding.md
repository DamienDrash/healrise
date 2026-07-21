# HEALRISE — Branding / Corporate Identity („Papercraft / Botanisch")

Referenz ist das Brand-Board (Papercraft-Blüte mit Copper-Ring, Sage-Blättern,
Ivory-Petalen und Samen-Schale). Alle Brand-Assets sind **rein vektoriell im Repo**
(SVG/JSX) — es gibt keine Bild-Abhängigkeiten zu externen Dateien.

## Markenkern

- **Wortmarke:** HEALRISE (Versalien, Playfair Display, weites Tracking)
- **Tagline:** `SUPPORT · RENEW · RISE`
- **Claim-Ton:** vertrauenswürdig, sanft, aufrichtend („Guidance that cares. Strength that rises.")
  — Achtung: Formulierungen mit Heilungs-/Wirkversprechen fallen unter
  [claims-richtlinie.md](claims-richtlinie.md) (MDR/HWG) und sind vor Verwendung freizugeben.
- **Anmutung:** handmade · tactile · layered (Papier-Ebenen, weiche Schatten, botanische Akzente)

## Farbpalette (Brand-Board)

| Token | Hex | Rolle |
|---|---|---|
| Warm Ivory | `#F6F3EF` | Grundfläche, Manifest `theme_color`/`background_color` |
| Stone | `#D8D2C7` | Trennlinien, ruhige Flächen |
| Sage | `#A7B7A6` | botanische Akzente, Thumbnails |
| Ink | `#1E2321` | Text, tiefe Flächen (Banner) |
| Copper | `#B8734F` | dekorativ: Logo-Ring, Verläufe, Botanik |
| Copper (AA) | `#9C5E3D` | **interaktiv**: Buttons, Links, Fokus — AA-Kontrast auf Ivory |

Ergänzende Abstufungen (`--ivory-2`, `--stone-2`, `--sage-deep`, `--copper-soft`, …)
sowie die Verläufe `--grad-hero` (Ink), `--grad-thumb` (Sage) und `--grad-copper`
sind in `app/src/index.css` als CSS-Custom-Properties definiert — **dort ist die
Single Source of Truth für alle Farbwerte.**

### Alias-Ebene (Bestandscode)

Ältere Token-Namen bleiben als Aliasse erhalten und zeigen auf die neue Palette:
`--cream → --ivory`, `--gold → --copper-ink`, `--text → --ink` usw.
Neuer Code soll die Brand-Tokens direkt verwenden; Alt-Hexwerte
(`#A9896D`, `#8a6f55`, `#c9ab8a`, `#2c2218`, `#eae8e5`, …) dürfen nicht mehr
vorkommen (wird von `src/components/brand/brand.test.jsx` erzwungen).

## Typografie

| Schrift | Einsatz | Quelle |
|---|---|---|
| Playfair Display | Wortmarke, Headlines (`h1–h4`) | `@fontsource/playfair-display` (self-hosted, Review I1) |
| Lora | Fließtext | `@fontsource/lora` |
| Poppins | UI-Labels, Buttons, Eyebrows (`.eyebrow`) | `@fontsource/poppins` |

## Brand-Komponenten (`app/src/components/brand/`)

| Komponente | Zweck |
|---|---|
| `HealriseMark` | Bildmarke (Papercraft-Blüte). `variant="plain"` freigestellt, `"framed"` mit Ivory-Kachel. Gradient-IDs sind pro Instanz eindeutig (`useId`). |
| `HealriseLogo` | Wort-Bild-Marke. `variant="horizontal"` (Kopfzeile) / `"full"` (Auth/Splash, mit Tagline). Wortmarke ist echter Text (a11y, scharfe Skalierung). |
| `Botanical` | Dekorative Botanik: `variant="sprig"` (feine Linienbotanik) / `"spray"` (Papercraft-Blätter + Copper-Bogen). Färbt über `currentColor`, immer `aria-hidden`. |

Utility `.paper-grain` (index.css) legt eine feine Papierstruktur über tiefe
Flächen (Hero-Banner) — reines Inline-SVG-Noise, kein Asset.

## App-Icons / Favicon

- `app/public/favicon.svg` — Blüte auf Ivory-Kachel (Quelle identisch zu `HealriseMark`).
- PNG-Icons (`icon-*.png`, `apple-touch-icon.png`) werden aus dem Vektor gerastert:

```bash
cd app && node scripts/generate-icons.mjs   # braucht lokal installiertes Playwright-Chromium
```

- `maskable`-Varianten nutzen 66 % Safe-Zone, `any`-Varianten 90 % (Review I8:
  getrennte any/maskable-Icons).
- Nach Logo-Änderungen: SVG in `HealriseMark.jsx`, `favicon.svg` **und**
  `scripts/generate-icons.mjs` synchron halten, dann Icons neu generieren.

## Landing-Page (`landing/` → `dist/`)

Die öffentliche Landing (https://services.frigew.ski/healrise/) wird aus `dist/`
ausgeliefert; **Quelle ist `landing/`** (statisches HTML/CSS/JS, Tokens identisch
zur App, Blüte/Botanik als wiederverwendbare SVG-`<defs>`). Build:

```bash
npm run build:landing   # landing/ → dist/ (Teil von npm run check)
```

`dist/` nie direkt editieren. Texte müssen der
[claims-richtlinie.md](claims-richtlinie.md) genügen — erzwungen durch den
Claim-Guard in `app/src/test/landing.test.js`.

## Do / Don't

- ✅ Farben ausschließlich über Tokens (`var(--…)`) — keine neuen Hex-Literale in Komponenten.
- ✅ Interaktive Elemente in Copper (AA) `--copper-ink`, dekorative in Copper `--copper`.
- ✅ Botanik/Blüte immer `aria-hidden` bzw. dekorativ; der Markenname kommt aus echtem Text.
- ❌ Kein Sonnen-Motiv mehr (Alt-CI), keine Gold-/Braun-Töne.
- ❌ Keine Raster-Bilder für Brand-Elemente einchecken (Ausnahme: generierte PWA-Icons).
