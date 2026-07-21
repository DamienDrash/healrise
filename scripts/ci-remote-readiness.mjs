#!/usr/bin/env node
// O-02: Git-Remote/CI-Readiness — lokaler Report, KEINE GitHub-/Netz-Aktion.
//
// Validiert die CI-Vorlage (docs/ci-github-actions.yml) auf Pflicht-Jobs/-Schritte
// und Secret-Freiheit und meldet, ob ein Git-Remote konfiguriert ist. Konfiguriert
// NICHTS, pusht nichts. Das private Remote + der erste Push/CI-Lauf bleiben ein
// Betreiber-Schritt (Damien-Go).
//
// Nutzung:  node scripts/ci-remote-readiness.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const REQUIRED_JOBS = ['frontend', 'backend-api'];
const REQUIRED_STEPS = [
  { label: 'lint', re: /npm run lint/ },
  { label: 'test', re: /npm test|npm run test/ },
  { label: 'build', re: /npm run build/ },
];
// Muster für ECHTE Secrets (CI-Dummy-Werte wie ci-jwt-secret sind erlaubt).
const REAL_SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[A-Za-z0-9]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** Bewertet die CI-Vorlage rein statisch (kein Netz). */
export function assessCiTemplate(yml) {
  const blockers = [];
  for (const job of REQUIRED_JOBS) {
    if (!new RegExp(`^\\s{2}${job}:`, 'm').test(yml)) blockers.push(`CI-Job fehlt: ${job}`);
  }
  for (const step of REQUIRED_STEPS) {
    if (!step.re.test(yml)) blockers.push(`CI-Schritt fehlt: ${step.label}`);
  }
  if (!/on:\s*[\s\S]*push/.test(yml)) blockers.push('CI-Trigger "push" fehlt');

  const secretFree = !REAL_SECRET_PATTERNS.some((re) => re.test(yml));
  if (!secretFree) blockers.push('CI-Vorlage enthält ein echtes Secret-Muster');

  return { ready: blockers.length === 0, secretFree, blockers };
}

/** True, wenn `git remote -v`-Ausgabe ein Remote enthält. */
export function remoteConfigured(remotesOutput) {
  return String(remotesOutput || '').trim().length > 0;
}

// CLI: Report drucken, keine Secrets, kein Push/Remote-Change.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const yml = readFileSync(join(root, 'docs', 'ci-github-actions.yml'), 'utf8');
  const t = assessCiTemplate(yml);
  let remotes = '';
  try { remotes = execSync('git remote -v', { cwd: root, encoding: 'utf8' }); } catch { /* ignore */ }
  const hasRemote = remoteConfigured(remotes);

  // eslint-disable-next-line no-console
  console.log('O-02 Git-Remote/CI-Readiness (lokal)\n');
  console.log(`  CI-Vorlage        : ${t.ready ? 'READY' : 'BLOCKED'} (secret-free: ${t.secretFree})`);
  for (const b of t.blockers) console.log(`    ✖ ${b}`);
  console.log(`  Git-Remote        : ${hasRemote ? 'konfiguriert' : 'NICHT konfiguriert → Betreiber-Schritt'}`);
  console.log('\n  Betreiber (Damien-Go): privates Remote anlegen, `git remote add origin <privat>`,');
  console.log('  docs/ci-github-actions.yml → .github/workflows/ci.yml, Actions/Secrets aktivieren,');
  console.log('  erster Push/CI-Lauf nur mit ausdrücklicher Freigabe.');
  process.exit(t.ready ? 0 : 1);
}
