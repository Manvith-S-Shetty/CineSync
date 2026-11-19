import { Link } from 'react-router-dom';
import AdminGateShell from './AdminGateShell';
import { IconShield } from './icons';

export default function AdminAccessDenied({
  onSwitchAccount,
}: {
  onSwitchAccount: () => void;
}) {
  return (
    <AdminGateShell
      tone="danger"
      eyebrow="403 · Forbidden"
      icon={<IconShield size={26} />}
      title="Access denied"
      description="You are signed in, but this account is not on the CineSync admin allowlist. Admin access is verified by the backend on every admin request."
    >
      <Link className="admin-btn admin-btn--primary" to="/">
        Back to CineSync
      </Link>
      <button type="button" className="admin-btn admin-btn--ghost" onClick={onSwitchAccount}>
        Switch account
      </button>
    </AdminGateShell>
  );
}
