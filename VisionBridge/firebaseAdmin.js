/**
 * Firebase Admin SDK bootstrap + ID token verification.
 * Identity must come only from verified tokens — never from client fields.
 *
 * Uses the modular firebase-admin/app + firebase-admin/auth APIs (Admin SDK v12+).
 */
const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let initAttempted = false;
let ready = false;
const isProduction = process.env.NODE_ENV === 'production';
const log = (...args) => {
    if (!isProduction) console.log(...args);
};
const warn = (...args) => {
    if (!isProduction) console.warn(...args);
};
const error = (...args) => {
    if (!isProduction) console.error(...args);
};

function parseServiceAccountFromEnv() {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json && String(json).trim()) {
        return JSON.parse(json);
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // --- TEMP DEBUG: raw console, bypasses the log/warn/error wrappers ---
    console.log("KEY DEBUG >> FIREBASE_SERVICE_ACCOUNT_JSON present:", !!json);
    console.log("KEY DEBUG >> projectId present:", !!projectId);
    console.log("KEY DEBUG >> clientEmail present:", !!clientEmail);
    console.log("KEY DEBUG >> privateKey length:", privateKey?.length);
    console.log("KEY DEBUG >> privateKey starts with:", privateKey?.slice(0, 25));
    console.log("KEY DEBUG >> has real newlines:", privateKey?.includes("\n"));
    console.log("KEY DEBUG >> has literal backslash-n:", privateKey?.includes("\\n"));
    // --- END TEMP DEBUG ---

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

function initFirebaseAdmin() {
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
        //error('[auth] Firebase Admin init failed:', err?.message || err);
        console.error('[auth] Firebase Admin init failed:', err?.message || err); // was: error(...)
        
        ready = false;
        return ready;
    }
}

function isFirebaseAdminReady() {
    if (!initAttempted) initFirebaseAdmin();
    return ready;
}

/**
 * Verify a Firebase ID token and return server-trusted identity fields only.
 * @param {string} idToken
 * @returns {Promise<{ uid: string, email: string, displayName: string, photoURL: string }>}
 */
async function verifyIdToken(idToken) {
    if (!isFirebaseAdminReady()) {
        const err = new Error('AUTH_UNAVAILABLE');
        err.code = 'AUTH_UNAVAILABLE';
        throw err;
    }
    if (typeof idToken !== 'string' || !idToken.trim()) {
        const err = new Error('AUTH_REQUIRED');
        err.code = 'AUTH_REQUIRED';
        throw err;
    }

    const decoded = await getAuth().verifyIdToken(idToken.trim());
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

module.exports = {
    initFirebaseAdmin,
    isFirebaseAdminReady,
    verifyIdToken,
};
