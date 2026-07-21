import { canAccess } from './plans';

/** Ist das (normalisierte) Programm für den Plan zugänglich? Server-Flag hat Vorrang. */
export function isAccessible(program, userPlan) {
  if (!program) return false;
  if (program.locked != null) return !program.locked;
  return canAccess(userPlan, program.plan_required);
}

/**
 * Nächstes zugängliches Programm nach `current` in der Kurs-Reihenfolge
 * (Woche → Tag → Order). Extrahiert aus ProgramDetail (Review F24/F36),
 * damit die Logik testbar ist.
 */
export function findNextProgram(allPrograms, current, userPlan) {
  if (!current || !allPrograms?.length) return null;
  const cw = current.week ?? 0;
  const cd = current.day ?? 0;
  const co = current.order ?? 0;

  const accessible = allPrograms.filter(
    p => isAccessible(p, userPlan) && p.slug && p.slug !== current.slug
  );

  const sameDay = accessible
    .filter(p => (p.week ?? 0) === cw && (p.day ?? 0) === cd && (p.order ?? 0) > co)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (sameDay.length > 0) return sameDay[0];

  return accessible
    .filter(p => {
      const w = p.week ?? 0;
      const d = p.day ?? 0;
      return w > cw || (w === cw && d > cd);
    })
    .sort((a, b) => {
      const aw = a.week ?? 0, bw = b.week ?? 0;
      const ad = a.day ?? 0, bd = b.day ?? 0;
      return aw !== bw ? aw - bw : ad - bd;
    })[0] ?? null;
}

/**
 * Aktuelle Kurs-Woche des Users: erste Woche mit unerledigten, zugänglichen
 * Inhalten; sind alle erledigt, die letzte Woche (Review F12 — die alte
 * Rechnung `ceil(max(day)/7)` ergab immer 1).
 */
export function getCurrentWeek(programs, userPlan, isCompleteFn) {
  const weeks = [...new Set(programs.map(p => p.week).filter(w => w > 0))].sort((a, b) => a - b);
  if (weeks.length === 0) return 1;
  const open = weeks.find(w =>
    programs.some(p => p.week === w && isAccessible(p, userPlan) && p.slug && !isCompleteFn(p.slug))
  );
  return open ?? weeks[weeks.length - 1];
}
