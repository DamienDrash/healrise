// O-01: Backup/Restore-Readiness. Versionierte, sichere Artefakte (Dry-Run per
// Default, env-gesteuert, keine Secrets); Restore-Drill blockt die Live-DB ohne
// bewusstes Flag. Rein statischer Guard über die Script-Quellen + Doku, führt
// kein pg_dump/Restore aus. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => readFileSync(join(ROOT, ...p), 'utf8');

const BACKUP = read('scripts', 'db-backup.sh');
const RESTORE = read('scripts', 'db-restore-drill.sh');
const AUDIT = read('docs', 'production-readiness-audit.md');
const CHECKLIST = read('docs', 'launch-checklist.md');

// verbotene Klartext-Secret-Muster in beiden Scripts
const SECRET_PATTERNS = [/tobemodified/, /PGPASSWORD=['"]?[A-Za-z0-9]{6,}/, /postgres:\/\/[^@\s]+:[^@\s]+@/];

test('db-backup.sh: pg_dump, Dry-Run per Default (BACKUP_RUN-gated), env-basiert', () => {
  assert.match(BACKUP, /set -euo pipefail/);
  assert.match(BACKUP, /pg_dump/);
  assert.match(BACKUP, /BACKUP_RUN/, 'kein Dry-Run/Run-Gate');
  assert.match(BACKUP, /DATABASE_(HOST|NAME|USERNAME)/, 'nutzt DB-Env');
  assert.match(BACKUP, /PGPASSWORD/, 'Passwort nur über Env an pg_dump');
});

test('db-backup.sh: Rotation + Offsite nur env-gesteuert/dokumentiert, keine Secrets', () => {
  assert.match(BACKUP, /BACKUP_KEEP|Rotation/i);
  assert.match(BACKUP, /BACKUP_OFFSITE|Off-?Site/i);
  for (const re of SECRET_PATTERNS) assert.doesNotMatch(BACKUP, re, `Secret-Muster: ${re}`);
});

test('db-restore-drill.sh: blockt Live-DB ohne bewusstes Flag, Dry-Run per Default', () => {
  assert.match(RESTORE, /set -euo pipefail/);
  assert.match(RESTORE, /pg_restore|psql/);
  assert.match(RESTORE, /RESTORE_ALLOW_LIVE/, 'kein Live-DB-Schutzflag');
  assert.match(RESTORE, /RESTORE_TARGET_DB/, 'kein explizites Test-DB-Ziel');
  assert.match(RESTORE, /DATABASE_NAME/, 'vergleicht Ziel nicht mit Live-DB');
  assert.match(RESTORE, /RESTORE_RUN/, 'kein Dry-Run/Run-Gate');
  for (const re of SECRET_PATTERNS) assert.doesNotMatch(RESTORE, re, `Secret-Muster: ${re}`);
});

test('Doku markiert O-01 lokal vorbereitet + Betreiber-blockiert', () => {
  const o01 = AUDIT.match(/\| \*\*O-01\*\*.*/);
  assert.ok(o01, 'O-01-Zeile im Audit');
  assert.match(o01[0], /vorbereitet|db-backup\.sh/i);
  assert.match(o01[0], /Betreiber|Damien|Off-?Site|Cron|Timer/i);
  assert.match(CHECKLIST, /db-backup\.sh|db-restore-drill\.sh/);
});
