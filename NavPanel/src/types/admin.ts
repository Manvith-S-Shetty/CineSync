/**
 * Frontend mirrors of the Phase 2.4 backend admin response shapes.
 * Source of truth: VisionBridge/src/routes/adminAnalytics.ts and VisionBridge/src/db/analytics.ts.
 */

export interface AdminMeData {
  uid: string;
  isAdmin: true;
}

export interface AdminRangeMeta {
  from: string;
  to: string;
  timezone: 'UTC';
  interval: '[from, to)';
}

export interface AdminResponseMeta {
  generatedAt: string;
  range?: AdminRangeMeta;
  definitions?: Record<string, string>;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  query?: string;
}

/** `GET /api/admin/overview` -> data */
export interface OverviewData {
  users: {
    total: number;
    newInPeriod: number;
    activeInPeriod: number;
  };
  rooms: {
    total: number;
    createdInPeriod: number;
    active: number;
    ended: number;
  };
  watch: {
    totalSessions: number;
    sessionsInPeriod: number;
    activeSessions: number;
    completedSessionsInPeriod: number;
    averageSessionDurationSeconds: number | null;
    totalSessionDurationSeconds: number;
    totalWatchTimeSeconds: null;
    watchTimeAvailable: false;
    limitation: string;
  };
}

/** `GET /api/admin/analytics/users` -> data */
export interface UserAnalyticsData {
  registrations: Array<{ date: string; newUsers: number }>;
  activeUsers: {
    daily: Array<{ date: string; activeUsers: number }>;
    latestDaily: number;
    weekly: number;
    monthly: number;
  };
}

/** `GET /api/admin/analytics/rooms` -> data */
export interface RoomAnalyticsData {
  totals: {
    totalRooms: number;
    activeRooms: number;
    endedRooms: number;
    roomsCreatedInPeriod: number;
  };
  averageRoomDurationSeconds: number | null;
  participation: {
    participantJoinsInPeriod: number;
    uniqueParticipantsInPeriod: number;
    averageParticipantsPerRoom: number | null;
    averageCompletedPresenceDurationSeconds: number | null;
  };
  createdOverTime: Array<{ date: string; roomsCreated: number }>;
}

/** `GET /api/admin/analytics/watch-time` -> data */
export interface WatchTimeAnalyticsData {
  totalWatchTimeSeconds: null;
  watchTimeAvailable: false;
  limitation: string;
  sessions: {
    total: number;
    inPeriod: number;
    completedInPeriod: number;
    active: number;
    invalidInPeriod: number;
    averageDurationSeconds: number | null;
    totalSessionDurationSeconds: number;
    longestSessionDurationSeconds: number | null;
  };
  trend: Array<{
    date: string;
    sessionCount: number;
    totalSessionDurationSeconds: number;
    averageSessionDurationSeconds: number | null;
  }>;
}

export interface AdminSuccessBody<T> {
  ok: true;
  data: T;
  meta?: AdminResponseMeta;
}

export interface AdminErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}
