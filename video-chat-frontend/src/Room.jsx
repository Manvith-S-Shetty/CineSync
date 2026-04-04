import { useRef, useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import TopNavbar from './components/TopNavbar';
import VideoStage from './components/VideoStage';
import BottomPanels from './components/BottomPanels';
import './styles/RoomLayout.css';

export default function Room({
  roomId,
  mediaWarning,
  videoCall,
  chat,
  participants,
  isHost,
  syncedWatchVideoUrl = null,
}) {
  const vpRef = useRef(null);
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
        onFileChange={(e) => vpRef.current?.loadLocalFile(e)}
        onLoadUrl={() => {
          const url = String(pasteUrl ?? '').trim();
          console.log('[Room] Load URL', { length: url.length, preview: url.slice(0, 100) });
          const vp = vpRef.current;
          if (!vp) {
            console.warn('[Room] VideoPlayer ref not ready');
            return;
          }
          const result = vp.loadUrl(url);
          if (result?.ok) setPasteUrl('');
        }}
        onSample={() => vpRef.current?.resetToSample()}
        isHost={!!isHost}
      />

      <div className="room-main">
        <VideoStage mediaWarning={mediaWarning}>
          <VideoPlayer
            ref={vpRef}
            roomId={roomId}
            playerOnly
            isHost={!!isHost}
            syncedWatchVideoUrl={syncedWatchVideoUrl}
            fileInputId={fileInputId}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded((v) => !v)}
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
