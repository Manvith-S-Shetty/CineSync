import type { ReactNode, RefObject } from 'react';
import type { RemoteStreamInfo, RoomUser } from '../../types/models';
import { LOCAL_TILE_ID, streamHasScreenShareVideo } from '../../videoCallLayoutUtils';
import '../../styles/VideoCallStage.css';

interface VideoCallStageProps {
  participants: RoomUser[];
  remoteStreams: RemoteStreamInfo[];
  remoteVideoStates: Record<string, boolean>;
  localStream: MediaStream | null;
  localVideoRef: RefObject<HTMLVideoElement>;
  isVideoOff: boolean;
  videoError: boolean;
  isScreenSharing: boolean;
  focusTileId: string | null;
  manualPinTileId: string | null;
  onPinTile: (id: string) => void;
  maximizedTileId: string | null;
  onMaximizeTile: (id: string) => void;
  onMinimizeTile: () => void;
  renderEnableCameraButton?: () => ReactNode;
  onLocalVideoError?: () => void;
}

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
}: VideoCallStageProps) {
  const usernameFor = (userId: string): string => {
    if (userId === LOCAL_TILE_ID) return 'You';
    const p = participants.find((x) => x && x.id === userId);
    return p?.displayName || p?.username || 'Participant';
  };

  const remoteStreamFor = (userId: string) => remoteStreams.find((s) => s.userId === userId);

  const localIsScreen = isScreenSharing && !!localStream;
  const localMirror = localStream && !localIsScreen;

  const stripIds = (() => {
    const maximized = maximizedTileId;
    const focus = focusTileId;
    const ids: string[] = [];
    const localInStrip = focus !== LOCAL_TILE_ID && maximized !== LOCAL_TILE_ID;
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
    if (localStream && focusTileId !== LOCAL_TILE_ID && maximizedTileId !== LOCAL_TILE_ID) return 'strip';
    return 'none';
  })();

  const sideBySide = remoteStreams.length > 0 && stripIds.length > 0 && !maximizedTileId;

  const renderRemoteVideoEl = (stream: MediaStream, userId: string, variant: string) => {
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
            if (el.paused) void el.play().catch(() => {});
          }
        }}
        className={`video-tile__media video-item ${contain ? 'video-tile__media--contain' : ''}`.trim()}
        style={{
          transform: screen ? undefined : 'scaleX(-1)',
          objectFit: contain ? 'contain' : 'cover',
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.paused) void v.play().catch(() => {});
        }}
      />
    );
  };

  const renderLocalVideoEl = (variant: string) => {
    const contain = localIsScreen || variant === 'focus' || variant === 'maximized';
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
          void e.currentTarget.play().catch(() => {});
        }}
        onError={() => {
          onLocalVideoError?.();
        }}
      />
    );
  };

  const renderLocalContent = (variant: string) => {
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
    if (!attachRef) return null;
    return renderLocalVideoEl(variant);
  };

  const renderRemoteContent = (userId: string, variant: string) => {
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

  const pinActive = (tileId: string) => manualPinTileId === tileId;

  function TileChrome({
    tileId,
    label,
    isScreen,
    variant,
    interactive,
    children,
  }: {
    tileId: string;
    label: string;
    isScreen: boolean;
    variant: string;
    interactive: boolean;
    children: ReactNode;
  }) {
    const isMax = variant === 'maximized-inner';
    const showPin = interactive && !isMax;
    const showMax = interactive && !isMax;

    return (
      <div className={`video-tile video-tile--${isMax ? 'focus' : variant} ${pinActive(tileId) ? 'video-tile--user-pinned' : ''} relative group`}>
        {children}
        {isScreen ? <span className="video-tile__badge video-tile__badge--screen z-10">Screen</span> : null}
        {pinActive(tileId) ? <span className="video-tile__badge z-10">Pinned</span> : null}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition z-20">
          {showMax ? (
            <button type="button" className="bg-black/60 text-white p-2 rounded-lg hover:bg-black flex items-center justify-center text-sm" title="Maximize" aria-label="Maximize video" onClick={(e) => { e.stopPropagation(); onMaximizeTile(tileId); }}>⛶</button>
          ) : null}
          {showPin ? (
            <button type="button" className="bg-black/60 text-white p-2 rounded-lg hover:bg-black flex items-center justify-center text-sm" title="Click to pin or unpin" aria-label={pinActive(tileId) ? 'Unpin video' : 'Pin video to main focus'} aria-pressed={pinActive(tileId)} onClick={(e) => { e.stopPropagation(); onPinTile(tileId); }}>🗕</button>
          ) : null}
        </div>
        {showPin ? (
          <button type="button" className="video-tile__click-layer" title="Click to pin or unpin" aria-label={pinActive(tileId) ? 'Unpin video' : 'Pin video to main focus'} aria-pressed={pinActive(tileId)} onClick={() => onPinTile(tileId)} />
        ) : null}
        <div className="video-tile__label z-10">{label}</div>
      </div>
    );
  }

  const renderFocusMain = () => {
    if (maximizedTileId) {
      return <div className="video-tile video-tile--focus video-tile__placeholder"><p className="m-0 text-sm text-zinc-500">Maximized — use Minimize to return</p></div>;
    }
    if (focusTileId === LOCAL_TILE_ID) {
      return <TileChrome tileId={LOCAL_TILE_ID} label={`${usernameFor(LOCAL_TILE_ID)}${localIsScreen ? ' — sharing' : ''}`} isScreen={localIsScreen} variant="focus" interactive>{renderLocalContent('focus')}</TileChrome>;
    }
    const fid = focusTileId ?? LOCAL_TILE_ID;
    const info = remoteStreamFor(fid);
    if (!info?.stream) {
      return <div className="video-tile video-tile--focus video-tile__placeholder"><p className="m-0 text-sm text-zinc-500">Waiting for video…</p></div>;
    }
    const screen = streamHasScreenShareVideo(info.stream);
    return <TileChrome tileId={fid} label={usernameFor(fid)} isScreen={screen} variant="focus" interactive>{renderRemoteContent(fid, 'focus')}</TileChrome>;
  };

  const renderStripTile = (tileId: string) => {
    if (tileId === LOCAL_TILE_ID) {
      return <TileChrome key="strip-local" tileId={LOCAL_TILE_ID} label="You" isScreen={localIsScreen} variant="strip" interactive>{renderLocalContent('strip')}</TileChrome>;
    }
    const info = remoteStreamFor(tileId);
    const screen = info?.stream && streamHasScreenShareVideo(info.stream);
    return <TileChrome key={tileId} tileId={tileId} label={usernameFor(tileId)} isScreen={!!screen} variant="strip" interactive>{renderRemoteContent(tileId, 'strip')}</TileChrome>;
  };

  const renderMaximizedOverlay = () => {
    if (!maximizedTileId) return null;
    if (maximizedTileId === LOCAL_TILE_ID) {
      return (
        <div className="video-call-stage__overlay" role="dialog" aria-modal="true">
          <div className="video-call-stage__overlay-top"><button type="button" className="video-call-stage__minimize-btn" onClick={onMinimizeTile}><span className="material-symbols-outlined">close_fullscreen</span>Minimize</button></div>
          <div className="video-call-stage__overlay-body"><TileChrome tileId={LOCAL_TILE_ID} label={`${usernameFor(LOCAL_TILE_ID)}${localIsScreen ? ' — sharing' : ''}`} isScreen={localIsScreen} variant="maximized-inner" interactive={false}>{renderLocalContent('maximized')}</TileChrome></div>
        </div>
      );
    }
    const info = remoteStreamFor(maximizedTileId);
    const screen = info?.stream && streamHasScreenShareVideo(info.stream);
    return (
      <div className="video-call-stage__overlay" role="dialog" aria-modal="true">
        <div className="video-call-stage__overlay-top"><button type="button" className="video-call-stage__minimize-btn" onClick={onMinimizeTile}><span className="material-symbols-outlined">close_fullscreen</span>Minimize</button></div>
        <div className="video-call-stage__overlay-body"><TileChrome tileId={maximizedTileId} label={usernameFor(maximizedTileId)} isScreen={!!screen} variant="maximized-inner" interactive={false}>{info ? renderRemoteContent(maximizedTileId, 'focus') : null}</TileChrome></div>
      </div>
    );
  };

  return (
    <div className="video-call-stage">
      <div className={`video-call-stage__body ${sideBySide ? 'video-call-stage__body--side-by-side' : ''} ${maximizedTileId ? 'video-call-stage__body--maximized-backdrop' : ''}`}>
        <div className="video-call-stage__focus">{renderFocusMain()}</div>
        {!maximizedTileId && stripIds.length > 0 ? <div className="video-call-stage__strip">{stripIds.map((id) => renderStripTile(id))}</div> : null}
      </div>
      {renderMaximizedOverlay()}
    </div>
  );
}
