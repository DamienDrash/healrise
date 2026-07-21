#!/usr/bin/env node
// D-01: Read-only Dry-Run-Plan für die Prod-Testdaten-Bereinigung.
//
// WICHTIG: Dieses Modul FÜHRT NICHTS AUS und verbindet sich mit KEINER DB.
// Es dokumentiert nur, WELCHE Testdaten-Muster ein Cleanup identifizieren würde,
// und liefert ausschließlich LESENDE SQL (SELECT/COUNT). Die eigentliche
// Bereinigung ist ein Operator-Schritt mit explizitem Damien-Go (Betreiber-Blocker):
// erst die SELECTs read-only ausführen, Ergebnis prüfen, dann — separat und bewusst —
// ein Löschskript mit Backup/Transaktion. Kein DELETE/UPDATE liegt hier vor.
//
// Nutzung (druckt nur den Plan, kein DB-Zugriff):
//   node scripts/db-cleanup-plan.mjs

// Bekannte Testdaten-Muster aus Audit D-01 (rein lesende Identifikation).
export const CLEANUP_TARGETS = [
  {
    id: 'seed-testuser',
    desc: 'Seed-Testuser mit im Code sichtbarem Default-Passwort (nur Entwicklung)',
    identify: "SELECT id, username, email FROM up_users WHERE username = 'Testuser'",
  },
  {
    id: 'test-artifact-users',
    desc: 'Test-Artefakt-User aus API-Testläufen (buyer_*, iso_*)',
    identify: "SELECT id, username FROM up_users WHERE username LIKE 'buyer\\_%' OR username LIKE 'iso\\_%'",
  },
  {
    id: 'cs-test-purchases',
    desc: 'Purchases aus Fake-Webhook-Tests (stripe_session_id cs_test_*)',
    identify: "SELECT count(*) AS n FROM purchases WHERE stripe_session_id LIKE 'cs_test%'",
  },
  {
    id: 'fake-premium-users',
    desc: 'User, die per Fake-Webhook auf premium gehoben wurden (zur Sichtung)',
    identify: "SELECT id, username, plan FROM up_users WHERE plan = 'premium'",
  },
];

/**
 * Baut den Dry-Run-Plan. `mode` ist immer 'dry-run'; jeder Schritt ist
 * REPORT_ONLY. Echte Löschung erfordert bewusstes DB_CLEANUP_CONFIRM=1 + Damien-Go
 * und ist NICHT Teil dieses Moduls.
 */
export function buildCleanupPlan() {
  return {
    mode: 'dry-run',
    requiresExplicitGo: 'DB_CLEANUP_CONFIRM=1 + Damien-Go (separates Löschskript mit Backup)',
    note: 'Nur lesende Identifikation. Keine Mutation. Reihenfolge bei echtem Cleanup: '
      + 'Backup → Purchases entkoppeln/prüfen (Aufbewahrung §147 AO!) → Test-User löschen.',
    steps: CLEANUP_TARGETS.map((t) => ({ ...t, action: 'REPORT_ONLY' })),
  };
}

// CLI: druckt den Plan als Text — KEIN DB-Zugriff, keine Secrets.
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const plan = buildCleanupPlan();
  // eslint-disable-next-line no-console
  console.log('D-01 Testdaten-Cleanup — DRY-RUN-PLAN (führt nichts aus)\n');
  console.log(`Freigabe nötig: ${plan.requiresExplicitGo}`);
  console.log(`Hinweis: ${plan.note}\n`);
  for (const s of plan.steps) {
    console.log(`• [${s.action}] ${s.id} — ${s.desc}`);
    console.log(`    ${s.identify}`);
  }
}
