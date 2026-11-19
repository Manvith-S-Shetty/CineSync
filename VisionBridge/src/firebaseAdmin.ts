/**
 * Firebase Admin SDK bootstrap + ID token verification.
 * Identity must come only from verified tokens — never from client fields.
 */
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let initAttempted = false;
let ready = false;
const isProduction = process.env.NODE_ENV === 'production';
const log = (...args: unknown[]) => {
    if (!isProduction) console.log(...args);
};
const warn = (...args: unknown[]) => {
    if (!isProduction) console.warn(...args);
};

interface ServiceAccountShape {
    project_id?: string;
    projectId?: string;
    client_email?: string;
    clientEmail?: string;
    private_key?: string;
    privateKey?: string;
}

interface VerifiedIdentity {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
}

interface AuthError extends Error {
    code?: string;
}

function parseServiceAccountFromEnv(): ServiceAccountShape | null {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json && String(json).trim()) {
        return JSON.parse(json) as ServiceAccountShape;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        privateKey = String(privateKey).replace(/\\n/g, '\n');
        return {
            project_id: projectId,
            client_email: clientEmail,
            private_key: privateKey,
        };
    }

    return null;
}

function initFirebaseAdmin(): boolean {
    if (initAttempted) return ready;
    initAttempted = true;

    try {
        if (getApps().length > 0) {
            ready = true;
            return ready;
        }

        const serviceAccount = parseServiceAccountFromEnv();
        if (serviceAccount) {
            initializeApp({
                credential: cert({
                    projectId: serviceAccount.project_id || serviceAccount.projectId,
                    clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
                    privateKey: serviceAccount.private_key || serviceAccount.privateKey,
                }),
            });
            ready = true;
            log('[auth] Firebase Admin initialized (service account)');
            return ready;
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            initializeApp({
                credential: applicationDefault(),
            });
            ready = true;
            log('[auth] Firebase Admin initialized (application default)');
            return ready;
        }

        warn(
            '[auth] Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY. Privileged socket events will be rejected.'
        );
        ready = false;
        return ready;
    } catch (err) {
        console.error('[auth] Firebase Admin init failed. Full error:', err);
        ready = false;
        return ready;
    }
}

function isFirebaseAdminReady(): boolean {
    if (!initAttempted) initFirebaseAdmin();
    return ready;
}

/**
 * Verify a Firebase ID token and return only server-trusted identity.
 * Set `checkRevoked` for privileged/admin authorization paths.
 *
 * Future custom-claim support: the decoded token returned by
 * `getAuth().verifyIdToken` already contains custom claims (for example
 * `decoded.admin === true`). They can be checked here later without changing
 * the Socket.IO identity contract.
 */
async function verifyIdToken(idToken: unknown, checkRevoked = false): Promise<VerifiedIdentity> {
    if (!isFirebaseAdminReady()) {
        const err: AuthError = new Error('AUTH_UNAVAILABLE');
        err.code = 'AUTH_UNAVAILABLE';
        throw err;
    }
    if (typeof idToken !== 'string' || !idToken.trim()) {
        const err: AuthError = new Error('AUTH_REQUIRED');
        err.code = 'AUTH_REQUIRED';
        throw err;
    }

    const decoded = await getAuth().verifyIdToken(idToken.trim(), checkRevoked);
    const email = typeof decoded.email === 'string' ? decoded.email : '';
    const displayName =
        (typeof decoded.name === 'string' && decoded.name.trim()) ||
        (email.includes('@') ? email.split('@')[0] : '') ||
        'Guest';
    const photoURL = typeof decoded.picture === 'string' ? decoded.picture : '';

    return {
        uid: decoded.uid,
        email,
        displayName,
        photoURL,
    };
}

export = {
    initFirebaseAdmin,
    isFirebaseAdminReady,
    verifyIdToken,
};