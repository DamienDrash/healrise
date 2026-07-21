// Test-first für die Secrets-Hardening des Deploy-Pfads (Audit O-03, Roadmap P2.5).
// Der unterstützte Deploy-Pfad muss einen unsicheren strapi/.env-Modus sicher auf
// 600 normalisieren, OHNE den Inhalt zu lesen oder zu verändern und ohne den Owner
// zu ändern. Getestet wird das eigenständige, per ENV_FILE parametrisierbare
// scripts/harden-env.sh gegen eine temporäre Fake-.env — kein echtes Secret, kein
// Netz. Ausführen: npm run test:scripts  (node --test scripts/tests/*.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARDEN = join(HERE, '..', 'harden-env.sh');
const DEPLOY = join(HERE, '..', 'deploy.sh');

function run(script, env = {}) {
  return new Promise((resolve) => {
    execFile('bash', [script], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr });
    });
  });
}

const modeOf = (p) => (statSync(p).mode & 0o777).toString(8);

function makeEnvFile(mode) {
  const dir = mkdtempSync(join(tmpdir(), 'healrise-env-'));
  const file = join(dir, '.env');
  // Repräsentativer, NICHT echter Inhalt — nur um Unveränderlichkeit zu prüfen.
  writeFileSync(file, 'DUMMY_KEY=not-a-real-secret\n');
  chmodSync(file, mode);
  return { dir, file };
}

test('normalisiert einen unsicheren Modus (644) auf 600', async () => {
  const { dir, file } = makeEnvFile(0o644);
  try {
    assert.equal(modeOf(file), '644', 'Vorbedingung: unsicher');
    const before = readFileSync(file);
    const { code } = await run(HARDEN, { ENV_FILE: file });
    assert.equal(code, 0, 'harden-env.sh erfolgreich');
    assert.equal(modeOf(file), '600', 'Modus auf 600 normalisiert');
    // Inhalt unverändert (Skript darf Secrets weder lesen-verändern noch anfassen).
    assert.deepEqual(readFileSync(file), before, 'Inhalt unverändert');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ist idempotent: bereits 600 bleibt 600, Exit 0', async () => {
  const { dir, file } = makeEnvFile(0o600);
  try {
    const { code } = await run(HARDEN, { ENV_FILE: file });
    assert.equal(code, 0);
    assert.equal(modeOf(file), '600');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fehlende Datei bricht den Deploy nicht ab (Exit 0)', async () => {
  const { code } = await run(HARDEN, { ENV_FILE: join(tmpdir(), 'healrise-does-not-exist-xyz', '.env') });
  assert.equal(code, 0, 'graceful skip');
});

test('der unterstützte Deploy-Pfad (deploy.sh) ruft die Hardening auf', () => {
  const deploy = readFileSync(DEPLOY, 'utf8');
  assert.match(deploy, /harden-env\.sh/, 'deploy.sh wired die O-03-Hardening ein');
});
