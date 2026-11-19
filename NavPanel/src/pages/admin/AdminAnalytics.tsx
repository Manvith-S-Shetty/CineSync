import { useMemo, useState } from 'react';
import AdminDateRangeSelector from '../../admin/AdminDateRangeSelector';
import MetricCard from '../../admin/MetricCard';
import MetricGrid from '../../admin/MetricGrid';
import { AdminSkeletonGrid } from '../../admin/AdminStates';
import BarChart from '../../admin/charts/BarChart';
import ChartCard, { type ChartStatus } from '../../admin/charts/ChartCard';
import ComparisonBars from '../../admin/charts/ComparisonBars';
import LineChart from '../../admin/charts/LineChart';
import { formatChartDay, sumValues } from '../../admin/chartUtils';
import {
  createAdminDateRange,
  type AdminDateRange,
} from '../../admin/dateRange';
import {
  formatCount,
  formatDurationAxis,
  formatDurationSeconds,
} from '../../admin/format';
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconEyeOff,
  IconFilm,
  IconGauge,
  IconHourglass,
  IconInfo,
  IconRefresh,
  IconRooms,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
} from '../../admin/icons';
import {
  useAdminAnalyticsResource,
  type AdminResourceState,
} from '../../admin/useAdminAnalyticsResource';
import {
  fetchAdminRoomAnalytics,
  fetchAdminUserAnalytics,
  fetchAdminWatchTimeAnalytics,
} from '../../services/adminApi';

const USER_COLOR = '#a78bfa';
const DAU_COLOR = '#60a5fa';
const ROOM_COLOR = '#34d399';
const WATCH_COLOR = '#fbbf24';

const formatDurationValue = (value: number): string => formatDurationSeconds(value) ?? '0s';

