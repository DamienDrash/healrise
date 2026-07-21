/**
 * Konto-Löschlogik (P1.2, Finding R-02).
 *
 * Bewusst als eigenständiges Modul (nicht inline in strapi-server), damit die
 * Orchestrierung und der HTTP-Vertrag unit-testbar bleiben. Als `.ts` gepflegt,
 * damit der Strapi-Server-Build es zuverlässig nach `dist/` kompiliert — eine
 * handgeschriebene `.js` würde NICHT mitkopiert (Produktionsblocker:
 * `Cannot find module './account-deletion'` beim dist-Start).
 *
 * Ablauf, atomar in EINER DB-Transaktion (kein Teil-Zustand bei Fehlern):
 *  1. eigene Fortschrittsdaten (Art. 9 – Gesundheitsdaten) vollständig löschen,
 *  2. Käufe vom User ENTKOPPELN (user → null) statt zu löschen: Kaufbelege
 *     unterliegen der handels-/steuerrechtlichen Aufbewahrungspflicht
 *     (§ 147 AO, 10 Jahre) und dürfen nicht mitgelöscht werden,
 *  3. danach den User selbst löschen.
 */
const PROGRESS_UID = 'api::progress.progress-entry';
const PURCHASE_UID = 'api::purchase.purchase';
const USER_UID = 'plugin::users-permissions.user';

export async function deleteAccount(strapi: any, userId: any) {
  if (!userId) throw new Error('deleteAccount: userId erforderlich');

  return strapi.db.transaction(async () => {
    // 1. Fortschrittsdaten des Users restlos entfernen.
    await strapi.db.query(PROGRESS_UID).deleteMany({ where: { user: userId } });

    // 2. Käufe entkoppeln (NICHT löschen — Aufbewahrungspflicht bleibt gewahrt).
    await strapi.db.query(PURCHASE_UID).updateMany({
      where: { user: userId },
      data: { user: null },
    });

    // 3. Zuletzt den User selbst löschen.
    await strapi.db.query(USER_UID).delete({ where: { id: userId } });
  });
}

/**
 * Controller-Factory für DELETE /api/users/me. HTTP-Vertrag:
 *  - ohne Authentifizierung → ctx.unauthorized() (401),
 *  - Erfolg → HTTP 204 (No Content) mit leerem Body,
 *  - Fehler aus deleteAccount propagiert (Transaktion rollt zurück, non-2xx).
 */
export function makeDeleteMeController(strapi: any) {
  return async (ctx: any) => {
    const user = ctx.state && ctx.state.user;
    if (!user) return ctx.unauthorized();

    await deleteAccount(strapi, user.id);

    ctx.status = 204; // No Content
    ctx.body = null;  // leerer Body
  };
}
