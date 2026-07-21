import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProgramsProvider } from './context/ProgramsContext';

import AppShell from './components/layout/AppShell';
import RouteAccessibility from './components/layout/RouteAccessibility';
import UpdatePrompt from './components/ui/UpdatePrompt';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import { Impressum, Datenschutz, AGB, Widerruf } from './pages/Legal';
import Dashboard from './pages/Dashboard';
import Plans from './pages/Plans';
import ProgramDetail from './pages/ProgramDetail';
import Account from './pages/Account';
import Upgrade from './pages/Upgrade';
import { UpgradeSuccess, UpgradeCancel } from './pages/UpgradeResult';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p style={{
          fontFamily: "'Lora', serif",
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          marginTop: '0.5rem',
        }}>
          HEALRISE lädt…
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/passwort-vergessen"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      {/* Pflichtseiten — ohne Login erreichbar (R6: max. 2 Klicks) */}
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/datenschutz" element={<Datenschutz />} />
      <Route path="/agb" element={<AGB />} />
      <Route path="/widerruf" element={<Widerruf />} />

      {/* Protected – wrapped in AppShell */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="plaene" element={<Plans />} />
        <Route path="programm/:slug" element={<ProgramDetail />} />
        <Route path="konto" element={<Account />} />
        <Route path="upgrade" element={<Upgrade />} />
        <Route path="upgrade/erfolg" element={<UpgradeSuccess />} />
        <Route path="upgrade/abbruch" element={<UpgradeCancel />} />
      </Route>

      {/* Legacy redirect */}
      <Route path="/programme" element={<Navigate to="/plaene" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/healrise/app">
        <AuthProvider>
          <ProgramsProvider>
            <RouteAccessibility />
            <AppRoutes />
            <UpdatePrompt />
          </ProgramsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
