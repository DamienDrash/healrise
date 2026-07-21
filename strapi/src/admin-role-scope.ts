/**
 * P4.3 / L-03/L-04: Scope-Definition für die reduzierte Strapi-Admin-Rolle
 * „HEALRISE Betrieb" (Damien als NICHT-Super-Admin).
 *
 * Reine Datendefinition + Validator — KEIN Strapi-Import, node-testbar. Die
 * eigentliche (best-effort) Anwendung im Bootstrap liegt in admin-role-seed.ts.
 *
 * Zweck (Audit L-03/L-04): Damien braucht im CMS nur „Kunden" (App-Nutzer +
 * ihre Käufe) und „Produkte" (Programme). Alles andere — Settings, Media
 * Library (Upload), Content-Type Builder, Admin-/Rollen-Verwaltung — bleibt
 * ihm verwehrt. Im Strapi-Admin folgt das Ausblenden der Menüs automatisch aus
 * den (fehlenden) Permissions: Content-Manager zeigt nur Content-Types mit
 * read-Permission; Settings/Media erscheinen nur mit ihren admin::/upload-
 * Permissions; der Content-Type Builder ist in Produktion ohnehin deaktiviert.
 */

/** Rollen-Metadaten. `code` ist stabil (Idempotenz-Schlüssel) und NICHT der
 * Super-Admin-Code — diese Rolle ist bewusst unprivilegiert. */
export const BETRIEB_ROLE = {
  name: 'HEALRISE Betrieb',
  code: 'healrise-betrieb',
  description:
    'Kundenbetreuung & Produktpflege. Nur Kunden (Nutzer/Käufe) und Produkte (Programme); ' +
    'kein Super-Admin, keine Settings, keine Media Library, kein Content-Type Builder.',
} as const;

export const SUPER_ADMIN_CODE = 'strapi-super-admin';

// Content-Types, die Damien sieht.
export const SUBJECT_USER = 'plugin::users-permissions.user'; // Kunden
export const SUBJECT_PURCHASE = 'api::purchase.purchase'; // Kunden-Käufe
export const SUBJECT_PROGRAM = 'api::program.program'; // Produkte

export const ALLOWED_SUBJECTS = [SUBJECT_USER, SUBJECT_PURCHASE, SUBJECT_PROGRAM];

const CM = 'plugin::content-manager.explorer';

export interface AdminPermission {
  action: string;
  subject: string;
}

/**
 * Der erlaubte Permission-Satz (Content-Manager, pro Subject):
 *  - Kunden/Nutzer: lesen + bearbeiten (kein Löschen — Kontolöschung läuft über
 *    den dedizierten Nutzer-Flow, nicht über den Admin).
 *  - Kunden/Käufe: nur lesen (Käufe sind Belege, nicht editierbar).
 *  - Produkte/Programme: volles CRUD + veröffentlichen (Draft&Publish).
 */
export const SCOPED_PERMISSIONS: AdminPermission[] = [
  { action: `${CM}.read`, subject: SUBJECT_USER },
  { action: `${CM}.update`, subject: SUBJECT_USER },
  { action: `${CM}.read`, subject: SUBJECT_PURCHASE },
  { action: `${CM}.create`, subject: SUBJECT_PROGRAM },
  { action: `${CM}.read`, subject: SUBJECT_PROGRAM },
  { action: `${CM}.update`, subject: SUBJECT_PROGRAM },
  { action: `${CM}.delete`, subject: SUBJECT_PROGRAM },
  { action: `${CM}.publish`, subject: SUBJECT_PROGRAM },
];

/**
 * Verbotene Action-Präfixe: alles, was Damien Super-Admin-/Betriebsrechte gäbe.
 * admin::* = Settings/Admin-Nutzer/Rollen/API-Tokens/Webhooks; content-type-
 * builder = Schema-Änderungen; upload = Media Library; email/u-p settings =
 * Provider-/Auth-Konfiguration.
 */
