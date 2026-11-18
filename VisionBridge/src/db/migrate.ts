import fs = require('fs');
import path = require('path');
import dotenv = require('dotenv');
import { closePool, getPool, isDatabaseConfigured } from './pool';

dotenv.config({ quiet: true } as any);

type MigrationResult = { applied: string[]; skipped: string[] };

// Fixed advisory lock key to prevent concurrent migration runners.
const MIGRATION_ADVISORY_LOCK_KEY = 915_337_201;

function getMigrationsDir(): string {
    // src/db -> ../../migrations (source) ; dist/db -> ../../migrations (compiled)
    return path.resolve(__dirname, '..', '..', 'migrations');
}

async function ensureMigrationsTable(): Promise<void> {
    const pool = getPool();
    if (!pool) throw new Error('Database not configured');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

export async function runMigrations(): Promise<MigrationResult> {
    if (!isDatabaseConfigured()) {
        throw new Error('DATABASE_URL is not configured');
    }
    const pool = getPool();
    if (!pool) throw new Error('Database pool unavailable');

    const dir = getMigrationsDir();
    if (!fs.existsSync(dir)) {
        throw new Error(`Migrations directory not found: ${dir}`);
    }

    const files = fs.readdirSync(dir)
        .filter((f) => /^\d+.*\.sql$/i.test(f))
        .sort();

    const applied: string[] = [];
    const skipped: string[] = [];
    const client = await pool.connect();
    let lockAcquired = false;

    try {
        // Acquire session-level advisory lock to prevent concurrent runners.
        await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
        lockAcquired = true;

        await ensureMigrationsTable();

        for (const file of files) {
            const version = file.replace(/\.sql$/i, '');
            const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
            if ((existing.rowCount ?? 0) > 0) {
                skipped.push(version);
                continue;
            }
            const sql = fs.readFileSync(path.join(dir, file), 'utf8');
            try {
                // Runner is the single transaction owner and migration-version recorder.
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    'INSERT INTO schema_migrations (version) VALUES ($1)',
                    [version]
                );
                await client.query('COMMIT');
                applied.push(version);
                console.log(`[db:migrate] applied ${version}`);
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch { /* ignore */ }
                console.error(`[db:migrate] failed ${version}`, { message: (err as any)?.message });
                throw err;
            }
        }

        return { applied, skipped };
    } finally {
        if (lockAcquired) {
            try {
                await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
            } catch {
                // ignore unlock errors; session close also releases advisory locks
            }
        }
        client.release();
    }
}

async function main(): Promise<void> {
    try {
        const result = await runMigrations();
        console.log('[db:migrate] complete', result);
        process.exitCode = 0;
    } catch (err) {
        console.error('[db:migrate] error', { message: (err as any)?.message });
        process.exitCode = 1;
    } finally {
        try {
            await closePool();
        } catch {
            // ignore
        }
    }
}

// Run when executed directly (ts-node/dev or compiled node dist/db/migrate.js)
if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    main();
}
