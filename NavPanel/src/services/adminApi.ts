import { getBackendUrl } from '../config/backendUrl';
import type {
  AdminErrorBody,
  AdminMeData,
  AdminResponseMeta,
  OverviewData,
  RoomAnalyticsData,
  UserAnalyticsData,
  WatchTimeAnalyticsData,
} from '../types/admin';

/**
 * Bearer-token getter. Backed by Firebase Auth via AuthContext.getIdToken.
 * Passing `true` forces a token refresh when a stale token is suspected.
 */
export type AdminTokenGetter = (forceRefresh?: boolean) => Promise<string>;

export type AdminErrorKind =
  | 'auth'
  | 'forbidden'
  | 'unavailable'
  | 'invalid_request'
  | 'server'
  | 'network'
  | 'config'
  | 'response';

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: AdminErrorKind;

  constructor(status: number, code: string, message: string, kind: AdminErrorKind) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.kind = kind;
  }
}

export function toAdminApiError(value: unknown): AdminApiError {
  if (value instanceof AdminApiError) return value;
  return new AdminApiError(
    0,
    'UNKNOWN_ERROR',
    'The admin request could not be completed.',
    'server'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): boolean {
  return value === null || isFiniteNumber(value);
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isRecord(item));
}

function errorKindForStatus(status: number): AdminErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 503) return 'unavailable';
  if (status === 400) return 'invalid_request';
  if (status === 0) return 'network';
  return 'server';
}

/** Safe, user-facing messages. Backend internals are never surfaced. */
function safeMessage(status: number, code: string): string {
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'AUTH_INVALID':
      return 'Your session could not be verified. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'This account does not have access to the CineSync admin console.';
    case 'AUTH_UNAVAILABLE':
      return 'The authentication service is temporarily unavailable. Please retry shortly.';
    case 'DATABASE_UNAVAILABLE':
      return 'The analytics database is temporarily unavailable. Please retry shortly.';
    case 'INVALID_RANGE':
    case 'RANGE_TOO_LARGE':
    case 'INVALID_DATE':
      return 'The selected date range is not valid.';
    case 'INVALID_PAGINATION':
    case 'INVALID_SORT':
    case 'INVALID_SEARCH':
    case 'INVALID_QUERY':
      return 'The request parameters were invalid.';
    case 'BACKEND_UNCONFIGURED':
      return 'The backend URL is not configured. Set VITE_BACKEND_URL and rebuild.';
    case 'NETWORK_ERROR':
      return 'Could not reach the CineSync backend. Check your connection and retry.';
    case 'INVALID_RESPONSE':
      return 'The admin service returned an unexpected response.';
    case 'INTERNAL_ERROR':
      return 'The analytics service could not complete the request. Please retry.';
    default:
      return status === 503
        ? 'The admin service is temporarily unavailable. Please retry shortly.'
        : 'The admin request failed. Please retry.';
  }
}

function extractErrorCode(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const error = body.error;
  if (isRecord(error) && typeof error.code === 'string' && error.code.length <= 64) {
    return error.code;
  }
  return null;
}

/**
 * Deduplicates identical in-flight GETs (React StrictMode remounts, rapid
 * navigation, repeated date selections) without caching token-bound results.
 */
const inFlight = new Map<string, Promise<unknown>>();

function runDeduped<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = run().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

interface HttpResult {
  status: number;
  ok: boolean;
  body: unknown;
}