export const FORBIDDEN_ACTION_PREFIXES = [
  'admin::',
  'plugin::content-type-builder',
  'plugin::upload',
  'plugin::email',
  'plugin::users-permissions.roles',
  'plugin::users-permissions.providers',
  'plugin::users-permissions.advanced-settings',
  'plugin::users-permissions.email-templates',
];

export interface ScopeValidation {
  ok: boolean;
  violations: string[];
}

/**
 * Prüft einen Permission-Satz gegen die Betriebs-Rolle-Regeln: nur Content-
 * Manager-Explorer-Actions, nur erlaubte Subjects, kein verbotenes Präfix.
 * Reine Funktion für Guard UND Laufzeit-Selbstschutz vor dem Seed.
 */
export function validateAdminRoleScope(perms: AdminPermission[]): ScopeValidation {
  const violations: string[] = [];
  for (const p of perms) {
    if (FORBIDDEN_ACTION_PREFIXES.some((pre) => p.action.startsWith(pre))) {
      violations.push(`verbotene Action: ${p.action}`);
    }
    if (!p.action.startsWith(`${CM}.`)) {
      violations.push(`nicht-Content-Manager-Action: ${p.action}`);
    }
    if (!ALLOWED_SUBJECTS.includes(p.subject)) {
      violations.push(`nicht erlaubtes Subject: ${p.subject}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

export interface SeedResult {
  applied: boolean;
  created: boolean;
  reason?: string;
}

/**
 * P4.3-Seed: legt die Rolle „HEALRISE Betrieb" beim Bootstrap best-effort und
 * idempotent an und weist ihr den Scope zu. Wirft NIE (ein Fehler darf den
 * Strapi-Start nicht verhindern) und legt KEINE Admin-Nutzer an — Damien
 * einzuladen/ihm die Rolle zuzuweisen bleibt ein GUI-/Betreiber-Schritt
 * (docs/admin-roles.md). Im selben Leaf-Modul wie die Scope-Definition, damit
 * es ohne relative Imports node-testbar bleibt und der Scope die einzige Quelle
 * der Wahrheit ist.
 *
 * Nutzt den Admin-Role-Service (`admin::role`): `findOne` (Idempotenz),
 * `create` (Rolle anlegen), `assignPermissions` (Scope; selbst diff-idempotent).
 */
export async function applyBetriebAdminRole(strapi: any): Promise<SeedResult> {
  try {
    // Selbstschutz: nie einen Scope zuweisen, der verbotene Rechte enthielte.
    const check = validateAdminRoleScope(SCOPED_PERMISSIONS);
    if (!check.ok) {
      strapi.log?.error?.(`admin-role-seed: Scope-Verletzung, Seed abgebrochen: ${check.violations.join(', ')}`);
      return { applied: false, created: false, reason: 'scope-violation' };
    }

    const roleService = strapi.service?.('admin::role');
    if (!roleService?.create || !roleService?.assignPermissions) {
      strapi.log?.warn?.('admin-role-seed: Admin-Role-Service nicht verfügbar — übersprungen (kein Abbruch).');
      return { applied: false, created: false, reason: 'no-service' };
    }

    // Idempotenz: existiert die Rolle (per stabilem code) bereits?
    let role = (await roleService.findOne?.({ where: { code: BETRIEB_ROLE.code } })) || null;
    let created = false;
    if (!role) {
      role = await roleService.create({
        name: BETRIEB_ROLE.name,
        code: BETRIEB_ROLE.code,
        description: BETRIEB_ROLE.description,
      });
      created = true;
      strapi.log?.info?.(`admin-role-seed: Rolle „${BETRIEB_ROLE.name}" angelegt (${BETRIEB_ROLE.code}).`);
    }

    // Scope (neu) zuweisen — assignPermissions ist idempotent (diff-basiert).
    await roleService.assignPermissions(role.id, SCOPED_PERMISSIONS);
    return { applied: true, created };
  } catch (err) {
    strapi.log?.error?.(`admin-role-seed: fehlgeschlagen (best effort, kein Abbruch): ${err}`);
    return { applied: false, created: false, reason: 'error' };
  }
}
