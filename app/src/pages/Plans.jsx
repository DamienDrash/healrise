import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../context/ProgramsContext';
import { PLAN_META, CATEGORY_META } from '../utils/plans';
import { isAccessible } from '../utils/programNav';
import ContentTypeIconComp from '../components/ui/ContentTypeIcon';
import { isComplete, markComplete, markIncomplete } from '../utils/progress';

const DAY_NAMES = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function getDayName(day) {
  return DAY_NAMES[day] ?? `Tag ${day}`;
}

function LockSVG() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckCircle({ done, onClick, locked }) {
  if (locked) {
    return (
      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <LockSVG />
      </div>
    );
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={done ? 'Als nicht erledigt markieren' : 'Als erledigt markieren'}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: done ? 'none' : '2px solid var(--border)',
        background: done ? 'var(--gold)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s, border-color 0.2s',
        padding: 0,
      }}
    >
      {done && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function ContentIcon({ type }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(184,115,79,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <ContentTypeIconComp type={type} size={17} color="var(--gold)" />
    </div>
  );
}

function ContentItem({ program, userPlan, onToggle, onNavigate }) {
  const { slug, title, category } = program;
  const duration = program.duration_minutes;
  const contentType = program.content_type;
  const reqPlan = program.plan_required;
  const locked = !isAccessible(program, userPlan);
  const catMeta = CATEGORY_META[category] ?? { label: category ?? '' };
  const planMeta = PLAN_META[reqPlan] ?? PLAN_META.freebie;
  const done = slug ? isComplete(slug) : false;

  const handleRowClick = () => {
    onNavigate(slug); // Detailseite zeigt bei gesperrten Inhalten die Upgrade-Karte
  };

  const handleRowKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  };

  const handleToggle = () => {
    if (!slug || locked) return;
    if (done) markIncomplete(slug);
    else markComplete(slug);
    onToggle();
  };

  return (
    <div
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      role="button"
      tabIndex={0}
      aria-label={locked ? `${title} — gesperrt, Upgrade erforderlich` : title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: done ? 'rgba(184,115,79,0.05)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        opacity: locked ? 0.6 : 1,
        transition: 'background 0.15s',
        minHeight: '60px',
      }}
      onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'rgba(184,115,79,0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = done ? 'rgba(184,115,79,0.05)' : 'transparent'; }}
    >
      <ContentIcon type={contentType} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "'Lora', serif",
          fontSize: '0.88rem',
          fontWeight: done ? 400 : 500,
          color: done ? 'var(--text-muted)' : 'var(--text)',
          lineHeight: 1.3,
          textDecoration: done ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
          {catMeta.label && (
            <span className="badge badge-gold" style={{ fontSize: '0.48rem' }}>{catMeta.label}</span>
          )}
          {locked && (
            <span className="badge badge-locked" style={{ fontSize: '0.48rem' }}>{planMeta.label}</span>
          )}
          {locked && (
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.52rem',
              fontWeight: 600,
              color: 'var(--gold)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Upgrade
            </span>
          )}
        </div>
      </div>

      {duration && (
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: 'var(--text-subtle)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          marginRight: '0.5rem',
        }}>
          {duration}'
        </span>
      )}

      <CheckCircle done={done} onClick={handleToggle} locked={locked} />
    </div>
  );
}

