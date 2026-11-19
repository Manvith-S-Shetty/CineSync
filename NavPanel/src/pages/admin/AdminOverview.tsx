import { useState } from 'react';
import AdminDateRangeSelector from '../../admin/AdminDateRangeSelector';
import MetricCard from '../../admin/MetricCard';
import MetricGrid from '../../admin/MetricGrid';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeletonGrid,
} from '../../admin/AdminStates';
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconEyeOff,
  IconFilm,
  IconGauge,
  IconHourglass,
  IconInfo,
  IconPlayCircle,
  IconRefresh,
  IconRooms,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
} from '../../admin/icons';
import {
  createAdminDateRange,
  type AdminDateRange,
} from '../../admin/dateRange';
import {
  formatCount,
  formatDurationSeconds,
  formatGeneratedAt,
  humanizeKey,
} from '../../admin/format';
import { useAdminOverview } from '../../admin/useAdminOverview';

export default function AdminOverview() {
  const [range, setRange] = useState<AdminDateRange>(() => createAdminDateRange(30));
  const { status, data, meta, error, refreshing, retry } = useAdminOverview(range);

  const generatedAt = formatGeneratedAt(meta?.generatedAt);

  return (
    <div className="admin-page">
      <section className="admin-page__intro">
        <div className="admin-page__intro-text">
          <p className="admin-eyebrow">Platform overview</p>
          <h2 className="admin-page__heading">Activity at a glance</h2>
          <p className="admin-page__lede">
            Metrics are aggregated from persisted CineSync data over a UTC period. Audience totals
            are all-time unless labelled as period-based.
          </p>
        </div>

        <div className="admin-page__controls">
          <AdminDateRangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-refresh"
            onClick={retry}
            disabled={status === 'loading' || refreshing}
          >
            <IconRefresh size={16} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      {status === 'loading' ? (
        <div aria-busy="true">
          <AdminSkeletonGrid count={6} />
        </div>
      ) : null}

      {status === 'error' ? (
        <AdminErrorState
          message={error?.message ?? 'The overview metrics could not be loaded.'}
          onRetry={retry}
        />
      ) : null}

      {status === 'success' && data ? (
        <div className={`admin-overview${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing || undefined}>
          {isEmptyOverview(data) ? (
            <AdminEmptyState
              title="No recorded activity yet"
              message="CineSync has no persisted users, rooms, or watch sessions. Metrics will appear here once people start using the app."
            />
          ) : (
            <>
              {hasPeriodActivity(data) ? null : (
                <div className="admin-callout admin-callout--muted">
                  <span className="admin-callout__icon" aria-hidden="true">
                    <IconInfo size={18} />
                  </span>
                  <div>
                    <p className="admin-callout__text">
                      No new users, room activity, or watch sessions were recorded in this period.
                      All-time totals below still reflect existing data.
                    </p>
                  </div>
                </div>
              )}

              <section className="admin-section">
                <div className="admin-section__header">
                  <h3 className="admin-section__title">Users</h3>
                  <p className="admin-section__hint">Registered accounts and presence-based activity.</p>
                </div>
                <MetricGrid>
                  <MetricCard
                    label="Total registered users"
                    value={formatCount(data.users.total)}
                    description="All accounts stored in the users table."
                    icon={<IconUsers size={18} />}
                  />
                  <MetricCard
                    label="New users"
                    value={formatCount(data.users.newInPeriod)}
                    description={`Registered during ${range.label.toLowerCase()}.`}
                    icon={<IconUserPlus size={18} />}
                  />
                  <MetricCard
                    label="Active users"
                    value={formatCount(data.users.activeInPeriod)}
                    description="Distinct users with room presence in the period. Presence is not confirmed playback."
                    icon={<IconUserCheck size={18} />}
                  />
                </MetricGrid>
              </section>

              <section className="admin-section">
                <div className="admin-section__header">
                  <h3 className="admin-section__title">Rooms</h3>
                  <p className="admin-section__hint">Room lifecycle and creation volume.</p>
                </div>
                <MetricGrid>
                  <MetricCard
                    label="Total rooms"
                    value={formatCount(data.rooms.total)}
                    description="All rooms created in CineSync."
                    icon={<IconRooms size={18} />}
                  />
                  <MetricCard
                    label="Active rooms"
                    value={formatCount(data.rooms.active)}
                    description="Persisted active status. May be stale after a process crash."
                    icon={<IconPlayCircle size={18} />}
                    tone="accent"
                  />
                  <MetricCard
                    label="Ended rooms"
                    value={formatCount(data.rooms.ended)}
                    description="Rooms marked ended or with an end timestamp."
                    icon={<IconCheckCircle size={18} />}
                  />
                  <MetricCard
                    label="Rooms created"
                    value={formatCount(data.rooms.createdInPeriod)}
                    description={`Created during ${range.label.toLowerCase()}.`}
                    icon={<IconCalendar size={18} />}
                  />
                </MetricGrid>
              </section>

              <section className="admin-section">
                <div className="admin-section__header">
                  <h3 className="admin-section__title">Watch sessions</h3>
                  <p className="admin-section__hint">Shared-media session wall-clock time.</p>
                </div>
                <MetricGrid>
                  <MetricCard
                    label="Total watch sessions"
                    value={formatCount(data.watch.totalSessions)}
                    description="All watch-session records."
                    icon={<IconFilm size={18} />}
                  />
                  <MetricCard
                    label="Sessions in period"
                    value={formatCount(data.watch.sessionsInPeriod)}
                    description={`Started during ${range.label.toLowerCase()}.`}
                    icon={<IconCalendar size={18} />}
                  />
                  <MetricCard
                    label="Completed sessions"
                    value={formatCount(data.watch.completedSessionsInPeriod)}
                    description="Started in the period and ended with a valid timestamp."
                    icon={<IconCheckCircle size={18} />}
                  />
                  <MetricCard
                    label="Active sessions"
                    value={formatCount(data.watch.activeSessions)}
                    description="Persisted active flag. May be stale after a process crash."
                    icon={<IconPlayCircle size={18} />}
                    tone="accent"
                  />
                  <MetricCard
                    label="Average session duration"
                    value={formatDurationSeconds(data.watch.averageSessionDurationSeconds) ?? '—'}
                    description={
                      data.watch.averageSessionDurationSeconds === null
                        ? 'No completed sessions were started in this period.'
                        : 'Average shared-session duration for completed sessions.'
                    }
                    icon={<IconGauge size={18} />}
                  />
                  <MetricCard
                    label="Total session duration"
                    value={formatDurationSeconds(data.watch.totalSessionDurationSeconds) ?? '—'}
                    description="Summed wall-clock duration of completed sessions in the period."
                    icon={<IconHourglass size={18} />}
                  />
                  <MetricCard
                    label="Total watch time"
                    value="Unavailable"
                    description="Requires per-user playback heartbeats, which are not persisted in the current schema."
                    icon={<IconEyeOff size={18} />}
                    unavailable
                  />
                </MetricGrid>
              </section>

              <div className="admin-callout admin-callout--info">
                <span className="admin-callout__icon" aria-hidden="true">
                  <IconEyeOff size={18} />
                </span>
                <div>
                  <p className="admin-callout__title">Per-user watch time is not tracked</p>
                  <p className="admin-callout__text">{data.watch.limitation}</p>
                </div>
              </div>

              {Object.keys(meta?.definitions ?? {}).length > 0 ? (
                <details className="admin-definitions">
                  <summary>
                    <IconClock size={15} />
                    How these metrics are calculated
                  </summary>
                  <dl className="admin-definitions__list">
                    {Object.entries(meta?.definitions ?? {}).map(([key, value]) => (
                      <div className="admin-definitions__row" key={key}>
                        <dt>{humanizeKey(key)}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}

              <p className="admin-generated">
                {generatedAt ? `Updated ${generatedAt}` : 'Latest available data'}
                {refreshing ? ' · refreshing…' : ''} · Reported in UTC
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function isEmptyOverview(data: {
  users: { total: number };
  rooms: { total: number };
  watch: { totalSessions: number };
}): boolean {
  return data.users.total === 0 && data.rooms.total === 0 && data.watch.totalSessions === 0;
}

function hasPeriodActivity(data: {
  users: { newInPeriod: number; activeInPeriod: number };
  rooms: { createdInPeriod: number };
  watch: { sessionsInPeriod: number };
}): boolean {
  return (
    data.users.newInPeriod +
      data.users.activeInPeriod +
      data.rooms.createdInPeriod +
      data.watch.sessionsInPeriod >
    0
  );
}
