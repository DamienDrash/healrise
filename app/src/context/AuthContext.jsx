import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, getMe } from '../api/auth';
import { initProgressSync, clearProgressSession } from '../utils/progress';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Ohne Token gibt es nichts zu laden — lazy Initializer statt setState im Effect.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('healrise_jwt')));

  const loadUser = useCallback(async () => {
    const jwt = localStorage.getItem('healrise_jwt');
    if (!jwt) return;
    try {
      const me = await getMe();
      setUser(me);
    } catch (err) {
      // Nur bei tatsächlich ungültigem Token abmelden — Netzwerkfehler
      // (z. B. offline gestartete PWA) dürfen die Session nicht zerstören (Review F8).
      if (err.response?.status === 401) {
        localStorage.removeItem('healrise_jwt');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // loadUser ist async — alle setState-Aufrufe passieren erst nach await
    // (kein synchroner Cascading-Render; die Regel prüft das statisch zu streng).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  // 401 vom API-Client (Review F17): Session zurücksetzen, Route-Guards
  // übernehmen die SPA-Navigation zu /login — kein Hard-Redirect mehr.
  useEffect(() => {
    const onUnauthorized = () => {
      clearProgressSession();
      setUser(null);
    };
    window.addEventListener('healrise:unauthorized', onUnauthorized);
    return () => window.removeEventListener('healrise:unauthorized', onUnauthorized);
  }, []);

  // Fortschritts-Sync an die Session koppeln (Plan E5): Server-Stand ziehen,
  // Offline-Queue flushen.
  useEffect(() => {
    if (user?.id) {
      void initProgressSync(user.id, Boolean(user.health_consent_at));
    }
    // health_consent_at ist Teil der Abhängigkeit: Consent-Änderung re-synct
  }, [user?.id, user?.health_consent_at]);

  const login = async (identifier, password) => {
    const { jwt, user: u } = await apiLogin(identifier, password);
    localStorage.setItem('healrise_jwt', jwt);
    setUser(u);
    return u;
  };

  // Session direkt aus einer Register-/Change-Password-Response übernehmen —
  // erspart den redundanten Zweit-Login nach der Registrierung (Review F10).
  const applySession = (jwt, u) => {
    localStorage.setItem('healrise_jwt', jwt);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('healrise_jwt');
    // Lokale Fortschrittsdaten (Gesundheitsbezug) löschen (Review F6)
    clearProgressSession();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      // bewusst: bei Fehlern bleibt der zuletzt bekannte User-State erhalten
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, applySession }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- etablierter Context-Hook-Export
export const useAuth = () => useContext(AuthContext);
