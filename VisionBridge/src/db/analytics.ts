import { type Pool, type QueryResultRow } from 'pg';
import { getPool } from './pool';

export interface DateRange {
    from: Date;
    to: Date;
}

export type UserSortField =
    | 'registeredAt'
    | 'lastSeenAt'
    | 'displayName'
    | 'roomCount'
    | 'participantSessions'
    | 'watchSessionsHosted';

export type SortDirection = 'asc' | 'desc';

export interface UserListParams {
    page: number;
    pageSize: number;
    search: string;
    sortField: UserSortField;
    sortDirection: SortDirection;
}

export interface AdminUserListItem {
    id: number;
    displayName: string;
    emailMasked: string | null;
    registeredAt: string;
    lastSeenAt: string | null;
    roomCount: number;
    participantSessions: number;
    watchSessionsHosted: number;
}

export interface AdminUserListResult {
    users: AdminUserListItem[];
    total: number;
}

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

export interface UserAnalyticsData {
    registrations: Array<{ date: string; newUsers: number }>;
    activeUsers: {
        daily: Array<{ date: string; activeUsers: number }>;
        latestDaily: number;
        weekly: number;
        monthly: number;
    };
}

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

export interface ActivityItem {
    id: string;
    type: string;
    occurredAt: string;
    roomCode: string | null;
    actor: { id: number; displayName: string } | null;
    metadata: Record<string, unknown> | null;
}

export interface ActivityResult {
    items: ActivityItem[];
    total: number;
}

export interface ActivityParams {
    page: number;
    pageSize: number;
    range: DateRange;
}

export class AnalyticsDatabaseUnavailableError extends Error {
    readonly code = 'DATABASE_UNAVAILABLE';

    constructor() {
        super('Analytics database is not configured');
    }
}

export const WATCH_TIME_LIMITATION =
    'watch_sessions stores the wall-clock duration of a shared media session (started_at to ended_at), not per-user playback position or confirmed viewing time. Accurate total and per-user watch time requires playback heartbeats, which are not persisted in the current schema.';

function toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function toRoundedNumber(value: unknown): number {
    return Math.round(toNumber(value));
}

function toNullableRoundedNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
}

function toIsoString(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
}

function maskEmail(email: unknown): string | null {
    if (typeof email !== 'string' || !email.includes('@')) return null;
    const [local, domain] = email.split('@');
    if (!domain) return null;
    const visible = local.slice(0, 1);
    return `${visible}***@${domain}`;
}

function getRequiredPool(): Pool {
    const pool = getPool();
    if (!pool) throw new AnalyticsDatabaseUnavailableError();
    return pool;
}

async function queryRows<T extends QueryResultRow>(
    sql: string,
    params: unknown[]
): Promise<T[]> {
    const pool = getRequiredPool();
    const result = await pool.query<T>(sql, params as any[]);
    return result.rows;
}

const USER_SORT_COLUMNS: Record<UserSortField, string> = {
    registeredAt: 'created_at',
    lastSeenAt: 'last_seen_at',
    displayName: 'display_name',
    roomCount: 'room_count',
    participantSessions: 'participant_sessions',
    watchSessionsHosted: 'watch_sessions_hosted',
};

function daySeriesCte(): string {
    return `
        WITH days AS (
            SELECT generate_series(
                ($1::timestamptz AT TIME ZONE 'UTC')::date,
                (($2::timestamptz - interval '1 second') AT TIME ZONE 'UTC')::date,
                interval '1 day'
            )::date AS day
        )`;
}

