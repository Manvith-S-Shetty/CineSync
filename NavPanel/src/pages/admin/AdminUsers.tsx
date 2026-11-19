import AdminPlaceholder from './AdminPlaceholder';
import { IconUsers } from '../../admin/icons';

export default function AdminUsers() {
  return (
    <AdminPlaceholder
      eyebrow="Users"
      icon={<IconUsers size={24} />}
      title="User directory"
      description="A paginated view of registered CineSync accounts with search, sorting, and per-user engagement."
      planned={[
        'Paginated directory backed by GET /api/admin/users',
        'Server-side search and allowlisted sorting',
        'Masked email display and last-seen timestamps',
        'Per-user room and hosted-session signals',
      ]}
    />
  );
}
