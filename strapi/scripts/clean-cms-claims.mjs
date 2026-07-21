/**
 * Überträgt die bereinigten Wellness-Texte aus dem Code-Seed (src/index.ts)
 * in die Live-DB (Claims-Richtlinie: docs/claims-richtlinie.md).
 *
 *   node scripts/clean-cms-claims.mjs            # Dry-Run (zeigt Diff)
 *   node scripts/clean-cms-claims.mjs --apply    # schreibt in die DB
 *
 * Aktualisiert je Slug title/description/body in ALLEN Versionen (Draft +
 * Published, gleiche document_id) und setzt updated_at. Strukturfelder
 * (plan_required, category, day/week/order …) bleiben unangetastet.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

// .env laden (nur DATABASE_*)
for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^(DATABASE_[A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^['"]|['"]$/g, '');
}

// Seed-Objekte aus src/index.ts extrahieren (eine Zeile = ein Objektliteral)
const src = readFileSync(resolve(ROOT, 'src', 'index.ts'), 'utf8');
const seedLines = src.match(/^\s*\{ title: .*\},?\s*$/gm) ?? [];
const seeds = seedLines.map((l) => {
  // Objektliteral sicher auswerten — Datei liegt im Repo, kein Fremd-Input
  return Function(`"use strict"; return (${l.trim().replace(/,\s*$/, '')})`)();
});
if (!seeds.length) {
  console.error('Keine Seed-Programme in src/index.ts gefunden.');
  process.exit(1);
}

const client = new pg.Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});
await client.connect();

let changed = 0;
for (const s of seeds) {
  const { rows } = await client.query(
    'SELECT id, title, description, body, published_at IS NOT NULL AS pub FROM programs WHERE slug = $1 ORDER BY id',
    [s.slug],
  );
  if (!rows.length) {
    console.log(`— ${s.slug}: nicht in DB (übersprungen)`);
    continue;
  }
  for (const row of rows) {
    const same = row.title === s.title && row.description === s.description && row.body === s.body;
    if (same) {
      console.log(`= ${s.slug} #${row.id} (${row.pub ? 'published' : 'draft'}): bereits sauber`);
      continue;
    }
    changed++;
    console.log(`✎ ${s.slug} #${row.id} (${row.pub ? 'published' : 'draft'}):`);
    if (row.title !== s.title) console.log(`    Titel: „${row.title}" → „${s.title}"`);
    if (row.description !== s.description) console.log(`    Beschr.: „${row.description}" → „${s.description}"`);
    if (row.body !== s.body) console.log('    Body: aktualisiert');
    if (APPLY) {
      await client.query(
        'UPDATE programs SET title=$1, description=$2, body=$3, updated_at=now() WHERE id=$4',
        [s.title, s.description, s.body, row.id],
      );
    }
  }
}

await client.end();
console.log(APPLY ? `\n✓ ${changed} Zeilen aktualisiert.` : `\nDry-Run: ${changed} Zeilen würden geändert (--apply zum Schreiben).`);