export async function getOverview(range: DateRange): Promise<OverviewData> {
    const rows = await queryRows<{
        total_users: string;
        new_users: string;
        active_users: string;
        total_rooms: string;
        rooms_created: string;
        active_rooms: string;
        ended_rooms: string;
        total_watch_sessions: string;
        watch_sessions_in_period: string;
        active_watch_sessions: string;
        completed_watch_sessions: string;
        average_session_duration_seconds: string | null;
        total_session_duration_seconds: string | null;
    }>(
        `SELECT
            (SELECT COUNT(*) FROM users) AS total_users,
            (SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2) AS new_users,
            (SELECT COUNT(DISTINCT rp.firebase_uid)
               FROM room_participants rp
              WHERE rp.joined_at < $2
                AND COALESCE(rp.left_at, now()) > $1) AS active_users,
            (SELECT COUNT(*) FROM rooms) AS total_rooms,
            (SELECT COUNT(*) FROM rooms WHERE created_at >= $1 AND created_at < $2) AS rooms_created,
            (SELECT COUNT(*) FROM rooms WHERE status = 'active') AS active_rooms,
            (SELECT COUNT(*) FROM rooms WHERE status = 'ended' OR ended_at IS NOT NULL) AS ended_rooms,
            (SELECT COUNT(*) FROM watch_sessions) AS total_watch_sessions,
            (SELECT COUNT(*) FROM watch_sessions WHERE started_at >= $1 AND started_at < $2) AS watch_sessions_in_period,
            (SELECT COUNT(*) FROM watch_sessions WHERE is_active = true) AS active_watch_sessions,
            (SELECT COUNT(*)
               FROM watch_sessions
              WHERE started_at >= $1 AND started_at < $2
                AND ended_at IS NOT NULL AND ended_at >= started_at) AS completed_watch_sessions,
            (SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))
               FROM watch_sessions
              WHERE ended_at IS NOT NULL AND ended_at >= started_at
                AND started_at >= $1 AND started_at < $2) AS average_session_duration_seconds,
            (SELECT SUM(EXTRACT(EPOCH FROM (ended_at - started_at)))
               FROM watch_sessions
              WHERE ended_at IS NOT NULL AND ended_at >= started_at
                AND started_at >= $1 AND started_at < $2) AS total_session_duration_seconds`,
        [range.from, range.to]
    );

    const row = rows[0];
    if (!row) {
        return {
            users: { total: 0, newInPeriod: 0, activeInPeriod: 0 },
            rooms: { total: 0, createdInPeriod: 0, active: 0, ended: 0 },
            watch: {
                totalSessions: 0,
                sessionsInPeriod: 0,
                activeSessions: 0,
                completedSessionsInPeriod: 0,
                averageSessionDurationSeconds: null,
                totalSessionDurationSeconds: 0,
                totalWatchTimeSeconds: null,
                watchTimeAvailable: false,
                limitation: WATCH_TIME_LIMITATION,
            },
        };
    }

    return {
        users: {
            total: toNumber(row.total_users),
            newInPeriod: toNumber(row.new_users),
            activeInPeriod: toNumber(row.active_users),
        },
        rooms: {
            total: toNumber(row.total_rooms),
            createdInPeriod: toNumber(row.rooms_created),
            active: toNumber(row.active_rooms),
            ended: toNumber(row.ended_rooms),
        },
        watch: {
            totalSessions: toNumber(row.total_watch_sessions),
            sessionsInPeriod: toNumber(row.watch_sessions_in_period),
            activeSessions: toNumber(row.active_watch_sessions),
            completedSessionsInPeriod: toNumber(row.completed_watch_sessions),
            averageSessionDurationSeconds: toNullableRoundedNumber(row.average_session_duration_seconds),
            totalSessionDurationSeconds: toRoundedNumber(row.total_session_duration_seconds),
            totalWatchTimeSeconds: null,
            watchTimeAvailable: false,
            limitation: WATCH_TIME_LIMITATION,
        },
    };
}

