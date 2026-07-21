import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../api/auth';
import { toGermanError } from '../utils/apiErrors';
import HealriseLogo from '../components/brand/HealriseLogo';
import Botanical from '../components/brand/Botanical';

export default function Login() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  // Art.-9-Einwilligung: separater Opt-in, NIE vorangekreuzt (R3)
  const [healthConsent, setHealthConsent] = useState(false);

  const { login, applySession } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) { setError('Bitte alle Felder ausfüllen.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(toGermanError(err, 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword || !regConfirm) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await apiRegister(regUsername, regEmail, regPassword, healthConsent);
      if (data?.jwt && data?.user) {
        // Register-Response enthält bereits Session — kein Zweit-Login (Review F10)
        applySession(data.jwt, data.user);
        navigate('/', { replace: true });
      } else {
        // E-Mail-Bestätigung ist aktiv: Register liefert kein JWT (Review F10)
        setTab('login');
        setInfo('Konto erstellt. Bitte bestätige deine E-Mail-Adresse und melde dich dann an.');
      }
    } catch (err) {
      setError(toGermanError(err, 'Registrierung fehlgeschlagen.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--cream)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
      }}
    >
      {/* Decorative top accent */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent, var(--copper), transparent)',
        }}
      />

      {/* Botanische Akzente (dekorativ) */}
      <Botanical variant="sprig" size={190} style={{ position: 'fixed', bottom: -12, left: -26, color: 'var(--sage-deep)', opacity: 0.16, zIndex: 0, pointerEvents: 'none' }} />
      <Botanical variant="sprig" size={150} style={{ position: 'fixed', top: 8, right: -22, color: 'var(--sage-deep)', opacity: 0.13, transform: 'scaleX(-1)', zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        {/* A11y: Seiten-Überschrift (WCAG 2.4.6) — visuell durch Logo/Tabs
            repräsentiert, für Screenreader als <h1> bereitgestellt. */}
        <h1 className="sr-only">Bei HEALRISE anmelden oder registrieren</h1>
        {/* Logo */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'center' }}>
          <HealriseLogo variant="full" />
        </div>

        {/* Card */}
        <div
          className="card"
          style={{
            padding: '2rem 1.75rem',
            background: 'var(--surface)',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              marginBottom: '1.75rem',
            }}
          >
            {[
              { key: 'login', label: 'Anmelden' },
              { key: 'register', label: 'Registrieren' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setError(''); }}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  padding: '0.6rem 0.5rem',
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  color: tab === key ? 'var(--gold)' : 'var(--text-muted)',
                  borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Info (z. B. E-Mail-Bestätigung ausstehend) */}
          {info && !error && (
            <div
              role="status"
              style={{
                background: 'rgba(62,125,90,0.07)',
                border: '1px solid rgba(62,125,90,0.2)',
                borderRadius: 'var(--radius)',
                padding: '0.65rem 0.9rem',
                marginBottom: '1rem',
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.72rem',
                color: 'var(--success)',
              }}
            >
              {info}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(178,59,46,0.07)',
                border: '1px solid rgba(178,59,46,0.2)',
                borderRadius: 'var(--radius)',
                padding: '0.65rem 0.9rem',
                marginBottom: '1rem',
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.72rem',
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="identifier">E-Mail oder Benutzername</label>
                <input
                  id="identifier"
                  type="text"
                  className="form-input"
                  placeholder="deine@email.de"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Passwort</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              <div className="mt-3">
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ height: '48px', fontSize: '0.78rem' }}
                >
                  {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Anmelden'}
                </button>
              </div>
              <p style={{ textAlign: 'center', marginTop: '0.9rem' }}>
                <Link
                  to="/passwort-vergessen"
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                >
                  Passwort vergessen?
                </Link>
              </p>
              <p
                style={{
                  textAlign: 'center',
                  marginTop: '1.25rem',
                  fontFamily: "'Lora', serif",
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                Noch kein Konto?{' '}
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    cursor: 'pointer',
                    fontFamily: "'Lora', serif",
                    fontSize: '0.78rem',
                    fontStyle: 'italic',
                    textDecoration: 'underline',
                  }}
                >
                  Jetzt registrieren
                </button>
              </p>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">Benutzername</label>
                <input
                  id="reg-username"
                  type="text"
                  className="form-input"
                  placeholder="deinname"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">E-Mail</label>
                <input
                  id="reg-email"
                  type="email"
                  className="form-input"
                  placeholder="deine@email.de"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Passwort</label>
                <input
                  id="reg-password"
                  type="password"
                  className="form-input"
                  placeholder="Min. 8 Zeichen"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Passwort bestätigen</label>
                <input
                  id="reg-confirm"
                  type="password"
                  className="form-input"
                  placeholder="Passwort wiederholen"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', margin: '0.25rem 0 0.5rem' }}>
                <input
                  type="checkbox"
                  checked={healthConsent}
                  onChange={e => setHealthConsent(e.target.checked)}
                  disabled={loading}
                  style={{ marginTop: '3px', flexShrink: 0, width: 15, height: 15, accentColor: 'var(--gold)' }}
                />
                <span style={{ fontFamily: "'Lora', serif", fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  Ich willige ausdrücklich ein, dass HEALRISE meine Fortschrittsdaten
                  (Angaben mit Gesundheitsbezug, Art. 9 DSGVO) verarbeitet, um mein
                  Programm-Tracking bereitzustellen. Freiwillig — ohne Häkchen ist das
                  Tracking deaktiviert und kann später im Konto aktiviert werden.
                  Details: <Link to="/datenschutz" style={{ color: 'var(--gold)' }}>Datenschutzerklärung</Link>.
                </span>
              </label>
              <div className="mt-3">
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  style={{ height: '48px', fontSize: '0.78rem' }}
                >
                  {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Konto erstellen'}
                </button>
              </div>
              <p
                style={{
                  textAlign: 'center',
                  marginTop: '1.25rem',
                  fontFamily: "'Lora', serif",
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}
              >
                Bereits registriert?{' '}
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold)',
                    cursor: 'pointer',
                    fontFamily: "'Lora', serif",
                    fontSize: '0.78rem',
                    fontStyle: 'italic',
                    textDecoration: 'underline',
                  }}
                >
                  Jetzt anmelden
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Footer note */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '1.75rem',
            fontFamily: "'Lora', serif",
            fontSize: '0.72rem',
            color: 'var(--text-subtle)',
            fontStyle: 'italic',
            lineHeight: 1.6,
          }}
        >
          Mit deiner Anmeldung stimmst du unseren{' '}
          <Link to="/agb" style={{ color: 'var(--gold)', textDecoration: 'none' }}>AGB</Link> zu.
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.9rem', fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: 'var(--text-subtle)' }}>
          <Link to="/impressum" style={{ color: 'var(--text-subtle)' }}>Impressum</Link>
          {' · '}
          <Link to="/datenschutz" style={{ color: 'var(--text-subtle)' }}>Datenschutz</Link>
          {' · '}
          <Link to="/widerruf" style={{ color: 'var(--text-subtle)' }}>Widerruf</Link>
        </p>
      </div>
    </div>
  );
}
