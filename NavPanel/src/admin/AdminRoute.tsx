import { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  fetchAdminMe,
  toAdminApiError,
  type AdminApiError,
} from '../services/adminApi';
import AdminAuthRequired from './AdminAuthRequired';
import AdminAccessDenied from './AdminAccessDenied';
import AdminGateShell from './AdminGateShell';
import AdminServiceUnavailable from './AdminServiceUnavailable';
import { IconAlertTriangle, IconRefresh, IconShield } from './icons';
import './admin.css';

type VerificationStatus =
  | 'idle'
  | 'checking'
  | 'allowed'
  | 'denied'
  | 'unavailable'
  | 'auth'
  | 'error';

/**
 * UX-level admin gate. The backend `requireAdmin` middleware remains the
 * actual security boundary; this only decides which screen to show.
 */
export default function AdminRoute() {
  const { user, loading, firebaseReady, getIdToken, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [error, setError] = useState<AdminApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (loading || !firebaseReady || !uid) return;

    let active = true;
    setStatus('checking');
    setError(null);

    fetchAdminMe(getIdToken)
      .then(() => {
        if (active) setStatus('allowed');
      })
      .catch((err: unknown) => {
        if (!active) return;
        const apiError = toAdminApiError(err);
        setError(apiError);
        if (apiError.status === 401) setStatus('auth');
        else if (apiError.status === 403) setStatus('denied');
        else if (apiError.status === 503) setStatus('unavailable');
        else setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [loading, firebaseReady, uid, getIdToken, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const switchAccount = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Sign-out failures must not trap the user on the admin gate.
    }
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  if (loading) {
    return (
      <AdminGateShell
        busy
        icon={<span className="admin-spinner" />}
        title="Checking your session"
        description="Restoring your CineSync authentication state."
      />
    );
  }

  if (!firebaseReady || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (status === 'allowed') {
    return <Outlet />;
  }

  if (status === 'denied') {
    return <AdminAccessDenied onSwitchAccount={switchAccount} />;
  }

  if (status === 'unavailable') {
    return <AdminServiceUnavailable onRetry={retry} />;
  }

  if (status === 'auth') {
    return <AdminAuthRequired onRetry={retry} onSwitchAccount={switchAccount} />;
  }

  if (status === 'error') {
    return (
      <AdminGateShell
        tone="warning"
        eyebrow="Admin access check failed"
        icon={<IconAlertTriangle size={26} />}
        title="Could not verify admin access"
        description={error?.message ?? 'The admin service could not complete the access check.'}
      >
        <button type="button" className="admin-btn admin-btn--primary" onClick={retry}>
          <IconRefresh size={16} />
          Retry
        </button>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={switchAccount}>
          Switch account
        </button>
      </AdminGateShell>
    );
  }

  return (
    <AdminGateShell
      busy
      eyebrow="Restricted area"
      icon={<IconShield size={26} />}
      title="Verifying admin access"
      description="Confirming your Firebase session with the CineSync backend."
    />
  );
}
