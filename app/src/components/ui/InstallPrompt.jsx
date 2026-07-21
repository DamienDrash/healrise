import { useState, useEffect } from 'react';
import HealriseMark from '../brand/HealriseMark';

const DISMISSED_KEY = 'healrise_install_dismissed';
// Nach Ablauf wird wieder gefragt (Review F21: Dismiss war permanent)
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isChromeIOS() {
  return isIOS() && /CriOS/.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    // Android / Desktop Chrome: native prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS (Safari + Chrome on iOS): manuelle Anleitung, verzögert eingeblendet
    let timer;
    if (isIOS()) {
      timer = setTimeout(() => {
        setShowIOS(true);
        setVisible(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (timer) clearTimeout(timer); // Review F21: Timer-Leak
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
    setShowIOS(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setDeferredPrompt(null);
  };

  if (!visible || isStandalone()) return null;

  const banner = {
    position: 'fixed', bottom: 80, left: 12, right: 12,
    background: 'var(--text)', color: 'var(--cream)',
    borderRadius: '16px', padding: '1rem 1rem 1rem 1.1rem',
    boxShadow: '0 8px 40px rgba(30,35,33,0.25)',
    zIndex: 200, display: 'flex', alignItems: 'flex-start', gap: '0.85rem',
    animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
  };
  // Papercraft-Blüte — Ivory/Sage/Copper tragen sich selbst auf dem Ink-Banner
  const mark = <HealriseMark size={38} />;

  // iOS instructions
  if (showIOS) {
    const isChr = isChromeIOS();
    return (
      <>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
        <div style={banner}>
          {mark}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem', color: 'var(--cream)' }}>
              Als App installieren
            </p>
            {isChr ? (
              <p style={{ fontFamily: "'Lora',serif", fontSize: '0.78rem', color: 'rgba(246,243,239,0.72)', lineHeight: 1.5 }}>
                Öffne diese Seite in <strong style={{ color: 'var(--gold-light)' }}>Safari</strong>, tippe dann auf{' '}
                <ShareIcon /> und wähle <em>„Zum Home-Bildschirm"</em>.
              </p>
            ) : (
              <p style={{ fontFamily: "'Lora',serif", fontSize: '0.78rem', color: 'rgba(246,243,239,0.72)', lineHeight: 1.5 }}>
                Tippe auf <ShareIcon /> unten und wähle{' '}
                <em>„Zum Home-Bildschirm"</em> hinzufügen.
              </p>
            )}
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 0.25rem', color: 'rgba(246,243,239,0.5)', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>
      </>
    );
  }

  // Android / Desktop Chrome
  if (deferredPrompt) {
    return (
      <>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
        <div style={banner}>
          {mark}
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.2rem' }}>
              HEALRISE installieren
            </p>
            <p style={{ fontFamily: "'Lora',serif", fontSize: '0.76rem', color: 'rgba(246,243,239,0.65)', lineHeight: 1.4 }}>
              Als App speichern – offline verfügbar, kein Browser nötig.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
              <button onClick={install} style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.5rem 1rem', background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Installieren
              </button>
              <button onClick={dismiss} style={{ fontFamily: "'Poppins',sans-serif", fontSize: '0.72rem', padding: '0.5rem 0.8rem', background: 'rgba(246,243,239,0.1)', color: 'rgba(246,243,239,0.6)', border: '1px solid rgba(246,243,239,0.15)', borderRadius: '8px', cursor: 'pointer' }}>
                Später
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-light)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 1px' }}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}
