import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PLAN_META, PLAN_ORDER } from '../utils/plans';
import { createCheckoutSession } from '../api/checkout';
import { toGermanError } from '../utils/apiErrors';
import Botanical from '../components/brand/Botanical';

const PLAN_FEATURES = {
  freebie: [
    'Ausgewählte Einstiegs-Inhalte',
    'Ernährungs-Grundlagen',
    'Community-Zugang',
  ],
  healrise7: [
    'Alle Freebie-Inhalte',
    '7-Tage Wohlfühl-Programm',
    'Bewegungs- & Selfcare-Videos',
    'E-Mail Support',
  ],
  healrise14: [
    'Alle HEALRISE 7 Inhalte',
    '14-Tage Intensivprogramm',
    'Hautpflege & Supplements Guide',
    'Mindset-Coaching-Module',
    'Prioritäts-Support',
  ],
  premium: [
    'Alle HEALRISE 14 Inhalte',
    'Persönlicher 1:1 Coaching-Call',
    'Individuelle Ernährungspläne',
    'Unbegrenzte Laufzeit',
    'Exklusive Community & Live-Calls',
  ],
};

const PLAN_POPULAR = 'healrise14';

function CheckIcon({ color = 'var(--gold)' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UpgradeCard({ planKey, isPopular, isCurrent, isSelected, onSelect }) {
  const meta = PLAN_META[planKey];
  const features = PLAN_FEATURES[planKey] ?? [];

  return (
    <div style={{
      background: 'var(--surface)',
      border: isPopular ? '2px solid var(--gold)' : '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: isPopular ? '0 4px 32px rgba(184,115,79,0.18)' : '0 2px 12px rgba(30,35,33,0.06)',
      marginBottom: '1rem',
    }}>
      {isPopular && (
        <div style={{
          background: 'var(--gold)',
          padding: '0.35rem 1rem',
          textAlign: 'center',
        }}>
          <span style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#fff',
          }}>
            ✦ Beliebteste Wahl
          </span>
        </div>
      )}

      <div style={{ padding: '1.4rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.2rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '0.2rem',
            }}>
              {meta.label}
            </h3>
            {isCurrent && (
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.58rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                background: 'rgba(184,115,79,0.12)',
                padding: '0.15rem 0.5rem',
                borderRadius: '12px',
              }}>
                Aktueller Plan
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.5rem',
              fontWeight: 600,
              color: 'var(--gold-dark)',
            }}>
              {meta.price}
            </span>
            {meta.price !== '0 €' && (
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.58rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>
                einmalig
              </p>
            )}
          </div>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.25rem' }}>
          {features.map((f, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontFamily: "'Lora', serif",
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              marginBottom: '0.5rem',
            }}>
              <CheckIcon />
              {f}
            </li>
          ))}
        </ul>

        {!isCurrent && (
          <button
            onClick={() => onSelect(planKey)}
            className={isSelected ? 'btn btn-outline btn-full' : 'btn btn-primary btn-full'}
            style={{ background: isSelected ? undefined : (isPopular ? 'var(--gold)' : undefined) }}
          >
            {isSelected ? 'Ausgewählt ✓' : 'Auswählen'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Upgrade() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const userPlan = user?.plan ?? 'freebie';
  const planMeta = PLAN_META[userPlan] ?? PLAN_META.freebie;
  const currentIdx = PLAN_ORDER.indexOf(userPlan);
  const [showCurrentFeatures, setShowCurrentFeatures] = useState(false);

  const upgradePlans = PLAN_ORDER.filter((_, i) => i > currentIdx);
  const currentFeatures = PLAN_FEATURES[userPlan] ?? [];

  // Vorauswahl aus gesperrtem Inhalt heraus (?plan=..., Plan T6.2.3)
  const requestedPlan = searchParams.get('plan');
  const [selectedPlan, setSelectedPlan] = useState(
    upgradePlans.includes(requestedPlan) ? requestedPlan : null
  );
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const selectedMeta = selectedPlan ? PLAN_META[selectedPlan] : null;

  const handleOrder = async () => {
    if (!selectedPlan || !withdrawalConsent) return;
    setCheckoutError('');
    setCheckoutLoading(true);
    try {
      const session = await createCheckoutSession(selectedPlan, true);
      if (session?.url) {
        // Weiterleitung zu Stripe Checkout (Stripe.js wird bewusst nicht
        // app-weit geladen — R15)
        window.location.href = session.url;
      } else {
        setCheckoutError('Checkout konnte nicht gestartet werden.');
        setCheckoutLoading(false);
      }
    } catch (err) {
      setCheckoutError(err.response?.status === 503
        ? 'Zahlungen sind derzeit nicht verfügbar. Bitte versuche es später erneut oder schreibe uns an hello@healrise.de.'
        : toGermanError(err, 'Checkout konnte nicht gestartet werden.'));
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '1.25rem 1rem 2rem', maxWidth: '640px', margin: '0 auto' }}>
      {/* Current plan banner */}
      <div style={{
        background: 'var(--grad-copper)',
        borderRadius: '14px',
        padding: '1.4rem 1.25rem',
        marginBottom: '1.75rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }} className="paper-grain">
        <Botanical variant="spray" size={120} style={{ position: 'absolute', right: '-20px', top: '-16px', color: '#FDFCFA', opacity: 0.35, transform: 'scaleY(-1)' }} />

        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.82, marginBottom: '0.3rem' }}>
          Dein aktueller Plan
        </p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 600, color: '#fff', marginBottom: '0.9rem' }}>
          {planMeta.label}
        </h2>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {currentFeatures.slice(0, 3).map((f, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontFamily: "'Lora', serif",
              fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.9)',
              marginBottom: '0.35rem',
            }}>
              <CheckIcon color="rgba(255,255,255,0.9)" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade title */}
      {upgradePlans.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.3rem' }}>
            Dein Plan upgraden
          </h2>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Schalte mehr Inhalte frei für deine tägliche Selfcare-Routine.
          </p>
        </div>
      )}

      {/* Upgrade plan cards */}
      {upgradePlans.map(planKey => (
        <UpgradeCard
          key={planKey}
          planKey={planKey}
          isPopular={planKey === PLAN_POPULAR}
          isCurrent={false}
          isSelected={selectedPlan === planKey}
          onSelect={(k) => { setSelectedPlan(k); setCheckoutError(''); }}
        />
      ))}

      {/* Bestellübersicht — Pflichtinfos unmittelbar über dem Bestell-Button
          (§ 312j Abs. 3 BGB, R9) + Widerrufs-Erlöschens-Checkbox (§ 356 Abs. 5, R8) */}
      {selectedPlan && selectedMeta && (
        <div style={{
          background: 'var(--surface)',
          border: '2px solid var(--gold)',
          borderRadius: '14px',
          padding: '1.4rem 1.25rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.9rem' }}>
            Deine Bestellung
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
            <div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                {selectedMeta.label}
              </p>
              <p style={{ fontFamily: "'Lora', serif", fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Digitaler Inhalt · Einmalkauf · sofortiger Zugang
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 600, color: 'var(--gold-dark)' }}>
                {selectedMeta.price}
              </p>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.58rem', color: 'var(--text-subtle)' }}>
                Gesamtpreis inkl. MwSt.
              </p>
            </div>
          </div>

          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={withdrawalConsent}
              onChange={e => setWithdrawalConsent(e.target.checked)}
              style={{ marginTop: '3px', flexShrink: 0, width: 16, height: 16, accentColor: 'var(--gold)' }}
            />
            <span style={{ fontFamily: "'Lora', serif", fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Ich stimme ausdrücklich zu, dass mit der Bereitstellung der digitalen Inhalte
              sofort begonnen wird, und bestätige meine Kenntnis, dass ich dadurch mein{' '}
              <Link to="/widerruf" style={{ color: 'var(--gold)' }}>Widerrufsrecht</Link> verliere.
            </span>
          </label>

          {checkoutError && (
            <p role="alert" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>
              {checkoutError}
            </p>
          )}

          <button
            onClick={handleOrder}
            disabled={!withdrawalConsent || checkoutLoading}
            className="btn btn-primary btn-full"
            style={{ height: '48px', opacity: withdrawalConsent ? 1 : 0.55 }}
          >
            {checkoutLoading
              ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : 'Zahlungspflichtig bestellen'}
          </button>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '0.6rem', lineHeight: 1.5 }}>
            Sichere Zahlung über Stripe. Es gelten unsere <Link to="/agb" style={{ color: 'var(--gold)' }}>AGB</Link>.
          </p>
        </div>
      )}

      {/* Already on premium */}
      {upgradePlans.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1.5rem',
          background: 'var(--surface)',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✦</div>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.4rem' }}>
            Du hast den besten Plan!
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Als Premium-Mitglied hast du Zugang zu allen Inhalten von HEALRISE.
          </p>
        </div>
      )}

      {/* Current plan details collapsible */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowCurrentFeatures(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
            Was ist in deinem aktuellen Plan enthalten?
          </span>
          <svg
            width="16" height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-subtle)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transform: showCurrentFeatures ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showCurrentFeatures && (
          <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.75rem' }}>
              {currentFeatures.map((f, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  fontFamily: "'Lora', serif",
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  marginBottom: '0.5rem',
                }}>
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p style={{
        textAlign: 'center',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.62rem',
        color: 'var(--text-subtle)',
        marginTop: '1.5rem',
        lineHeight: 1.6,
      }}>
        Bei Fragen schreibe uns unter{' '}
        <a href="mailto:hello@healrise.de" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
          hello@healrise.de
        </a>
      </p>
    </div>
  );
}
