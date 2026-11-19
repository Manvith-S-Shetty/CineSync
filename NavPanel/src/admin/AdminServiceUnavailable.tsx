import { Link } from 'react-router-dom';
import AdminGateShell from './AdminGateShell';
import { IconAlertTriangle, IconRefresh } from './icons';

export default function AdminServiceUnavailable({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <AdminGateShell
      tone="warning"
      eyebrow="503 · Service unavailable"
      icon={<IconAlertTriangle size={26} />}
      title="Admin service unavailable"
      description="The CineSync backend could not verify admin access right now. This is usually temporary — retry in a moment."
    >
      <button type="button" className="admin-btn admin-btn--primary" onClick={onRetry}>
        <IconRefresh size={16} />
        Retry verification
      </button>
      <Link className="admin-btn admin-btn--ghost" to="/">
        Back to CineSync
      </Link>
    </AdminGateShell>
  );
}
