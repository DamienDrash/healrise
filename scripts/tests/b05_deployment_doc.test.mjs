// B-05: docs/deployment.md muss die REALITÄT beschreiben — Caddy (statt nginx),
// systemd (statt PM2), Healthcheck + Alerting, Backup-Timer, Caddy-Access-Log —
// und KEINE Secrets im Klartext. Rein statisch. Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PATH = join(ROOT, 'docs', 'deployment.md');

test('docs/deployment.md existiert', () => {
  assert.ok(existsSync(PATH));
});

const DOC = readFileSync(PATH, 'utf8');

test('enthält Pflicht-Keywords: Caddy, systemd, Healthcheck, Backup', () => {
  for (const kw of [/Caddy/, /systemd/, /Healthcheck/i, /Backup/]) {
    assert.match(DOC, kw, `Keyword fehlt: ${kw}`);
  }
});

test('Caddy inkl. Access-Logs', () => {
  assert.match(DOC, /Access-Log|access[-.]log|healrise-access/i);
});

test('Healthcheck-Alerting (wie im HEAD committet: HEALTH_ALERT_CMD)', () => {
  assert.match(DOC, /Alert/i);
  assert.match(DOC, /HEALTH_ALERT_CMD/);
});

test('Backup-Timer dokumentiert', () => {
  assert.match(DOC, /healrise-backup\.timer|Backup-Timer/);
});

test('erwähnt KEIN nginx und KEIN PM2', () => {
  assert.doesNotMatch(DOC, /nginx/i, 'nginx muss entfernt sein');
  assert.doesNotMatch(DOC, /\bPM2\b/i, 'PM2 muss entfernt sein');
});

test('kein Stripe-/Secret-Klartext (nur Verweis auf env)', () => {
  assert.doesNotMatch(DOC, /sk_(test|live)_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(DOC, /whsec_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(DOC, /tobemodified/);
});
