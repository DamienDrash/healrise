import { describe, it, expect } from 'vitest';
import { findNextProgram, getCurrentWeek, isAccessible } from './programNav';

const P = (slug, week, day, order = 0, extra = {}) => ({
  slug, week, day, order, plan_required: 'freebie', locked: null, ...extra,
});

describe('isAccessible', () => {
  it('Server-Flag hat Vorrang vor Client-Berechnung', () => {
    expect(isAccessible(P('a', 1, 1, 0, { locked: true, plan_required: 'freebie' }), 'premium')).toBe(false);
    expect(isAccessible(P('a', 1, 1, 0, { locked: false, plan_required: 'premium' }), 'freebie')).toBe(true);
  });
  it('fällt ohne Server-Flag auf canAccess zurück', () => {
    expect(isAccessible(P('a', 1, 1, 0, { plan_required: 'premium' }), 'freebie')).toBe(false);
    expect(isAccessible(P('a', 1, 1, 0, { plan_required: 'freebie' }), 'freebie')).toBe(true);
  });
});

describe('findNextProgram (Review F24/F36)', () => {
  const course = [
    P('w1d1a', 1, 1, 1),
    P('w1d1b', 1, 1, 2),
    P('w1d3', 1, 3, 1),
    P('w2d1', 2, 1, 1, { plan_required: 'premium', locked: true }),
    P('w2d2', 2, 2, 1),
  ];

  it('nimmt zuerst den nächsten Eintrag am selben Tag (order)', () => {
    expect(findNextProgram(course, course[0], 'freebie')?.slug).toBe('w1d1b');
  });
  it('springt danach zum nächsten Tag', () => {
    expect(findNextProgram(course, course[1], 'freebie')?.slug).toBe('w1d3');
  });
  it('überspringt gesperrte Inhalte', () => {
    expect(findNextProgram(course, course[2], 'freebie')?.slug).toBe('w2d2');
  });
  it('liefert null am Kursende', () => {
    expect(findNextProgram(course, course[4], 'freebie')).toBeNull();
  });
  it('liefert null ohne Programm/Liste', () => {
    expect(findNextProgram([], course[0], 'freebie')).toBeNull();
    expect(findNextProgram(course, null, 'freebie')).toBeNull();
  });
});

describe('getCurrentWeek (Review F12)', () => {
  const progs = [P('a', 1, 1), P('b', 2, 1), P('c', 3, 1)];

  it('erste Woche mit offenen Inhalten', () => {
    const done = new Set(['a']);
    expect(getCurrentWeek(progs, 'freebie', s => done.has(s))).toBe(2);
  });
  it('alles erledigt → letzte Woche', () => {
    expect(getCurrentWeek(progs, 'freebie', () => true)).toBe(3);
  });
  it('keine Wochenstruktur → 1', () => {
    expect(getCurrentWeek([P('x', null, null)], 'freebie', () => false)).toBe(1);
  });
  it('gesperrte Wochen zählen nicht als offen', () => {
    const locked = [P('a', 1, 1), P('b', 2, 1, 0, { locked: true })];
    expect(getCurrentWeek(locked, 'freebie', s => s === 'a')).toBe(2); // Fallback: letzte
  });
});
