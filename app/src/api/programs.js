import client from './client';

/**
 * Normalisiert Strapi-v4/v5-Antworten in EIN flaches Format (Review F23:
 * das `x ?? attributes?.x`-Muster war ~40× über die Seiten verstreut).
 */
export function normalizeProgram(raw) {
  if (!raw) return null;
  const a = raw.attributes ?? raw;
  return {
    id: raw.id,
    documentId: raw.documentId ?? a.documentId ?? null,
    slug: a.slug ?? null,
    title: a.title ?? 'Programm',
    description: a.description ?? '',
    body: a.body ?? null,
    plan_required: a.plan_required ?? 'freebie',
    category: a.category ?? 'allgemein',
    content_type: a.content_type ?? 'guide',
    day: a.day ?? null,
    week: a.week ?? null,
    order: a.order ?? 0,
    duration_minutes: a.duration_minutes ?? null,
    is_featured: Boolean(a.is_featured),
    thumbnail: a.thumbnail ?? null,
    video_url: a.video_url ?? null,
    media_source: a.media_source ?? 'none',
    media_url: a.media_url ?? null,
    media_asset: a.media_asset ?? null,
    media_embed_id: a.media_embed_id ?? null,
    media_title: a.media_title ?? null,
    media_duration_seconds: a.media_duration_seconds ?? null,
    // Serverseitiges Gating-Flag (null = alte API ohne Flag)
    locked: a.locked ?? raw.locked ?? null,
  };
}

const PAGE_SIZE = 100;

/**
 * Lädt ALLE veröffentlichten Programme (paginiert nach, Review F20) und
 * liefert sie normalisiert. Der frühere `publishedAt`-Pseudo-Filter war
 * wirkungslos und ist entfernt (Review F15) — Strapi liefert per Default
 * nur veröffentlichte Einträge.
 */
export async function getPrograms() {
  const all = [];
  let page = 1;
  let pageCount;
  do {
    const { data } = await client.get('/api/programs', {
      params: {
        'pagination[page]': page,
        'pagination[pageSize]': PAGE_SIZE,
        'sort[0]': 'week:asc',
        'sort[1]': 'day:asc',
        'sort[2]': 'order:asc',
        // Strapi 5 rejects explicit media keys here ("Invalid key media_asset");
        // wildcard populate returns both media fields and keeps the content load stable.
        populate: '*',
      },
    });
    all.push(...(data?.data ?? []).map(normalizeProgram));
    pageCount = data?.meta?.pagination?.pageCount ?? 1;
    page += 1;
  } while (page <= pageCount);
  return all;
}

export async function getProgram(slug) {
  const { data } = await client.get('/api/programs', {
    params: {
      'filters[slug][$eq]': slug,
      populate: '*',
    },
  });
  return normalizeProgram(data?.data?.[0] ?? null);
}
