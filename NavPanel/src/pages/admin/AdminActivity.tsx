import AdminPlaceholder from './AdminPlaceholder';
import { IconActivity } from '../../admin/icons';

export default function AdminActivity() {
  return (
    <AdminPlaceholder
      eyebrow="Activity"
      icon={<IconActivity size={24} />}
      title="Event feed"
      description="A chronological feed reconstructed only from persisted CineSync timestamps."
      planned={[
        'Paginated feed backed by GET /api/admin/activity',
        'User, room, presence, and watch-session events',
        'UTC range controls with clear empty states',
        'No synthetic or inferred events',
      ]}
    />
  );
}
