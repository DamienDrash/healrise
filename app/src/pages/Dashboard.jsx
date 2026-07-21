import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../context/ProgramsContext';
import { PLAN_META, CATEGORY_META } from '../utils/plans';
import { isAccessible, getCurrentWeek } from '../utils/programNav';
import ContentTypeIcon from '../components/ui/ContentTypeIcon';
import CategoryIcon from '../components/ui/CategoryIcon';
import { getCompletionRate, getActiveDays, isComplete } from '../utils/progress';
import Botanical from '../components/brand/Botanical';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Tag';
  if (h < 18) return 'Guten Nachmittag';
  return 'Guten Abend';
}

function ProgressRing({ percent, size = 64, stroke = 5 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)' }}
      role="img"
      aria-label={`Fortschritt: ${percent} Prozent`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cream-dark)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--gold)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ProgramCard({ program, locked, onClick }) {
  const catMeta = CATEGORY_META[program.category] ?? { label: program.category ?? 'Allgemein' };

  // Semantische Bedienbarkeit (Review F31): Tastatur + Screenreader
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={locked ? `${program.title} — gesperrt, Upgrade erforderlich` : program.title}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: locked ? 0.72 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 2px 12px rgba(30,35,33,0.06)',
        position: 'relative',
        minWidth: '155px',
      }}
      onMouseEnter={e => { if (!locked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(30,35,33,0.12)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(30,35,33,0.06)'; }}
    >
      {/* Thumbnail */}
      <div style={{
        height: '88px',
        background: 'var(--grad-thumb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <CategoryIcon category={program.category} size={32} color="rgba(253,252,250,0.92)" />
        {locked && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(30,35,33,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <LockIcon />
          </div>
        )}
        {!locked && (
          <div style={{ position: 'absolute', top: '6px', left: '7px' }}>
            <ContentTypeIcon type={program.content_type} />
          </div>
        )}
        {locked && (
          <span style={{
            position: 'absolute',
            bottom: '6px',
            right: '7px',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.52rem',
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(184,115,79,0.7)',
            padding: '0.12rem 0.4rem',
            borderRadius: '8px',
          }}>
            Upgrade
          </span>
        )}
      </div>

      <div style={{ padding: '0.6rem 0.7rem 0.75rem' }}>
        <span className="badge badge-gold" style={{ fontSize: '0.5rem', marginBottom: '0.3rem', display: 'inline-flex' }}>
          {catMeta.label}
        </span>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '0.82rem',
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.3,
          marginTop: '0.25rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {program.title}
        </p>
        {program.duration_minutes && (
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.58rem',
            color: 'var(--text-subtle)',
            marginTop: '0.3rem',
            letterSpacing: '0.03em',
          }}>
            {program.duration_minutes} Min.
          </p>
        )}
      </div>
    </div>
  );
}

const CATEGORIES = [
  { key: 'ernaehrung', ...CATEGORY_META.ernaehrung },
  { key: 'bewegung', ...CATEGORY_META.bewegung },
  { key: 'selfcare', ...CATEGORY_META.selfcare },
  { key: 'mindset', ...CATEGORY_META.mindset },
  { key: 'supplements', ...CATEGORY_META.supplements },
  { key: 'narbenpflege', ...CATEGORY_META.narbenpflege },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { programs, status, reload } = usePrograms();

  const userPlan = user?.plan ?? 'freebie';
  const planMeta = PLAN_META[userPlan] ?? PLAN_META.freebie;

  const accessibleSlugs = programs
    .filter(p => isAccessible(p, userPlan))
    .map(p => p.slug)
    .filter(Boolean);

  const completionPct = getCompletionRate(accessibleSlugs);
  const activeDays = getActiveDays();
  // Review F12: aus dem Fortschritt abgeleitet (vorher: immer „Woche 1")
  const currentWeek = getCurrentWeek(programs, userPlan, isComplete);

  const featuredPrograms = programs
    .filter(p => p.is_featured || (p.day === 1 && p.week === 1))
    .slice(0, 3);

  const handleProgramClick = (program) => {
    if (isAccessible(program, userPlan)) {
      navigate(`/programm/${program.slug}`);
    } else {
      navigate('/upgrade');
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Lädt…
        </p>
      </div>
    );
  }

  // Review F13: Fehler nicht als „Noch keine Programme" maskieren
  if (status === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
          Inhalte konnten nicht geladen werden
        </p>
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', fontStyle: 'italic', marginBottom: '1.25rem' }}>
          Prüfe deine Internetverbindung und versuche es erneut.
        </p>
        <button onClick={reload} className="btn btn-primary btn-sm">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '1rem' }}>
      {/* Hero Card */}
      <div style={{
        margin: '1rem 1rem 0',
        borderRadius: '16px',
        background: 'var(--grad-hero)',
        padding: '1.5rem 1.25rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }} className="paper-grain">
        {/* Botanischer Akzent (dekorativ) */}
        <Botanical variant="spray" size={150} style={{ position: 'absolute', right: '-26px', top: '-18px', color: 'var(--sage)', opacity: 0.55, transform: 'scaleY(-1)' }} />

        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.85, marginBottom: '0.2rem' }}>
          {getGreeting()},
        </p>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.5rem',
          fontWeight: 600,
          color: '#fff',
          marginBottom: '0.4rem',
          lineHeight: 1.2,
        }}>
          {user?.username ?? 'Willkommen'}
        </h2>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.68rem', letterSpacing: '0.05em', opacity: 0.82, marginBottom: '1.1rem' }}>
          Woche {currentWeek} · Plan: {planMeta.label}
        </p>
        <Link to="/plaene" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          background: '#fff',
          color: 'var(--gold-dark)',
          padding: '0.6rem 1.1rem',
          borderRadius: '8px',
          textDecoration: 'none',
          transition: 'opacity 0.2s',
        }}>
          Heute weitermachen →
        </Link>
      </div>

      {/* KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.6rem',
        margin: '1rem 1rem 0',
      }}>
        {/* Fortschritt */}
        <div className="card" style={{ padding: '0.9rem 0.6rem', textAlign: 'center', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: '0.4rem' }}>
            <ProgressRing percent={completionPct} size={56} stroke={5} />
            <span aria-hidden="true" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'var(--gold)',
            }}>
              {completionPct}%
            </span>
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.55rem', color: 'var(--text-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Fortschritt
          </p>
        </div>

        {/* Aktueller Plan */}
        <div className="card" style={{ padding: '0.9rem 0.6rem', textAlign: 'center', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.6rem',
            fontWeight: 600,
            color: 'var(--gold)',
            lineHeight: 1.3,
            marginBottom: '0.3rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {planMeta.label.replace('HEALRISE ', '')}
          </p>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.5rem', color: 'var(--text-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Dein Plan
          </p>
        </div>

        {/* Aktive Tage */}
        <div className="card" style={{ padding: '0.9rem 0.6rem', textAlign: 'center', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.4rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '0.1rem',
          }}>
            {activeDays}
          </p>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.55rem', color: 'var(--text-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Aktive Tage
          </p>
        </div>
      </div>

      {/* Heute empfohlen */}
      {featuredPrograms.length > 0 && (
        <section style={{ margin: '1.5rem 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', marginBottom: '0.75rem' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 500, color: 'var(--text)' }}>
              Heute empfohlen
            </h2>
            <Link to="/plaene" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem', color: 'var(--gold)', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Alle →
            </Link>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
            gap: '0.75rem',
            padding: '0 1rem',
          }}>
            {featuredPrograms.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                locked={!isAccessible(p, userPlan)}
                onClick={() => handleProgramClick(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Category Shortcuts */}
      <section style={{ margin: '1.5rem 0 0' }}>
        <div style={{ padding: '0 1rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 500, color: 'var(--text)' }}>
            Kategorien
          </h2>
        </div>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0 1rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '4px',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => navigate(`/plaene?cat=${cat.key}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.68rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '0.45rem 0.9rem',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'background 0.18s, color 0.18s, border-color 0.18s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span aria-hidden="true">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Empty state (nur bei erfolgreicher, leerer Antwort — Review F13) */}
      {programs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
          <div aria-hidden="true" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.5 }}>☀️</div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text)' }}>
            Noch keine Programme
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', marginTop: '0.4rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            Deine Inhalte werden bald verfügbar sein.
          </p>
        </div>
      )}

      {/* Upgrade teaser */}
      {userPlan === 'freebie' && programs.length > 0 && (
        <div style={{
          margin: '1.5rem 1rem 0',
          background: 'linear-gradient(135deg, rgba(184,115,79,0.1) 0%, rgba(156,94,61,0.16) 100%)',
          border: '1px solid rgba(184,115,79,0.28)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.35rem' }}>
            Mehr Inhalte freischalten
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: '0.9rem' }}>
            Erhalte Zugang zu allen Plänen, Videos und exklusiven Inhalten.
          </p>
          <Link to="/upgrade" className="btn btn-primary btn-sm">
            Jetzt upgraden
          </Link>
        </div>
      )}
    </div>
  );
}