async function sendRequest(
  path: string,
  getIdToken: AdminTokenGetter,
  forceRefresh: boolean
): Promise<HttpResult> {
  const token = await getIdToken(forceRefresh);
  const base = getBackendUrl();
  const response = await fetch(`${base}/api/admin${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    credentials: 'omit',
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }

  return { status: response.status, ok: response.ok, body };
}

async function adminGet<T>(
  path: string,
  getIdToken: AdminTokenGetter,
  validate: (data: unknown) => data is T
): Promise<{ data: T; meta: AdminResponseMeta | null }> {
  if (!getBackendUrl()) {
    throw new AdminApiError(
      0,
      'BACKEND_UNCONFIGURED',
      safeMessage(0, 'BACKEND_UNCONFIGURED'),
      'config'
    );
  }

  let result: HttpResult;
  try {
    result = await sendRequest(path, getIdToken, false);
    // Firebase may still hand back a cached token that the backend rejects.
    // Retry once after a forced refresh before reporting an auth failure.
    if (result.status === 401) {
      result = await sendRequest(path, getIdToken, true);
    }
  } catch {
    throw new AdminApiError(0, 'NETWORK_ERROR', safeMessage(0, 'NETWORK_ERROR'), 'network');
  }

  if (result.ok && isRecord(result.body) && result.body.ok === true) {
    const data = result.body.data;
    if (!validate(data)) {
      throw new AdminApiError(
        result.status,
        'INVALID_RESPONSE',
        safeMessage(result.status, 'INVALID_RESPONSE'),
        'response'
      );
    }
    const meta = isRecord(result.body.meta)
      ? (result.body.meta as unknown as AdminResponseMeta)
      : null;
    return { data, meta };
  }

  const body: AdminErrorBody | null = isRecord(result.body) && result.body.ok === false
    ? (result.body as unknown as AdminErrorBody)
    : null;
  const code = body ? extractErrorCode(body) ?? 'UNKNOWN_ERROR' : extractErrorCode(result.body) ?? 'UNKNOWN_ERROR';
  const kind = errorKindForStatus(result.status);
  throw new AdminApiError(result.status, code, safeMessage(result.status, code), kind);
}

function isOverviewData(value: unknown): value is OverviewData {
  if (!isRecord(value)) return false;
  const { users, rooms, watch } = value;
  if (!isRecord(users) || !isRecord(rooms) || !isRecord(watch)) return false;

  return (
    isFiniteNumber(users.total) &&
    isFiniteNumber(users.newInPeriod) &&
    isFiniteNumber(users.activeInPeriod) &&
    isFiniteNumber(rooms.total) &&
    isFiniteNumber(rooms.createdInPeriod) &&
    isFiniteNumber(rooms.active) &&
    isFiniteNumber(rooms.ended) &&
    isFiniteNumber(watch.totalSessions) &&
    isFiniteNumber(watch.sessionsInPeriod) &&
    isFiniteNumber(watch.activeSessions) &&
    isFiniteNumber(watch.completedSessionsInPeriod) &&
    (watch.averageSessionDurationSeconds === null ||
      isFiniteNumber(watch.averageSessionDurationSeconds)) &&
    isFiniteNumber(watch.totalSessionDurationSeconds) &&
    watch.totalWatchTimeSeconds === null &&
    watch.watchTimeAvailable === false &&
    typeof watch.limitation === 'string'
  );
}

function isAdminMeData(value: unknown): value is AdminMeData {
  return isRecord(value) && typeof value.uid === 'string' && value.isAdmin === true;
}

function isUserAnalyticsData(value: unknown): value is UserAnalyticsData {
  if (!isRecord(value) || !isRecord(value.activeUsers)) return false;
  const active = value.activeUsers;

  return (
    isRecordArray(value.registrations) &&
    value.registrations.every(
      (row) => typeof row.date === 'string' && isFiniteNumber(row.newUsers)
    ) &&
    isRecordArray(active.daily) &&
    active.daily.every(
      (row) => typeof row.date === 'string' && isFiniteNumber(row.activeUsers)
    ) &&
    isFiniteNumber(active.latestDaily) &&
    isFiniteNumber(active.weekly) &&
    isFiniteNumber(active.monthly)
  );
}

function isRoomAnalyticsData(value: unknown): value is RoomAnalyticsData {
  if (!isRecord(value) || !isRecord(value.totals) || !isRecord(value.participation)) {
    return false;
  }
  const totals = value.totals;
  const participation = value.participation;

  return (
    isFiniteNumber(totals.totalRooms) &&
    isFiniteNumber(totals.activeRooms) &&
    isFiniteNumber(totals.endedRooms) &&
    isFiniteNumber(totals.roomsCreatedInPeriod) &&
    isNullableNumber(value.averageRoomDurationSeconds) &&
    isFiniteNumber(participation.participantJoinsInPeriod) &&
    isFiniteNumber(participation.uniqueParticipantsInPeriod) &&
    isNullableNumber(participation.averageParticipantsPerRoom) &&
    isNullableNumber(participation.averageCompletedPresenceDurationSeconds) &&
    isRecordArray(value.createdOverTime) &&
    value.createdOverTime.every(
      (row) => typeof row.date === 'string' && isFiniteNumber(row.roomsCreated)
    )
  );
}

function isWatchTimeAnalyticsData(value: unknown): value is WatchTimeAnalyticsData {
  if (!isRecord(value) || !isRecord(value.sessions)) return false;
  const sessions = value.sessions;

  return (
    value.totalWatchTimeSeconds === null &&
    value.watchTimeAvailable === false &&
    typeof value.limitation === 'string' &&
    isFiniteNumber(sessions.total) &&
    isFiniteNumber(sessions.inPeriod) &&
    isFiniteNumber(sessions.completedInPeriod) &&
    isFiniteNumber(sessions.active) &&
    isFiniteNumber(sessions.invalidInPeriod) &&
    isNullableNumber(sessions.averageDurationSeconds) &&
    isFiniteNumber(sessions.totalSessionDurationSeconds) &&
    isNullableNumber(sessions.longestSessionDurationSeconds) &&
    isRecordArray(value.trend) &&
    value.trend.every(
      (row) =>
        typeof row.date === 'string' &&
        isFiniteNumber(row.sessionCount) &&
        isFiniteNumber(row.totalSessionDurationSeconds) &&
        isNullableNumber(row.averageSessionDurationSeconds)
    )
  );
}

function rangeQuery(fromIso: string, toIso: string): string {
  return `?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`;
}

/** Verifies the signed-in Firebase identity against the backend admin allowlist. */
export function fetchAdminMe(
  getIdToken: AdminTokenGetter
): Promise<{ data: AdminMeData; meta: AdminResponseMeta | null }> {
  return runDeduped('admin:me', () => adminGet('/me', getIdToken, isAdminMeData));
}

/** Real overview metrics for the selected UTC range. */
export function fetchAdminOverview(
  getIdToken: AdminTokenGetter,
  fromIso: string,
  toIso: string
): Promise<{ data: OverviewData; meta: AdminResponseMeta | null }> {
  return runDeduped(`admin:overview:${fromIso}:${toIso}`, () =>
    adminGet(`/overview${rangeQuery(fromIso, toIso)}`, getIdToken, isOverviewData)
  );
}

/** User registrations and presence-based DAU/WAU/MAU for the selected range. */
export function fetchAdminUserAnalytics(
  getIdToken: AdminTokenGetter,
  fromIso: string,
  toIso: string
): Promise<{ data: UserAnalyticsData; meta: AdminResponseMeta | null }> {
  return runDeduped(`admin:analytics:users:${fromIso}:${toIso}`, () =>
    adminGet(`/analytics/users${rangeQuery(fromIso, toIso)}`, getIdToken, isUserAnalyticsData)
  );
}

/** Room lifecycle, duration, and participation metrics for the selected range. */
export function fetchAdminRoomAnalytics(
  getIdToken: AdminTokenGetter,
  fromIso: string,
  toIso: string
): Promise<{ data: RoomAnalyticsData; meta: AdminResponseMeta | null }> {
  return runDeduped(`admin:analytics:rooms:${fromIso}:${toIso}`, () =>
    adminGet(`/analytics/rooms${rangeQuery(fromIso, toIso)}`, getIdToken, isRoomAnalyticsData)
  );
}

/** Shared-session wall-clock metrics. Per-user watch time is not available. */
export function fetchAdminWatchTimeAnalytics(
  getIdToken: AdminTokenGetter,
  fromIso: string,
  toIso: string
): Promise<{ data: WatchTimeAnalyticsData; meta: AdminResponseMeta | null }> {
  return runDeduped(`admin:analytics:watch-time:${fromIso}:${toIso}`, () =>
    adminGet(
      `/analytics/watch-time${rangeQuery(fromIso, toIso)}`,
      getIdToken,
      isWatchTimeAnalyticsData
    )
  );
}
