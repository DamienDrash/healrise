#!/usr/bin/env node
// R-01: Legal-Placeholder-Readiness — lokaler Report, KEINE Netz-/DB-Aktion.
//
// Scannt die gepflegten Rechtsseiten-Quellen nach verbleibenden Platzhaltern
// ([PLATZHALTER: …] via <PH>-Komponente) und prüft, ob die Landing die vier
// Pflichtseiten verlinkt. Meldet NUR sichere Feldnamen/Pfade/Zeilen/Counts —
// niemals echte Daten oder Secrets. ERSETZT KEINE Platzhalter und behauptet
// KEINE Rechtskonformität. Reale Betreiberdaten + anwaltliche Prüfung bleiben
// ein Betreiber-Schritt (Damien-Go).
//
// Nutzung:  node scripts/legal-readiness.mjs   (Exit 1 solange Platzhalter offen)
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const REQUIRED_LANDING_LINKS = ['impressum', 'datenschutz', 'agb', 'widerruf'];

/**
 * Findet Platzhalter im Quelltext: `<PH>Feldname</PH>`-Nutzungen sowie rohe
 * `[PLATZHALTER: Feldname]`-Marker. Liefert je Treffer nur { field, line }.
 */
export function scanPlaceholders(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/<PH>([^<]*)<\/PH>/g)) {
      out.push({ field: m[1].trim(), line: i + 1 });
    }
    for (const m of line.matchAll(/\[PLATZHALTER:\s*([^\]]*)\]/g)) {
      const field = m[1].trim();
      // Komponenten-Definition/Legende ausblenden (kein echtes Feld).
      if (field && field !== '{children}' && field !== '…') out.push({ field, line: i + 1 });
    }
  });
  return out;
}

/**
 * Bewertet die Legal-Readiness über mehrere Dateien.
 * files: [{ path, kind: 'legal-page'|'landing', text }]
 * ready = keine Platzhalter offen UND alle Pflicht-Rechtslinks in der Landing.
 */
export function assessLegalReadiness(files) {
  const placeholders = [];
  const missingRefs = [];
  for (const f of files) {
    for (const p of scanPlaceholders(f.text)) placeholders.push({ path: f.path, ...p });
    if (f.kind === 'landing') {
      for (const link of REQUIRED_LANDING_LINKS) {
        if (!new RegExp(link, 'i').test(f.text)) missingRefs.push({ path: f.path, missing: link });
      }
    }
  }
  return {
    ready: placeholders.length === 0 && missingRefs.length === 0,
    placeholderCount: placeholders.length,
    placeholders,
    missingRefs,
  };
}

// CLI: Report drucken (nur Feldnamen/Pfad/Zeile), Exit 1 solange nicht ready.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const rd = (...p) => { try { return readFileSync(join(root, ...p), 'utf8'); } catch { return ''; } };
  const files = [
    { path: 'app/src/pages/Legal.jsx', kind: 'legal-page', text: rd('app', 'src', 'pages', 'Legal.jsx') },
    { path: 'landing/index.html', kind: 'landing', text: rd('landing', 'index.html') },
  ].filter((f) => f.text);

  const r = assessLegalReadiness(files);
  // eslint-disable-next-line no-console
  console.log(`R-01 Legal-Readiness: ${r.ready ? 'READY' : 'BLOCKED'} — ${r.placeholderCount} offene Platzhalter\n`);
  for (const p of r.placeholders) console.log(`  ✖ ${p.path}:${p.line}  Feld: ${p.field}`);
  for (const m of r.missingRefs) console.log(`  ✖ ${m.path}: fehlender Pflicht-Rechtslink '${m.missing}'`);
  console.log('\n  Betreiber-Blocker (Damien-Go): echte Betreiberdaten (Name/Anschrift/USt-IdNr./');
  console.log('  Widerrufsadresse) einsetzen UND Rechtstexte anwaltlich prüfen lassen. Kein Auto-Fill.');
  process.exit(r.ready ? 0 : 1);
}
