// P0: Härtungs-Guard für scripts/deploy.sh. Prüft die Deploy-Sicherheitskontrakte
// statisch (Quelle) UND im Verhalten gegen Mocks — KEIN echter Build, KEIN echtes
// systemctl, KEIN Netzzugriff nach außen. Alle Seiteneffekte (Restart/Harden/Smoke)
// werden über argv-Hooks auf Marker-Dateien umgeleitet; Health läuft gegen einen
// lokalen Mock-Server. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEPLOY = join(ROOT, 'scripts', 'deploy.sh');
const SRC = readFileSync(DEPLOY, 'utf8');

// ---------- Statische Kontrakte ----------
test('deploy.sh: fail-fast (set -euo pipefail)', () => {
  assert.match(SRC, /set -euo pipefail/);
});

test('deploy.sh: root-Guard (kein Deploy als uid 0 — Ownership-Falle B-04)', () => {
  assert.match(SRC, /id -u/);
  assert.match(SRC, /exit 1/);
});

test('deploy.sh: Concurrency-Lock via flock (kein überlappender Deploy)', () => {
  assert.match(SRC, /flock/, 'kein flock-Lock');
});

// Ausführungsreihenfolge wird an den eindeutigen Phasen-Bannern (je genau einmal,
// in Ausführungsreihenfolge) gemessen — nicht an den Variablen-Deklarationen oben.
const iHarden = SRC.indexOf('== Hardening');
const iRestart = SRC.indexOf('== Restart');
const iHealth = SRC.indexOf('== Warte auf');
const iSmoke = SRC.indexOf('== Live-Smoke');
const iPreflight = SRC.indexOf('Deploy abgebrochen'); // .env-Preflight-Abbruchmeldung

test('deploy.sh: Preflight prüft die Secrets-Datei vor Restart', () => {
  assert.ok(iPreflight > -1, 'kein .env-Preflight');
  assert.ok(iPreflight < iRestart, 'Preflight muss vor dem Restart stehen');
});

test('deploy.sh: Reihenfolge harden-env → restart → health → smoke', () => {
  assert.ok(iHarden > -1 && iRestart > -1 && iHealth > -1 && iSmoke > -1, 'Phasen-Banner fehlen');
  assert.ok(iHarden < iRestart, 'harden-env muss vor Restart laufen');
  assert.ok(iRestart < iHealth, 'Restart muss vor dem Health-Wait laufen');
  assert.ok(iHealth < iSmoke, 'Smoke muss nach dem Health-Wait laufen');
});

test('deploy.sh: Health-Wait ist beschränkt und scheitert hart bei Timeout', () => {
  assert.match(SRC, /HEALTH_RETRIES|seq 1 /, 'kein beschränkter Health-Wait');
  // Nach erschöpften Versuchen MUSS mit Fehler abgebrochen werden (kein stiller Erfolg).
  assert.match(SRC, /healthy[\s\S]*exit 1|exit 1[\s\S]*healthy/i);
});

// ---------- Verhalten (gegen Mocks) ----------
function startHealth({ healthy = true } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/_health' && healthy) { res.writeHead(204); return res.end(); }
      res.writeHead(500); res.end('down');
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function hook(dir, name, marker) {
  const p = join(dir, name);
  writeFileSync(p, `#!/usr/bin/env bash\ntouch ${JSON.stringify(marker)}\n`);
  chmodSync(p, 0o755);
  return p;
}

function run(env) {
  return new Promise((resolve) => {
    execFile('bash', [DEPLOY], { env: { ...process.env, ...env }, timeout: 20000 },
      (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr }));
  });
}

// `id`-Shim: deploy.sh verweigert den Lauf als root (uid 0, Ownership-Falle B-04).
// Läuft die Test-Suite selbst als root, würde dieser Prod-Schutz die Verhaltens-
// tests fälschlich abbrechen. Der Shim (vorne im PATH) meldet `id -u` als
// Nicht-root — der reale Root-Guard im Skript bleibt unangetastet und wird separat
// (statisch) geprüft.
function idShimPath(dir) {
  const p = join(dir, 'id');
  writeFileSync(p, `#!/usr/bin/env bash\n[[ "$1" == "-u" ]] && { echo 1000; exit 0; }\nexec /usr/bin/id "$@"\n`);
  chmodSync(p, 0o755);
  return p;
}