export async function listUsers(params: UserListParams): Promise<AdminUserListResult> {
    const searchPattern = params.search ? `%${params.search}%` : '';
    const offset = (params.page - 1) * params.pageSize;
    const sortColumn = USER_SORT_COLUMNS[params.sortField];
    const sortDirection = params.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const countRows = await queryRows<{ total_count: string }>(
        `SELECT COUNT(*) AS total_count
           FROM users u
          WHERE ($1 = '' OR u.display_name ILIKE $1 OR u.email ILIKE $1)`,
        [searchPattern]
    );

    const rows = await queryRows<{
        id: string;
        display_name: string | null;
        email: string | null;
        created_at: Date | string;
        last_seen_at: Date | string | null;
        room_count: string;
        participant_sessions: string;
        watch_sessions_hosted: string;
    }>(
        `WITH filtered AS (
            SELECT
                u.id,
                u.display_name,
                u.email,
                u.created_at,
                u.last_seen_at,
                COALESCE(rp.room_count, 0) AS room_count,
                COALESCE(rp.participant_sessions, 0) AS participant_sessions,
                COALESCE(ws.watch_sessions_hosted, 0) AS watch_sessions_hosted
              FROM users u
              LEFT JOIN (
                  SELECT
                      firebase_uid,
                      COUNT(DISTINCT room_id) AS room_count,
                      COUNT(*) AS participant_sessions
                    FROM room_participants
                   GROUP BY firebase_uid
              ) rp ON rp.firebase_uid = u.firebase_uid
              LEFT JOIN (
                  SELECT host_firebase_uid, COUNT(*) AS watch_sessions_hosted
                    FROM watch_sessions
                   GROUP BY host_firebase_uid
              ) ws ON ws.host_firebase_uid = u.firebase_uid
             WHERE ($1 = '' OR u.display_name ILIKE $1 OR u.email ILIKE $1)
        )
        SELECT id, display_name, email, created_at, last_seen_at,
               room_count, participant_sessions, watch_sessions_hosted
          FROM filtered
         ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, id ASC
         LIMIT $2 OFFSET $3`,
        [searchPattern, params.pageSize, offset]
    );

    return {
        total: toNumber(countRows[0]?.total_count),
        users: rows.map((row) => ({
            id: toNumber(row.id),
            displayName: row.display_name || 'Guest',
            emailMasked: maskEmail(row.email),
            registeredAt: toIsoString(row.created_at) || new Date(0).toISOString(),
            lastSeenAt: toIsoString(row.last_seen_at),
            roomCount: toNumber(row.room_count),
            participantSessions: toNumber(row.participant_sessions),
            watchSessionsHosted: toNumber(row.watch_sessions_hosted),
        })),
    };
}

export async function getUserAnalytics(range: DateRange): Promise<UserAnalyticsData> {
    const rows = await queryRows<{
        day: string;
        new_users: string;
        active_users: string;
    }>(
        `${daySeriesCte()},
        registrations AS (
            SELECT (u.created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS new_users
              FROM users u
             WHERE u.created_at >= $1 AND u.created_at < $2
             GROUP BY 1
        ),
        dau AS (
            SELECT d.day, COUNT(DISTINCT rp.firebase_uid) AS active_users
              FROM days d
              LEFT JOIN room_participants rp
                ON rp.joined_at < ((d.day + interval '1 day')::timestamp AT TIME ZONE 'UTC')
               AND COALESCE(rp.left_at, now()) > (d.day::timestamp AT TIME ZONE 'UTC')
             GROUP BY d.day
        )
        SELECT
            to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(r.new_users, 0) AS new_users,
            COALESCE(dau.active_users, 0) AS active_users
          FROM days d
          LEFT JOIN registrations r ON r.day = d.day
          LEFT JOIN dau ON dau.day = d.day
         ORDER BY d.day`,
        [range.from, range.to]
    );

    const windowRows = await queryRows<{
        weekly_active_users: string;
        monthly_active_users: string;
    }>(
        `SELECT
            (SELECT COUNT(DISTINCT firebase_uid)
               FROM room_participants
              WHERE joined_at < $1
                AND COALESCE(left_at, now()) > ($1::timestamptz - interval '7 days')) AS weekly_active_users,
            (SELECT COUNT(DISTINCT firebase_uid)
               FROM room_participants
              WHERE joined_at < $1
                AND COALESCE(left_at, now()) > ($1::timestamptz - interval '30 days')) AS monthly_active_users`,
        [range.to]
    );

    const daily = rows.map((row) => ({
        date: row.day,
        activeUsers: toNumber(row.active_users),
    }));

    return {
        registrations: rows.map((row) => ({
            date: row.day,
            newUsers: toNumber(row.new_users),
        })),
        activeUsers: {
            daily,
            latestDaily: daily.length ? daily[daily.length - 1].activeUsers : 0,
            weekly: toNumber(windowRows[0]?.weekly_active_users),
            monthly: toNumber(windowRows[0]?.monthly_active_users),
        },
    };
}

