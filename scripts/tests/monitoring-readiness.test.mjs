// 2.4 / L-01 Monitoring: (a) Healthcheck löst bei Fail einen konfigurierbaren
// Alarm aus (best effort, env-gesteuert, keine Secrets) UND restartet weiterhin;
// (b) versioniertes Caddy-Access-Log-Artefakt für /healrise mit Rotation,
// pfad-scoped + Deploy-Gate. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HEALTHCHECK = readFileSync(join(ROOT, 'scripts', 'healthcheck.sh'), 'utf8');
const ACCESS_LOG = readFileSync(join(ROOT, 'deploy', 'caddy', 'healrise-access-log.caddy'), 'utf8');

test('Healthcheck: env-konfigurierbarer Alarm-Hook vorhanden (kein Secret im Skript)', () => {
  assert.match(HEALTHCHECK, /HEALTH_ALERT_CMD/, 'kein Alarm-Hook');
  assert.doesNotMatch(HEALTHCHECK, /https?:\/\/\S+:\S+@/, 'keine Credentials/URL im Skript');
});

test('Healthcheck (Verhalten): bei /_health-Fail feuern Alarm UND Restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hc-'));
  const alertMarker = join(dir, 'alert.txt');
  const restartMarker = join(dir, 'restart.txt');
  const alertSh = join(dir, 'alert.sh');
  const restartSh = join(dir, 'restart.sh');
  writeFileSync(alertSh, `#!/usr/bin/env bash\nprintf '%s' "$*" >> ${JSON.stringify(alertMarker)}\n`);
  writeFileSync(restartSh, `#!/usr/bin/env bash\nprintf '%s' "$*" >> ${JSON.stringify(restartMarker)}\n`);
  chmodSync(alertSh, 0o755);
  chmodSync(restartSh, 0o755);

  try {
    execFileSync('bash', [join(ROOT, 'scripts', 'healthcheck.sh')], {
      env: {
        ...process.env,
        HEALTH_URL: 'http://127.0.0.1:1/_health', // Port 1 → connection refused
        HEALTH_ALERT_CMD: alertSh,
        RESTART_HOOK: restartSh,
      },
      stdio: 'ignore',
    });
  } catch { /* Skript kann non-zero exiten — egal, wir prüfen die Marker */ }

  assert.ok(existsSync(alertMarker), 'Alarm wurde bei Healthcheck-Fail NICHT ausgelöst');
  assert.ok(existsSync(restartMarker), 'Restart-Hook wurde NICHT aufgerufen');
});

test('Caddy-Access-Log-Artefakt: Datei-Output + Rotation + /healrise + Deploy-Gate', () => {
  assert.match(ACCESS_LOG, /\blog\b/);
  assert.match(ACCESS_LOG, /output\s+file/);
  assert.match(ACCESS_LOG, /roll_size|roll_keep/, 'keine Log-Rotation');
  assert.match(ACCESS_LOG, /healrise/i);
  assert.match(ACCESS_LOG, /reload|Damien|Deploy|validate/i, 'kein Deploy-Gate-Hinweis');
});

test('Access-Log-Artefakt enthält keine Secrets', () => {
  assert.doesNotMatch(ACCESS_LOG, /https?:\/\/\S+:\S+@|tobemodified|-----BEGIN/);
});
