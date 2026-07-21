/**
 * Fortschritt pro User (Plan E5, Review F14/F6): Einträge sind strikt an
 * ctx.state.user gebunden — kein Core-Router, damit niemals fremde Einträge
 * gelistet oder geschrieben werden können (Gesundheitsdaten, Art. 9).
 */
const UID = 'api::progress.progress-entry';

export default {
  /** GET /api/progress → { "<slug>": "<completed_at ISO>" } für den eigenen User */
  async find(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const entries = await strapi.db.query(UID).findMany({
      where: { user: user.id },
      select: ['program_slug', 'completed_at'],
    });

    const map: Record<string, string> = {};
    for (const e of entries) map[e.program_slug] = e.completed_at;
    ctx.body = { data: map };
  },

  /** PUT /api/progress/:slug  Body: { completed: boolean } → Upsert/Delete */
  async toggle(ctx: any) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Ohne dokumentierte Art.-9-Einwilligung kein Tracking (Plan T7.2.2)
    if (!user.health_consent_at) {
      return ctx.forbidden('Fortschritts-Tracking erfordert deine Einwilligung (Konto → Datenschutz).');
    }

    const slug = ctx.params.slug;
    if (!slug || typeof slug !== 'string' || slug.length > 255) {
      return ctx.badRequest('Ungültiger Slug');
    }
    const completed = Boolean(ctx.request.body?.completed);

    const existing = await strapi.db.query(UID).findOne({
      where: { user: user.id, program_slug: slug },
    });

    if (completed) {
      const completedAt = ctx.request.body?.completed_at || new Date().toISOString();
      if (existing) {
        await strapi.db.query(UID).update({
          where: { id: existing.id },
          data: { completed_at: completedAt },
        });
      } else {
        await strapi.db.query(UID).create({
          data: { user: user.id, program_slug: slug, completed_at: completedAt },
        });
      }
      ctx.body = { data: { program_slug: slug, completed: true } };
    } else {
      if (existing) {
        await strapi.db.query(UID).delete({ where: { id: existing.id } });
      }
      ctx.body = { data: { program_slug: slug, completed: false } };
    }
  },
};