export async function getRoomAnalytics(range: DateRange): Promise<RoomAnalyticsData> {
    const totalsRows = await queryRows<{
        total_rooms: string;
        active_rooms: string;
        ended_rooms: string;
        rooms_created_in_period: string;
        average_room_duration_seconds: string | null;
        participant_joins_in_period: string;
        unique_participants_in_period: string;
        average_participants_per_room: string | null;
        average_completed_presence_duration_seconds: string | null;
    }>(
        `SELECT
            (SELECT COUNT(*) FROM rooms) AS total_rooms,
            (SELECT COUNT(*) FROM rooms WHERE status = 'active') AS active_rooms,
            (SELECT COUNT(*) FROM rooms WHERE status = 'ended' OR ended_at IS NOT NULL) AS ended_rooms,
            (SELECT COUNT(*) FROM rooms WHERE created_at >= $1 AND created_at < $2) AS rooms_created_in_period,
            (SELECT AVG(EXTRACT(EPOCH FROM (ended_at - created_at)))
               FROM rooms
              WHERE ended_at IS NOT NULL AND ended_at >= created_at
                AND created_at >= $1 AND created_at < $2) AS average_room_duration_seconds,
            (SELECT COUNT(*)
               FROM room_participants
              WHERE joined_at >= $1 AND joined_at < $2) AS participant_joins_in_period,
            (SELECT COUNT(DISTINCT firebase_uid)
               FROM room_participants
              WHERE joined_at < $2 AND COALESCE(left_at, now()) > $1) AS unique_participants_in_period,
            (SELECT AVG(EXTRACT(EPOCH FROM (left_at - joined_at)))
               FROM room_participants
              WHERE left_at IS NOT NULL AND left_at >= joined_at
                AND joined_at >= $1 AND joined_at < $2) AS average_completed_presence_duration_seconds,
            (SELECT AVG(participant_count)
               FROM (
                   SELECT room_id, COUNT(DISTINCT firebase_uid) AS participant_count
                     FROM room_participants
                    WHERE joined_at >= $1 AND joined_at < $2
                    GROUP BY room_id
               ) counts) AS average_participants_per_room`,
        [range.from, range.to]
    );

    const createdRows = await queryRows<{ day: string; rooms_created: string }>(
        `${daySeriesCte()},
        created AS (
            SELECT (r.created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS rooms_created
              FROM rooms r
             WHERE r.created_at >= $1 AND r.created_at < $2
             GROUP BY 1
        )
        SELECT
            to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(c.rooms_created, 0) AS rooms_created
          FROM days d
          LEFT JOIN created c ON c.day = d.day
         ORDER BY d.day`,
        [range.from, range.to]
    );

    const totals = totalsRows[0];

    return {
        totals: {
            totalRooms: toNumber(totals?.total_rooms),
            activeRooms: toNumber(totals?.active_rooms),
            endedRooms: toNumber(totals?.ended_rooms),
            roomsCreatedInPeriod: toNumber(totals?.rooms_created_in_period),
        },
        averageRoomDurationSeconds: toNullableRoundedNumber(totals?.average_room_duration_seconds),
        participation: {
            participantJoinsInPeriod: toNumber(totals?.participant_joins_in_period),
            uniqueParticipantsInPeriod: toNumber(totals?.unique_participants_in_period),
            averageParticipantsPerRoom: toNullableRoundedNumber(totals?.average_participants_per_room),
            averageCompletedPresenceDurationSeconds: toNullableRoundedNumber(
                totals?.average_completed_presence_duration_seconds
            ),
        },
        createdOverTime: createdRows.map((row) => ({
            date: row.day,
            roomsCreated: toNumber(row.rooms_created),
        })),
    };
}

