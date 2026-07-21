import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getPrograms } from '../api/programs';
import { useAuth } from './AuthContext';

/**
 * Zentraler Programm-Cache (Review F24): Dashboard, Pläne und Detailseite
 * teilen sich EINE Liste statt sie jeweils neu zu laden. Fehler werden als
 * Status gemeldet statt als leere Liste maskiert (Review F13).
 */
const ProgramsContext = createContext(null);

export function ProgramsProvider({ children }) {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setStatus('loading');
    try {
      const list = await getPrograms();
      if (requestRef.current !== requestId) return; // ältere Antwort verwerfen
      setPrograms(list);
      setStatus('ready');
    } catch {
      if (requestRef.current !== requestId) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (user) {
      // async — setState erst nach await (Regel prüft statisch zu streng)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    } else {
      // Logout: Cache leeren, damit der nächste User keine fremden Daten sieht
      setPrograms([]);
      setStatus('idle');
    }
  }, [user, reload]);

  return (
    <ProgramsContext.Provider value={{ programs, status, reload }}>
      {children}
    </ProgramsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- etablierter Context-Hook-Export
export const usePrograms = () => useContext(ProgramsContext);
