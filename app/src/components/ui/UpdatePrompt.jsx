import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Prüfintervall für neue Service-Worker-Versionen (Goldstandard T2)
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Update-Flow nach Goldstandard T1/T2 (Review I11/F28):
 * registerType 'prompt' + Banner „Neue Version verfügbar" statt stillem
 * Sofort-Update mitten in der Session; dazu periodische Update-Checks.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // Nur prüfen, wenn online und kein Update bereits läuft (T2)
        if (registration.installing || !navigator.onLine) return;
        registration.update().catch(() => {
          // Netzwerkfehler beim Update-Check sind unkritisch
        });
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    // Screenreader-Nutzer nicht überraschen: Banner bleibt bis zur Interaktion
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 80,
        left: 12,
        right: 12,
        zIndex: 210,
        background: 'var(--text)',
        color: 'var(--cream)',
        borderRadius: '14px',
        padding: '0.9rem 1rem',
        boxShadow: '0 8px 40px rgba(30,35,33,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <p style={{ flex: 1, minWidth: '160px', fontFamily: "'Poppins',sans-serif", fontSize: '0.78rem' }}>
        Eine neue Version von HEALRISE ist verfügbar.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.72rem',
            padding: '0.5rem 1rem', background: 'var(--gold)', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
          }}
        >
          Aktualisieren
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            fontFamily: "'Poppins',sans-serif", fontSize: '0.72rem',
            padding: '0.5rem 0.8rem', background: 'rgba(246,243,239,0.1)',
            color: 'rgba(246,243,239,0.6)', border: '1px solid rgba(246,243,239,0.15)',
            borderRadius: '8px', cursor: 'pointer',
          }}
        >
          Später
        </button>
      </div>
    </div>
  );
}
