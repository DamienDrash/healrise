import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProgress, markComplete, markIncomplete, isComplete,
  getCompletedSlugs, getCompletionRate, getActiveDays,
} from './progress';

beforeEach(() => localStorage.clear());

describe('progress (localStorage)', () => {
  it('startet leer', () => {
    expect(getProgress()).toEqual({});
    expect(getCompletedSlugs()).toEqual([]);
  });

  it('markComplete/isComplete/markIncomplete Roundtrip', () => {
    markComplete('tag-1');
    expect(isComplete('tag-1')).toBe(true);
    expect(isComplete('tag-2')).toBe(false);
    markIncomplete('tag-1');
    expect(isComplete('tag-1')).toBe(false);
  });

  it('getCompletionRate rechnet in Prozent, gerundet', () => {
    expect(getCompletionRate([])).toBe(0);
    expect(getCompletionRate(null)).toBe(0);
    markComplete('a');
    expect(getCompletionRate(['a', 'b', 'c'])).toBe(33);
    markComplete('b');
    markComplete('c');
    expect(getCompletionRate(['a', 'b', 'c'])).toBe(100);
  });

  it('getActiveDays zählt eindeutige Tage', () => {
    markComplete('a');
    markComplete('b'); // gleicher Tag
    expect(getActiveDays()).toBe(1);
  });

  it('übersteht kaputtes JSON im Storage', () => {
    localStorage.setItem('healrise_progress', '{kaputt');
    expect(getProgress()).toEqual({});
  });
});
