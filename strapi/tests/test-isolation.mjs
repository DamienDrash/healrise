// D-02: Harte Test-Isolation für den schreibenden API-Test-Runner.
//
// strapi/tests/api-tests.mjs registriert User (buyer_*, iso_*), ändert das
// Testuser-Passwort und erzeugt Progress/Purchases — es MUTIERT die Ziel-DB.
// Ohne Schutz läuft es per Default gegen die Prod-Strapi-Instanz (127.0.0.1:9130)
// und verschmutzt/verändert Produktionsdaten (Ursache von D-01).
//
// Dieser Guard blockiert Läufe, solange keine BEWUSSTE Test-Freigabe gesetzt ist,
// und schützt den Produktions-Port zusätzlich. Fehlermeldungen enthalten nur
// Flags/Port — niemals Secrets.

const PROD_PORTS = ['9130']; // Strapi-Prod-Port (server-eins)

/**
 * Wirft, wenn der API-Test-Runner nicht sicher isoliert ist.
 *  - `API_TESTS_ALLOW=1` ist Pflicht (bewusste Bestätigung: Wegwerf-/Test-Instanz).
 *  - Der Produktions-Port ist zusätzlich gesperrt, außer `API_TESTS_ALLOW_PROD_PORT=1`.
 */
export function assertApiTestIsolation({ env = process.env, base = '' } = {}) {
  if (env.API_TESTS_ALLOW !== '1') {
    throw new Error(
      'API-Tests blockiert (D-02): Diese Tests SCHREIBEN in die Ziel-DB '
        + '(User/Progress/Passwort). Nur gegen eine Wegwerf-/Test-Strapi-Instanz laufen '
        + 'lassen und dann bewusst API_TESTS_ALLOW=1 setzen — NIE gegen Prod. '
        + 'Siehe docs/production-readiness-roadmap.md (5.1).',
    );
  }

  let port = '';
  try { port = new URL(base).port; } catch { /* ungültige/relative base → kein Port */ }

  if (PROD_PORTS.includes(port) && env.API_TESTS_ALLOW_PROD_PORT !== '1') {
    throw new Error(
      `API-Tests-Ziel nutzt den Produktions-Port :${port} (D-02) — verweigert. `
        + 'Nutze eine separate Test-Instanz/Port. Nur bei einer bewusst disponiblen '
        + 'Instanz: API_TESTS_ALLOW_PROD_PORT=1 zusätzlich setzen.',
    );
  }
}