export async function getWatchTimeAnalytics(range: DateRange): Promise<WatchTimeAnalyticsData> {
    const totalsRows = await queryRows<{
        total_sessions: string;
        sessions_in_period: string;
        completed_sessions: string;
        active_sessions: string;
        invalid_sessions: string;
        average_session_duration_seconds: string | null;
        total_session_duration_seconds: string | null;
        longest_session_duration_seconds: string | null;
    }>(
        `SELECT
            (SELECT COUNT(*) FROM watch_sessions) AS total_sessions,
            (SELECT COUNT(*) FROM watch_sessions WHERE started_at >= $1 AND started_at < $2) AS sessions_in_period,
            (SELECT COUNT(*)
               FROM watch_sessions
              WHERE started_at >= $1 AND started_at < $2
                AND ended_at IS NOT NULL AND ended_at >= started_at) AS completed_sessions,
            (SELECT COUNT(*) FROM watch_sessions WHERE is_active = true) AS active_sessions,
            (SELECT COUNT(*)
               FROM watch_sessions
              WHERE started_at >= $1 AND started_at < $2
                AND ended_at IS NOT NULL AND ended_at < started_at) AS invalid_sessions,
            (SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))
               FROM watch_sessions
              WHERE ended_at IS NOT NULL AND ended_at >= started_at
                AND started_at >= $1 AND started_at < $2) AS average_session_duration_seconds,
            (SELECT SUM(EXTRACT(EPOCH FROM (ended_at - started_at)))
               FROM watch_sessions
              WHERE ended_at IS NOT NULL AND ended_at >= started_at
                AND started_at >= $1 AND started_at < $2) AS total_session_duration_seconds,
            (SELECT MAX(EXTRACT(EPOCH FROM (ended_at - started_at)))
               FROM watch_sessions
              WHERE ended_at IS NOT NULL AND ended_at >= started_at
                AND started_at >= $1 AND started_at < $2) AS longest_session_duration_seconds`,
        [range.from, range.to]
    );

    const trendRows = await queryRows<{
        day: string;
        session_count: string;
        total_session_duration_seconds: string;
        average_session_duration_seconds: string | null;
    }>(
        `${daySeriesCte()},
        sessions AS (
            SELECT
                (ws.started_at AT TIME ZONE 'UTC')::date AS day,
                COUNT(*) AS session_count,
                COALESCE(SUM(
                    CASE
                        WHEN ws.ended_at IS NOT NULL AND ws.ended_at >= ws.started_at
                        THEN EXTRACT(EPOCH FROM (ws.ended_at - ws.started_at))
                        ELSE 0
                    END
                ), 0) AS total_session_duration_seconds,
                AVG(
                    CASE
                        WHEN ws.ended_at IS NOT NULL AND ws.ended_at >= ws.started_at
                        THEN EXTRACT(EPOCH FROM (ws.ended_at - ws.started_at))
                        ELSE NULL
                    END
                ) AS average_session_duration_seconds
              FROM watch_sessions ws
             WHERE ws.started_at >= $1 AND ws.started_at < $2
             GROUP BY 1
        )
        SELECT
            to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(s.session_count, 0) AS session_count,
            COALESCE(s.total_session_duration_seconds, 0) AS total_session_duration_seconds,
            s.average_session_duration_seconds
          FROM days d
          LEFT JOIN sessions s ON s.day = d.day
         ORDER BY d.day`,
        [range.from, range.to]
    );

    const totals = totalsRows[0];

    return {
        totalWatchTimeSeconds: null,
        watchTimeAvailable: false,
        limitation: WATCH_TIME_LIMITATION,
        sessions: {
            total: toNumber(totals?.total_sessions),
            inPeriod: toNumber(totals?.sessions_in_period),
            completedInPeriod: toNumber(totals?.completed_sessions),
            active: toNumber(totals?.active_sessions),
            invalidInPeriod: toNumber(totals?.invalid_sessions),
            averageDurationSeconds: toNullableRoundedNumber(totals?.average_session_duration_seconds),
            totalSessionDurationSeconds: toRoundedNumber(totals?.total_session_duration_seconds),
            longestSessionDurationSeconds: toNullableRoundedNumber(totals?.longest_session_duration_seconds),
        },
        trend: trendRows.map((row) => ({
            date: row.day,
            sessionCount: toNumber(row.session_count),
            totalSessionDurationSeconds: toRoundedNumber(row.total_session_duration_seconds),
            averageSessionDurationSeconds: toNullableRoundedNumber(row.average_session_duration_seconds),
        })),
    };
}

