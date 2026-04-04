/**
 * WebRTC ICE servers for production (HTTPS) and local dev.
 *
 * Optional: set VITE_WEBRTC_ICE_SERVERS to a JSON array of RTCIceServer objects, e.g.
 * [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}]
 *
 * getUserMedia and peer connections require a secure context (HTTPS) in production.
 */

const DEFAULT_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * @returns {RTCConfiguration}
 */
export function getRtcConfiguration() {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (raw && String(raw).trim()) {
    try {
      const parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { iceServers: parsed };
      }
    } catch {
      console.warn('[rtcConfig] VITE_WEBRTC_ICE_SERVERS is not valid JSON; using default STUN servers');
    }
  }
  return { iceServers: DEFAULT_STUN };
}
