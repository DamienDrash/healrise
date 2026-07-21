import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PLAN_META } from '../../utils/plans';
import InstallPrompt from '../ui/InstallPrompt';
import HealriseLogo from '../brand/HealriseLogo';

const ROUTE_TITLES = {
  '/': 'Übersicht',
  '/plaene': 'Mein Plan',
  '/upgrade': 'Upgrade',
  '/konto': 'Konto',
};

function getTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/programm/')) return 'Programm';
  return 'HEALRISE';
}

function IconHome({ active }) {
  const c = active ? 'var(--gold)' : 'var(--text-subtle)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5z" />
      <path d="M9 21V13h6v8" />
    </svg>
  );
}

function IconPlans({ active }) {
  const c = active ? 'var(--gold)' : 'var(--text-subtle)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="7" y1="14" x2="10" y2="14" />
      <line x1="7" y1="17.5" x2="10" y2="17.5" />
      <line x1="14" y1="14" x2="17" y2="14" />
    </svg>
  );
}

function IconUpgrade({ active }) {
  const c = active ? 'var(--gold)' : 'var(--text-subtle)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
    </svg>
  );
}

function IconPerson({ active }) {
  const c = active ? 'var(--gold)' : 'var(--text-subtle)';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 20.5C5.5 17.5 8.5 15 12 15s6.5 2.5 6.5 5.5" />
    </svg>
  );
}

const NAV_TABS = [
  { to: '/', label: 'Home', Icon: IconHome, exact: true },
  { to: '/plaene', label: 'Pläne', Icon: IconPlans, exact: false },
  { to: '/upgrade', label: 'Upgrade', Icon: IconUpgrade, exact: false },
  { to: '/konto', label: 'Konto', Icon: IconPerson, exact: false },
];

export default function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const plan = user?.plan ?? 'freebie';
  const planMeta = PLAN_META[plan] ?? PLAN_META.freebie;
  const title = getTitle(location.pathname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--cream)', overflow: 'hidden' }}>
      {/* A11y (WCAG 2.4.1): Skip-to-Content — erster Tab-Stopp, sichtbar nur bei Fokus.
          Fokus programmatisch ins <main> setzen (robuster als natives Hash-Verhalten). */}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          const main = document.getElementById('main-content');
          if (main) {
            e.preventDefault();
            main.focus();
            main.scrollIntoView?.({ block: 'start' });
          }
        }}
      >
        Zum Inhalt springen
      </a>
      {/* Top Header */}
      <header style={{
        height: '56px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        flexShrink: 0,
        zIndex: 200,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
      }}>
        <HealriseLogo variant="horizontal" markSize={30} wordmarkSize={0.98} />

        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1rem',
          fontWeight: 500,
          color: 'var(--text)',
          letterSpacing: '0.03em',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </h1>

        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'rgba(184,115,79,0.14)',
          color: 'var(--gold-dark)',
          border: '1px solid rgba(184,115,79,0.28)',
          padding: '0.22rem 0.6rem',
          borderRadius: '20px',
        }}>
          {planMeta.label}
        </span>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingTop: '56px',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          outline: 'none',
        }}
      >
        <Outlet />
      </main>

      <InstallPrompt />

      {/* Bottom Nav */}
      <nav style={{
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
        zIndex: 200,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {NAV_TABS.map(({ to, label, Icon, exact }) => (
          <NavLink key={to} to={to} end={exact} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '64px',
                gap: '3px',
                position: 'relative',
                paddingTop: '4px',
              }}>
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '6px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: 'var(--gold)',
                  }} />
                )}
                <Icon active={isActive} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.58rem',
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: '0.05em',
                  color: isActive ? 'var(--gold)' : 'var(--text-subtle)',
                  transition: 'color 0.2s',
                }}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
