import fs = require('fs');
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import tls = require('tls');

let pool: Pool | null = null;
let initAttempted = false;

export interface DatabaseServerTlsEvidence {
    ssl: boolean | null;
    tlsVersion: string | null;
    cipher: string | null;
    bits: number | null;
}

export interface DatabaseClientTlsEvidence {
    isTlsSocket: boolean;
    encrypted: boolean;
    protocol: string | null;
    cipherName: string | null;
    cipherVersion: string | null;
    authorized: boolean | null;
    authorizationError: string | null;
    peerSubjectCN: string | null;
    peerIssuerCN: string | null;
    peerIssuerO: string | null;
    peerValidTo: string | null;
}

export interface DatabaseHealthReport {
    configured: boolean;
    connected: boolean;
    postgresVersion?: string | null;
    serverTls?: DatabaseServerTlsEvidence | null;
    clientTls?: DatabaseClientTlsEvidence | null;
    endpointType?: string;
    sslmode?: string | null;
    sslConfigured?: boolean;
    sslRejectUnauthorized?: boolean | null;
    sslCaProvided?: boolean;
    errorCode?: string;
    errorMessage?: string;
}

function parseDbUrl(connectionString: string): URL | null {
    try {
        return new URL(connectionString);
    } catch {
        return null;
    }
}

function getEndpointType(connectionString: string): string {
    const u = parseDbUrl(connectionString);
    const host = (u?.hostname || '').toLowerCase();
    if (!host) return 'unknown';
    if (host.includes('pooler.supabase.com')) return 'supabase-pooler';
    if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) return 'supabase-direct';
    if (host === 'localhost' || host === '127.0.0.1') return 'local';
    return 'other';
}

function getUrlSslMode(connectionString: string): string | null {
    const u = parseDbUrl(connectionString);
    const mode = u?.searchParams.get('sslmode');
    return mode ? mode.toLowerCase() : null;
}

function isLocalHost(connectionString: string): boolean {
    const u = parseDbUrl(connectionString);
    const host = (u?.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
}

function shouldUseSsl(connectionString: string): boolean {
    const explicit = String(process.env.DATABASE_SSL || '').toLowerCase().trim();
    if (explicit === 'false' || explicit === '0' || explicit === 'disable') return false;
    if (explicit === 'true' || explicit === '1' || explicit === 'require' || explicit === 'verify-full' || explicit === 'verify-ca') return true;
    const mode = getUrlSslMode(connectionString);
    if (mode === 'disable') return false;
    if (mode) return true; // require/prefer/verify-ca/verify-full imply SSL intent
    if (isLocalHost(connectionString)) return false;
    return true; // prefer encrypted transport for non-local (e.g. Supabase pooler)
}

function loadSslCa(): string | Buffer | undefined {
    const caFile = String(process.env.DATABASE_SSL_CA_FILE || '').trim();
    if (caFile) {
        // When an explicit CA file is configured, it must be loadable.
        return fs.readFileSync(caFile, 'utf8');
    }
    const ca = String(process.env.DATABASE_SSL_CA || '').trim();
    if (!ca) return undefined;
    return ca.replace(/\\n/g, '\n');
}

function buildSslConfig(connectionString: string): PoolConfig['ssl'] {
    const mode = getUrlSslMode(connectionString);
    const explicitSsl = String(process.env.DATABASE_SSL || '').toLowerCase().trim();
    const explicitDisable = explicitSsl === 'false' || explicitSsl === '0' || explicitSsl === 'disable';

    // Explicit secure CA/verification config takes precedence over URL sslmode so it
    // cannot be silently weakened by connection-string parameters.
    const ca = loadSslCa();
    const rejectEnv = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').toLowerCase().trim();
    const explicitVerify = rejectEnv === 'true' || rejectEnv === '1' || explicitSsl === 'verify-full' || explicitSsl === 'verify-ca';
    const explicitNoVerify = rejectEnv === 'false' || rejectEnv === '0';
    const hasExplicitSecureConfig = explicitVerify || !!ca;

    if ((mode === 'disable' || explicitDisable) && !hasExplicitSecureConfig) return false;

    // Enforce certificate verification for SSL connections by default.
    // Explicit opt-out is honored only outside production.
    let rejectUnauthorized = true;
    if (explicitNoVerify && !explicitVerify && process.env.NODE_ENV !== 'production') {
        rejectUnauthorized = false;
    }
    if (explicitVerify) {
        rejectUnauthorized = true;
    }

    if (hasExplicitSecureConfig) {
        const cfg: any = { rejectUnauthorized: true };
        if (ca) cfg.ca = ca;
        return cfg;
    }

    if (!shouldUseSsl(connectionString)) return false;

    const cfg: any = { rejectUnauthorized };
    return cfg;
}

export function isDatabaseConfigured(): boolean {
    const url = process.env.DATABASE_URL;
    return typeof url === 'string' && url.trim().length > 0;
}

function buildPoolConfig(connectionString: string): PoolConfig {
    const max = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10);
    const ssl = buildSslConfig(connectionString);
    const cfg: PoolConfig = {
        connectionString,
        max: Number.isFinite(max) && max > 0 ? max : 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    };
    if (ssl !== undefined) cfg.ssl = ssl as any;
    return cfg;
}

