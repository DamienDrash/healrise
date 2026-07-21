import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { toGermanError } from '../utils/apiErrors';

/**
 * Passwort-vergessen-Flow (Review F33). Ohne ?code= wird die Reset-Mail
 * angefordert; mit ?code= (Link aus der Mail) wird das neue Passwort gesetzt.
 * Hinweis: Der Mail-Versand braucht konfiguriertes SMTP (launch-checklist.md).
 */
export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const code = searchParams.get('code');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!email) { setError('Bitte gib deine E-Mail-Adresse ein.'); return; }
    setError(''); setLoading(true);
    try {
      await forgotPassword(email);
      // Immer dieselbe Meldung — keine Auskunft, ob die Adresse existiert
      setInfo('Wenn ein Konto mit dieser Adresse existiert, haben wir dir eine E-Mail mit einem Link zum Zurücksetzen geschickt.');
    } catch (err) {
      setError(toGermanError(err, 'Anfrage fehlgeschlagen. Bitte versuche es erneut.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password || !confirm) { setError('Bitte alle Felder ausfüllen.'); return; }
    if (password !== confirm) { setError('Die Passwörter stimmen nicht überein.'); return; }
    if (password.length < 8) { setError('Das Passwort muss mindestens 8 Zeichen lang sein.'); return; }
    setError(''); setLoading(true);
    try {
      const data = await resetPassword(code, password, confirm);
      if (data?.jwt && data?.user) {
        applySession(data.jwt, data.user);
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(toGermanError(err, 'Zurücksetzen fehlgeschlagen. Fordere ggf. einen neuen Link an.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--cream)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.25rem',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div className="card" style={{ padding: '2rem 1.75rem', background: 'var(--surface)' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
            {code ? 'Neues Passwort setzen' : 'Passwort vergessen'}
          </h1>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {code
              ? 'Wähle ein neues Passwort für dein Konto.'
              : 'Gib deine E-Mail-Adresse ein — wir schicken dir einen Link zum Zurücksetzen.'}
          </p>

          {info && !error && (
            <div role="status" style={{
              background: 'rgba(62,125,90,0.07)', border: '1px solid rgba(62,125,90,0.2)',
              borderRadius: 'var(--radius)', padding: '0.65rem 0.9rem', marginBottom: '1rem',
              fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'var(--success)',
            }}>
              {info}
            </div>
          )}
          {error && (
            <div role="alert" style={{
              background: 'rgba(178,59,46,0.07)', border: '1px solid rgba(178,59,46,0.2)',
              borderRadius: 'var(--radius)', padding: '0.65rem 0.9rem', marginBottom: '1rem',
              fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          {code ? (
            <form onSubmit={handleReset} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">Neues Passwort</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="Min. 8 Zeichen"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Passwort bestätigen</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Passwort wiederholen"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ height: '48px', marginTop: '0.5rem' }}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Passwort speichern'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequest} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">E-Mail</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-input"
                  placeholder="deine@email.de"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ height: '48px', marginTop: '0.5rem' }}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Link anfordern'}
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <Link to="/login" style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
              Zurück zur Anmeldung
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
