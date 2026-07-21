import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// api/progress mocken — die Sync-Logik selbst wird getestet (Plan T5.1.6)
vi.mock('../api/progress', () => ({
  fetchProgress: vi.fn(),
  pushProgress: vi.fn(),
}));

import { fetchProgress, pushProgress } from '../api/progress';
import {
  initProgressSync, clearProgressSession, markComplete, markIncomplete,
  isComplete, getProgress, flushPending,
} from './progress';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fetchProgress.mockResolvedValue({});
  pushProgress.mockResolvedValue({});
});

afterEach(() => {
  clearProgressSession();
});

describe('initProgressSync', () => {
  it('übernimmt den Server-Stand in den lokalen Cache', async () => {
    fetchProgress.mockResolvedValue({ 'tag-1': '2026-07-01T10:00:00.000Z' });
    await initProgressSync(42);
    expect(isComplete('tag-1')).toBe(true);
    expect(isComplete('tag-2')).toBe(false);
  });

  it('löscht alte geräteweite (nicht user-gebundene) Daten (Review F6)', async () => {
    localStorage.setItem('healrise_progress', JSON.stringify({ fremd: '2026-01-01' }));
    await initProgressSync(42);
    expect(localStorage.getItem('healrise_progress')).toBeNull();
    expect(isComplete('fremd')).toBe(false);
  });

  it('Pending-Ops überlagern den Server-Stand und werden gepusht', async () => {
    localStorage.setItem('healrise_progress_pending_u42', JSON.stringify({
      offline: { completed: true, completed_at: '2026-07-02T08:00:00.000Z' },
    }));
    fetchProgress.mockResolvedValue({ 'tag-1': '2026-07-01T10:00:00.000Z' });
    await initProgressSync(42);
    expect(isComplete('offline')).toBe(true);
    expect(isComplete('tag-1')).toBe(true);
    expect(pushProgress).toHaveBeenCalledWith('offline', true, '2026-07-02T08:00:00.000Z');
  });

  it('offline (fetch wirft): lokaler Cache bleibt erhalten', async () => {
    localStorage.setItem('healrise_progress_u42', JSON.stringify({ lokal: '2026-07-01' }));
    fetchProgress.mockRejectedValue(new Error('offline'));
    await initProgressSync(42);
    expect(isComplete('lokal')).toBe(true);
  });
});

describe('markComplete/markIncomplete mit Session', () => {
  it('schreibt lokal und pusht zum Server', async () => {
    await initProgressSync(42);
    markComplete('uebung-1');
    expect(isComplete('uebung-1')).toBe(true);
    await vi.waitFor(() => expect(pushProgress).toHaveBeenCalledWith('uebung-1', true, expect.any(String)));
  });

  it('Push-Fehler: Op bleibt in der Queue und wird bei flushPending nachgeholt', async () => {
    await initProgressSync(42);
    pushProgress.mockRejectedValueOnce(new Error('offline'));
    markComplete('uebung-2');
    await vi.waitFor(() => expect(pushProgress).toHaveBeenCalled());
    // Queue enthält die Op noch
    const pending = JSON.parse(localStorage.getItem('healrise_progress_pending_u42'));
    expect(pending['uebung-2']).toBeTruthy();
    // Reconnect
    pushProgress.mockResolvedValue({});
    await flushPending();
    const after = JSON.parse(localStorage.getItem('healrise_progress_pending_u42') || '{}');
    expect(after['uebung-2']).toBeUndefined();
  });

  it('markIncomplete entfernt lokal und pusht completed=false', async () => {
    fetchProgress.mockResolvedValue({ x: '2026-07-01T10:00:00.000Z' });
    await initProgressSync(42);
    markIncomplete('x');
    expect(isComplete('x')).toBe(false);
    await vi.waitFor(() => expect(pushProgress).toHaveBeenCalledWith('x', false, null));
  });
});

describe('clearProgressSession (Review F6)', () => {
  it('löscht Cache und Queue beim Logout', async () => {
    await initProgressSync(42);
    markComplete('geheim');
    clearProgressSession();
    expect(localStorage.getItem('healrise_progress_u42')).toBeNull();
    expect(localStorage.getItem('healrise_progress_pending_u42')).toBeNull();
    expect(getProgress()).toEqual({});
  });
});
