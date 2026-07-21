/**
 * Landing-Build: kopiert die Quelle landing/ reproduzierbar nach dist/
 * (dort wird https://services.frigew.ski/healrise/ direkt ausgeliefert).
 *
 *   npm run build:landing
 *
 * dist/ ist ein reines Build-Artefakt — Änderungen gehören in landing/ (siehe docs/branding.md).
 */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'landing');
const OUT = resolve(ROOT, 'dist');

if (!existsSync(SRC)) {
  console.error('landing/ fehlt — nichts zu bauen.');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
console.log('✓ Landing gebaut: landing/ → dist/');
