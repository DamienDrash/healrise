import { fetchProgress, pushProgress } from '../api/progress';

/**
 * Fortschritt: serverseitig pro User (Plan E5, Review F14), localStorage nur
 * als Offline-Cache mit User-Namespace (Review F6: Daten dürfen weder Logout
 * überleben noch dem nächsten Nutzer angezeigt werden — Gesundheitsbezug!).
 *
 * Offline-Verhalten: Toggles landen sofort im lokalen Cache und in einer
 * Pending-Queue; die Queue wird bei Reconnect bzw. beim nächsten Sync geleert.
 */
const LEGACY_KEY = 'healrise_progress';

let userId = null;
let consentGranted = false; // Art.-9-Einwilligung (Plan T7.2.2)

const cacheKey = () => (userId ? `healrise_progress_u${userId}` : LEGACY_KEY);
const pendingKey = () => (userId ? `healrise_progress_pending_u${userId}` : `${LEGACY_KEY}_pending`);

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function write(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

// ── Lese-API (synchron, wie bisher von allen Seiten genutzt) ──────────────

export function getProgress() {
  return read(cacheKey());
}

export function isComplete(slug) {
  return Boolean(getProgress()[slug]);
}

export function getCompletedSlugs() {
  return Object.keys(getProgress());
}

export function getCompletionRate(slugs) {
  if (!slugs || slugs.length === 0) return 0;
  const progress = getProgress();
  const done = slugs.filter(s => Boolean(progress[s])).length;
  return Math.round((done / slugs.length) * 100);
}

export function getActiveDays() {
  const progress = getProgress();
  const days = new Set();
  Object.values(progress).forEach(iso => {
    if (iso) {
      const d = new Date(iso);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });
  return days.size;
}

// ── Schreib-API: optimistisch lokal + Server-Queue ────────────────────────

function enqueue(slug, completed, completedAt) {
  if (!userId) return; // ohne Session kein Server-Sync (z. B. Unit-Tests)
  const pending = read(pendingKey());
  pending[slug] = { completed, completed_at: completedAt };
  write(pendingKey(), pending);
  void flushPending();
}

export function hasTrackingConsent() {
  return consentGranted;
}

export function markComplete(slug) {
  if (userId && !consentGranted) return; // ohne Einwilligung kein Tracking
  const iso = new Date().toISOString();
  const progress = getProgress();
  progress[slug] = iso;
  write(cacheKey(), progress);
  enqueue(slug, true, iso);
}

export function markIncomplete(slug) {
  if (userId && !consentGranted) return;
  const progress = getProgress();
  delete progress[slug];
  write(cacheKey(), progress);
  enqueue(slug, false, null);
}

// ── Sync-Lifecycle ────────────────────────────────────────────────────────

export async function flushPending() {
  if (!userId || !navigator.onLine) return;
  const key = pendingKey();
  const pending = read(key);
  for (const [slug, op] of Object.entries(pending)) {
    try {
      await pushProgress(slug, op.completed, op.completed_at);
      const current = read(key);
      delete current[slug];
      write(key, current);
    } catch {
      break; // Server nicht erreichbar — Rest bleibt in der Queue
    }
  }
}

/**
 * Beim Login/App-Start: Server-Stand ziehen, noch ungesyncte lokale Ops
 * darüberlegen, Queue flushen. Offline bleibt der lokale Cache maßgeblich.
 */
export async function initProgressSync(uid, consent = true) {
  userId = uid;
  consentGranted = consent;
  // Alte geräteweite (nicht user-gebundene) Daten verwerfen — sie könnten
  // von einer anderen Person auf diesem Gerät stammen (Review F6).
  localStorage.removeItem(LEGACY_KEY);
  if (!consent) {
    // Ohne Einwilligung: nichts ziehen, lokale Reste entfernen
    localStorage.removeItem(cacheKey());
    localStorage.removeItem(pendingKey());
    return;
  }
  try {
    const server = await fetchProgress();
    const pending = read(pendingKey());
    const merged = { ...server };
    for (const [slug, op] of Object.entries(pending)) {
      if (op.completed) merged[slug] = op.completed_at;
      else delete merged[slug];
    }
    write(cacheKey(), merged);
    void flushPending();
  } catch {
    // offline: lokaler Cache bleibt gültig, Queue wartet auf Reconnect
  }
}

/** Beim Logout: alle lokalen Fortschrittsdaten löschen (Review F6). */
export function clearProgressSession() {
  if (userId) {
    localStorage.removeItem(cacheKey());
    localStorage.removeItem(pendingKey());
  }
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(`${LEGACY_KEY}_pending`);
  userId = null;
  consentGranted = false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushPending());
}
