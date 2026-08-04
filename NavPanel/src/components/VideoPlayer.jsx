import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import socket from '../socket';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_VIDEO_SAMPLE_URL,
  validateDirectVideoUrl,
} from '../utils/videoUrlUtils';
import '../styles/VideoPlayer.css';

const isDev = import.meta.env.DEV;
const devLog = (...args) => {
  if (isDev) console.log(...args);
};
const devWarn = (...args) => {
  if (isDev) console.warn(...args);
};
const devError = (...args) => {
  if (isDev) console.error(...args);
};

const LOAD_FAILED_MESSAGE = 'Video failed to load';
const HOST_SYNC_INTERVAL_MS = 1000;
const HOST_SYNC_SEEK_TOLERANCE_SECONDS = 0.75;

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    roomId,
    playerOnly = false,
    isExpanded = false,
    onToggleExpand,
    isHost = false,
    syncedWatchVideoUrl = null,
    fileInputId = '',
    setError,
  },
  ref
) {
  const { getIdToken } = useAuth();
  const videoRef = useRef(null);
  const objectUrlRef = useRef(null);
  const isSyncingRef = useRef(false);
  const pendingRemotePlayRef = useRef(false);
  const videoSrcRef = useRef(DEFAULT_VIDEO_SAMPLE_URL);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO_SAMPLE_URL);
  const [localFileLabel, setLocalFileLabel] = useState('');
  const [inlineUrlError, setInlineUrlError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [lastAttemptedUrl, setLastAttemptedUrl] = useState('');

  useEffect(() => {
    videoSrcRef.current = videoSrc;
  }, [videoSrc]);

  const broadcastWatchUrl = useCallback(
    (videoUrl) => {
       if (!isHost || !roomId || !socket.connected) return;
      void (async () => {
        try {
          const idToken = await getIdToken();
          socket.emit('videoChange', { roomId, videoUrl, idToken });
          socket.emit('watchVideoUrl', { roomId, videoUrl, idToken });
        } catch (err) {
          devError('[VideoPlayer] auth required to change video', err);
          setError?.('Authentication required to change video.');
        }
      })();
    },
    [isHost, roomId, getIdToken, setError]
  );

  const runSyncedUpdate = async (updateFn) => {
    isSyncingRef.current = true;
    try {
      await updateFn();
    } finally {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 250);
    }
  };

  const tryPlayVideo = async () => {
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
  };

  const handlePlay = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    if (videoRef.current.paused) {
      tryPlayVideo();
    }
    devLog('emitting play/pause', { type: 'play', roomId, time: videoRef.current.currentTime || 0 });
    socket.emit('videoPlay', {
      roomId,
      currentTime: videoRef.current.currentTime || 0,
    });
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    devLog('emitting play/pause', { type: 'pause', roomId, time: videoRef.current.currentTime || 0 });
    socket.emit('videoPause', {
      roomId,
      currentTime: videoRef.current.currentTime || 0,
    });
    setIsPlaying(false);
  };

  const handleSeek = () => {
    if (!isHost || !roomId || isSyncingRef.current || !videoRef.current) return;
    socket.emit('videoSeek', {
      roomId,
      currentTime: videoRef.current.currentTime || 0,
    });
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const revokeBlobUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const openLocalFilePicker = useCallback(() => {
    if (!fileInputId) return;
    document.getElementById(fileInputId)?.click();
  }, [fileInputId]);

  const handleVideoLoadedData = useCallback(() => {
    devLog('[VideoPlayer] onLoadedData: success', {
      src: videoSrcRef.current,
    });
    setLoadError(null);
    setIsVideoLoading(false);
  }, []);

  const handleVideoError = useCallback(() => {
    const el = videoRef.current;
    const code = el?.error?.code;
    const message = el?.error?.message;
    const failedSrc = videoSrcRef.current;
    devError('[VideoPlayer] onError: video failed to load', {
      src: failedSrc,
      code,
      message,
      mediaError: el?.error,
    });
    if (failedSrc) setLastAttemptedUrl(failedSrc);
    setLoadError(LOAD_FAILED_MESSAGE);
    setIsVideoLoading(false);
    setVideoSrc('');
  }, []);

  const handleLocalFileChange = useCallback(
    (e) => {
      // if (!isHost) return; //It give acces only for the host 
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('video/')) {
        return;
      }
      revokeBlobUrl();
      const url = URL.createObjectURL(file);
      //const url = await uploadVideo(file); //To-Do later
      objectUrlRef.current = url;
      setVideoSrc(url);
      setLocalFileLabel(file.name);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      setLoadError(null);
      setInlineUrlError(null);
      setIsVideoLoading(true);
      pendingRemotePlayRef.current = false;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (e.target) e.target.value = '';
      if (isHost && roomId) {
        broadcastWatchUrl(null);
        devLog('[VideoPlayer] local file selected; cleared shared watch URL for room');
      }
    },
    [revokeBlobUrl, isHost, roomId, broadcastWatchUrl]
  );

  const handleUseSampleVideo = useCallback(() => {
    if (!isHost) return;
    revokeBlobUrl();
    setVideoSrc(DEFAULT_VIDEO_SAMPLE_URL);
    setLocalFileLabel('');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLoadError(null);
    setInlineUrlError(null);
    setIsVideoLoading(true);
    setLastAttemptedUrl(DEFAULT_VIDEO_SAMPLE_URL);
    pendingRemotePlayRef.current = false;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    if (isHost && roomId) {
      broadcastWatchUrl(DEFAULT_VIDEO_SAMPLE_URL);
      devLog('[VideoPlayer] host switched to sample video; broadcasting URL');
    }
  }, [revokeBlobUrl, isHost, roomId, broadcastWatchUrl]);

  const loadUrl = useCallback(
    (raw) => {
      // if (!isHost) {
      //   return { ok: false, error: 'Only the host can change the video' };
      // }
      if (!socket || !socket.connected) {
        setInlineUrlError('Server not connected');
        return { ok: false, error: 'Server not connected' };
      }
      const rawStr = typeof raw === 'string' ? raw : String(raw ?? '');
      if (!rawStr.trim()) {
        setInlineUrlError('Enter a video URL.');
        return { ok: false, error: 'Enter a video URL.' };
      }
      devLog('[VideoPlayer] loadUrl called', {
        length: rawStr.length,
        preview: rawStr.trim().slice(0, 120),
      });
      const v = validateDirectVideoUrl(rawStr);
      if (!v.ok) {
        devWarn('[VideoPlayer] loadUrl validation failed:', v.error);
        setInlineUrlError(v.error);
        return { ok: false, error: v.error };
      }
      devLog('[VideoPlayer] loading validated video URL:', v.url);
      setInlineUrlError(null);
      setLoadError(null);
      revokeBlobUrl();
      setLocalFileLabel('');
      setLastAttemptedUrl(v.url);
      setVideoSrc(v.url);
      setIsVideoLoading(true);
      pendingRemotePlayRef.current = false;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      if (roomId) {
        broadcastWatchUrl(v.url);
        devLog('[VideoPlayer] broadcast videoChange to room:', roomId);
      }
      return { ok: true };
    },
    [revokeBlobUrl, isHost, roomId, broadcastWatchUrl]
  );

  const retryLastUrl = useCallback(() => {
    if (!lastAttemptedUrl) return;
    const v = validateDirectVideoUrl(lastAttemptedUrl);
    if (!v.ok) return;
    devLog('[VideoPlayer] retry: reloading URL', v.url);
    setLoadError(null);
    setVideoSrc(v.url);
    setIsVideoLoading(true);
  }, [lastAttemptedUrl]);

  useImperativeHandle(
    ref,
    () => ({
      loadLocalFile: (e) => handleLocalFileChange(e),
      loadUrl,
      resetToSample: () => handleUseSampleVideo(),
    }),
    [handleLocalFileChange, loadUrl, handleUseSampleVideo]
  );

  useEffect(() => {
    return () => {
      revokeBlobUrl();
    };
  }, [revokeBlobUrl]);

  /** When `videoSrc` changes, show loading until loadeddata / error. */
  useEffect(() => {
    if (!videoSrc) {
      setIsVideoLoading(false);
      return;
    }
    setIsVideoLoading(true);
  }, [videoSrc]);

  /**
   * After React commits `src`, force the media element to load.
   * Fixes cases where the browser does not reliably fetch a new remote URL.
   */
  useLayoutEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;
    devLog('[VideoPlayer] useLayoutEffect: video.load() after src update', videoSrc);
    try {
      el.load();
    } catch (err) {
      devError('[VideoPlayer] video.load() threw:', err);
    }
  }, [videoSrc]);

  /** Apply host-shared URL from server (room join + live updates). */
  useEffect(() => {
    if (syncedWatchVideoUrl === undefined) return;

    if (isHost) {
      if (syncedWatchVideoUrl === null) return;
      const v = validateDirectVideoUrl(syncedWatchVideoUrl);
      if (!v.ok) {
        devWarn('[VideoPlayer] host: ignoring invalid synced URL');
        return;
      }
      if (v.url === videoSrcRef.current) return;
      revokeBlobUrl();
      setLocalFileLabel('');
      setLoadError(null);
      setInlineUrlError(null);
      setLastAttemptedUrl(v.url);
      setVideoSrc(v.url);
      setIsVideoLoading(true);
      devLog('[VideoPlayer] host applied synced room URL (rejoin)', v.url);
      return;
    }

    if (syncedWatchVideoUrl === null) {
      if (videoSrcRef.current === DEFAULT_VIDEO_SAMPLE_URL) return;
      revokeBlobUrl();
      setLocalFileLabel('');
      setLoadError(null);
      setInlineUrlError(null);
      setLastAttemptedUrl(DEFAULT_VIDEO_SAMPLE_URL);
      setVideoSrc(DEFAULT_VIDEO_SAMPLE_URL);
      setIsVideoLoading(true);
      devLog('[VideoPlayer] guest: host cleared shared URL — using sample');
      return;
    }

    const v = validateDirectVideoUrl(syncedWatchVideoUrl);
    if (!v.ok) {
      devWarn('[VideoPlayer] guest: invalid synced URL ignored', syncedWatchVideoUrl);
      return;
    }
    if (v.url === videoSrcRef.current) return;
    revokeBlobUrl();
    setLocalFileLabel('');
    setLoadError(null);
    setInlineUrlError(null);
    setLastAttemptedUrl(v.url);
    setVideoSrc(v.url);
    setIsVideoLoading(true);
    devLog('[VideoPlayer] guest applied synced watch URL', v.url);
  }, [syncedWatchVideoUrl, isHost, revokeBlobUrl]);

  useEffect(() => {
    if (!roomId) return;

    const handleRemotePlay = ({ currentTime: remoteTime }) => {
      if (!videoRef.current) return;
      devLog('sync event received', { type: 'play', roomId, time: remoteTime });
      runSyncedUpdate(async () => {
        if (typeof remoteTime === 'number') {
          videoRef.current.currentTime = remoteTime;
        }
        pendingRemotePlayRef.current = true;
        await tryPlayVideo();
      });
      setIsPlaying(true);
    };

    const handleRemotePause = ({ currentTime: remoteTime }) => {
      if (!videoRef.current) return;
      devLog('sync event received', { type: 'pause', roomId, time: remoteTime });
      runSyncedUpdate(() => {
        if (typeof remoteTime === 'number') {
          videoRef.current.currentTime = remoteTime;
        }
        videoRef.current.pause();
        pendingRemotePlayRef.current = false;
      });
      setIsPlaying(false);
    };

    const handleRemoteSeek = ({ currentTime: remoteTime }) => {
      if (!videoRef.current || typeof remoteTime !== 'number') return;
      devLog('sync event received', { type: 'seek', roomId, time: remoteTime });
      runSyncedUpdate(() => {
        videoRef.current.currentTime = remoteTime;
      });
      setCurrentTime(remoteTime);
    };

    socket.on('videoPlay', handleRemotePlay);
    socket.on('videoPause', handleRemotePause);
    socket.on('videoSeek', handleRemoteSeek);

    return () => {
      socket.off('videoPlay', handleRemotePlay);
      socket.off('videoPause', handleRemotePause);
      socket.off('videoSeek', handleRemoteSeek);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !isHost) return;
    const id = window.setInterval(() => {
      const el = videoRef.current;
      if (!el || isSyncingRef.current) return;
      const hostTime = el.currentTime || 0;
      devLog('[SYNC SEND]', { roomId, currentTime: hostTime });
      socket.emit('videoHostSync', {
        roomId,
        currentTime: hostTime,
      });
    }, HOST_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [roomId, isHost]);

  useEffect(() => {
    if (!roomId || isHost) return;
    const onHostSync = ({ currentTime: t }) => {
      const el = videoRef.current;
      if (!el || typeof t !== 'number' || isSyncingRef.current) return;
      const localTime = el.currentTime || 0;
      const drift = Math.abs(localTime - t);
      devLog('[SYNC RECEIVE]', { roomId, hostTime: t, localTime });
      devLog('[TIME DIFF]', { roomId, diff: drift });
      if (drift <= HOST_SYNC_SEEK_TOLERANCE_SECONDS) return;
      isSyncingRef.current = true;
      el.currentTime = t;
      setCurrentTime(t);
      window.setTimeout(() => {
        isSyncingRef.current = false;
      }, 280);
    };
    socket.on('videoHostSync', onHostSync);
    return () => socket.off('videoHostSync', onHostSync);
  }, [roomId, isHost]);

  useEffect(() => {
    const handleUserInteraction = () => {
      if (pendingRemotePlayRef.current || playbackBlocked) {
        tryPlayVideo();
      }
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, [playbackBlocked]);

  const showVideoElement = Boolean(videoSrc);
  const showLoadingOverlay = showVideoElement && isVideoLoading && !loadError;

  const fallbackBlock = !showVideoElement ? (
    <div className="watch-player-fallback" role="alert">
      <p className="watch-player-fallback__title">
        {loadError ? `${loadError}.` : 'No video loaded'}
      </p>
      <div className="watch-player-fallback__actions">
        {lastAttemptedUrl ? (
          <button type="button" className="watch-player-fallback__btn" onClick={retryLastUrl}>
            Retry
          </button>
        ) : null}
        {fileInputId ? (
          <button type="button" className="watch-player-fallback__btn" onClick={openLocalFilePicker}>
            Upload local file
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const videoBlock = (
    <>
      <div
        className={`watch-player-video-container flex-1 min-h-0${!isHost ? ' watch-player-video-container--guest' : ''}`}
      >
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
              onLoadStart={() =>
                devLog('[VideoPlayer] onLoadStart', { src: videoSrcRef.current })
              }
              onPlay={(e) => {
                devLog("[VIDEO PLAY]");
                handlePlay(e);
              }}
              onPause={(e) => {
                devLog("[VIDEO PAUSE]");
                handlePause(e);
              }}
              onSeeked={handleSeek}
              onTimeUpdate={(e) => {
                const time = e.target.currentTime || 0;
                devLog("[TIME]", time);
                setCurrentTime(time);
              }}
              onLoadedMetadata={(e) => {
                const d = e.target.duration || 0;
                setDuration(d);
                devLog('[VideoPlayer] onLoadedMetadata', {
                  src: videoSrcRef.current,
                  duration: d,
                });
              }}
              onLoadedData={handleVideoLoadedData}
              onCanPlay={() => {
                devLog('[VideoPlayer] onCanPlay', { src: videoSrcRef.current });
                setIsVideoLoading(false);
              }}
              onError={handleVideoError}
              onPlaying={() => setIsVideoLoading(false)}
            />
            {showLoadingOverlay ? (
              <div className="watch-player-loading" aria-live="polite">
                <span className="watch-player-loading__text">Loading video…</span>
              </div>
            ) : null}
            {playbackBlocked ? (
              <button type="button" className="watch-player-start" onClick={tryPlayVideo}>
                Click to start playback
              </button>
            ) : null}
          </>
        ) : (
          fallbackBlock
        )}
      </div>
      {inlineUrlError ? (
        <p className="watch-player-inline-url-error" role="status">
          {inlineUrlError}
        </p>
      ) : null}
      <div className="watch-player-footer">
        <span>{formatTime(currentTime)}</span>
        <span> / </span>
        <span>{formatTime(duration || 0)}</span>
        {playerOnly && typeof onToggleExpand === 'function' ? (
          <button
            type="button"
            className="watch-player-theater-btn"
            onClick={onToggleExpand}
            aria-pressed={isExpanded}
            aria-label={isExpanded ? 'Exit theater mode' : 'Theater mode — expand video'}
            title={isExpanded ? 'Exit theater mode' : 'Theater mode — expand video'}
          >
            <span className="material-symbols-outlined watch-player-theater-btn__icon" aria-hidden>
              {isExpanded ? 'fullscreen_exit' : 'fullscreen'}
            </span>
            <span className="watch-player-theater-btn__label">
              {isExpanded ? 'Exit' : 'Theater'}
            </span>
          </button>
        ) : null}
        <span className="watch-player-sync-indicator">
          {!isHost ? 'Following host · ' : null}
          {isPlaying ? 'Playing (synced)' : 'Paused'}
        </span>
      </div>
    </>
  );

  if (playerOnly) {
    return (
      <div className="watch-player animate-zoom-in watch-player--player-only h-full w-full flex flex-col min-h-0">
        {videoBlock}
      </div>
    );
  }

  return (
    <div className="watch-player animate-zoom-in h-full w-full flex flex-col min-h-0">
      <div className="watch-player-header">
        <h3>Watch Party</h3>
        <span className="watch-player-status">
          {roomId ? `Room: ${roomId}` : 'Not in room'}
        </span>
      </div>
      <div className="watch-player-file-row">
        <input
          type="file"
          accept="video/*"
          className="watch-player-file-input"
          id="watch-party-video-file"
          onChange={handleLocalFileChange}
        />
        <label htmlFor="watch-party-video-file" className="watch-player-file-btn">
          Load video file
        </label>
        {localFileLabel ? (
          <span className="watch-player-file-name" title={localFileLabel}>
            {localFileLabel}
          </span>
        ) : (
          <span className="watch-player-file-hint">Sample video (default)</span>
        )}
        {localFileLabel ? (
          <button type="button" className="watch-player-sample-btn" onClick={handleUseSampleVideo}>
            Use sample video
          </button>
        ) : null}
      </div>
      <p className="watch-player-manual-sync-note">
        Sync uses time only — each person must load the same file (or both use the sample) so playback lines up.
      </p>
      {videoBlock}
    </div>
  );
});

export default VideoPlayer;