function DaySection({ day, week, programs, userPlan, onToggle, onNavigate, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const doneCount = programs.filter(p => p.slug && isComplete(p.slug)).length;
  const total = programs.length;

  const dayLabel = day ? `Tag ${day} · ${getDayName(((week - 1) * 7 + day - 1) % 7 + 1)}` : 'Allgemein';

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem',
          background: 'var(--surface)',
          border: 'none',
          borderTop: '1px solid var(--border)',
          borderBottom: open ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
            {dayLabel}
          </span>
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.58rem',
            fontWeight: 500,
            background: doneCount === total ? 'rgba(62,125,90,0.12)' : 'rgba(184,115,79,0.12)',
            color: doneCount === total ? 'var(--success)' : 'var(--gold)',
            padding: '0.15rem 0.5rem',
            borderRadius: '20px',
          }}>
            {doneCount}/{total} erledigt
          </span>
        </div>
        <svg
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-subtle)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {programs.map(p => (
            <ContentItem
              key={p.id}
              program={p}
              userPlan={userPlan}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Plans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { programs, status, reload } = usePrograms();
  const [selectedWeek, setSelectedWeek] = useState(null); // explizite Nutzerwahl
  const [tick, setTick] = useState(0); // Re-Render + Neuberechnung nach Progress-Toggle

  const userPlan = user?.plan ?? 'freebie';
  const catFilter = searchParams.get('cat');
  const loading = status === 'loading' || status === 'idle';

  const filtered = useMemo(() => {
    if (!catFilter) return programs;
    return programs.filter(p => p.category === catFilter);
  }, [programs, catFilter]);

  // Group by week
  const byWeek = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      const w = p.week ?? 0;
      if (!map[w]) map[w] = [];
      map[w].push(p);
    });
    return map;
  }, [filtered]);

  const weeks = useMemo(
    () => Object.keys(byWeek).map(Number).sort((a, b) => a - b),
    [byWeek]
  );
  const hasWeekStructure = weeks.some(w => w > 0);

  // Default-Woche: erste Woche mit unerledigten, zugänglichen Inhalten —
  // als abgeleiteter Wert statt Effect (Review F9: Kategorie-Filter konnte
  // auf eine nicht existierende Woche zeigen und leere Ansichten erzeugen).
  const defaultWeek = useMemo(() => {
    if (weeks.length === 0) return 1;
    const w = weeks.find(wk => {
      const progs = byWeek[wk] ?? [];
      return progs.some(p => isAccessible(p, userPlan) && p.slug && !isComplete(p.slug));
    });
    return w ?? weeks[0];
    // `tick`: Neuberechnung, wenn sich der Fortschritt ändert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byWeek, weeks, userPlan, tick]);

  // Ungültige (z. B. weggefilterte) Nutzerwahl fällt auf die Default-Woche zurück.
  const activeWeek = selectedWeek != null && weeks.includes(selectedWeek) ? selectedWeek : defaultWeek;

  // Group programs within a week by day
  const getDayGroups = (weekNum) => {
    const progs = byWeek[weekNum] ?? [];
    const byDay = {};
    progs.forEach(p => {
      const d = p.day ?? 0;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(p);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([day, items]) => ({ day: Number(day), items }));
  };

  const handleNavigate = (slug) => {
    if (slug) navigate(`/programm/${slug}`);
  };

  const handleToggle = () => setTick(t => t + 1);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Lädt…
        </p>
      </div>
    );
  }

  // Review F13: Fehler nicht als leeren Plan maskieren
  if (status === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
          Inhalte konnten nicht geladen werden
        </p>
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', fontStyle: 'italic', marginBottom: '1.25rem' }}>
          Prüfe deine Internetverbindung und versuche es erneut.
        </p>
        <button onClick={reload} className="btn btn-primary btn-sm">Erneut versuchen</button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Week selector */}
      {hasWeekStructure && weeks.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.85rem 1rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 56, // Höhe des fixierten App-Headers (Review F18)
          zIndex: 10,
        }}>
          {weeks.filter(w => w > 0).map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                padding: '0.45rem 1rem',
                borderRadius: '24px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                background: activeWeek === w ? 'var(--gold)' : 'var(--cream)',
                color: activeWeek === w ? '#fff' : 'var(--text-muted)',
                transition: 'background 0.18s, color 0.18s',
              }}
            >
              Woche {w}
            </button>
          ))}
        </div>
      )}

      {/* Category filter indicator */}
      {catFilter && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 1rem',
          background: 'rgba(184,115,79,0.08)',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Filter: {CATEGORY_META[catFilter]?.label ?? catFilter}
          </span>
          <button
            onClick={() => navigate('/plaene')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontFamily: "'Poppins', sans-serif", fontSize: '0.65rem', fontWeight: 600 }}
          >
            ✕ Zurücksetzen
          </button>
        </div>
      )}

      {/* Content */}
      {hasWeekStructure ? (
        <div>
          {getDayGroups(activeWeek).map(({ day, items }, idx) => {
            const firstIncomplete = items.findIndex(p =>
              isAccessible(p, userPlan) && p.slug && !isComplete(p.slug)
            );
            return (
              <DaySection
                key={`${activeWeek}-${day}`}
                day={day || null}
                week={activeWeek}
                programs={items}
                userPlan={userPlan}
                onToggle={handleToggle}
                onNavigate={handleNavigate}
                defaultOpen={idx === 0 || firstIncomplete >= 0}
              />
            );
          })}
          {getDayGroups(activeWeek).length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', fontStyle: 'italic' }}>
                Keine Inhalte für diese Woche.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Flat list grouped by category */
        <div>
          {Object.entries(
            filtered.reduce((acc, p) => {
              const cat = p.category ?? 'allgemein';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(p);
              return acc;
            }, {})
          ).map(([cat, items]) => {
            const catMeta = CATEGORY_META[cat] ?? { label: cat, icon: '📋' };
            return (
              <div key={cat} style={{ marginBottom: '0.25rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1rem 0.5rem',
                  background: 'var(--cream)',
                }}>
                  <span style={{ fontSize: '0.9rem' }}>{catMeta.icon}</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {catMeta.label}
                  </span>
                </div>
                <div>
                  {items.map(p => (
                    <ContentItem
                      key={p.id}
                      program={p}
                      userPlan={userPlan}
                      onToggle={handleToggle}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {programs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.5 }}>📋</div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: 'var(--text)' }}>
            Noch keine Inhalte verfügbar
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            Deine Inhalte werden bald freigeschaltet.
          </p>
        </div>
      )}
    </div>
  );
}
