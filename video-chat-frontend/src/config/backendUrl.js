/**
 * Resolves the Socket.IO base URL for the signaling server.
 *
 * Production (Vite `import.meta.env.PROD`): **VITE_BACKEND_URL** (or VITE_SOCKET_URL) is required.
 * Dev: env first, then LAN hostname :5000, then localhost:5000.
 */
export function getBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_SOCKET_URL;
  const trimmed = fromEnv && String(fromEnv).trim();
  if (trimmed) {
    return trimmed.replace(/\/$/, '');
  }

  if (import.meta.env.PROD) {
    console.error(
      '[config] VITE_BACKEND_URL is not set. Set it in Vercel to your Render signaling URL (https://…).'
    );
    return '';
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:5000`;
    }
  }

  return 'http://localhost:5000';
}