function baseEnv(dir, port, markers, extra = {}) {
  const envFile = join(dir, 'env');
  writeFileSync(envFile, 'JWT_SECRET=x\n');
  idShimPath(dir); // legt `dir/id` an; dir wird unten vorne an PATH gehängt
  return {
    DEPLOY_SKIP_BUILD: '1',
    ENV_FILE: envFile,
    HARDEN_CMD: hook(dir, 'harden.sh', markers.harden),
    RESTART_HOOK: hook(dir, 'restart.sh', markers.restart),
    SMOKE_CMD: hook(dir, 'smoke.sh', markers.smoke),
    HEALTH_URL: `http://127.0.0.1:${port}/_health`,
    HEALTH_RETRIES: '3',
    HEALTH_SLEEP: '0',
    DEPLOY_LOCK: join(dir, 'deploy.lock'),
    PATH: `${dir}:${process.env.PATH}`,
    ...extra,
  };
}

test('deploy.sh: Happy Path → Exit 0, harden+restart+smoke ausgeführt', async () => {
  const server = await startHealth({ healthy: true });
  const dir = mkdtempSync(join(tmpdir(), 'dep-'));
  const markers = { harden: join(dir, 'H'), restart: join(dir, 'R'), smoke: join(dir, 'S') };
  try {
    const { code, stdout } = await run(baseEnv(dir, server.address().port, markers));
    assert.equal(code, 0, `Deploy sollte grün sein:\n${stdout}`);
    assert.ok(existsSync(markers.harden), 'harden-env nicht ausgeführt');
    assert.ok(existsSync(markers.restart), 'Restart nicht ausgeführt');
    assert.ok(existsSync(markers.smoke), 'Smoke nicht ausgeführt');
  } finally {
    server.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('deploy.sh: fehlende Secrets-Datei → Abbruch VOR Restart', async () => {
  const server = await startHealth({ healthy: true });
  const dir = mkdtempSync(join(tmpdir(), 'dep-'));
  const markers = { harden: join(dir, 'H'), restart: join(dir, 'R'), smoke: join(dir, 'S') };
  try {
    const env = baseEnv(dir, server.address().port, markers, { ENV_FILE: join(dir, 'does-not-exist') });
    const { code } = await run(env);
    assert.notEqual(code, 0, 'fehlende .env muss den Deploy abbrechen');
    assert.equal(existsSync(markers.restart), false, 'kein Restart ohne Secrets-Datei');
  } finally {
    server.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('deploy.sh: Strapi wird nicht healthy → Exit 1, Smoke NICHT erreicht', async () => {
  const server = await startHealth({ healthy: false });
  const dir = mkdtempSync(join(tmpdir(), 'dep-'));
  const markers = { harden: join(dir, 'H'), restart: join(dir, 'R'), smoke: join(dir, 'S') };
  try {
    const { code } = await run(baseEnv(dir, server.address().port, markers));
    assert.equal(code, 1, 'unhealthy Strapi muss den Deploy rot machen');
    assert.equal(existsSync(markers.smoke), false, 'Smoke darf bei fehlender Health nicht laufen');
  } finally {
    server.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('deploy.sh: gehaltener Lock verhindert überlappenden Deploy', async () => {
  const server = await startHealth({ healthy: true });
  const dir = mkdtempSync(join(tmpdir(), 'dep-'));
  const markers = { harden: join(dir, 'H'), restart: join(dir, 'R'), smoke: join(dir, 'S') };
  const lock = join(dir, 'deploy.lock');
  // Halter-Prozess belegt den Lock exklusiv für 3s.
  const holder = spawn('bash', ['-c', `exec 9>"${lock}"; flock 9; sleep 3`]);
  try {
    await new Promise((r) => setTimeout(r, 400)); // Lock sicher belegt
    const env = baseEnv(dir, server.address().port, markers, { DEPLOY_LOCK: lock });
    const { code } = await run(env);
    assert.notEqual(code, 0, 'zweiter Deploy muss am Lock scheitern');
    assert.equal(existsSync(markers.restart), false, 'kein Restart bei belegtem Lock');
  } finally {
    holder.kill('SIGKILL');
    server.close(); rmSync(dir, { recursive: true, force: true });
  }
});