function chartStatus<T>(resource: AdminResourceState<T>, hasData: boolean): ChartStatus {
  if (resource.status === 'error') return 'error';
  if (resource.status === 'loading') return 'loading';
  return hasData ? 'ready' : 'empty';
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<AdminDateRange>(() => createAdminDateRange(30));

  const users = useAdminAnalyticsResource(range, fetchAdminUserAnalytics);
  const rooms = useAdminAnalyticsResource(range, fetchAdminRoomAnalytics);
  const watch = useAdminAnalyticsResource(range, fetchAdminWatchTimeAnalytics);

  const refreshing = users.refreshing || rooms.refreshing || watch.refreshing;
  const busy =
    refreshing ||
    users.status === 'loading' ||
    rooms.status === 'loading' ||
    watch.status === 'loading';

  const refreshAll = () => {
    users.retry();
    rooms.retry();
    watch.retry();
  };

  const registrationPoints = useMemo(
    () =>
      users.data
        ? users.data.registrations.map((row) => ({ date: row.date, value: row.newUsers }))
        : [],
    [users.data]
  );
  const dauPoints = useMemo(
    () =>
      users.data
        ? users.data.activeUsers.daily.map((row) => ({ date: row.date, value: row.activeUsers }))
        : [],
    [users.data]
  );
  const registrationTotal = useMemo(
    () => sumValues(registrationPoints.map((point) => point.value)),
    [registrationPoints]
  );
  const dauTotal = useMemo(
    () => sumValues(dauPoints.map((point) => point.value)),
    [dauPoints]
  );
  const lastDauDay = users.data?.activeUsers.daily.length
    ? users.data.activeUsers.daily[users.data.activeUsers.daily.length - 1].date
    : null;

  const roomCreatedPoints = useMemo(
    () =>
      rooms.data
        ? rooms.data.createdOverTime.map((row) => ({ date: row.date, value: row.roomsCreated }))
        : [],
    [rooms.data]
  );
  const roomCreatedTotal = useMemo(
    () => sumValues(roomCreatedPoints.map((point) => point.value)),
    [roomCreatedPoints]
  );

  const sessionPoints = useMemo(
    () =>
      watch.data
        ? watch.data.trend.map((row) => ({ date: row.date, value: row.sessionCount }))
        : [],
    [watch.data]
  );
  const sessionTotal = useMemo(
    () => sumValues(sessionPoints.map((point) => point.value)),
    [sessionPoints]
  );
  const durationPoints = useMemo(
    () =>
      watch.data
        ? watch.data.trend.map((row) => ({
            date: row.date,
            value: row.totalSessionDurationSeconds,
          }))
        : [],
    [watch.data]
  );
  const durationTotal = useMemo(
    () => sumValues(durationPoints.map((point) => point.value)),
    [durationPoints]
  );

  return (
    <div className={`admin-page admin-analytics${refreshing ? ' is-refreshing' : ''}`}>
      <section className="admin-page__intro">
        <div className="admin-page__intro-text">
          <p className="admin-eyebrow">Analytics</p>
          <h2 className="admin-page__heading">Trends &amp; distribution</h2>
          <p className="admin-page__lede">
            Daily trends use the same UTC window for all three analytics resources. Presence-based
            activity reflects room membership, not confirmed video playback.
          </p>
        </div>

        <div className="admin-page__controls">
          <AdminDateRangeSelector value={range} onChange={setRange} />
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-refresh"
            onClick={refreshAll}
            disabled={busy}
          >
            <IconRefresh size={16} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </section>

      {/* ---------------- Users ---------------- */}
      <section className="admin-section">
        <div className="admin-section__header">
          <h3 className="admin-section__title">User activity</h3>
          <p className="admin-section__hint">
            Registrations and presence-based active users · UTC
          </p>
        </div>

        {users.status === 'loading' ? <AdminSkeletonGrid count={4} /> : null}

        {users.status === 'success' && users.data ? (
          <MetricGrid>
            <MetricCard
              label="New registrations"
              value={formatCount(registrationTotal)}
              description={`New accounts created during ${range.label.toLowerCase()}.`}
              icon={<IconUserPlus size={18} />}
            />
            <MetricCard
              label="Latest daily active users"
              value={formatCount(users.data.activeUsers.latestDaily)}
              description={
                lastDauDay
                  ? `Distinct users with room presence on ${formatChartDay(lastDauDay)} UTC.`
                  : 'No daily presence data in this period.'
              }
              icon={<IconUserCheck size={18} />}
              tone="accent"
            />
            <MetricCard
              label="Weekly active users"
              value={formatCount(users.data.activeUsers.weekly)}
              description="Rolling 7-day presence window ending at the range end."
              icon={<IconCalendar size={18} />}
            />
            <MetricCard
              label="Monthly active users"
              value={formatCount(users.data.activeUsers.monthly)}
              description="Rolling 30-day presence window ending at the range end."
              icon={<IconUsers size={18} />}
            />
          </MetricGrid>
        ) : null}

        <div className="admin-chart-grid">
          <ChartCard
            title="Registration growth"
            subtitle="New users registered per UTC day"
            status={chartStatus(users, registrationTotal > 0)}
            errorMessage={users.error?.message}
            onRetry={users.retry}
            emptyMessage="No new users registered in this period."
            footnote="Each point counts users whose account was created on that UTC day."
          >
            <LineChart
              points={registrationPoints}
              valueLabel="New users"
              formatValue={formatCount}
              color={USER_COLOR}
            />
          </ChartCard>

          <ChartCard
            title="Daily active users"
            subtitle="Distinct users with room presence per UTC day"
            status={chartStatus(users, dauTotal > 0)}
            errorMessage={users.error?.message}
            onRetry={users.retry}
            emptyMessage="No room presence was recorded on any day in this period."
            footnote="Presence is derived from room membership intervals, not confirmed playback."
          >
            <LineChart
              points={dauPoints}
              valueLabel="Active users"
              formatValue={formatCount}
              color={DAU_COLOR}
              fill
            />
          </ChartCard>
        </div>
      </section>

      {/* ---------------- Rooms ---------------- */}
      <section className="admin-section">
        <div className="admin-section__header">
          <h3 className="admin-section__title">Rooms</h3>
          <p className="admin-section__hint">Creation volume, lifecycle state, and participation</p>
        </div>

        {rooms.status === 'loading' ? <AdminSkeletonGrid count={6} /> : null}

        {rooms.status === 'success' && rooms.data ? (
          <MetricGrid>
            <MetricCard
              label="Rooms created"
              value={formatCount(rooms.data.totals.roomsCreatedInPeriod)}
              description={`Rooms created during ${range.label.toLowerCase()}.`}
              icon={<IconRooms size={18} />}
            />
            <MetricCard
              label="Average room duration"
              value={formatDurationSeconds(rooms.data.averageRoomDurationSeconds) ?? '—'}
              description={
                rooms.data.averageRoomDurationSeconds === null
                  ? 'No ended rooms were created in this period.'
                  : 'Ended rooms created in this period.'
              }
              icon={<IconClock size={18} />}
            />
            <MetricCard
              label="Participant joins"
              value={formatCount(rooms.data.participation.participantJoinsInPeriod)}
              description="Presence records started in this period. Rejoins count again."
              icon={<IconUserPlus size={18} />}
            />
            <MetricCard
              label="Unique participants"
              value={formatCount(rooms.data.participation.uniqueParticipantsInPeriod)}
              description="Distinct users with presence overlapping the period."
              icon={<IconUsers size={18} />}
            />
            <MetricCard
              label="Avg participants per room"
              value={
                rooms.data.participation.averageParticipantsPerRoom === null
                  ? '—'
                  : formatCount(rooms.data.participation.averageParticipantsPerRoom)
              }
              description={
                rooms.data.participation.averageParticipantsPerRoom === null
                  ? 'No room received a join in this period.'
                  : 'Across rooms with at least one join in this period.'
              }
              icon={<IconGauge size={18} />}
            />
            <MetricCard
              label="Avg completed presence"
              value={
                formatDurationSeconds(
                  rooms.data.participation.averageCompletedPresenceDurationSeconds
                ) ?? '—'
              }
              description={
                rooms.data.participation.averageCompletedPresenceDurationSeconds === null
                  ? 'No completed presence records in this period.'
                  : 'Completed presence rows; open rows are excluded.'
              }
              icon={<IconHourglass size={18} />}
            />
          </MetricGrid>
        ) : null}

        <div className="admin-chart-grid">
          <ChartCard
            title="Rooms created"
            subtitle="Rooms created per UTC day"
            status={chartStatus(rooms, roomCreatedTotal > 0)}
            errorMessage={rooms.error?.message}
            onRetry={rooms.retry}
            emptyMessage="No rooms were created in this period."
            footnote="Counts rooms by their created_at UTC day."
          >
            <BarChart
              points={roomCreatedPoints}
              valueLabel="Rooms created"
              formatValue={formatCount}
              color={ROOM_COLOR}
            />
          </ChartCard>

          <ChartCard
            title="Active vs ended rooms"
            subtitle="All-time persisted room states"
            status={chartStatus(
              rooms,
              (rooms.data?.totals.activeRooms ?? 0) + (rooms.data?.totals.endedRooms ?? 0) > 0
            )}
            errorMessage={rooms.error?.message}
            onRetry={rooms.retry}
            emptyMessage="No active or ended rooms have been recorded."
            footnote="Active status may be stale after a process crash; ended rooms include a persisted end timestamp."
          >
            <ComparisonBars
              items={[
                {
                  label: 'Active',
                  value: rooms.data?.totals.activeRooms ?? 0,
                  color: ROOM_COLOR,
                },
                {
                  label: 'Ended',
                  value: rooms.data?.totals.endedRooms ?? 0,
                  color: '#64748b',
                },
              ]}
              formatValue={formatCount}
              ariaLabel={`Active rooms: ${rooms.data?.totals.activeRooms ?? 0}. Ended rooms: ${
                rooms.data?.totals.endedRooms ?? 0
              }.`}
            />
          </ChartCard>
        </div>
      </section>

      {/* ---------------- Watch sessions ---------------- */}
      <section className="admin-section">
        <div className="admin-section__header">
          <h3 className="admin-section__title">Watch sessions</h3>
          <p className="admin-section__hint">Recorded shared-session duration · UTC</p>
        </div>

        {watch.status === 'loading' ? <AdminSkeletonGrid count={7} /> : null}

        {watch.status === 'success' && watch.data ? (
          <>
            <MetricGrid>
              <MetricCard
                label="Total sessions"
                value={formatCount(watch.data.sessions.total)}
                description="All watch-session records, all time."
                icon={<IconFilm size={18} />}
              />
              <MetricCard
                label="Sessions in period"
                value={formatCount(watch.data.sessions.inPeriod)}
                description={`Watch sessions started during ${range.label.toLowerCase()}.`}
                icon={<IconCalendar size={18} />}
              />
              <MetricCard
                label="Completed in period"
                value={formatCount(watch.data.sessions.completedInPeriod)}
                description="Sessions with a valid end timestamp."
                icon={<IconCheckCircle size={18} />}
              />
              <MetricCard
                label="Average session duration"
                value={formatDurationSeconds(watch.data.sessions.averageDurationSeconds) ?? '—'}
                description={
                  watch.data.sessions.averageDurationSeconds === null
                    ? 'No completed sessions in this period.'
                    : 'Completed sessions started in this period.'
                }
                icon={<IconGauge size={18} />}
              />
              <MetricCard
                label="Total recorded duration"
                value={
                  formatDurationSeconds(watch.data.sessions.totalSessionDurationSeconds) ?? '0s'
                }
                description="Summed shared-session wall-clock duration."
                icon={<IconHourglass size={18} />}
              />
              <MetricCard
                label="Longest session"
                value={
                  formatDurationSeconds(watch.data.sessions.longestSessionDurationSeconds) ?? '—'
                }
                description="Longest completed session started in this period."
                icon={<IconClock size={18} />}
              />
              <MetricCard
                label="Total watch time"
                value="Unavailable"
                description="Per-user viewing time is not persisted in the current schema."
                icon={<IconEyeOff size={18} />}
                unavailable
              />
            </MetricGrid>

            {watch.data.sessions.invalidInPeriod > 0 ? (
              <p className="admin-footnote">
                {formatCount(watch.data.sessions.invalidInPeriod)} invalid session
                {watch.data.sessions.invalidInPeriod === 1 ? '' : 's'} in this period (end before
                start) were excluded from duration metrics.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="admin-chart-grid">
          <ChartCard
            title="Sessions started"
            subtitle="Watch sessions started per UTC day"
            status={chartStatus(watch, sessionTotal > 0)}
            errorMessage={watch.error?.message}
            onRetry={watch.retry}
            emptyMessage="No watch sessions started in this period."
            footnote="Active and invalid sessions are counted; duration metrics exclude invalid rows."
          >
            <BarChart
              points={sessionPoints}
              valueLabel="Sessions"
              formatValue={formatCount}
              color={WATCH_COLOR}
            />
          </ChartCard>

          <ChartCard
            title="Recorded session duration"
            subtitle="Shared-session wall-clock duration per UTC day"
            status={chartStatus(watch, durationTotal > 0)}
            errorMessage={watch.error?.message}
            onRetry={watch.retry}
            emptyMessage="No completed session duration was recorded in this period."
            footnote="This is shared media-session duration, not individual viewing time."
          >
            <LineChart
              points={durationPoints}
              valueLabel="Recorded duration"
              formatValue={formatDurationValue}
              formatAxis={formatDurationAxis}
              color={WATCH_COLOR}
              fill
            />
          </ChartCard>
        </div>

        <div className="admin-callout admin-callout--info">
          <span className="admin-callout__icon" aria-hidden="true">
            <IconEyeOff size={18} />
          </span>
          <div>
            <p className="admin-callout__title">Per-user watch time is unavailable</p>
            <p className="admin-callout__text">
              {watch.data?.limitation ??
                'watch_sessions stores the wall-clock duration of a shared media session, not per-user playback position or confirmed viewing. All duration figures on this page describe recorded shared sessions only.'}
            </p>
          </div>
        </div>

        <div className="admin-callout admin-callout--muted">
          <span className="admin-callout__icon" aria-hidden="true">
            <IconInfo size={18} />
          </span>
          <div>
            <p className="admin-callout__text">
              WAU and MAU use rolling windows ending at the selected range end. User activity is
              presence-based and does not imply confirmed video playback.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