export function getPool(): Pool | null {
    if (pool) return pool;
    if (initAttempted) return null;
    initAttempted = true;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || !connectionString.trim()) {
        return null;
    }

    try {
        pool = new Pool(buildPoolConfig(connectionString));

        pool.on('error', (err) => {
            console.error('[db] pool error', { code: (err as any)?.code, message: (err as any)?.message });
        });

        return pool;
    } catch (err) {
        console.error('[db] failed to initialize pool', { message: (err as any)?.message });
        pool = null;
        return null;
    }
}

function getClientSocket(client: PoolClient): any {
    const c: any = client as any;
    return c?.connection?.stream || c?.connection?.socket || null;
}

export function inspectClientTls(client: PoolClient): DatabaseClientTlsEvidence {
    const stream = getClientSocket(client);
    const isTlsSocket = stream instanceof tls.TLSSocket;
    if (!isTlsSocket || !stream) {
        return {
            isTlsSocket: false,
            encrypted: !!stream?.encrypted,
            protocol: null,
            cipherName: null,
            cipherVersion: null,
            authorized: null,
            authorizationError: null,
            peerSubjectCN: null,
            peerIssuerCN: null,
            peerIssuerO: null,
            peerValidTo: null,
        };
    }
    const s = stream as tls.TLSSocket;
    let cipherName: string | null = null;
    let cipherVersion: string | null = null;
    try {
        const c = s.getCipher ? s.getCipher() : null;
        cipherName = c?.name ?? null;
        cipherVersion = c?.version ?? null;
    } catch { /* ignore */ }
    let peerSubjectCN: string | null = null;
    let peerIssuerCN: string | null = null;
    let peerIssuerO: string | null = null;
    let peerValidTo: string | null = null;
    try {
        const cert: any = s.getPeerCertificate ? s.getPeerCertificate(false) : null;
        if (cert && Object.keys(cert).length) {
            peerSubjectCN = cert.subject?.CN ?? null;
            peerIssuerCN = cert.issuer?.CN ?? null;
            peerIssuerO = cert.issuer?.O ?? null;
            peerValidTo = cert.valid_to ?? null;
        }
    } catch { /* ignore */ }
    let protocol: string | null = null;
    try { protocol = s.getProtocol ? s.getProtocol() : null; } catch { /* ignore */ }
    const authorized = typeof (s as any).authorized === 'boolean' ? (s as any).authorized : null;
    const authorizationError = (s as any).authorizationError ? String((s as any).authorizationError) : null;
    return {
        isTlsSocket: true,
        encrypted: !!s.encrypted,
        protocol,
        cipherName,
        cipherVersion,
        authorized,
        authorizationError,
        peerSubjectCN,
        peerIssuerCN,
        peerIssuerO,
        peerValidTo,
    };
}

