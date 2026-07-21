import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrograms } from '../context/ProgramsContext';
import { PLAN_META, CATEGORY_META, CONTENT_TYPE_META } from '../utils/plans';
import { isAccessible, findNextProgram } from '../utils/programNav';
import { isComplete, markComplete, markIncomplete } from '../utils/progress';
import { sanitizeHtml } from '../utils/sanitize';
import Botanical from '../components/brand/Botanical';

function getMediaAssetUrl(asset) {
  const data = asset?.data ?? asset;
  const attrs = data?.attributes ?? data;
  return attrs?.url ?? null;
}

function getYouTubeId(program) {
  const explicit = (program.media_embed_id || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(explicit)) return explicit;
  try {
    const url = new URL(program.media_url || program.video_url || '');
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com' || url.hostname === 'm.youtube.com') {
      const id = url.searchParams.get('v') || url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1];
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

function MediaSection({ program }) {
  const assetUrl = getMediaAssetUrl(program.media_asset);
  const mediaUrl = program.media_url || assetUrl || null;
  const title = program.media_title || 'Medieninhalt';
  const youtubeId = program.media_source === 'youtube' ? getYouTubeId(program) : null;
  const isDownload = ['pdf', 'checklist'].includes(program.content_type) || ['strapi', 'minio'].includes(program.media_source);

  if (!mediaUrl && !program.media_embed_id) return null;

  return (
    <section style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px' }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
        {title}
      </h2>
      {youtubeId ? (
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden', borderRadius: '10px', background: '#000' }}>
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      ) : mediaUrl ? (
        <a className="btn btn-outline" href={mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex' }}>
          {isDownload ? 'Medium öffnen / herunterladen' : 'Medium öffnen'}
        </a>
      ) : (
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Medieninhalt ist hinterlegt, aber noch nicht direkt verfügbar.
        </p>
      )}
      {program.media_duration_seconds && (
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Dauer: {Math.round(program.media_duration_seconds / 60)} Min.
        </p>
      )}
    </section>
  );
}


export default function ProgramDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Zentraler Cache statt Doppel-Fetch pro Detailseite (Review F24)
  const { programs, status, reload } = usePrograms();
  const [, setDoneVersion] = useState(0); // Re-Render nach Progress-Toggle

  const userPlan = user?.plan ?? 'freebie';
  const trackingAllowed = Boolean(user?.health_consent_at);
  const program = programs.find(p => p.slug === slug) ?? null;
  const loading = status === 'loading' || status === 'idle';
  const done = slug ? isComplete(slug) : false;

  const handleToggleDone = useCallback(() => {
    if (!slug) return;
    if (isComplete(slug)) markIncomplete(slug);
    else markComplete(slug);
    setDoneVersion(v => v + 1);
  }, [slug]);

  // Review F19: Deep-Link/PWA-Start hat keine App-History — Fallback statt
  // aus der App heraus zu navigieren.
  const goBack = useCallback(() => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/plaene', { replace: true });
  }, [navigate]);

  const nextProgram = findNextProgram(programs, program, userPlan);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  if (status === 'error' || !program) {
    return (
      <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text)' }}>
          {status === 'error' ? 'Programm konnte nicht geladen werden.' : 'Programm nicht gefunden.'}
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginTop: '1rem' }}>
          {status === 'error' && (
            <button onClick={reload} className="btn btn-primary">
              Erneut versuchen
            </button>
          )}
          <button onClick={goBack} className="btn btn-outline">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  const accessible = isAccessible(program, userPlan);
  const catMeta = CATEGORY_META[program.category] ?? { label: program.category ?? 'Allgemein', icon: '📋' };
  const typeMeta = CONTENT_TYPE_META[program.content_type] ?? { label: 'Inhalt', icon: '📋' };
  const planMeta = PLAN_META[program.plan_required] ?? PLAN_META.freebie;

  return (
    <div className="fade-in">
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={goBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            padding: '0.4rem 0',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurück
        </button>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span className="badge badge-gold" style={{ fontSize: '0.5rem' }}>{typeMeta.icon} {typeMeta.label}</span>
          {!accessible && (
            <span className="badge badge-locked" style={{ fontSize: '0.5rem' }}>{planMeta.label}</span>
          )}
        </div>
      </div>

      {/* Hero banner */}
      <div style={{
        background: 'var(--grad-hero)',
        padding: '2rem 1.25rem 1.75rem',
        position: 'relative',
        overflow: 'hidden',
      }} className="paper-grain">
        <Botanical variant="spray" size={190} style={{ position: 'absolute', right: '-34px', bottom: '-40px', color: 'var(--sage)', opacity: 0.5 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.58rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.18)',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
            }}>
              {catMeta.icon} {catMeta.label}
            </span>
            {program.week && program.day && (
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.58rem',
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.14)',
                padding: '0.2rem 0.6rem',
                borderRadius: '20px',
              }}>
                Woche {program.week} · Tag {program.day}
              </span>
            )}
          </div>

          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.55rem',
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.25,
            marginBottom: '0.75rem',
          }}>
            {program.title}
          </h2>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {program.duration_minutes && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.68rem', color: 'rgba(255,255,255,0.88)' }}>
                  {program.duration_minutes} Min.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {!accessible ? (
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.5rem' }}>
              Inhalt gesperrt
            </p>
            <p style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Dieser Inhalt ist nur für {planMeta.label}-Mitglieder zugänglich.
            </p>
            <button
              onClick={() => navigate(`/upgrade?plan=${program.plan_required}`)}
              className="btn btn-primary"
            >
              Jetzt upgraden
            </button>
          </div>
        ) : (
          <>
            {program.description && !program.body && (
              <p style={{
                fontFamily: "'Lora', serif",
                fontSize: '0.95rem',
                color: 'var(--text-muted)',
                lineHeight: 1.8,
                fontStyle: 'italic',
                marginBottom: '1.5rem',
                borderLeft: '3px solid var(--gold-light)',
                paddingLeft: '1rem',
              }}>
                {program.description}
              </p>
            )}

            {program.body && (
              <div
                style={{
                  fontFamily: "'Lora', serif",
                  fontSize: '0.95rem',
                  lineHeight: 1.85,
                  color: 'var(--text)',
                }}
                className="richtext-body"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.body) }}
              />
            )}

            <MediaSection program={program} />

            {!program.body && !program.description && !program.media_url && !program.media_asset && !program.media_embed_id && (
              <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem 0' }}>
                Inhalt wird bald verfügbar sein.
              </p>
            )}
          </>
        )}

        {/* Footer actions */}
        {accessible && (
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}>
            {!trackingAllowed && (
              <p style={{ width: '100%', fontFamily: "'Lora', serif", fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Fortschritts-Tracking ist deaktiviert.{' '}
                <span
                  onClick={() => navigate('/konto')}
                  role="link"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') navigate('/konto'); }}
                  style={{ color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Im Konto aktivieren
                </span>
              </p>
            )}
            {trackingAllowed && (
            <button
              onClick={handleToggleDone}
              className={done ? 'btn btn-primary' : 'btn btn-outline'}
              style={{
                flex: 1,
                minWidth: '160px',
                background: done ? 'var(--success)' : undefined,
                borderColor: done ? 'var(--success)' : undefined,
                color: done ? '#fff' : undefined,
                gap: '0.4rem',
              }}
            >
              {done ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Erledigt
                </>
              ) : (
                'Als erledigt markieren'
              )}
            </button>
            )}

            {nextProgram && (
              <button
                onClick={() => navigate(`/programm/${nextProgram.slug}`)}
                className="btn btn-ghost"
                style={{ flex: 1, minWidth: '120px' }}
              >
                Weiter →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Richtext styles via style tag approach */}
      <style>{`
        .richtext-body h1, .richtext-body h2, .richtext-body h3, .richtext-body h4 {
          font-family: 'Playfair Display', serif;
          color: var(--text);
          margin: 1.5rem 0 0.6rem;
          line-height: 1.3;
        }
        .richtext-body h2 { font-size: 1.2rem; }
        .richtext-body h3 { font-size: 1.05rem; }
        .richtext-body p { margin-bottom: 1rem; }
        .richtext-body ul, .richtext-body ol {
          padding-left: 1.4rem;
          margin-bottom: 1rem;
        }
        .richtext-body li { margin-bottom: 0.4rem; line-height: 1.7; }
        .richtext-body strong { font-weight: 600; color: var(--text); }
        .richtext-body em { font-style: italic; color: var(--text-muted); }
        .richtext-body a { color: var(--gold); }
        .richtext-body blockquote {
          border-left: 3px solid var(--gold-light);
          padding-left: 1rem;
          margin: 1.25rem 0;
          color: var(--text-muted);
          font-style: italic;
        }
        .richtext-body table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
        .richtext-body th, .richtext-body td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
        .richtext-body img { max-width: 100%; border-radius: var(--radius); margin: 1rem 0; }
        .richtext-body hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
      `}</style>
    </div>
  );
}
