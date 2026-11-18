import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';
import socket from '../socket';
import { uploadVideo } from '../services/cloudinary';
import { useAuth } from '../contexts/useAuth';
import {
  DEFAULT_VIDEO_SAMPLE_URL,
  validateDirectVideoUrl,
} from '../utils/videoUrlUtils';
import type { SharedVideoDescriptor, VideoPlayerHandle } from '../types/models';
import '../styles/VideoPlayer.css';

const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};
const devError = (...args: unknown[]) => {
  if (isDev) console.error(...args);
};

const LOAD_FAILED_MESSAGE = 'Video failed to load';
const HOST_SYNC_INTERVAL_MS = 1000;
const SMALL_DRIFT_THRESHOLD_SECONDS = 0.35;
const MEDIUM_DRIFT_THRESHOLD_SECONDS = 1.5;
const LARGE_DRIFT_THRESHOLD_SECONDS = 2.5;
const PLAYBACK_RATE_ADJUST_WINDOW_SECONDS = 1.0;
const SEEK_COOLDOWN_MS = 450;
const DURATION_TOLERANCE_SECONDS = 0.75;
const FINGERPRINT_CHUNK_SIZE = 256 * 1024;
const SUPPORTED_VIDEO_EXT = ['.mp4', '.webm', '.ogg'];

type GuestMatchState =
  | 'waiting'
  | 'host-available'
  | 'select-matching'
  | 'checking'
  | 'matched'
  | 'mismatch'
  | 'ready';

interface VideoPlayerProps {
  roomId: string | null;
  playerOnly?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isHost?: boolean;
  syncedWatchVideoUrl?: string | null;
  syncedWatchVideo?: SharedVideoDescriptor | null;
  hostSyncTime?: number;
  fileInputId?: string;
  setError?: (message: string | null) => void;
}

function isSupportedVideoFile(file: File): boolean {
  const typeOk = file.type === 'video/mp4' || file.type === 'video/webm' || file.type === 'video/ogg';
  if (typeOk) return true;
  const name = file.name.toLowerCase();
  return SUPPORTED_VIDEO_EXT.some((ext) => name.endsWith(ext));
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

async function computeLightweightFingerprint(file: File): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const size = file.size;
    const chunk = Math.min(FINGERPRINT_CHUNK_SIZE, size);
    const parts: Blob[] = [];
    parts.push(file.slice(0, chunk));
    if (size > chunk * 2) {
      const mid = Math.floor(size / 2) - Math.floor(chunk / 2);
      parts.push(file.slice(Math.max(chunk, mid), Math.max(chunk, mid) + chunk));
    }
    if (size > chunk) {
      parts.push(file.slice(Math.max(0, size - chunk), size));
    }
    const blob = new Blob(parts);
    const data = await blob.arrayBuffer();
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hash);
  } catch {
    return null;
  }
}

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(d);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read video metadata'));
    };
    video.src = url;
  });
}

