import { factories } from '@strapi/strapi';
import { stripLockedFields } from '../services/program';

/**
 * Serverseitiges Content-Gating (Goldstandard T8, Review B1/B2):
 * Alle veröffentlichten Programme sind sichtbar (Metadaten für die
 * Paywall-UX), aber `body`/`video_url` werden ohne ausreichenden Plan
 * genullt und `locked: true` gesetzt. Strapi 5 liefert flache Objekte —
 * kein `attributes`-Wrapper (das war der Bug des alten Controllers).
 */

/** Stellt sicher, dass eine fields-Selektion `plan_required` nicht ausblendet. */
function ensurePlanRequiredField(ctx: any) {
  const fields = (ctx.query as any)?.fields;
  if (Array.isArray(fields) && !fields.includes('plan_required')) {
    (ctx.query as any).fields = [...fields, 'plan_required'];
  }
}

export default factories.createCoreController('api::program.program', () => ({
  async find(ctx) {
    ensurePlanRequiredField(ctx);
    const userPlan = ctx.state.user?.plan || 'freebie';
    const { data, meta } = await super.find(ctx);
    return { data: (data || []).map((p: any) => stripLockedFields(p, userPlan)), meta };
  },

  async findOne(ctx) {
    ensurePlanRequiredField(ctx);
    const userPlan = ctx.state.user?.plan || 'freebie';
    const result = await super.findOne(ctx);
    if (!result?.data) return result;
    return { ...result, data: stripLockedFields(result.data, userPlan) };
  },
}));
