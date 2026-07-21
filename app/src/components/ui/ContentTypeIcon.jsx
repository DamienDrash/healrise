export default function ContentTypeIcon({ type, size = 20, color = 'currentColor' }) {
  const s = { width: size, height: size };
  if (type === 'video') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" fill={color} fillOpacity="0.15"/>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
  if (type === 'tipp') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 4 12.9V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.1A7 7 0 0 1 12 2z"/>
      <line x1="9" y1="21" x2="15" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
  if (type === 'uebung') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 6.5 4 9l2.5 2.5M17.5 6.5 20 9l-2.5 2.5"/>
      <path d="M4 14h16M6 17l-2 3M18 17l2 3"/>
    </svg>
  );
  if (type === 'rezept') return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8 2 5 6 5 10c0 3.5 2 6.5 5 8v2h4v-2c3-1.5 5-4.5 5-8 0-4-3-8-7-8z"/>
      <line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/>
    </svg>
  );
  // default: guide / PDF
  return (
    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>
    </svg>
  );
}
