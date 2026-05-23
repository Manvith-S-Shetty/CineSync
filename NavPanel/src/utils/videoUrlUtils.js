/** Direct file extensions only (no HLS/DASH/pages). */
export const DIRECT_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg'];

export const DEFAULT_VIDEO_SAMPLE_URL =
  'https://www.w3schools.com/html/mov_bbb.mp4';

/** @see DEFAULT_VIDEO_SAMPLE_URL — use as manual playback test in the app */
export const YOUTUBE_NOT_SUPPORTED_MESSAGE =
  'YouTube links are not supported. Use direct video file URL.';

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isYouTubeHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'youtube.com' ||
    h === 'www.youtube.com' ||
    h === 'm.youtube.com' ||
    h === 'youtu.be' ||
    h === 'www.youtu.be' ||
    h.endsWith('.youtube.com')
  );
}

/**
 * Validate a direct HTTP(S) video file URL (by pathname extension).
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function validateDirectVideoUrl(raw) {
  const u = typeof raw === 'string' ? raw.trim() : '';
  if (!u) {
    return { ok: false, error: 'Enter a video URL.' };
  }
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) links are allowed.' };
  }
  if (isYouTubeHostname(parsed.hostname)) {
    return { ok: false, error: YOUTUBE_NOT_SUPPORTED_MESSAGE };
  }
  const path = parsed.pathname.toLowerCase();
  const hasAllowedExt = DIRECT_VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      ok: false,
      error: 'Only direct .mp4, .webm, or .ogg video URLs are supported.',
    };
  }
  return { ok: true, url: u };
}
