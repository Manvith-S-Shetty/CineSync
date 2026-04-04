import '../../styles/VideoCallStage.css';
import {
  LOCAL_TILE_ID,
  streamHasScreenShareVideo,
} from '../../videoCallLayoutUtils';

/**
 * Video call UI: main focus tile, scrollable strip, maximize overlay.
 * Parent owns MediaStreams and localVideoRef; this file only lays out elements.
 */
export default function VideoCallStage({
  participants,
  remoteStreams,
  remoteVideoStates,
  localStream,
  localVideoRef,
  isVideoOff,
  videoError,
  isScreenSharing,
  focusTileId,
  manualPinTileId,
  onPinTile,
  maximizedTileId,
  onMaximizeTile,
  onMinimizeTile,
  renderEnableCameraButton,
  onLocalVideoError,
}) {
  const usernameFor = (userId) => {
    if (userId === LOCAL_TILE_ID) return 'You';
    const p = participants.find((x) => x && x.id === userId);
    return p?.username || 'Participant';
  };

  const remoteStreamFor = (userId) =>
    remoteStreams.find((s) => s.userId === userId);

  const localIsScreen = isScreenSharing && !!localStream;
  const localMirror = localStream && !localIsScreen;

  const stripIds = (() => {
    const maximized = maximizedTileId;
    const focus = focusTileId;
    const ids = [];

    const localInStrip =
      focus !== LOCAL_TILE_ID && maximized !== LOCAL_TILE_ID;
    if (localInStrip) ids.push(LOCAL_TILE_ID);

    for (const r of remoteStreams) {
      if (!r?.userId) continue;
      if (r.userId === focus || r.userId === maximized) continue;
      ids.push(r.userId);
    }
    return ids;
  })();

  const localRefPlacement = (() => {
    if (maximizedTileId === LOCAL_TILE_ID) return 'maximized';
    if (focusTileId === LOCAL_TILE_ID) return 'focus';
    if (
      localStream &&
      focusTileId !== LOCAL_TILE_ID &&
      maximizedTileId !== LOCAL_TILE_ID
    )
      return 'strip';
    return 'none';
  })();

  const sideBySide =
    remoteStreams.length > 0 && stripIds.length > 0 && !maximizedTileId;

  const renderRemoteVideoEl = (stream, userId, variant) => {
    const screen = streamHasScreenShareVideo(stream);
    const contain = screen || variant === 'focus';
    return (
      <video
        autoPlay
        playsInline
        muted={false}
        ref={(el) => {
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream;
            if (el.paused) el.play().catch(() => {});
          }
        }}
        className={`video-tile__media video-item ${contain ? 'video-tile__media--contain' : ''}`.trim()}
        style={{
          transform: screen ? undefined : 'scaleX(-1)',
          objectFit: contain ? 'contain' : 'cover',
        }}
        onLoadedMetadata={(e) => {
          const v = e.target;
          if (v.paused) v.play().catch(() => {});
        }}
      />
    );
  };

  const renderLocalVideoEl = (variant) => {
    const contain =
      localIsScreen || variant === 'focus' || variant === 'maximized';
    return (
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={`video-tile__media video-item local ${contain ? 'video-tile__media--contain' : ''}`.trim()}
        style={{
          transform: localMirror ? 'scaleX(-1)' : undefined,
          objectFit: contain ? 'contain' : 'cover',
        }}
        onLoadedMetadata={(e) => {
          e.target.play().catch(() => {});
        }}
        onError={(e) => {
          onLocalVideoError?.(e);
        }}
      />
    );
  };

  const renderLocalContent = (variant) => {
    const attachRef =
      (variant === 'focus' && localRefPlacement === 'focus') ||
      (variant === 'strip' && localRefPlacement === 'strip') ||
      (variant === 'maximized' && localRefPlacement === 'maximized');

    if (!localStream) {
      return (
        <div className="video-tile__placeholder">
          <span className="material-symbols-outlined">videocam</span>
          <p>Enable your camera to appear in the call</p>
          {renderEnableCameraButton?.()}
        </div>
      );
    }
    if (videoError) {
      return (
        <div className="video-tile__error">
          <span className="material-symbols-outlined">error</span>
          <p>Camera not available</p>
        </div>
      );
    }
    if (isVideoOff) {
      return (
        <div className="video-tile__error">
          <span className="material-symbols-outlined">videocam_off</span>
          <p>Camera turned off</p>
        </div>
      );
    }
    if (!attachRef) {
      return null;
    }
    return renderLocalVideoEl(variant);
  };

  const renderRemoteContent = (userId, variant) => {
    const info = remoteStreamFor(userId);
    if (!info?.stream) return null;
    if (remoteVideoStates[userId]) {
      return (
        <div className="video-tile__error">
          <span className="material-symbols-outlined">videocam_off</span>
          <p>Camera turned off</p>
        </div>
      );
    }
    return renderRemoteVideoEl(info.stream, userId, variant);
  };

  const pinActive = (tileId) => manualPinTileId === tileId;

  function TileChrome({
    tileId,
    label,
    isScreen,
    variant,
    interactive,
    children,
  }) {
    const isMax = variant === 'maximized-inner';
    const showPin = interactive && !isMax;
    const showMax = interactive && !isMax;

    return (
      <div
        className={`video-tile video-tile--${isMax ? 'focus' : variant} ${pinActive(tileId) ? 'video-tile--user-pinned' : ''}`}
      >
        {children}
        {isScreen ? (
          <span className="video-tile__badge video-tile__badge--screen">Screen</span>
        ) : null}
        {pinActive(tileId) ? <span className="video-tile__badge">Pinned</span> : null}
        <div className="video-tile__actions">
          {showMax ? (
            <button
              type="button"
              className="video-tile__icon-btn"
              title="Maximize"
              aria-label="Maximize video"
              onClick={(e) => {
                e.stopPropagation();
                onMaximizeTile(tileId);
              }}
            >
              <span className="material-symbols-outlined">open_in_full</span>
            </button>
          ) : null}
        </div>
        {showPin ? (
          <button
            type="button"
            className="video-tile__click-layer"
            title="Click to pin or unpin"
            aria-label={
              pinActive(tileId) ? 'Unpin video' : 'Pin video to main focus'
            }
            aria-pressed={pinActive(tileId)}
            onClick={() => onPinTile(tileId)}
          />
        ) : null}
        <div className="video-tile__label">{label}</div>
      </div>
    );
  }

  const renderFocusMain = () => {
    if (maximizedTileId) {
      return (
        <div className="video-tile video-tile--focus video-tile__placeholder">
          <p className="m-0 text-sm text-zinc-500">Maximized — use Minimize to return</p>
        </div>
      );
    }

    if (focusTileId === LOCAL_TILE_ID) {
      return (
        <TileChrome
          tileId={LOCAL_TILE_ID}
          label={`${usernameFor(LOCAL_TILE_ID)}${localIsScreen ? ' — sharing' : ''}`}
          isScreen={localIsScreen}
          variant="focus"
          interactive
        >
          {renderLocalContent('focus')}
        </TileChrome>
      );
    }

    const info = remoteStreamFor(focusTileId);
    if (!info?.stream) {
      return (
        <div className="video-tile video-tile--focus video-tile__placeholder">
          <p className="m-0 text-sm text-zinc-500">Waiting for video…</p>
        </div>
      );
    }
    const screen = streamHasScreenShareVideo(info.stream);
    return (
      <TileChrome
        tileId={focusTileId}
        label={usernameFor(focusTileId)}
        isScreen={screen}
        variant="focus"
        interactive
      >
        {renderRemoteContent(focusTileId, 'focus')}
      </TileChrome>
    );
  };

  const renderStripTile = (tileId) => {
    if (tileId === LOCAL_TILE_ID) {
      return (
        <TileChrome
          key="strip-local"
          tileId={LOCAL_TILE_ID}
          label="You"
          isScreen={localIsScreen}
          variant="strip"
          interactive
        >
          {renderLocalContent('strip')}
        </TileChrome>
      );
    }
    const info = remoteStreamFor(tileId);
    const screen = info?.stream && streamHasScreenShareVideo(info.stream);
    return (
      <TileChrome
        key={tileId}
        tileId={tileId}
        label={usernameFor(tileId)}
        isScreen={!!screen}
        variant="strip"
        interactive
      >
        {renderRemoteContent(tileId, 'strip')}
      </TileChrome>
    );
  };

  const renderMaximizedOverlay = () => {
    if (!maximizedTileId) return null;

    if (maximizedTileId === LOCAL_TILE_ID) {
      return (
        <div className="video-call-stage__overlay" role="dialog" aria-modal="true">
          <div className="video-call-stage__overlay-top">
            <button
              type="button"
              className="video-call-stage__minimize-btn"
              onClick={onMinimizeTile}
            >
              <span className="material-symbols-outlined">close_fullscreen</span>
              Minimize
            </button>
          </div>
          <div className="video-call-stage__overlay-body">
            <TileChrome
              tileId={LOCAL_TILE_ID}
              label={`${usernameFor(LOCAL_TILE_ID)}${localIsScreen ? ' — sharing' : ''}`}
              isScreen={localIsScreen}
              variant="maximized-inner"
              interactive={false}
            >
              {renderLocalContent('maximized')}
            </TileChrome>
          </div>
        </div>
      );
    }

    const info = remoteStreamFor(maximizedTileId);
    const screen = info?.stream && streamHasScreenShareVideo(info.stream);
    return (
      <div className="video-call-stage__overlay" role="dialog" aria-modal="true">
        <div className="video-call-stage__overlay-top">
          <button
            type="button"
            className="video-call-stage__minimize-btn"
            onClick={onMinimizeTile}
          >
            <span className="material-symbols-outlined">close_fullscreen</span>
            Minimize
          </button>
        </div>
        <div className="video-call-stage__overlay-body">
          <TileChrome
            tileId={maximizedTileId}
            label={usernameFor(maximizedTileId)}
            isScreen={!!screen}
            variant="maximized-inner"
            interactive={false}
          >
            {info ? renderRemoteContent(maximizedTileId, 'focus') : null}
          </TileChrome>
        </div>
      </div>
    );
  };

  return (
    <div className="video-call-stage">
      <div
        className={`video-call-stage__body ${sideBySide ? 'video-call-stage__body--side-by-side' : ''} ${maximizedTileId ? 'video-call-stage__body--maximized-backdrop' : ''}`}
      >
        <div className="video-call-stage__focus">{renderFocusMain()}</div>
        {!maximizedTileId && stripIds.length > 0 ? (
          <div className="video-call-stage__strip">
            {stripIds.map((id) => renderStripTile(id))}
          </div>
        ) : null}
      </div>
      {renderMaximizedOverlay()}
    </div>
  );
}
