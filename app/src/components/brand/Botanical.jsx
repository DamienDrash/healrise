/**
 * Dekorative botanische Elemente (rein vektoriell, kein Bildimport).
 * Nutzt `currentColor` → Farbe & Deckkraft steuert der Aufrufer via `color`/`opacity`.
 *
 *  variant="sprig"  feine, verzweigte Botanik (Trockenblumen-Anmutung) — Empty-States, Hero
 *  variant="spray"  Papercraft-Blätter mit Copper-Bogen — Hero-Ecken
 */
export default function Botanical({ variant = 'sprig', size = 120, style, className }) {
  const base = { display: 'block', ...style };

  if (variant === 'spray') {
    return (
      <svg
        width={size} height={size * 0.82} viewBox="0 0 160 130" fill="none"
        aria-hidden="true" className={className} style={base}
      >
        {/* Copper-Bogen */}
        <path d="M96 96 A34 34 0 0 1 150 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
        {/* Papercraft-Blätter */}
        <path d="M70 122 Q118 96 128 40 Q84 74 70 122 Z" fill="currentColor" opacity="0.16" />
        <path d="M74 122 Q40 92 44 44 Q80 72 74 122 Z" fill="currentColor" opacity="0.13" />
        <path d="M72 124 Q96 78 92 30 Q66 74 72 124 Z" fill="currentColor" opacity="0.22" />
      </svg>
    );
  }

  // sprig — feine Linienbotanik
  return (
    <svg
      width={size * 0.8} height={size} viewBox="0 0 100 120" fill="none"
      aria-hidden="true" className={className} style={base}
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
    >
      <path d="M50 118 C44 92 52 74 47 54 S44 22 46 6" />
      <path d="M49 96 C40 92 34 90 30 86" />
      <path d="M50 92 C58 89 63 86 67 82" />
      <path d="M49 74 C41 71 36 69 32 65" />
      <path d="M50 70 C57 67 61 64 65 60" />
      <path d="M47 52 C40 49 36 47 33 43" />
      <path d="M48 48 C54 45 58 42 61 38" />
      <path d="M46 30 C41 27 38 25 35 21" />
      <path d="M46 26 C51 23 54 20 57 16" />
      <g fill="currentColor" stroke="none">
        <circle cx="29" cy="85" r="2" /><circle cx="68" cy="81" r="2" />
        <circle cx="31" cy="64" r="2" /><circle cx="66" cy="59" r="2" />
        <circle cx="32" cy="42" r="2" /><circle cx="62" cy="37" r="2" />
        <circle cx="34" cy="20" r="1.9" /><circle cx="58" cy="15" r="1.9" />
        <circle cx="46" cy="6" r="2.3" />
      </g>
    </svg>
  );
}