async function queryServerTlsEvidence(client: PoolClient): Promise<DatabaseServerTlsEvidence | null> {
    try {
        const r = await client.query(
            'SELECT ssl, version AS tls_version, cipher, bits FROM pg_stat_ssl WHERE pid = pg_backend_pid()'
        );
        const row = r.rows?.[0];
        if (!row) return null;
        return {
            ssl: typeof row.ssl === 'boolean' ? row.ssl : null,
            tlsVersion: row.tls_version ?? null,
            cipher: row.cipher ?? null,
            bits: typeof row.bits === 'number' ? row.bits : (row.bits == null ? null : Number(row.bits)),
        };
    } catch {
        return null;
    }
}

async function queryPostgresVersion(client: PoolClient): Promise<string | null> {
    try {
        const r = await client.query('SELECT version() AS version');
        const v = r.rows?.[0]?.version;
        if (typeof v !== 'string') return null;
        return v.split(',')[0] || v;
    } catch {
        return null;
    }
}

export async function getDatabaseHealthReport(): Promise<DatabaseHealthReport> {
    const configured = isDatabaseConfigured();
    const cs = process.env.DATABASE_URL || '';
    if (!configured) {
        return { configured: false, connected: false };
    }
    const p = getPool();
    const endpointType = getEndpointType(cs);
    const sslmode = getUrlSslMode(cs);
    let sslConfigError: string | undefined;
    let caProvided = false;
    try {
        caProvided = !!loadSslCa();
    } catch (err: any) {
        sslConfigError = err?.message || 'Failed to load configured SSL CA';
    }
    const ssl = (() => {
        if (sslConfigError) return null;
        try {
            return buildSslConfig(cs);
        } catch {
            return null;
        }
    })();
    const sslConfigured = ssl !== false;
    const sslRejectUnauthorized =
        ssl && typeof ssl === 'object' && 'rejectUnauthorized' in (ssl as any)
            ? !!(ssl as any).rejectUnauthorized
            : (sslConfigured ? null : null);

    if (sslConfigError) {
        return {
            configured: true,
            connected: false,
            endpointType,
            sslmode,
            sslConfigured: true,
            sslRejectUnauthorized: null,
            sslCaProvided: false,
            errorCode: 'SSL_CA_LOAD_ERROR',
            errorMessage: sslConfigError,
        };
    }

    if (!p) {
        return { configured: true, connected: false, endpointType, sslmode, sslConfigured, sslRejectUnauthorized, sslCaProvided: caProvided };
    }

    let client: PoolClient | null = null;
    try {
        client = await p.connect();
        await client.query('SELECT 1');
        const postgresVersion = await queryPostgresVersion(client);
        const serverTls = await queryServerTlsEvidence(client);
        const clientTls = inspectClientTls(client);
        return {
            configured: true,
            connected: true,
            postgresVersion,
            serverTls,
            clientTls,
            endpointType,
            sslmode,
            sslConfigured,
            sslRejectUnauthorized,
            sslCaProvided: caProvided,
        };
    } catch (err: any) {
        return {
            configured: true,
            connected: false,
            endpointType,
            sslmode,
            sslConfigured,
            sslRejectUnauthorized,
            sslCaProvided: caProvided,
            errorCode: err?.code,
            errorMessage: err?.message,
        };
    } finally {
        try { client?.release(); } catch { /* ignore */ }
    }
}

export async function checkDatabaseHealth(): Promise<{ configured: boolean; connected: boolean }> {
    const report = await getDatabaseHealthReport();
    return { configured: report.configured, connected: report.connected };
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T | null> {
    const p = getPool();
    if (!p) return null;
    const client = await p.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}

export async function closePool(): Promise<void> {
    if (!pool) return;
    try {
        await pool.end();
    } catch (err) {
        console.error('[db] error closing pool', { message: (err as any)?.message });
    } finally {
        pool = null;
        initAttempted = false;
    }
}
