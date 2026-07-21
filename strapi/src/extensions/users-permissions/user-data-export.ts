/**
 * DSGVO-Selbstauskunft (Art. 15 Auskunftsrecht / Art. 20 Portabilität):
 * trägt alle zu einem Nutzer gespeicherten personenbezogenen Daten maschinen-
 * lesbar (JSON) zusammen — Account, Käufe (Art.-9-relevant), Fortschritt.
 *
 * Reine Logik + Controller-Factory; KEIN relativer Import → node-testbar
 * (scripts/tests/user-data-export.test.mjs). Auth-Secrets (Passwort-Hash, Reset-/
 * Bestätigungs-Token) werden NIE exportiert.
 */

const USER_UID = 'plugin::users-permissions.user';
const PURCHASE_UID = 'api::purchase.purchase';
const PROGRESS_UID = 'api::progress.progress-entry';

/** Sicherheits-Artefakte, die niemals in eine Auskunft gehören. */
export const SECRET_USER_FIELDS = ['password', 'resetPasswordToken', 'confirmationToken'];

/** Entfernt Auth-Secrets aus einem User-Objekt; alle übrigen (personenbezogenen)
 *  Felder bleiben erhalten (Art.-15-Vollständigkeit). */
export function sanitizeUserForExport(user: any): any {
  const out: any = {};
  for (const [key, value] of Object.entries(user || {})) {
    if (SECRET_USER_FIELDS.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Entfernt die redundante user-Relation aus einem Kind-Datensatz. */
function stripUserRelation(row: any): any {
  const { user, ...rest } = row || {};
  return rest;
}

/**
 * Baut den vollständigen Datenexport für einen Nutzer. Gibt null zurück, wenn der
 * Nutzer nicht existiert. Nur die EIGENEN Datensätze (gefiltert über user = id).
 */
export async function buildUserDataExport(strapi: any, userId: number | string): Promise<any> {
  const user = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
  if (!user) return null;

  const purchases = (await strapi.db.query(PURCHASE_UID).findMany({ where: { user: userId } })) || [];
  const progress = (await strapi.db.query(PROGRESS_UID).findMany({ where: { user: userId } })) || [];

  return {
    account: sanitizeUserForExport(user),
    purchases: purchases.map(stripUserRelation),
    progress: progress.map(stripUserRelation),
  };
}

/**
 * Controller-Factory für `GET /users/me/export` (nur der eingeloggte Nutzer,
 * niemals fremde Daten). Liefert die Auskunft als JSON-Download.
 */
export function makeExportMeController(strapi: any) {
  return async (ctx: any) => {
    const authUser = ctx.state.user;
    if (!authUser) return ctx.unauthorized();

    const data = await buildUserDataExport(strapi, authUser.id);
    if (!data) return ctx.notFound();

    ctx.set('Content-Disposition', 'attachment; filename="healrise-datenexport.json"');
    ctx.set('Content-Type', 'application/json; charset=utf-8');
    ctx.body = {
      hinweis: 'DSGVO-Selbstauskunft (Art. 15/20). Enthält alle zu deinem Konto gespeicherten Daten.',
      exportedAt: new Date().toISOString(),
      ...data,
    };
  };
}
