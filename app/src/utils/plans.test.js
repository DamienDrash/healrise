import { describe, it, expect } from 'vitest';
import { canAccess, planIndex, PLAN_ORDER, PLAN_META, CATEGORY_META } from './plans';

describe('canAccess (Plan-Matrix, Review T2.1.4)', () => {
  // Vollständige Matrix: Zeile = User-Plan, Spalte = benötigter Plan
  const matrix = [
    // userPlan      freebie  h7     h14    premium
    ['freebie',      [true,  false, false, false]],
    ['healrise7',    [true,  true,  false, false]],
    ['healrise14',   [true,  true,  true,  false]],
    ['premium',      [true,  true,  true,  true]],
  ];

  for (const [userPlan, expected] of matrix) {
    for (let i = 0; i < PLAN_ORDER.length; i++) {
      const required = PLAN_ORDER[i];
      it(`${userPlan} × ${required} → ${expected[i]}`, () => {
        expect(canAccess(userPlan, required)).toBe(expected[i]);
      });
    }
  }

  it('null/undefined User-Plan wird als freebie behandelt', () => {
    expect(canAccess(null, 'freebie')).toBe(true);
    expect(canAccess(undefined, 'healrise7')).toBe(false);
  });

  it('null/undefined benötigter Plan wird als freebie behandelt', () => {
    expect(canAccess('freebie', null)).toBe(true);
    expect(canAccess('freebie', undefined)).toBe(true);
  });

  it('unbekannter User-Plan hat keinen Zugriff auf bezahlte Inhalte', () => {
    expect(canAccess('hacker-plan', 'healrise7')).toBe(false);
  });
});

describe('planIndex', () => {
  it('liefert die Position in der Hierarchie', () => {
    expect(planIndex('freebie')).toBe(0);
    expect(planIndex('premium')).toBe(3);
    expect(planIndex(null)).toBe(0);
  });
});

describe('PLAN_META', () => {
  it('hat Metadaten für jeden Plan der Hierarchie', () => {
    for (const plan of PLAN_ORDER) {
      expect(PLAN_META[plan]).toBeDefined();
      expect(PLAN_META[plan].label).toBeTruthy();
    }
  });
});

describe('CATEGORY_META', () => {
  it('Key „narbenpflege" bleibt stabil (URLs/CMS-Kategorie), Label ist „Hautpflege"', () => {
    // Slug-/Key-Stabilität: bestehende Programm-Referenzen dürfen nicht brechen
    expect(CATEGORY_META.narbenpflege).toBeDefined();
    expect(CATEGORY_META.narbenpflege.label).toBe('Hautpflege');
  });

  it('kein sichtbares Label enthält Wund-/Narbenbezug (Claims-Richtlinie)', () => {
    for (const [key, meta] of Object.entries(CATEGORY_META)) {
      expect(meta.label, `Label von „${key}"`).not.toMatch(/Narbe/i);
    }
  });
});
