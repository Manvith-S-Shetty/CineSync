/**
 * UI-only helpers for video call layout (pin / focus / screen-share detection).
 * Does not touch WebRTC or signaling.
 */

export const LOCAL_TILE_ID = 'local';

/** Heuristic: display capture tracks expose displaySurface in supporting browsers. */
export function isScreenShareVideoTrack(track) {
  if (!track || track.kind !== 'video') return false;
  try {
    const s = track.getSettings?.() || {};
    if (s.displaySurface) return true;
  } catch (_) {
    /* ignore */
  }
  const label = (track.label || '').toLowerCase();
  return /screen|display|window|monitor|desktop|entire|tab/.test(label);
}

export function streamHasScreenShareVideo(stream) {
  if (!stream) return false;
  return stream
    .getVideoTracks()
    .some((t) => t.readyState === 'live' && isScreenShareVideoTrack(t));
}
