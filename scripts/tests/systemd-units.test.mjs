// P0: Guard für die versionierten systemd-Units (deploy/systemd/*). Rein statisch
// (Datei-Parsing) — kein systemctl, kein Lauf. Sperrt die sicherheits-/betriebs-
// kritischen Verträge der Units gegen stilles Regredieren:
//  - Strapi läuft als unprivilegierter User (NIE root), NODE_ENV=production,
//    KEIN SEED_DEMO (legt Testuser mit bekanntem Passwort an), Härtungsflags,
//    Restart=always.
//  - Healthcheck-Oneshot ruft das real existierende scripts/healthcheck.sh und
//    hängt am Strapi-Dienst; der Timer feuert periodisch (L-01-Selbstheilung).
//  - Backup-Oneshot + täglicher, nachhol-fähiger Timer.
// Enthält Non-Vakuum-Selbstchecks (crafted Bad-Unit muss gefangen werden).
// Ausführen: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const unit = (name) => readFileSync(join(ROOT, 'deploy', 'systemd', name), 'utf8');

const STRAPI = unit('healrise-strapi.service');
const HEALTH_SVC = unit('healrise-strapi-health.service');
const HEALTH_TIMER = unit('healrise-strapi-health.timer');
const BACKUP_SVC = unit('healrise-backup.service');
const BACKUP_TIMER = unit('healrise-backup.timer');

// --- Prädikate (auch für die Non-Vakuum-Selbstchecks wiederverwendet) ---
/** Läuft eine Unit unprivilegiert (kein User=root, sondern ein echter User)? */
function runsUnprivileged(src) {
  if (/^\s*User\s*=\s*root\s*$/mi.test(src)) return false;
  return /^\s*User\s*=\s*\w+/mi.test(src);
}
/** Setzt die Unit das gefährliche SEED_DEMO tatsächlich (Testuser mit bekanntem
 * Passwort)? Nur echte, NICHT-kommentierte Zeilen zählen — der Warn-Kommentar
 * „SEED_DEMO darf hier NIE gesetzt werden" ist erlaubt und darf nicht auslösen. */
function hasSeedDemo(src) {
  return src.split('\n').some((line) => !/^\s*#/.test(line) && /SEED_DEMO/i.test(line));
}

// --- healrise-strapi.service ---
test('strapi.service: läuft als unprivilegierter User (NIE root)', () => {
  assert.equal(runsUnprivileged(STRAPI), true, 'Strapi darf nicht als root laufen');
  assert.match(STRAPI, /^\s*User\s*=\s*claude\s*$/m);
  assert.match(STRAPI, /^\s*Group\s*=\s*claude\s*$/m);
});

test('strapi.service: NODE_ENV=production und KEIN SEED_DEMO', () => {
  assert.match(STRAPI, /Environment\s*=\s*NODE_ENV=production/);
  assert.equal(hasSeedDemo(STRAPI), false, 'SEED_DEMO in der Prod-Unit = Testuser mit bekanntem Passwort');
});

test('strapi.service: Härtungsflags + Restart=always', () => {
  assert.match(STRAPI, /^\s*NoNewPrivileges\s*=\s*true\s*$/m);
  assert.match(STRAPI, /^\s*PrivateTmp\s*=\s*true\s*$/m);
  assert.match(STRAPI, /^\s*Restart\s*=\s*always\s*$/m);
});

test('strapi.service: korrekter ExecStart + WorkingDirectory + Install-Target', () => {
  assert.match(STRAPI, /WorkingDirectory\s*=\s*\/opt\/healrise\/strapi/);
  assert.match(STRAPI, /ExecStart=.*strapi start/);
  assert.match(STRAPI, /WantedBy\s*=\s*multi-user\.target/);
});

// --- healrise-strapi-health.service ---
test('health.service: Oneshot ruft das real existierende healthcheck.sh', () => {
  assert.match(HEALTH_SVC, /Type\s*=\s*oneshot/);
  const m = HEALTH_SVC.match(/ExecStart\s*=\s*(\S+)/);
  assert.ok(m, 'kein ExecStart in health.service');
  assert.match(m[1], /healthcheck\.sh$/);
  assert.ok(existsSync(m[1]), `ExecStart-Ziel existiert nicht: ${m[1]}`);
});

test('health.service: hängt am Strapi-Dienst (Requisite/After)', () => {
  assert.match(HEALTH_SVC, /(Requisite|After)\s*=.*healrise-strapi\.service/);
});

// --- healrise-strapi-health.timer ---
test('health.timer: feuert periodisch (Selbstheilung L-01) + Install', () => {
  assert.match(HEALTH_TIMER, /OnUnitActiveSec\s*=/, 'kein periodischer Trigger');
  assert.match(HEALTH_TIMER, /WantedBy\s*=\s*timers\.target/);
});

// --- healrise-backup.service + .timer ---
test('backup.service: Oneshot mit ExecStart', () => {
  assert.match(BACKUP_SVC, /Type\s*=\s*oneshot/);
  assert.match(BACKUP_SVC, /ExecStart\s*=\s*\S+/);
});

test('backup.timer: täglich, nachhol-fähig, Install', () => {
  assert.match(BACKUP_TIMER, /OnCalendar\s*=/);
  assert.match(BACKUP_TIMER, /Persistent\s*=\s*true/, 'verpasste Backups müssen nachgeholt werden');
  assert.match(BACKUP_TIMER, /WantedBy\s*=\s*timers\.target/);
});

// --- Querschnitt: keine Unit läuft als root, keine trägt Klartext-Secrets ---
test('KEINE Unit läuft als root', () => {
  for (const [name, src] of [['strapi', STRAPI], ['health', HEALTH_SVC], ['backup', BACKUP_SVC]]) {
    assert.doesNotMatch(src, /^\s*User\s*=\s*root\s*$/mi, `${name}.service läuft als root`);
  }
});

test('KEINE Unit enthält Klartext-Secrets/Passwörter', () => {
  for (const src of [STRAPI, HEALTH_SVC, HEALTH_TIMER, BACKUP_SVC, BACKUP_TIMER]) {
    assert.doesNotMatch(src, /(PASSWORD|SECRET|API_KEY|TOKEN)\s*=\s*\S+/i);
    assert.doesNotMatch(src, /-----BEGIN|https?:\/\/\S+:\S+@/);
  }
});

// --- Non-Vakuum: die Detektoren müssen echte Verstöße fangen ---
test('GUARDRAIL nicht vakuum: root + SEED_DEMO in einer Bad-Unit werden erkannt', () => {
  const bad = '[Service]\nUser=root\nEnvironment=SEED_DEMO=true\n';
  assert.equal(runsUnprivileged(bad), false, 'User=root muss als privilegiert erkannt werden');
  assert.equal(hasSeedDemo(bad), true, 'SEED_DEMO muss erkannt werden');
  // Gegprobe: die echte Prod-Unit ist sauber.
  assert.equal(runsUnprivileged(STRAPI), true);
  assert.equal(hasSeedDemo(STRAPI), false);
});