function compareDescriptors(
  host: SharedVideoDescriptor | null | undefined,
  guest: { fileName: string; fileSize: number; duration: number; fingerprint?: string | null } | null
): { match: boolean; reason?: string } {
  if (!host || host.source !== 'local' || !guest) return { match: false, reason: 'No host video metadata' };
  if ((host.fileName || '') !== guest.fileName) return { match: false, reason: 'File name differs' };
  if (Number(host.fileSize ?? -1) !== Number(guest.fileSize)) return { match: false, reason: 'File size differs' };
  const hostDur = Number(host.duration ?? 0);
  if (Math.abs(hostDur - guest.duration) > DURATION_TOLERANCE_SECONDS) return { match: false, reason: 'Duration differs' };
  if (host.fingerprint && guest.fingerprint && host.fingerprint !== guest.fingerprint) {
    return { match: false, reason: 'File content differs' };
  }
  return { match: true };
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  {
    roomId,
    playerOnly = false,
    isExpanded = false,
    onToggleExpand,
    isHost = false,
    syncedWatchVideoUrl = null,
    syncedWatchVideo = null,
    hostSyncTime = 0,
    fileInputId = '',
    setError,
  },
  ref
) {
  const { getIdToken } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localObjectUrlRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const pendingRemotePlayRef = useRef(false);
  const pendingGuestSyncTimeRef = useRef<number | null>(null);
  const guestMatchedSessionRef = useRef<string | null>(null);
  const lastAppliedRemoteKeyRef = useRef<string>('');
  const hostLocalFileRef = useRef<File | null>(null);
  const hostCloudinaryUploadingRef = useRef(false);
  const syncedWatchVideoRef = useRef<SharedVideoDescriptor | null>(syncedWatchVideo);
  const hostSyncTimeRef = useRef<number>(hostSyncTime);
  const lastHostEmitTimeRef = useRef<number>(-1);
  const lastHostEmitPlayingRef = useRef<boolean | null>(null);
  const lastSeekAtRef = useRef<number>(0);
  const lastDriftCorrectionAtRef = useRef<number>(0);
  const rateResetTimerRef = useRef<number | null>(null);
  const correctionCountRef = useRef(0);
  const forcedSeekCountRef = useRef(0);
  const rateAdjustCountRef = useRef(0);
  const lastEstimatedEventDelayRef = useRef<number | null>(null);
  const hostIsPlayingRef = useRef<boolean | null>(null);
  const guestBufferingRef = useRef(false);
  const lastKnownHostPositionRef = useRef<number>(0);

  const [videoSrc, setVideoSrc] = useState<string>(DEFAULT_VIDEO_SAMPLE_URL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [localFileLabel, setLocalFileLabel] = useState('');
  const [inlineUrlError, setInlineUrlError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [guestMatchState, setGuestMatchState] = useState<GuestMatchState>('waiting');
  const [guestMatchMessage, setGuestMatchMessage] = useState<string>('');
  const [isUploadingCloudinary, setIsUploadingCloudinary] = useState(false);

  const revokeLocalObjectUrl = useCallback(() => {
    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current);
      localObjectUrlRef.current = null;
    }
  }, []);

  const setLocalObjectSrc = useCallback(
    (file: File) => {
      revokeLocalObjectUrl();
      const url = URL.createObjectURL(file);
      localObjectUrlRef.current = url;
      setVideoSrc(url);
      setLoadError(null);
      setInlineUrlError(null);
      setIsVideoLoading(true);
    },
    [revokeLocalObjectUrl]
  );

  const logSyncDiagnostics = useCallback((reason: string, extra?: Record<string, unknown>) => {
    if (!isDev) return;
    const el = videoRef.current;
    const guestPosition = el?.currentTime ?? 0;
    const hostPosition = lastKnownHostPositionRef.current;
    void reason;
    void extra;
    void guestPosition;
    void hostPosition;
  }, []);

  useEffect(() => {
    return () => {
      revokeLocalObjectUrl();
      if (rateResetTimerRef.current) window.clearTimeout(rateResetTimerRef.current);
    };
  }, [revokeLocalObjectUrl]);

  useEffect(() => {
    syncedWatchVideoRef.current = syncedWatchVideo ?? null;
  }, [syncedWatchVideo]);

  useEffect(() => {
    hostSyncTimeRef.current = typeof hostSyncTime === 'number' ? hostSyncTime : 0;
    if (typeof hostSyncTime === 'number') lastKnownHostPositionRef.current = hostSyncTime;
  }, [hostSyncTime]);

  useLayoutEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    try {
      el.load();
    } catch (err) {
      devError('[VideoPlayer] video.load() threw:', err);
    }
  }, [videoSrc]);

  const runSyncedUpdate = async (updateFn: () => void | Promise<void>) => {
    isSyncingRef.current = true;
    try {
      await updateFn();
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 250);
    }
  };

  const tryPlayVideo = useCallback(async (): Promise<boolean> => {
    if (!videoRef.current) return false;
    try {
      await videoRef.current.play();
      setPlaybackBlocked(false);
      pendingRemotePlayRef.current = false;
      return true;
    } catch (error) {
      devError('Video play failed (autoplay policy or interaction needed):', error);
      setPlaybackBlocked(true);
      return false;
    }
  }, []);

  const resetPlaybackRate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (Math.abs(el.playbackRate - 1) > 0.001) {
      el.playbackRate = 1;
      logSyncDiagnostics('playbackRate-reset');
    }
  }, [logSyncDiagnostics]);

  const schedulePlaybackRateReset = useCallback((ms: number) => {
    if (rateResetTimerRef.current) window.clearTimeout(rateResetTimerRef.current);
    rateResetTimerRef.current = window.setTimeout(() => {
      rateResetTimerRef.current = null;
      resetPlaybackRate();
    }, ms);
  }, [resetPlaybackRate]);

  const emitHostDescriptor = useCallback(
    async (descriptor: SharedVideoDescriptor | null) => {
      if (!isHost || !roomId || !socket.connected) return;
      try {
        const idToken = await getIdToken();
        const videoUrl = descriptor?.source === 'remote' ? (descriptor.url ?? null) : null;
        socket.emit('videoChange', { roomId, videoUrl, descriptor, idToken });
        socket.emit('watchVideoUrl', { roomId, videoUrl, descriptor, idToken });
      } catch (err) {
        devError('[VideoPlayer] auth required to change video', err);
        setError?.('Authentication required to change video.');
      }
    },
    [isHost, roomId, getIdToken, setError]
  );

  const emitHostRemoteUrl = useCallback(
    async (url: string | null) => {
      if (url == null) {
        await emitHostDescriptor(null);
        return;
      }
      const desc: SharedVideoDescriptor = { source: 'remote', sessionId: createSessionId(), url };
      await emitHostDescriptor(desc);
    },
    [emitHostDescriptor]
  );

  const canGuestFollowSync = useMemo(() => {
    if (isHost) return true;
    if (!syncedWatchVideo) return true;
    if (syncedWatchVideo.source === 'remote') return true;
    return guestMatchState === 'ready' && guestMatchedSessionRef.current === syncedWatchVideo.sessionId;
  }, [isHost, syncedWatchVideo, guestMatchState]);

  const emitHostPlaybackEvent = useCallback(
    (event: 'videoPlay' | 'videoPause' | 'videoSeek' | 'videoHostSync', force = false) => {
      if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
      const el = videoRef.current;
      const current = el.currentTime || 0;
      const playing = !el.paused && !el.ended;
      if (!force && event === 'videoHostSync') {
        const dt = Math.abs(current - lastHostEmitTimeRef.current);
        if (dt < 0.05 && lastHostEmitPlayingRef.current === playing) return;
      }
      lastHostEmitTimeRef.current = current;
      lastHostEmitPlayingRef.current = playing;
      socket.emit(event, {
        roomId,
        currentTime: current,
        isPlaying: playing,
        hostSentAt: Date.now(),
      });
      if (event !== 'videoHostSync') {
        logSyncDiagnostics(`host-emit:${event}`, { currentTime: current, isPlaying: playing });
      }
    },
    [isHost, roomId, logSyncDiagnostics]
  );

  // Apply synced video from server (host rejoin + guests)
  useEffect(() => {
    const desc = syncedWatchVideo ?? null;
    const remoteUrlFallback = syncedWatchVideoUrl ?? null;
    const key = desc
      ? `${desc.sessionId}:${desc.source}:${desc.url ?? ''}:${desc.fileName ?? ''}:${desc.fileSize ?? ''}:${desc.duration ?? ''}`
      : remoteUrlFallback
        ? `remote-url:${remoteUrlFallback}`
        : 'none';
    if (key === lastAppliedRemoteKeyRef.current) return;
    lastAppliedRemoteKeyRef.current = key;

    if (!desc) {
      guestMatchedSessionRef.current = null;
      pendingGuestSyncTimeRef.current = null;
      setGuestMatchState('waiting');
      setGuestMatchMessage('');
      hostLocalFileRef.current = null;
      if (remoteUrlFallback) {
        const v = validateDirectVideoUrl(remoteUrlFallback);
        const safe = v.ok ? v.url : DEFAULT_VIDEO_SAMPLE_URL;
        revokeLocalObjectUrl();
        setLocalFileLabel('');
        setVideoSrc(safe);
        setIsVideoLoading(true);
        setLoadError(null);
        setInlineUrlError(null);
      } else if (!isHost) {
        revokeLocalObjectUrl();
        setLocalFileLabel('');
        setVideoSrc(DEFAULT_VIDEO_SAMPLE_URL);
        setIsVideoLoading(true);
        setLoadError(null);
        setInlineUrlError(null);
      }
      return;
    }

    if (desc.source === 'remote') {
      guestMatchedSessionRef.current = null;
      pendingGuestSyncTimeRef.current = null;
      setGuestMatchState('waiting');
      setGuestMatchMessage('');
      hostLocalFileRef.current = null;
      const url = desc.url || DEFAULT_VIDEO_SAMPLE_URL;
      const v = validateDirectVideoUrl(url);
      const safe = v.ok ? v.url : DEFAULT_VIDEO_SAMPLE_URL;
      if (isHost && localObjectUrlRef.current) return;
      revokeLocalObjectUrl();
      setLocalFileLabel('');
      setVideoSrc(safe);
      setIsVideoLoading(true);
      setLoadError(null);
      setInlineUrlError(null);
      return;
    }

    if (isHost) return;

    guestMatchedSessionRef.current = null;
    pendingGuestSyncTimeRef.current = typeof hostSyncTime === 'number' ? hostSyncTime : 0;
    lastKnownHostPositionRef.current = pendingGuestSyncTimeRef.current ?? 0;
    revokeLocalObjectUrl();
    setVideoSrc('');
    setLocalFileLabel('');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLoadError(null);
    setInlineUrlError(null);
    setIsVideoLoading(false);
    setGuestMatchState('host-available');
    setGuestMatchMessage('The host has loaded a video. Select the same video file to join playback.');
  }, [syncedWatchVideo, syncedWatchVideoUrl, isHost, hostSyncTime, revokeLocalObjectUrl]);

  const estimateDelayMs = useCallback((payload: { serverTimestamp?: number; hostSentAt?: number }) => {
    if (typeof payload.serverTimestamp === 'number') {
      const delay = Date.now() - payload.serverTimestamp;
      if (Number.isFinite(delay) && delay >= 0 && delay < 15000) return delay;
    }
    return null;
  }, []);

  const applyGuestSync = useCallback((
    targetTime: number,
    opts: { reason: string; isPlaying?: boolean; serverTimestamp?: number; hostSentAt?: number; hardSeek?: boolean }
  ) => {
    if (isHost) return;
    const el = videoRef.current;
    lastKnownHostPositionRef.current = targetTime;
    if (typeof opts.isPlaying === 'boolean') hostIsPlayingRef.current = opts.isPlaying;
    const delay = estimateDelayMs(opts);
    if (delay != null) lastEstimatedEventDelayRef.current = delay;
    if (!el || !canGuestFollowSync) {
      pendingGuestSyncTimeRef.current = targetTime;
      return;
    }
    if (isSyncingRef.current) return;

    const ready = el.readyState >= 1;
    if (!ready) {
      pendingGuestSyncTimeRef.current = targetTime;
      logSyncDiagnostics('guest-sync-deferred-not-ready', { target: targetTime, reason: opts.reason });
      return;
    }

    const drift = (el.currentTime || 0) - targetTime;
    const absDrift = Math.abs(drift);
    const now = Date.now();
    const buffering = guestBufferingRef.current;

    if (opts.isPlaying === false) {
      if (absDrift > SMALL_DRIFT_THRESHOLD_SECONDS && now - lastSeekAtRef.current > SEEK_COOLDOWN_MS) {
        isSyncingRef.current = true;
        try {
          el.currentTime = targetTime;
          lastSeekAtRef.current = now;
          forcedSeekCountRef.current += 1;
          correctionCountRef.current += 1;
          setCurrentTime(targetTime);
        } finally {
          window.setTimeout(() => { isSyncingRef.current = false; }, 180);
        }
      } else {
        setCurrentTime(el.currentTime || targetTime);
      }
      resetPlaybackRate();
      logSyncDiagnostics('guest-sync-paused', { target: targetTime, absDrift, reason: opts.reason, delayMs: delay });
      return;
    }

    if (buffering && absDrift < LARGE_DRIFT_THRESHOLD_SECONDS) {
      setCurrentTime(el.currentTime || 0);
      logSyncDiagnostics('guest-sync-skip-buffering', { target: targetTime, absDrift, reason: opts.reason });
      return;
    }

    if (absDrift <= SMALL_DRIFT_THRESHOLD_SECONDS) {
      if (Math.abs(el.playbackRate - 1) > 0.001 && now - lastDriftCorrectionAtRef.current > 300) {
        resetPlaybackRate();
      }
      setCurrentTime(el.currentTime || 0);
      logSyncDiagnostics('guest-sync-in-sync', { target: targetTime, absDrift, reason: opts.reason, delayMs: delay });
      return;
    }

    if (!opts.hardSeek && absDrift <= MEDIUM_DRIFT_THRESHOLD_SECONDS) {
      const behind = (el.currentTime || 0) < targetTime;
      const rate = behind ? 1.06 : 0.94;
      if (Math.abs(el.playbackRate - rate) > 0.005) {
        el.playbackRate = rate;
        rateAdjustCountRef.current += 1;
        correctionCountRef.current += 1;
        lastDriftCorrectionAtRef.current = now;
        schedulePlaybackRateReset(PLAYBACK_RATE_ADJUST_WINDOW_SECONDS * 1000);
        logSyncDiagnostics('guest-sync-rate-adjust', { target: targetTime, absDrift, rate, reason: opts.reason, delayMs: delay });
      }
      setCurrentTime(el.currentTime || 0);
      return;
    }

    if (now - lastSeekAtRef.current < SEEK_COOLDOWN_MS && !opts.hardSeek) {
      logSyncDiagnostics('guest-sync-seek-cooldown', { target: targetTime, absDrift, reason: opts.reason });
      return;
    }
    isSyncingRef.current = true;
    try {
      resetPlaybackRate();
      el.currentTime = targetTime;
      lastSeekAtRef.current = now;
      forcedSeekCountRef.current += 1;
      correctionCountRef.current += 1;
      setCurrentTime(targetTime);
    } finally {
      window.setTimeout(() => { isSyncingRef.current = false; }, 220);
    }
    logSyncDiagnostics('guest-sync-seek', { target: targetTime, absDrift, reason: opts.reason, delayMs: delay, hardSeek: !!opts.hardSeek });
  }, [isHost, canGuestFollowSync, estimateDelayMs, logSyncDiagnostics, resetPlaybackRate, schedulePlaybackRateReset]);

  // When guest becomes ready after host started, sync to latest host time
  useEffect(() => {
    if (isHost) return;
    if (!canGuestFollowSync) return;
    const t = pendingGuestSyncTimeRef.current;
    if (t == null) return;
    const el = videoRef.current;
    if (!el || el.readyState < 1) return;
    applyGuestSync(t, { reason: 'apply-pending', isPlaying: hostIsPlayingRef.current ?? undefined, hardSeek: true });
    pendingGuestSyncTimeRef.current = null;
  }, [isHost, canGuestFollowSync, videoSrc, applyGuestSync]);

  // Host playback controls (host-authoritative)
  const handlePlay = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    if (videoRef.current.paused) void tryPlayVideo();
    emitHostPlaybackEvent('videoPlay', true);
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    emitHostPlaybackEvent('videoPause', true);
    setIsPlaying(false);
  };

  const handleSeek = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    emitHostPlaybackEvent('videoSeek', true);
  };

  // Periodic host sync (time only)
  useEffect(() => {
    if (!roomId || !isHost) return;
    const id = window.setInterval(() => {
      emitHostPlaybackEvent('videoHostSync', false);
    }, HOST_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [roomId, isHost, emitHostPlaybackEvent]);

  // Guest receives host sync + play/pause/seek
  useEffect(() => {
    if (!roomId) return;

    const handleRemotePlay = (payload: { currentTime?: number; isPlaying?: boolean; serverTimestamp?: number; hostSentAt?: number }) => {
      if (isHost || !videoRef.current) return;
      const remoteTime = typeof payload.currentTime === 'number' ? payload.currentTime : undefined;
      hostIsPlayingRef.current = typeof payload.isPlaying === 'boolean' ? payload.isPlaying : true;
      if (typeof remoteTime === 'number') pendingGuestSyncTimeRef.current = remoteTime;
      if (!canGuestFollowSync) return;
      void runSyncedUpdate(async () => {
        if (typeof remoteTime === 'number') {
          applyGuestSync(remoteTime, { reason: 'videoPlay', isPlaying: true, serverTimestamp: payload.serverTimestamp, hostSentAt: payload.hostSentAt, hardSeek: true });
        }
        pendingRemotePlayRef.current = true;
        await tryPlayVideo();
      });
      setIsPlaying(true);
      logSyncDiagnostics('guest-recv-videoPlay', { currentTime: remoteTime, serverTimestamp: payload.serverTimestamp });
    };

    const handleRemotePause = (payload: { currentTime?: number; isPlaying?: boolean; serverTimestamp?: number; hostSentAt?: number }) => {
      if (isHost || !videoRef.current) return;
      const remoteTime = typeof payload.currentTime === 'number' ? payload.currentTime : undefined;
      hostIsPlayingRef.current = false;
      if (typeof remoteTime === 'number') pendingGuestSyncTimeRef.current = remoteTime;
      if (!canGuestFollowSync) return;
      void runSyncedUpdate(() => {
        if (typeof remoteTime === 'number') {
          applyGuestSync(remoteTime, { reason: 'videoPause', isPlaying: false, serverTimestamp: payload.serverTimestamp, hostSentAt: payload.hostSentAt, hardSeek: true });
        }
        videoRef.current?.pause();
        resetPlaybackRate();
        pendingRemotePlayRef.current = false;
      });
      setIsPlaying(false);
      logSyncDiagnostics('guest-recv-videoPause', { currentTime: remoteTime, serverTimestamp: payload.serverTimestamp });
    };

    const handleRemoteSeek = (payload: { currentTime?: number; isPlaying?: boolean; serverTimestamp?: number; hostSentAt?: number }) => {
      if (isHost || !videoRef.current || typeof payload.currentTime !== 'number') return;
      if (typeof payload.isPlaying === 'boolean') hostIsPlayingRef.current = payload.isPlaying;
      pendingGuestSyncTimeRef.current = payload.currentTime;
      if (!canGuestFollowSync) return;
      applyGuestSync(payload.currentTime, { reason: 'videoSeek', isPlaying: payload.isPlaying, serverTimestamp: payload.serverTimestamp, hostSentAt: payload.hostSentAt, hardSeek: true });
      setCurrentTime(payload.currentTime);
      logSyncDiagnostics('guest-recv-videoSeek', { currentTime: payload.currentTime, serverTimestamp: payload.serverTimestamp });
    };

    const onHostSync = (payload: { currentTime?: number; isPlaying?: boolean; serverTimestamp?: number; hostSentAt?: number }) => {
      if (isHost) return;
      const t = payload.currentTime;
      if (typeof t !== 'number') return;
      pendingGuestSyncTimeRef.current = t;
      applyGuestSync(t, { reason: 'videoHostSync', isPlaying: payload.isPlaying, serverTimestamp: payload.serverTimestamp, hostSentAt: payload.hostSentAt, hardSeek: false });
    };

    socket.on('videoPlay', handleRemotePlay);
    socket.on('videoPause', handleRemotePause);
    socket.on('videoSeek', handleRemoteSeek);
    socket.on('videoHostSync', onHostSync);
    return () => {
      socket.off('videoPlay', handleRemotePlay);
      socket.off('videoPause', handleRemotePause);
      socket.off('videoSeek', handleRemoteSeek);
      socket.off('videoHostSync', onHostSync);
    };
  }, [roomId, isHost, canGuestFollowSync, applyGuestSync, logSyncDiagnostics, resetPlaybackRate, tryPlayVideo]);

  // Autoplay restriction / user gesture recovery
  useEffect(() => {
    const handleUserInteraction = () => {
      if (pendingRemotePlayRef.current || playbackBlocked) void tryPlayVideo();
    };
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [playbackBlocked, tryPlayVideo]);

  const openLocalFilePicker = useCallback(() => {
    if (!fileInputId) return;
    document.getElementById(fileInputId)?.click();
  }, [fileInputId]);

  const handleLocalFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const resetInput = () => { if (e.target) e.target.value = ''; };
      const currentHostSyncTime = hostSyncTimeRef.current;
      if (!file) return;
      if (!isSupportedVideoFile(file)) {
        setInlineUrlError('Please select a supported video file (.mp4, .webm, .ogg).');
        resetInput();
        return;
      }

      try {
        setInlineUrlError(null);
        setLoadError(null);

        if (isHost) {
          const dur = await getVideoDuration(file);
          const fingerprint = await computeLightweightFingerprint(file);
          const sessionId = createSessionId();
          hostLocalFileRef.current = file;
          guestMatchedSessionRef.current = sessionId;
          setLocalFileLabel(file.name);
          setLocalObjectSrc(file);
          setCurrentTime(0);
          setDuration(dur || 0);
          setIsPlaying(false);
          pendingRemotePlayRef.current = false;
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          const descriptor: SharedVideoDescriptor = {
            source: 'local',
            sessionId,
            fileName: file.name,
            fileSize: file.size,
            duration: dur || 0,
            fingerprint: fingerprint ?? null,
          };
          await emitHostDescriptor(descriptor);
          devLog('[VideoPlayer] host shared local video metadata', { fileName: file.name, sessionId });
          resetInput();
          return;
        }

        const hostDesc = syncedWatchVideoRef.current;
        if (!hostDesc || hostDesc.source !== 'local') {
          setGuestMatchState('waiting');
          setGuestMatchMessage('Waiting for host to share a local video, or follow the shared stream when available.');
          resetInput();
          return;
        }

        setGuestMatchState('checking');
        setGuestMatchMessage('Checking selected file against host video...');
        const dur = await getVideoDuration(file);
        const fingerprint = await computeLightweightFingerprint(file);
        const cmp = compareDescriptors(hostDesc, { fileName: file.name, fileSize: file.size, duration: dur || 0, fingerprint });
        if (!cmp.match) {
          setGuestMatchState('mismatch');
          setGuestMatchMessage(`Video mismatch: ${cmp.reason || 'selected file does not match the host video'}. Select the same video file to join playback.`);
          revokeLocalObjectUrl();
          setVideoSrc('');
          setLocalFileLabel('');
          resetInput();
          return;
        }

        setLocalFileLabel(file.name);
        setLocalObjectSrc(file);
        setCurrentTime(0);
        setDuration(dur || 0);
        setIsPlaying(false);
        pendingRemotePlayRef.current = false;
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
        guestMatchedSessionRef.current = hostDesc.sessionId;
        pendingGuestSyncTimeRef.current = typeof currentHostSyncTime === 'number' ? currentHostSyncTime : 0;
        lastKnownHostPositionRef.current = pendingGuestSyncTimeRef.current ?? 0;
        setGuestMatchState('ready');
        setGuestMatchMessage('Video matched. Ready to watch (following host).');
        devLog('[VideoPlayer] guest local file matched host video', hostDesc.sessionId);
      } catch (error) {
        devError('[VideoPlayer] local file handling failed:', error);
        const message = error instanceof Error ? error.message : 'Failed to load local video file.';
        if (isHost) setLoadError(message);
        else { setGuestMatchState('mismatch'); setGuestMatchMessage(message); }
      } finally {
        resetInput();
      }
    },
    [isHost, emitHostDescriptor, setLocalObjectSrc, revokeLocalObjectUrl]
  );

  const uploadSelectedLocalToCloudinary = useCallback(async () => {
    if (!isHost) return;
    const file = hostLocalFileRef.current;
    if (!file) { setInlineUrlError('Select a local video file first to upload to Cloudinary.'); return; }
    if (hostCloudinaryUploadingRef.current) return;
    hostCloudinaryUploadingRef.current = true;
    setIsUploadingCloudinary(true);
    setInlineUrlError(null);
    try {
      const url = await uploadVideo(file);
      revokeLocalObjectUrl();
      hostLocalFileRef.current = null;
      guestMatchedSessionRef.current = null;
      setLocalFileLabel(file.name);
      setVideoSrc(url);
      setIsVideoLoading(true);
      await emitHostRemoteUrl(url);
      devLog('[VideoPlayer] host uploaded local file to Cloudinary and shared URL');
    } catch (error) {
      devError('[VideoPlayer] Cloudinary upload failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload video. Please try again.';
      setInlineUrlError(message);
    } finally {
      hostCloudinaryUploadingRef.current = false;
      setIsUploadingCloudinary(false);
    }
  }, [isHost, emitHostRemoteUrl, revokeLocalObjectUrl]);

  const handleUseSampleVideo = useCallback(() => {
    if (!isHost) return;
    revokeLocalObjectUrl();
    hostLocalFileRef.current = null;
    guestMatchedSessionRef.current = null;
    setVideoSrc(DEFAULT_VIDEO_SAMPLE_URL);
    setLocalFileLabel('');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLoadError(null);
    setInlineUrlError(null);
    setIsVideoLoading(true);
    pendingRemotePlayRef.current = false;
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    void emitHostRemoteUrl(DEFAULT_VIDEO_SAMPLE_URL);
  }, [isHost, revokeLocalObjectUrl, emitHostRemoteUrl]);

  const loadUrl = useCallback(
    (raw: string) => {
      if (!isHost) { setInlineUrlError('Host controls the shared video.'); return { ok: false, error: 'Host controls the shared video.' } as const; }
      if (syncedWatchVideo?.source === 'local') { setInlineUrlError('A local file is currently shared. Use sample or select another local file to replace it before loading a URL.'); return { ok: false, error: 'Local video currently shared.' } as const; }
      if (!socket || !socket.connected) { setInlineUrlError('Server not connected'); return { ok: false, error: 'Server not connected' } as const; }
      const rawStr = typeof raw === 'string' ? raw : String(raw ?? '');
      if (!rawStr.trim()) { setInlineUrlError('Enter a video URL.'); return { ok: false, error: 'Enter a video URL.' } as const; }
      const v = validateDirectVideoUrl(rawStr);
      if (!v.ok) { setInlineUrlError(v.error); return { ok: false, error: v.error } as const; }
      setInlineUrlError(null); setLoadError(null); revokeLocalObjectUrl();
      hostLocalFileRef.current = null; guestMatchedSessionRef.current = null;
      setLocalFileLabel(''); setVideoSrc(v.url); setIsVideoLoading(true);
      pendingRemotePlayRef.current = false;
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
      void emitHostRemoteUrl(v.url);
      return { ok: true } as const;
    },
    [isHost, syncedWatchVideo, revokeLocalObjectUrl, emitHostRemoteUrl]
  );

  const retryLastUrl = useCallback(() => {
    if (!videoSrc || localObjectUrlRef.current) return;
    const v = validateDirectVideoUrl(videoSrc);
    if (!v.ok) return;
    setLoadError(null); setIsVideoLoading(true);
    if (videoRef.current) videoRef.current.load();
  }, [videoSrc]);

  useImperativeHandle(
    ref,
    () => ({
      loadLocalFile: (e: ChangeEvent<HTMLInputElement>) => handleLocalFileChange(e),
      loadUrl,
      resetToSample: () => handleUseSampleVideo(),
    }),
    [handleLocalFileChange, loadUrl, handleUseSampleVideo]
  );

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = (e: SyntheticEvent<HTMLVideoElement>) => setCurrentTime(e.currentTarget.currentTime || 0);
  const handleLoadedMetadata = (e: SyntheticEvent<HTMLVideoElement>) => setDuration(e.currentTarget.duration || 0);

  const handleVideoLoadedData = useCallback(() => {
    setLoadError(null); setIsVideoLoading(false);
    if (!isHost && canGuestFollowSync && pendingGuestSyncTimeRef.current != null && videoRef.current) {
      applyGuestSync(pendingGuestSyncTimeRef.current, { reason: 'loaded-data', isPlaying: hostIsPlayingRef.current ?? undefined, hardSeek: true });
      pendingGuestSyncTimeRef.current = null;
    }
  }, [isHost, canGuestFollowSync, applyGuestSync]);

  const handleVideoError = useCallback(() => {
    const el = videoRef.current;
    devError('[VideoPlayer] onError', { src: videoSrc, mediaError: el?.error });
    setLoadError(LOAD_FAILED_MESSAGE); setIsVideoLoading(false);
    if (!localObjectUrlRef.current) setVideoSrc('');
  }, [videoSrc]);

  const onWaiting = useCallback(() => { if (isHost) return; guestBufferingRef.current = true; logSyncDiagnostics('guest-state-waiting'); }, [isHost, logSyncDiagnostics]);
  const onPlaying = useCallback(() => { if (isHost) return; guestBufferingRef.current = false; logSyncDiagnostics('guest-state-playing'); }, [isHost, logSyncDiagnostics]);
  const onCanPlay = useCallback(() => { setIsVideoLoading(false); if (!isHost) { guestBufferingRef.current = false; logSyncDiagnostics('guest-state-canplay'); } }, [isHost, logSyncDiagnostics]);
  const onPauseEvent = useCallback(() => { if (!isHost) { /* guest pause state tracked via host sync */ } }, [isHost]);

  const hostLocalShared = !!(!isHost && syncedWatchVideo?.source === 'local');
  const showGuestGate = hostLocalShared && guestMatchState !== 'ready';
  const effectiveStateLabel = (() => {
    if (isHost) return syncedWatchVideo?.source === 'local' ? 'Sharing local file' : 'Host';
    if (!syncedWatchVideo) return 'Waiting for host video';
    if (syncedWatchVideo.source === 'remote') return 'Following host stream';
    if (guestMatchState === 'host-available' || guestMatchState === 'select-matching') return 'Select matching video';
    if (guestMatchState === 'checking') return 'Checking video';
    if (guestMatchState === 'mismatch') return 'Video mismatch';
    if (guestMatchState === 'ready') return 'Ready to watch';
    return 'Host video available';
  })();

  const statusBanner = (() => {
    if (isHost) {
      if (syncedWatchVideo?.source === 'local') return `Sharing local file: ${syncedWatchVideo.fileName ?? 'video'} (guests must select the same file).`;
      return null;
    }
    if (!syncedWatchVideo) return 'Waiting for host video.';
    if (syncedWatchVideo.source === 'remote') return 'Following host · shared URL stream.';
    if (guestMatchState === 'ready') return 'Video matched. Ready to watch (following host).';
    if (guestMatchState === 'mismatch') return guestMatchMessage || 'Video mismatch. Select the same video file to join playback.';
    if (guestMatchState === 'checking') return 'Checking selected file...';
    return 'The host has loaded a video. Select the same video file to join playback.';
  })();

  const showVideoElement = Boolean(videoSrc) && !showGuestGate;
  const showLoadingOverlay = showVideoElement && isVideoLoading && !loadError;

  const fallbackBlock = !showVideoElement ? (
    <div className="watch-player-fallback" role="alert">
      <p className="watch-player-fallback__title">
        {loadError ? `${loadError}.` : hostLocalShared ? (guestMatchMessage || 'Select the same video file to join playback.') : 'No video loaded'}
      </p>
      <div className="watch-player-fallback__actions">
        {fileInputId ? (
          <button type="button" className="watch-player-fallback__btn" onClick={openLocalFilePicker}>
            {hostLocalShared ? 'Select matching video' : 'Select local file'}
          </button>
        ) : null}
        {loadError && videoSrc && !localObjectUrlRef.current ? (
          <button type="button" className="watch-player-fallback__btn" onClick={retryLastUrl}>Retry</button>
        ) : null}
      </div>
      {hostLocalShared && syncedWatchVideo?.source === 'local' ? (
        <p className="watch-player-manual-sync-note" style={{ marginTop: 8 }}>
          Expected: {syncedWatchVideo.fileName} ({Math.round((syncedWatchVideo.fileSize || 0) / (1024 * 1024))} MB)
        </p>
      ) : null}
    </div>
  ) : null;

  const devDrift = isDev && !isHost ? Math.abs((videoRef.current?.currentTime ?? 0) - lastKnownHostPositionRef.current) : 0;

  const videoBlock = (
    <>
      {statusBanner ? (
        <p className={`watch-player-inline-url-error ${guestMatchState === 'ready' || (!isHost && syncedWatchVideo?.source === 'remote') ? 'watch-player-status-ok' : ''} ${guestMatchState === 'mismatch' ? 'watch-player-status-bad' : ''}`} role="status">
          {statusBanner}
        </p>
      ) : null}
      <div className={`watch-player-video-container flex-1 min-h-0${!isHost ? ' watch-player-video-container--guest' : ''}`}>
        {showVideoElement ? (
          <>
            <video
              ref={videoRef}
              className="watch-player-video w-full h-full object-contain"
              src={videoSrc || undefined}
              preload="auto"
              muted
              playsInline
              controls={isHost}
              onPlay={() => { handlePlay(); }}
              onPause={() => { handlePause(); onPauseEvent(); }}
              onSeeked={handleSeek}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onLoadedData={handleVideoLoadedData}
              onCanPlay={onCanPlay}
              onPlaying={onPlaying}
              onWaiting={onWaiting}
              onError={handleVideoError}
            />
            {showLoadingOverlay ? (
              <div className="watch-player-loading" aria-live="polite"><span className="watch-player-loading__text">Loading video…</span></div>
            ) : null}
            {playbackBlocked ? (
              <button type="button" className="watch-player-start" onClick={() => void tryPlayVideo()}>Click to start playback</button>
            ) : null}
          </>
        ) : fallbackBlock}
      </div>
      {inlineUrlError ? <p className="watch-player-inline-url-error" role="status">{inlineUrlError}</p> : null}
      <div className="watch-player-footer">
        <span>{formatTime(currentTime)}</span><span> / </span><span>{formatTime(duration || 0)}</span>
        {playerOnly && typeof onToggleExpand === 'function' ? (
          <button type="button" className="watch-player-theater-btn" onClick={onToggleExpand} aria-pressed={isExpanded} aria-label={isExpanded ? 'Exit theater mode' : 'Theater mode — expand video'} title={isExpanded ? 'Exit theater mode' : 'Theater mode — expand video'}>
            <span className="material-symbols-outlined watch-player-theater-btn__icon" aria-hidden>{isExpanded ? 'fullscreen_exit' : 'fullscreen'}</span>
            <span className="watch-player-theater-btn__label">{isExpanded ? 'Exit' : 'Theater'}</span>
          </button>
        ) : null}
        <span className="watch-player-sync-indicator">
          {!isHost ? 'Following host · ' : null}
          {effectiveStateLabel} · {isPlaying ? 'Playing (synced)' : 'Paused'}
          {isDev && !isHost ? ` · drift:${devDrift.toFixed(2)}s corr:${correctionCountRef.current} seek:${forcedSeekCountRef.current} rateAdj:${rateAdjustCountRef.current}` : ''}
        </span>
      </div>
    </>
  );

  if (playerOnly) {
    return <div className="watch-player animate-zoom-in watch-player--player-only h-full w-full flex flex-col min-h-0">{videoBlock}</div>;
  }

  return (
    <div className="watch-player animate-zoom-in h-full w-full flex flex-col min-h-0">
      <div className="watch-player-header">
        <h3>Watch Party</h3>
        <span className="watch-player-status">{roomId ? `Room: ${roomId}` : 'Not in room'}</span>
      </div>
      <div className="watch-player-file-row">
        <input type="file" accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg" className="watch-player-file-input" id="watch-party-video-file" onChange={handleLocalFileChange} />
        <label htmlFor="watch-party-video-file" className="watch-player-file-btn">{isHost ? 'Load local video' : 'Select matching video'}</label>
        {isHost ? (
          <button type="button" className="watch-player-sample-btn" onClick={() => void uploadSelectedLocalToCloudinary()} disabled={isUploadingCloudinary || !hostLocalFileRef.current}>
            {isUploadingCloudinary ? 'Uploading…' : 'Upload to Cloudinary (optional)'}
          </button>
        ) : null}
        {localFileLabel ? <span className="watch-player-file-name" title={localFileLabel}>{localFileLabel}</span> : <span className="watch-player-file-hint">{isHost ? 'Local file (shared by metadata) or sample/URL' : 'Select the same file as host'}</span>}
        {isHost ? <button type="button" className="watch-player-sample-btn" onClick={handleUseSampleVideo}>Use sample video</button> : null}
      </div>
      <p className="watch-player-manual-sync-note">Local files are loaded per device (not uploaded). Host controls playback; guests follow after selecting the matching file.</p>
      {videoBlock}
    </div>
  );
});

export default VideoPlayer;
