import { factories } from '@strapi/strapi';

/**
 * Eine Quelle der Wahrheit für die Plan-Hierarchie im Backend (Plan T2.1.3).
 * Muss mit app/src/utils/plans.js übereinstimmen.
 */
export const PLAN_ORDER = ['freebie', 'healrise7', 'healrise14', 'premium'];

/** Felder, die nur mit ausreichendem Plan ausgeliefert werden (Goldstandard T8). */
export const PROTECTED_FIELDS = ['body', 'video_url', 'media_url', 'media_asset', 'media_embed_id'];

export function canAccess(userPlan?: string | null, planRequired?: string | null): boolean {
  const userIdx = PLAN_ORDER.indexOf(userPlan || 'freebie');
  const reqIdx = PLAN_ORDER.indexOf(planRequired || 'freebie');
  return userIdx >= reqIdx;
}

/**
 * Liefert das Programm mit `locked`-Flag; bei fehlender Berechtigung werden
 * die geschützten Felder genullt statt das Programm wegzufiltern — so bleibt
 * die Paywall-UX (Lock-Overlay, Upgrade-Pfad) möglich (Review B1/B2).
 *
 * Fail-closed: Ist `plan_required` nicht im Objekt (z. B. durch eine
 * clientseitige fields-Selektion ausgeblendet), gilt der Inhalt als gesperrt.
 */
export function stripLockedFields(program: Record<string, any>, userPlan?: string | null) {
  if (!program) return program;
  const known = Object.prototype.hasOwnProperty.call(program, 'plan_required');
  const locked = known ? !canAccess(userPlan, program.plan_required) : true;
  const result: Record<string, any> = { ...program, locked };
  if (locked) {
    for (const field of PROTECTED_FIELDS) {
      if (field in result) result[field] = null;
    }
  }
  return result;
}

export default factories.createCoreService('api::program.program');
