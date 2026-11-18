import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import VideoPlayer from './components/VideoPlayer';
import TopNavbar from './components/TopNavbar';
import VideoStage from './components/VideoStage';
import BottomPanels from './components/BottomPanels';
import type { SharedVideoDescriptor, VideoPlayerHandle } from './types/models';
import './styles/RoomLayout.css';

const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};
const devWarn = (...args: unknown[]) => {
  if (isDev) console.warn(...args);
};

interface RoomProps {
  roomId: string | null;
  mediaWarning?: string;
  videoCall: ReactNode;
  chat: ReactNode;
  participants: ReactNode;
  isHost?: boolean;
  syncedWatchVideoUrl?: string | null;
  syncedWatchVideo?: SharedVideoDescriptor | null;
  hostSyncTime?: number;
  setError?: (message: string | null) => void;
}

export default function Room({
  roomId,
  mediaWarning,
  videoCall,
  chat,
  participants,
  isHost,
  syncedWatchVideoUrl = null,
  syncedWatchVideo = null,
  hostSyncTime = 0,
  setError,
}: RoomProps) {
  const vpRef = useRef<VideoPlayerHandle | null>(null);
  const fileInputId = 'room-load-video-file';
  const [pasteUrl, setPasteUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`room-shell${isExpanded ? ' room-shell--expanded' : ''}`}
    >
      <TopNavbar
        roomId={roomId}
        fileInputId={fileInputId}
        pasteUrl={pasteUrl}
        onPasteChange={setPasteUrl}
        onFileChange={(e: ChangeEvent<HTMLInputElement>) => vpRef.current?.loadLocalFile(e)}
        onLoadUrl={() => {
          const url = String(pasteUrl ?? '').trim();
          devLog('[Room] Load URL', { length: url.length, preview: url.slice(0, 100) });
          const vp = vpRef.current;
          if (!vp) {
            devWarn('[Room] VideoPlayer ref not ready');
            return;
          }
          const result = vp.loadUrl(url);
          if (result?.ok) setPasteUrl('');
        }}
        onSample={() => vpRef.current?.resetToSample()}
        isHost={!!isHost}
        sharedVideo={syncedWatchVideo}
      />

      <div className="room-main">
        <VideoStage mediaWarning={mediaWarning}>
          <VideoPlayer
            ref={vpRef}
            roomId={roomId}
            playerOnly
            isHost={!!isHost}
            syncedWatchVideoUrl={syncedWatchVideoUrl}
            syncedWatchVideo={syncedWatchVideo}
            hostSyncTime={hostSyncTime}
            fileInputId={fileInputId}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((v) => !v)}
            setError={setError}
          />
        </VideoStage>
      </div>

      <BottomPanels
        videoCall={videoCall}
        chat={chat}
        participants={participants}
      />
    </div>
  );
}
