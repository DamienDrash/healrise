import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateMe, changePassword, setHealthConsent, deleteAccount, getBillingPortalUrl, exportMyData } from '../api/auth';
import { PLAN_META } from '../utils/plans';

function SectionCard({ children, style = {} }) {
  return (
    <div className="card" style={{ borderRadius: '14px', overflow: 'hidden', marginBottom: '1rem', ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{
      padding: '0.85rem 1.1rem',
      borderBottom: '1px solid var(--border)',
      background: 'var(--cream)',
    }}>
      <p style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-subtle)',
      }}>
        {title}
      </p>
    </div>
  );
}

function Row({ label, value, action, actionLabel, onClick, noBorder }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.9rem 1.1rem',
      borderBottom: noBorder ? 'none' : '1px solid var(--border)',
      minHeight: '52px',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', marginBottom: value ? '0.1rem' : 0 }}>
          {label}
        </p>
        {value && (
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {value}
          </p>
        )}
      </div>
      {action && (
        <button
          onClick={onClick}
          aria-label={actionLabel || undefined}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'var(--gold)',
            letterSpacing: '0.04em',
            padding: '0.3rem 0',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default function Account() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const plan = user?.plan ?? 'freebie';
  const planMeta = PLAN_META[plan] ?? PLAN_META.freebie;

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const [newUsername, setNewUsername] = useState(user?.username ?? '');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  // DSGVO-Selbstauskunft (Art. 15/20): lädt die eigenen Daten und speichert sie
  // als JSON-Datei. Der Blob-Download läuft rein clientseitig (kein Redirect).
  const handleExportData = async () => {
    setExportError('');
    setExportLoading(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'healrise-datenexport.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Der Datenexport konnte nicht erstellt werden. Bitte später erneut versuchen.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleBillingPortal = async () => {
    setBillingError('');
    setBillingLoading(true);
    try {
      const url = await getBillingPortalUrl();
      if (url) window.location.href = url;
      else setBillingError('Abo-Verwaltung ist derzeit nicht verfügbar.');
    } catch {
      setBillingError('Abo-Verwaltung konnte nicht geöffnet werden. Bitte später erneut versuchen.');
    } finally {
      setBillingLoading(false);
    }
  };

  const initials = (user?.username ?? 'U').charAt(0).toUpperCase();

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) { setProfileError('Benutzername darf nicht leer sein.'); return; }
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await updateMe({ username: newUsername.trim() });
      await refreshUser();
      setProfileSuccess('Profil gespeichert.');
      setEditingProfile(false);
    } catch (err) {
      const serverMsg = err.response?.data?.error?.message;
      setProfileError(serverMsg?.includes('vergeben')
        ? serverMsg
        : 'Speichern fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!currentPw || !newPw || !confirmPw) { setPwError('Bitte alle Felder ausfüllen.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwörter stimmen nicht überein.'); return; }
    if (newPw.length < 8) { setPwError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    setPwLoading(true);
    setPwError('');
    setPwSuccess('');
    try {
      // Validiert das aktuelle Passwort serverseitig (Review F5)
      const data = await changePassword(currentPw, newPw);
      if (data?.jwt) localStorage.setItem('healrise_jwt', data.jwt);
      setPwSuccess('Passwort geändert.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setEditingPassword(false);
    } catch {
      setPwError('Passwort konnte nicht geändert werden. Aktuelles Passwort falsch?');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Kontolöschung (P1.2, R-02 / GDPR Art. 17): der User muss „LÖSCHEN" eintippen;
  // Fehler löst KEINEN Logout aus, Erfolg meldet ab und leitet zur Landing.
  const DELETE_CONFIRM_WORD = 'LÖSCHEN';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteConfirmed = deleteInput.trim() === DELETE_CONFIRM_WORD;
  // Synchrone Sperre gegen Doppelrequests (state/disabled greift erst nach Re-Render).
  const deletingRef = useRef(false);

  const handleDeleteAccount = async () => {
    if (!deleteConfirmed) return; // ohne explizite Bestätigung nichts tun
    if (deletingRef.current) return; // bereits laufende Löschung — kein zweiter Request
    deletingRef.current = true;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAccount();
      // Erfolg: Session + lokale Fortschrittsdaten löschen (logout), dann zur
      // Landing (app-fremde Seite → echte Navigation statt SPA-navigate).
      logout();
      window.location.assign('/healrise/');
    } catch {
      // Fehler: bewusst NICHT abmelden — die Session bleibt bestehen.
      deletingRef.current = false; // erneuter Versuch erlaubt
      setDeleteError('Konto konnte nicht gelöscht werden. Bitte versuche es später erneut.');
      setDeleteLoading(false);
    }
  };

  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState('');
  const hasConsent = Boolean(user?.health_consent_at);

  const handleConsentChange = async (nextConsent) => {
    if (!nextConsent) {
      const confirmed = window.confirm(
        'Einwilligung widerrufen? Dein gespeicherter Fortschritt wird dabei unwiderruflich gelöscht.'
      );
      if (!confirmed) return;
    }
    setConsentLoading(true);
    setConsentError('');
    try {
      await setHealthConsent(nextConsent);
      await refreshUser();
    } catch {
      setConsentError('Änderung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setConsentLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '1.25rem 1rem 2rem', maxWidth: '600px', margin: '0 auto' }}>

      {/* Profile section */}
      <SectionCard>
        <SectionHeader title="Profil" />

        {/* Avatar + info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 1.1rem',
          borderBottom: editingProfile ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.4rem',
              fontWeight: 600,
              color: '#fff',
            }}>
              {initials}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '0.15rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user?.username ?? 'Nutzer'}
            </p>
            <p style={{ fontFamily: "'Lora', serif", fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? ''}
            </p>
          </div>
          <button
            onClick={() => { setEditingProfile(v => !v); setProfileError(''); setProfileSuccess(''); setNewUsername(user?.username ?? ''); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--gold)',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {editingProfile ? 'Abbrechen' : 'Bearbeiten'}
          </button>
        </div>

        {editingProfile && (
          <form onSubmit={handleSaveProfile} style={{ padding: '1rem 1.1rem 1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Benutzername</label>
              <input
                className="form-input"
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Benutzername"
                disabled={profileLoading}
              />
            </div>
            {profileError && <p className="form-error" role="alert">{profileError}</p>}
            {profileSuccess && (
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                {profileSuccess}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={profileLoading}>
              {profileLoading ? 'Speichern…' : 'Speichern'}
            </button>
          </form>
        )}
        {/* Erfolgsmeldung auch nach dem Einklappen des Formulars sichtbar (Review F16) */}
        {!editingProfile && profileSuccess && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--success)', padding: '0 1.1rem 0.9rem' }}>
            {profileSuccess}
          </p>
        )}
      </SectionCard>

      {/* Subscription section */}
      <SectionCard>
        <SectionHeader title="Abonnement" />
        <Row
          label="Aktueller Plan"
          value={planMeta.label}
          action="Plan wechseln →"
          onClick={() => navigate('/upgrade')}
          noBorder={plan === 'freebie'}
        />
        {plan !== 'freebie' && (
          <Row
            label="Abonnement & Zahlungen verwalten"
            value="Rechnungen, Zahlungsart und Belege im Stripe-Portal"
            action={billingLoading ? 'Öffne…' : 'Öffnen →'}
            onClick={billingLoading ? undefined : handleBillingPortal}
            noBorder
          />
        )}
        {billingError && (
          <p className="form-error" role="alert" style={{ padding: '0 1.1rem 0.8rem' }}>{billingError}</p>
        )}
      </SectionCard>

      {/* Settings section */}
      <SectionCard>
        <SectionHeader title="Einstellungen" />

        {/* Password change */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.9rem 1.1rem',
            borderBottom: editingPassword ? '1px solid var(--border)' : 'none',
            minHeight: '52px',
          }}>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)' }}>
              Passwort ändern
            </p>
            <button
              onClick={() => { setEditingPassword(v => !v); setPwError(''); setPwSuccess(''); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--gold)',
                letterSpacing: '0.04em',
              }}
            >
              {editingPassword ? 'Abbrechen' : 'Ändern'}
            </button>
          </div>

          {editingPassword && (
            <form onSubmit={handleSavePassword} style={{ padding: '1rem 1.1rem 1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Aktuelles Passwort</label>
                <input
                  className="form-input"
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  disabled={pwLoading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Neues Passwort</label>
                <input
                  className="form-input"
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  disabled={pwLoading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Passwort bestätigen</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Passwort wiederholen"
                  disabled={pwLoading}
                />
              </div>
              {pwError && <p className="form-error" role="alert">{pwError}</p>}
              {pwSuccess && (
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                  {pwSuccess}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-sm" disabled={pwLoading}>
                {pwLoading ? 'Speichern…' : 'Passwort ändern'}
              </button>
            </form>
          )}
          {!editingPassword && pwSuccess && (
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'var(--success)', padding: '0 1.1rem 0.9rem' }}>
              {pwSuccess}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Datenschutz: Art.-9-Einwilligung verwalten (Plan T7.2.3) */}
      <SectionCard>
        <SectionHeader title="Datenschutz" />
        <div style={{ padding: '1rem 1.1rem' }}>
          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasConsent}
              disabled={consentLoading}
              onChange={e => handleConsentChange(e.target.checked)}
              style={{ marginTop: '3px', flexShrink: 0, width: 16, height: 16, accentColor: 'var(--gold)' }}
            />
            <span style={{ fontFamily: "'Lora', serif", fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Programm-Tracking (Fortschrittsdaten)</strong><br />
              Einwilligung in die Verarbeitung meiner Fortschrittsdaten (Gesundheitsbezug,
              Art. 9 DSGVO). Beim Widerruf werden alle gespeicherten Fortschrittsdaten gelöscht.
              Details: <Link to="/datenschutz" style={{ color: 'var(--gold)' }}>Datenschutzerklärung</Link>.
            </span>
          </label>
          {consentError && (
            <p className="form-error" role="alert" style={{ marginTop: '0.6rem' }}>{consentError}</p>
          )}
        </div>
        <Row
          label="Meine Daten herunterladen"
          value="DSGVO-Selbstauskunft (Art. 15/20): Konto, Käufe und Fortschritt als JSON"
          action={exportLoading ? 'Erstelle…' : 'Herunterladen →'}
          actionLabel="Meine Daten herunterladen"
          onClick={exportLoading ? undefined : handleExportData}
          noBorder
        />
        {exportError && (
          <p className="form-error" role="alert" style={{ padding: '0 1.1rem 0.8rem' }}>{exportError}</p>
        )}
      </SectionCard>

      {/* Rechtliches (R6: von überall in max. 2 Klicks erreichbar) */}
      <SectionCard>
        <SectionHeader title="Rechtliches" />
        {[
          { to: '/impressum', label: 'Impressum' },
          { to: '/datenschutz', label: 'Datenschutzerklärung' },
          { to: '/agb', label: 'AGB' },
          { to: '/widerruf', label: 'Widerrufsbelehrung' },
        ].map((item, i, arr) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: 'block',
              padding: '0.85rem 1.1rem',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.78rem',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            {item.label} →
          </Link>
        ))}
      </SectionCard>

      {/* Danger zone */}
      <SectionCard style={{ border: '1px solid rgba(178,59,46,0.25)' }}>
        <SectionHeader title="Gefahrenzone" />
        <div style={{ padding: '1rem 1.1rem' }}>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.9rem', lineHeight: 1.55 }}>
            Du wirst abgemeldet und musst dich erneut einloggen.
          </p>
          <button
            onClick={handleLogout}
            className="btn btn-danger btn-sm"
          >
            Abmelden
          </button>
        </div>

        {/* Kontolöschung (P1.2, R-02) */}
        <div style={{ padding: '1rem 1.1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
            Konto löschen
          </p>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.9rem', lineHeight: 1.55 }}>
            Dein Konto und dein gespeicherter Fortschritt werden unwiderruflich gelöscht.
            Kaufbelege bleiben aus gesetzlicher Aufbewahrungspflicht (§ 147 AO) anonymisiert erhalten.
          </p>

          {!deleteOpen ? (
            <button
              onClick={() => { setDeleteOpen(true); setDeleteError(''); setDeleteInput(''); }}
              className="btn btn-danger btn-sm"
            >
              Konto löschen
            </button>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '0.9rem' }}>
                <span style={{ display: 'block', fontFamily: "'Poppins', sans-serif", fontSize: '0.74rem', color: 'var(--text)', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                  Tippe zur Bestätigung <strong>{DELETE_CONFIRM_WORD}</strong> ein:
                </span>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  disabled={deleteLoading}
                  aria-label={`Zur Bestätigung ${DELETE_CONFIRM_WORD} eingeben`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="form-input"
                  style={{ width: '100%', maxWidth: '220px' }}
                />
              </label>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={handleDeleteAccount}
                  className="btn btn-danger btn-sm"
                  disabled={!deleteConfirmed || deleteLoading}
                >
                  {deleteLoading ? 'Wird gelöscht…' : 'Endgültig löschen'}
                </button>
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteInput(''); setDeleteError(''); }}
                  className="btn btn-ghost btn-sm"
                  disabled={deleteLoading}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <p style={{
        textAlign: 'center',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.58rem',
        color: 'var(--text-subtle)',
        letterSpacing: '0.06em',
        marginTop: '0.5rem',
      }}>
        HEALRISE · {new Date().getFullYear()}
      </p>
      <p style={{
        textAlign: 'center',
        fontFamily: "'Lora', serif",
        fontSize: '0.68rem',
        color: 'var(--text-subtle)',
        fontStyle: 'italic',
        marginTop: '0.4rem',
        lineHeight: 1.5,
      }}>
        HEALRISE dient dem allgemeinen Wohlbefinden und ersetzt keine ärztliche Beratung,
        Diagnose oder Behandlung.
      </p>
    </div>
  );
}
