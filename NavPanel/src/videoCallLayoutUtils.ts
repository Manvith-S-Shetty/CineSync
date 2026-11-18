/**
 * UI-only helpers for video call layout (pin / focus / screen-share detection).
 * Does not touch WebRTC or signaling.
 */

export const LOCAL_TILE_ID = 'local' as const;

/** Heuristic: display capture tracks expose displaySurface in supporting browsers. */
export function isScreenShareVideoTrack(track: MediaStreamTrack | null | undefined): boolean {
  if (!track || track.kind !== 'video') return false;
  try {
    const s = track.getSettings?.() as MediaTrackSettings & { displaySurface?: string };
    if (s?.displaySurface) return true;
  } catch {
    /* ignore */
  }
  const label = (track.label || '').toLowerCase();
  return /screen|display|window|monitor|desktop|entire|tab/.test(label);
}

export function streamHasScreenShareVideo(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream
    .getVideoTracks()
    .some((t) => t.readyState === 'live' && isScreenShareVideoTrack(t));
}
