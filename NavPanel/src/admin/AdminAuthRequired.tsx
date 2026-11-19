import { Link } from 'react-router-dom';
import AdminGateShell from './AdminGateShell';
import { IconRefresh, IconShield } from './icons';

export default function AdminAuthRequired({
  onRetry,
  onSwitchAccount,
}: {
  onRetry: () => void;
  onSwitchAccount: () => void;
}) {
  return (
    <AdminGateShell
      tone="warning"
      eyebrow="401 · Authentication required"
      icon={<IconShield size={26} />}
      title="Session could not be verified"
      description="The backend rejected your current Firebase session. Retry the check, or sign in with an admin account."
    >
      <button type="button" className="admin-btn admin-btn--primary" onClick={onRetry}>
        <IconRefresh size={16} />
        Retry verification
      </button>
      <button type="button" className="admin-btn admin-btn--ghost" onClick={onSwitchAccount}>
        Sign in again
      </button>
      <Link className="admin-btn admin-btn--ghost" to="/">
        Back to CineSync
      </Link>
    </AdminGateShell>
  );
}
