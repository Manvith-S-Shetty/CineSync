import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import VideoChat from './VideoChat';
import './App.css';
import './components/AppShell.css';
import ErrorBoundary from './ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import AppHeader from './components/AppHeader';

function AuthLoading() {
  return (
    <div className="app-auth-loading" role="status">
      <span className="app-auth-loading__text">Loading…</span>
    </div>
  );
}

function LoginRoute() {
  const { user, loading, firebaseReady } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (firebaseReady && user) {
    const to = location.state?.from?.pathname || '/';
    return <Navigate to={to} replace />;
  }

  return (
    <div className="app-login-route">
      <LoginScreen />
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading, firebaseReady } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoading />;
  }

  if (!firebaseReady || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<VideoChat />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <div className="app-root">
        <BrowserRouter>
          <AuthProvider>
            <div className="app-router-outlet">
              <AppRoutes />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}

export default App;
