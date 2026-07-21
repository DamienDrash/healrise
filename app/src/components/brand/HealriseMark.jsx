import { useId } from 'react';

/**
 * HEALRISE Bildmarke — Papercraft-Blüte (Copper-Ring · Sage-Blätter · Ivory-Petalen · Samen-Schale).
 * Rein vektoriell (SVG/CSS), keine externen Assets. Gradient-IDs sind pro Instanz eindeutig (useId),
 * damit mehrere Marken auf einer Seite nicht kollidieren.
 *
 * @param {number} size   Kantenlänge in px
 * @param {'plain'|'framed'} variant  plain = freigestellt, framed = mit gerundeter Ivory-Fläche
 * @param {boolean} decorative  true → aria-hidden (Logo-Lockup liefert den Namen)
 */
export default function HealriseMark({ size = 40, variant = 'plain', decorative = true, title = 'HEALRISE' }) {
  const uid = useId().replace(/:/g, '');
  const cu = `cu-${uid}`;
  const pt = `pt-${uid}`;
  const a11y = decorative
    ? { 'aria-hidden': 'true' }
    : { role: 'img', 'aria-label': title };

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" {...a11y} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={cu} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#D89A78" />
          <stop offset="0.55" stopColor="#B8734F" />
          <stop offset="1" stopColor="#9C5E3D" />
        </linearGradient>
        <linearGradient id={pt} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#FDFCFA" />
          <stop offset="1" stopColor="#EFE9DE" />
        </linearGradient>
      </defs>

      {variant === 'framed' && (
        <>
          <rect x="4" y="4" width="112" height="112" rx="26" fill="#F6F3EF" />
          <rect x="4.75" y="4.75" width="110.5" height="110.5" rx="25.25" fill="none" stroke="#E7E1D7" strokeWidth="1.5" />
        </>
      )}

      {/* Copper-Ring */}
      <circle cx="60" cy="37" r="16.5" fill="none" stroke={`url(#${cu})`} strokeWidth="7" />

      {/* Sage-Blätter */}
      <g>
        <path d="M59 83 Q83.6 67.2 86 38 Q65.6 56.4 59 83 Z" fill="#97A995" />
        <path d="M61 83 Q36.4 67.2 34 38 Q54.4 56.4 61 83 Z" fill="#97A995" />
        <path d="M59 84 Q72.8 60.3 71 33 Q59.2 57.1 59 84 Z" fill="#A7B7A6" />
        <path d="M61 84 Q47.2 60.3 49 33 Q60.8 57.1 61 84 Z" fill="#A7B7A6" />
      </g>

      {/* Ivory-Petalen */}
      <g stroke="#E4DDD0" strokeWidth="0.8" strokeLinejoin="round">
        <path d="M60 85 Q72.2 56 66.5 25 Q55.8 54.2 60 85 Z" fill={`url(#${pt})`} />
        <path d="M60 85 Q47.8 56 53.5 25 Q64.2 54.2 60 85 Z" fill={`url(#${pt})`} />
      </g>
      <path d="M60 84 Q61.6 55 66 26" fill="none" stroke="#E9E2D6" strokeWidth="0.7" />
      <path d="M60 84 Q58.4 55 54 26" fill="none" stroke="#E9E2D6" strokeWidth="0.7" />

      {/* Ivory-Schale mit Samen-Punkten */}
      <path d="M41 82 Q60 90 79 82 L77 88 Q60 99 43 88 Z" fill="#F1EBE0" stroke="#E0D8C9" strokeWidth="0.8" />
      <path d="M44 83.5 Q60 90.5 76 83.5" fill="none" stroke="#FBF7F0" strokeWidth="0.9" />
      <g fill="#B7AE9F">
        <circle cx="55" cy="88" r="1.05" /><circle cx="60" cy="87.2" r="1.05" /><circle cx="65" cy="88" r="1.05" />
        <circle cx="57.5" cy="91" r="1.05" /><circle cx="62.5" cy="91" r="1.05" />
      </g>
    </svg>
  );
}
