/**
 * A11y-Prüf-Helfer (WCAG 1.3.1 / 2.4.6): meldet Heading-Hierarchie-Verstöße in
 * einem gerenderten DOM-Container. Erwartet genau EIN <h1> und keine in
 * Dokumentreihenfolge übersprungene Ebene (jede Überschrift höchstens +1 tiefer
 * als die vorige; Rücksprünge nach oben sind erlaubt).
 *
 * Reine DOM-Funktion (kein React) → in jeder jsdom-Testumgebung nutzbar.
 * Rückgabe: Array von { type, message } (leer = konform).
 */
export function getHeadingViolations(container) {
  const headings = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const levels = headings.map((h) => Number(h.tagName[1]));
  const violations = [];

  const h1count = levels.filter((l) => l === 1).length;
  if (h1count === 0) {
    violations.push({ type: 'missing-h1', message: 'Kein <h1> vorhanden' });
  } else if (h1count > 1) {
    violations.push({ type: 'multiple-h1', message: `${h1count} <h1> gefunden (genau eines erwartet)` });
  }

  let prev = 0;
  headings.forEach((h, i) => {
    const lvl = levels[i];
    if (prev !== 0 && lvl > prev + 1) {
      const label = (h.textContent || '').trim().slice(0, 40);
      violations.push({ type: 'skipped-level', message: `Sprung von h${prev} auf h${lvl} („${label}")` });
    }
    prev = lvl;
  });

  return violations;
}
