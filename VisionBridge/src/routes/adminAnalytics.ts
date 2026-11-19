import express = require('express');
import type { NextFunction, Request, Response } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    AnalyticsDatabaseUnavailableError,
    getActivity,
    getOverview,
    getRoomAnalytics,
    getUserAnalytics,
    getWatchTimeAnalytics,
    listUsers,
    type DateRange,
    type SortDirection,
    type UserSortField,
} from '../db/analytics';

const router = express.Router();

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 10_000;

class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string
    ) {
        super(message);
    }
}

function readSingleString(value: unknown, name: string): string | null {
    if (value === undefined) return null;
    if (typeof value !== 'string') {
        throw new ApiError(400, 'INVALID_QUERY', `${name} must be a single string value`);
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function parseDate(value: string, name: string): Date {
    if (value.length > 40) {
        throw new ApiError(400, 'INVALID_DATE', `${name} is not a valid ISO date`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ApiError(400, 'INVALID_DATE', `${name} is not a valid ISO date`);
    }
    return parsed;
}

function parseDateRange(query: Request['query']): DateRange {
    const now = new Date();
    const fromRaw = readSingleString(query.from, 'from');
    const toRaw = readSingleString(query.to, 'to');
    const from = fromRaw ? parseDate(fromRaw, 'from') : new Date(now.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    const to = toRaw ? parseDate(toRaw, 'to') : now;

    if (from.getTime() >= to.getTime()) {
        throw new ApiError(400, 'INVALID_RANGE', 'from must be before to');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
        throw new ApiError(400, 'RANGE_TOO_LARGE', 'Date range must be 366 days or less');
    }

    return { from, to };
}

function parseIntParam(
    value: unknown,
    name: string,
    defaultValue: number,
    min: number,
    max: number
): number {
    const raw = readSingleString(value, name);
    if (raw === null) return defaultValue;
    if (!/^\d+$/.test(raw)) {
        throw new ApiError(400, 'INVALID_PAGINATION', `${name} must be a positive integer`);
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        throw new ApiError(400, 'INVALID_PAGINATION', `${name} must be between ${min} and ${max}`);
    }
    return parsed;
}

function parsePagination(query: Request['query']): { page: number; pageSize: number } {
    return {
        page: parseIntParam(query.page, 'page', 1, 1, MAX_PAGE),
        pageSize: parseIntParam(query.pageSize, 'pageSize', DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    };
}

const USER_SORT_FIELDS: readonly UserSortField[] = [
    'registeredAt',
    'lastSeenAt',
    'displayName',
    'roomCount',
    'participantSessions',
    'watchSessionsHosted',
];

function parseUserSort(value: unknown): UserSortField {
    const raw = readSingleString(value, 'sort');
    if (raw === null) return 'registeredAt';
    if (!USER_SORT_FIELDS.includes(raw as UserSortField)) {
        throw new ApiError(
            400,
            'INVALID_SORT',
            `sort must be one of: ${USER_SORT_FIELDS.join(', ')}`
        );
    }
    return raw as UserSortField;
}

function parseSortDirection(value: unknown): SortDirection {
    const raw = readSingleString(value, 'order');
    if (raw === null) return 'desc';
    const normalized = raw.toLowerCase();
    if (normalized !== 'asc' && normalized !== 'desc') {
        throw new ApiError(400, 'INVALID_SORT', 'order must be asc or desc');
    }
    return normalized;
}

function parseSearch(value: unknown): string {
    const raw = readSingleString(value, 'q') ?? '';
    if (raw.length > 100) {
        throw new ApiError(400, 'INVALID_SEARCH', 'q must be 100 characters or fewer');
    }
    return raw;
}

function rangeMeta(range: DateRange): Record<string, unknown> {
    return {
        range: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
            timezone: 'UTC',
            interval: '[from, to)',
        },
    };
}

function sendOk(res: Response, data: unknown, meta: Record<string, unknown> = {}): void {
    res.status(200).json({
        ok: true,
        data,
        meta: {
            generatedAt: new Date().toISOString(),
            ...meta,
        },
    });
}

function asyncHandler(
    fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
        void fn(req, res).catch(next);
    };
}

// Every admin analytics response is uncached and requires the verified admin allowlist.
router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
router.use(requireAdmin);

router.get(
    '/overview',
    asyncHandler(async (req, res) => {
        const range = parseDateRange(req.query);
        const data = await getOverview(range);
        sendOk(res, data, {
            ...rangeMeta(range),
            definitions: {
                activeUser:
                    'Distinct verified users with at least one room_participants presence interval overlapping the selected UTC period.',
                newUser: 'Users whose users.created_at falls inside the selected UTC period.',
                sessionDuration:
                    'watch_sessions.ended_at minus watch_sessions.started_at for completed sessions that started in the period. This is shared-session wall-clock time, not per-user watch time.',
                completedSession:
                    'A session started in the period with ended_at not null and ended_at >= started_at.',
                activeSession:
                    'watch_sessions.is_active = true. This persisted flag may be stale after a process crash.',
            },
        });
    })
);

router.get(
    '/users',
    asyncHandler(async (req, res) => {
        const { page, pageSize } = parsePagination(req.query);
        const search = parseSearch(req.query.q);
        const sortField = parseUserSort(req.query.sort);
        const sortDirection = parseSortDirection(req.query.order);
        const result = await listUsers({ page, pageSize, search, sortField, sortDirection });

        sendOk(
            res,
            { users: result.users },
            {
                page,
                pageSize,
                total: result.total,
                totalPages: Math.ceil(result.total / pageSize),
                sort: sortField,
                order: sortDirection,
                query: search,
                definitions: {
                    roomCount: 'Distinct rooms joined by the user, from room_participants.room_id.',
                    participantSessions:
                        'Presence records from room_participants; rejoins create additional records.',
                    watchSessionsHosted:
                        'Watch sessions where the user was the host. Non-host viewing time is not persisted.',
                    emailMasked: 'Email is masked; raw email and Firebase UID are not returned.',
                },
            }
        );
    })
);

router.get(
    '/analytics/users',
    asyncHandler(async (req, res) => {
        const range = parseDateRange(req.query);
        const data = await getUserAnalytics(range);
        sendOk(res, data, {
            ...rangeMeta(range),
            definitions: {
                registration:
                    'Users grouped by UTC calendar day of users.created_at.',
                dau: 'Distinct users with a room_participants presence interval overlapping the UTC calendar day.',
                wau: 'Distinct users with a room_participants presence interval overlapping [to - 7 days, to).',
                mau: 'Distinct users with a room_participants presence interval overlapping [to - 30 days, to).',
                presence:
                    'A user is counted as active based on room presence, not confirmed video playback. Open presence rows use now() as the end time.',
            },
        });
    })
);

router.get(
    '/analytics/rooms',
    asyncHandler(async (req, res) => {
        const range = parseDateRange(req.query);
        const data = await getRoomAnalytics(range);
        sendOk(res, data, {
            ...rangeMeta(range),
            definitions: {
                activeRoom:
                    'Rooms with rooms.status = active. This persisted status may be stale if a process crashes before room termination is persisted.',
                endedRoom: 'Rooms with rooms.status = ended or a non-null rooms.ended_at.',
                roomDuration:
                    'rooms.ended_at minus rooms.created_at for ended rooms created in the period.',
                participantJoin:
                    'Each room_participants row is a join event; rejoins create additional rows.',
                averageParticipantsPerRoom:
                    'Average distinct participants across rooms that received at least one join in the period.',
                averageCompletedPresenceDurationSeconds:
                    'Average left_at minus joined_at for completed presence rows joined in the period. Open rows are excluded to avoid inflating unfinished presence.',
            },
        });
    })
);

router.get(
    '/analytics/watch-time',
    asyncHandler(async (req, res) => {
        const range = parseDateRange(req.query);
        const data = await getWatchTimeAnalytics(range);
        sendOk(res, data, {
            ...rangeMeta(range),
            definitions: {
                sessionDuration:
                    'watch_sessions.ended_at minus watch_sessions.started_at for completed sessions that started in the period.',
                validSession:
                    'A watch session with ended_at not null and ended_at >= started_at. Overlapping or duplicate sessions are counted per watch_sessions row.',
                completedSession:
                    'A session started in the period with ended_at not null and ended_at >= started_at.',
                activeSession:
                    'watch_sessions.is_active = true. This persisted flag may be stale after a process crash.',
                watchTime:
                    'Not available. The schema records shared-session wall-clock duration, not per-user playback position or confirmed viewing.',
            },
        });
    })
);

router.get(
    '/activity',
    asyncHandler(async (req, res) => {
        const range = parseDateRange(req.query);
        const { page, pageSize } = parsePagination(req.query);
        const result = await getActivity({ page, pageSize, range });

        sendOk(res, { items: result.items }, {
            ...rangeMeta(range),
            page,
            pageSize,
            total: result.total,
            totalPages: Math.ceil(result.total / pageSize),
            definitions: {
                events:
                    'Activity is reconstructed only from persisted timestamps in users, rooms, room_participants, and watch_sessions. No synthetic events are generated.',
                participantEvents:
                    'participant_joined and participant_left map to room_participants.joined_at and left_at.',
                watchEvents:
                    'watch_session_started and watch_session_ended map to watch_sessions.started_at and ended_at.',
            },
        });
    })
);

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;

    if (err instanceof ApiError) {
        res.status(err.status).json({
            ok: false,
            error: { code: err.code, message: err.message },
        });
        return;
    }

    if (err instanceof AnalyticsDatabaseUnavailableError) {
        res.status(503).json({
            ok: false,
            error: {
                code: 'DATABASE_UNAVAILABLE',
                message: 'Analytics database is not configured',
            },
        });
        return;
    }

    const code = (err as { code?: unknown } | null)?.code;
    const message = (err as { message?: unknown } | null)?.message;
    console.error('[admin analytics] request failed', { code, message });

    res.status(500).json({
        ok: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Analytics request failed',
        },
    });
});

export = router;
