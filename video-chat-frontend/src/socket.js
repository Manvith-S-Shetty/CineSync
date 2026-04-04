import { io } from 'socket.io-client';
import { getBackendUrl } from './config/backendUrl';

const backendUrl = getBackendUrl();
const canConnect = Boolean(backendUrl);
console.log('[socket] Backend URL:', backendUrl || '(empty — set VITE_BACKEND_URL in production)');

/** Dummy origin only when URL missing so the client does not connect until configured. */
const socket = io(backendUrl || 'http://127.0.0.1:1', {
  autoConnect: canConnect,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  timeout: 20000,
});

socket.on('connect_error', (err) => {
  console.error('[socket] Connection error:', err?.message || err);
});

export default socket;