export async function getActivity(params: ActivityParams): Promise<ActivityResult> {
    const offset = (params.page - 1) * params.pageSize;
    const rows = await queryRows<{
        id: string | null;
        type: string | null;
        occurred_at: Date | string | null;
        room_code: string | null;
        actor_id: string | null;
        actor_name: string | null;
        metadata: Record<string, unknown> | null;
        total_count: string;
    }>(
        `WITH events AS (
            SELECT
                'user_registered'::text AS type,
                'user:' || u.id::text AS id,
                u.created_at AS occurred_at,
                NULL::text AS room_code,
                u.id AS actor_id,
                COALESCE(u.display_name, 'Guest') AS actor_name,
                NULL::jsonb AS metadata
              FROM users u
             WHERE u.created_at >= $1 AND u.created_at < $2

            UNION ALL

            SELECT
                'room_created'::text,
                'room:' || r.id::text || ':created',
                r.created_at,
                r.room_code,
                ru.id,
                COALESCE(ru.display_name, 'Guest'),
                NULL::jsonb
              FROM rooms r
              LEFT JOIN users ru ON ru.firebase_uid = r.host_firebase_uid
             WHERE r.created_at >= $1 AND r.created_at < $2

            UNION ALL

            SELECT
                'room_ended'::text,
                'room:' || r.id::text || ':ended',
                r.ended_at,
                r.room_code,
                ru.id,
                COALESCE(ru.display_name, 'Guest'),
                NULL::jsonb
              FROM rooms r
              LEFT JOIN users ru ON ru.firebase_uid = r.host_firebase_uid
             WHERE r.ended_at IS NOT NULL
               AND r.ended_at >= $1 AND r.ended_at < $2

            UNION ALL

            SELECT
                'participant_joined'::text,
                'participant:' || rp.id::text || ':joined',
                rp.joined_at,
                r.room_code,
                u.id,
                COALESCE(u.display_name, 'Guest'),
                NULL::jsonb
              FROM room_participants rp
              JOIN rooms r ON r.id = rp.room_id
              JOIN users u ON u.firebase_uid = rp.firebase_uid
             WHERE rp.joined_at >= $1 AND rp.joined_at < $2

            UNION ALL

            SELECT
                'participant_left'::text,
                'participant:' || rp.id::text || ':left',
                rp.left_at,
                r.room_code,
                u.id,
                COALESCE(u.display_name, 'Guest'),
                NULL::jsonb
              FROM room_participants rp
              JOIN rooms r ON r.id = rp.room_id
              JOIN users u ON u.firebase_uid = rp.firebase_uid
             WHERE rp.left_at IS NOT NULL
               AND rp.left_at >= $1 AND rp.left_at < $2

            UNION ALL

            SELECT
                'watch_session_started'::text,
                'watch:' || ws.id::text || ':started',
                ws.started_at,
                r.room_code,
                u.id,
                COALESCE(u.display_name, 'Guest'),
                jsonb_build_object('sourceType', ws.source_type)
              FROM watch_sessions ws
              JOIN rooms r ON r.id = ws.room_id
              JOIN users u ON u.firebase_uid = ws.host_firebase_uid
             WHERE ws.started_at >= $1 AND ws.started_at < $2

            UNION ALL

            SELECT
                'watch_session_ended'::text,
                'watch:' || ws.id::text || ':ended',
                ws.ended_at,
                r.room_code,
                u.id,
                COALESCE(u.display_name, 'Guest'),
                jsonb_build_object('sourceType', ws.source_type)
              FROM watch_sessions ws
              JOIN rooms r ON r.id = ws.room_id
              JOIN users u ON u.firebase_uid = ws.host_firebase_uid
             WHERE ws.ended_at IS NOT NULL
               AND ws.ended_at >= $1 AND ws.ended_at < $2
        )
        SELECT
            page.id,
            page.type,
            page.occurred_at,
            page.room_code,
            page.actor_id,
            page.actor_name,
            page.metadata,
            totals.total_count
          FROM (SELECT COUNT(*) AS total_count FROM events) totals
          LEFT JOIN LATERAL (
              SELECT id, type, occurred_at, room_code, actor_id, actor_name, metadata
                FROM events
               ORDER BY occurred_at DESC, id DESC
               LIMIT $3 OFFSET $4
          ) page ON TRUE`,
        [params.range.from, params.range.to, params.pageSize, offset]
    );

    return {
        total: rows.length ? toNumber(rows[0].total_count) : 0,
        items: rows
            .filter((row): row is typeof row & { id: string } => row.id !== null)
            .map((row) => ({
                id: row.id,
                type: row.type || 'unknown',
                occurredAt: toIsoString(row.occurred_at) || new Date(0).toISOString(),
                roomCode: row.room_code,
                actor:
                    row.actor_id !== null
                        ? {
                              id: toNumber(row.actor_id),
                              displayName: row.actor_name || 'Guest',
                          }
                        : null,
                metadata: row.metadata ?? null,
            })),
    };
}
