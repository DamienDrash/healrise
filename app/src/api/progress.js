import client from './client';

/** GET /api/progress → { "<slug>": "<ISO-Datum>" } (nur eigene Einträge) */
export async function fetchProgress() {
  const { data } = await client.get('/api/progress');
  return data?.data ?? {};
}

export async function pushProgress(slug, completed, completedAt) {
  const { data } = await client.put(`/api/progress/${encodeURIComponent(slug)}`, {
    completed,
    completed_at: completedAt,
  });
  return data;
}
