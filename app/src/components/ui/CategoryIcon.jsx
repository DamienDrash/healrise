// Strichfarbe via CSS-Custom-Property (Default: Copper-Akzent der HEALRISE-CI);
// auf dunklen/Sage-Flächen `color`-Prop überschreiben.
const icons = {
  ernaehrung: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12M12 12C12 8 9 5 5 5s-3 4 0 5 7 2 7 2z"/><path d="M12 12c0-4 3-7 7-7s3 4 0 5-7 2-7 2z"/>
    </svg>
  ),
  bewegung: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5"/><path d="M8 12l4-5 4 5-2 3 2 5H8l2-5z"/>
    </svg>
  ),
  selfcare: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ),
  mindset: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2"/><path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/>
    </svg>
  ),
  supplements: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 3h3L15 7H9zM9 7l-1.5 4h9L15 7zM7.5 11l-2 9h13l-2-9z"/>
    </svg>
  ),
  narbenpflege: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 8v4l3 3"/>
    </svg>
  ),
};

export default function CategoryIcon({ category, size = 20, color = 'var(--gold)' }) {
  const fn = icons[category] ?? icons.selfcare;
  return <span style={{ color, display: 'inline-flex', lineHeight: 0 }}>{fn(size)}</span>;
}
