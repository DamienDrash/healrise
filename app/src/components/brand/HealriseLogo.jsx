import HealriseMark from './HealriseMark';

/**
 * HEALRISE Wort-Bild-Marke. Die Wortmarke ist echter Text (Playfair Display),
 * damit sie scharf skaliert und für Screenreader lesbar ist; die Bildmarke ist dekorativ.
 *
 * @param {'full'|'horizontal'} variant  full = gestapelt (Auth/Splash), horizontal = Kopfzeile
 * @param {number} markSize
 * @param {number} wordmarkSize  Schriftgröße der Wortmarke in rem
 * @param {boolean} tagline  „SUPPORT · RENEW · RISE" anzeigen
 */
export default function HealriseLogo({
  variant = 'horizontal',
  markSize,
  wordmarkSize,
  tagline = variant === 'full',
  framed = false,
}) {
  const isFull = variant === 'full';
  const mSize = markSize ?? (isFull ? 72 : 34);
  const wSize = wordmarkSize ?? (isFull ? 2.1 : 1.15);

  const wordmark = (
    <span
      style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: 600,
        fontSize: `${wSize}rem`,
        letterSpacing: isFull ? '0.2em' : '0.14em',
        color: 'var(--ink)',
        lineHeight: 1,
        // optische Kompensation des rechten Trackings
        paddingLeft: isFull ? '0.2em' : '0.14em',
      }}
    >
      HEALRISE
    </span>
  );

  const taglineEl = tagline && (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        marginTop: isFull ? '0.7rem' : '0.2rem',
      }}
    >
      {isFull && <span style={{ width: 22, height: 1, background: 'var(--copper)' }} aria-hidden="true" />}
      <span
        className="eyebrow"
        style={{ letterSpacing: '0.24em', fontSize: isFull ? '0.64rem' : '0.5rem' }}
      >
        Support · Renew · Rise
      </span>
      {isFull && <span style={{ width: 22, height: 1, background: 'var(--copper)' }} aria-hidden="true" />}
    </div>
  );

  if (isFull) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <HealriseMark size={mSize} variant={framed ? 'framed' : 'plain'} />
        <div style={{ marginTop: '0.85rem' }}>{wordmark}</div>
        {taglineEl}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <HealriseMark size={mSize} variant={framed ? 'framed' : 'plain'} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {wordmark}
        {taglineEl}
      </div>
    </div>
  );
}
