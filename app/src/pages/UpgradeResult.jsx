import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PLAN_META } from '../utils/plans';

/**
 * Rückkehrseiten nach Stripe Checkout (Plan T6.2.1/T6.2.2).
 * Erfolg: Der Webhook schaltet den Plan serverseitig frei — wir pollen den
 * eigenen User kurz nach, bis der neue Plan sichtbar ist.
 */
export function UpgradeSuccess() {
  const { user, refreshUser } = useAuth();
  const [waited, setWaited] = useState(false);
  // Plan beim Seitenaufruf festhalten (lazy Initializer) — ändert er sich
  // durch das Polling, war die Freischaltung erfolgreich.
  const [startPlan] = useState(() => user?.plan ?? 'freebie');
  const planChanged = (user?.plan ?? 'freebie') !== startPlan;

  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      await refreshUser();
      if (attempts >= 6) {
        clearInterval(timer);
        setWaited(true);
      }
    }, 2000);
    return () => clearInterval(timer);
    // refreshUser ist stabil genug; bewusst nur beim Mount starten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planMeta = PLAN_META[user?.plan ?? 'freebie'] ?? PLAN_META.freebie;

  return (
    <div className="fade-in" style={{ padding: '3rem 1.25rem', maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✦</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.6rem' }}>
        Vielen Dank für deinen Kauf!
      </h2>
      {planChanged ? (
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Dein Plan <strong>{planMeta.label}</strong> ist freigeschaltet.
          Alle Inhalte stehen dir ab sofort zur Verfügung.
        </p>
      ) : waited ? (
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Deine Zahlung wird verarbeitet. Die Freischaltung erfolgt in wenigen
          Minuten automatisch — du bekommst außerdem eine Bestätigung per E-Mail.
        </p>
      ) : (
        <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Einen Moment — wir schalten deine Inhalte frei…
        </p>
      )}
      <Link to="/plaene" className="btn btn-primary">
        Zu deinen Inhalten
      </Link>
    </div>
  );
}

export function UpgradeCancel() {
  return (
    <div className="fade-in" style={{ padding: '3rem 1.25rem', maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.6rem' }}>
        Bestellung abgebrochen
      </h2>
      <p style={{ fontFamily: "'Lora', serif", fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: '1.5rem' }}>
        Es wurde nichts abgebucht. Du kannst den Kauf jederzeit erneut starten.
      </p>
      <Link to="/upgrade" className="btn btn-primary">
        Zurück zu den Plänen
      </Link>
    </div>
  );
}
