-- CineSync Phase 3B initial persistence schema (PostgreSQL / Supabase)
-- Versioned migration: do not run on application startup.
-- Apply via migration runner/script in a controlled environment.

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. users: upserted from verified Firebase identity
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  firebase_uid TEXT NOT NULL UNIQUE,
  email TEXT NULL,
  display_name TEXT NULL,
  photo_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users (firebase_uid);

-- 2. rooms: room lifecycle (room_code = application roomId)
CREATE TABLE IF NOT EXISTS rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code TEXT NOT NULL UNIQUE,
  host_firebase_uid TEXT NOT NULL REFERENCES users(firebase_uid),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  CONSTRAINT rooms_status_check CHECK (status IN ('active', 'ended'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_status_created_at ON rooms (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_host_firebase_uid ON rooms (host_firebase_uid);

-- 3. room_participants: join/leave history (rejoin creates new record)
CREATE TABLE IF NOT EXISTS room_participants (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  firebase_uid TEXT NOT NULL REFERENCES users(firebase_uid),
  socket_session_id TEXT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_left_at ON room_participants (room_id, left_at);
CREATE INDEX IF NOT EXISTS idx_room_participants_uid_joined_at ON room_participants (firebase_uid, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_active ON room_participants (room_id) WHERE left_at IS NULL;

-- At most one active host participant per room
CREATE UNIQUE INDEX IF NOT EXISTS one_active_host_per_room
  ON room_participants (room_id)
  WHERE is_host = TRUE AND left_at IS NULL;

-- 4. watch_sessions: metadata only (no file contents, no blob URLs, no continuous playback)
CREATE TABLE IF NOT EXISTS watch_sessions (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  host_firebase_uid TEXT NOT NULL REFERENCES users(firebase_uid),
  source_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  file_name TEXT NULL,
  file_size BIGINT NULL,
  duration_seconds NUMERIC NULL,
  fingerprint TEXT NULL,
  remote_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL,
  CONSTRAINT watch_sessions_source_type_check CHECK (source_type IN ('local', 'remote'))
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_room_active ON watch_sessions (room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_room_started_at ON watch_sessions (room_id, started_at DESC);

-- At most one active watch session per room
CREATE UNIQUE INDEX IF NOT EXISTS one_active_watch_session_per_room
  ON watch_sessions (room_id)
  WHERE is_active = TRUE;
