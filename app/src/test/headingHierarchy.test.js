import { describe, it, expect } from 'vitest';
import { getHeadingViolations } from './headingHierarchy';

/**
 * A11y (WCAG 1.3.1 „Info and Relationships" / 2.4.6 „Headings and Labels"):
 * reine Prüf-Funktion für die Heading-Hierarchie eines gerenderten Containers —
 * genau EIN <h1>, keine übersprungene Ebene. Synthetisches DOM, kein React.
 */
function container(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('getHeadingViolations', () => {
  it('valide Hierarchie (h1 → h2 → h3) → keine Verstöße', () => {
    expect(getHeadingViolations(container('<h1>A</h1><h2>B</h2><h3>C</h3>'))).toEqual([]);
  });

  it('Rücksprung auf höhere Ebene ist erlaubt (h1→h2→h3→h2)', () => {
    expect(getHeadingViolations(container('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>'))).toEqual([]);
  });

  it('kein <h1> → missing-h1', () => {
    const v = getHeadingViolations(container('<h2>B</h2>'));
    expect(v.some((x) => x.type === 'missing-h1')).toBe(true);
  });

  it('zwei <h1> → multiple-h1', () => {
    const v = getHeadingViolations(container('<h1>A</h1><h1>B</h1>'));
    expect(v.some((x) => x.type === 'multiple-h1')).toBe(true);
  });

  it('übersprungene Ebene (h1 → h3) → skipped-level', () => {
    const v = getHeadingViolations(container('<h1>A</h1><h3>C</h3>'));
    expect(v.some((x) => x.type === 'skipped-level')).toBe(true);
  });

  it('leerer Container → missing-h1 (keine Überschrift)', () => {
    expect(getHeadingViolations(container('')).some((x) => x.type === 'missing-h1')).toBe(true);
  });
});
