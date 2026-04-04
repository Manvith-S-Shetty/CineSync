import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import socket from "./socket";
import { getRtcConfiguration } from './config/rtcConfig';
import RoomJoin from './components/RoomJoin';
import ConnectionStatus from './components/ConnectionStatus';
import ParticipantList from './components/ParticipantList';
import VideoCallStage from './components/video-call/VideoCallStage';
import ReactionFloatLayer from './components/ReactionFloatLayer';
import Room from './Room';
import { LOCAL_TILE_ID, streamHasScreenShareVideo } from './videoCallLayoutUtils';
import { useAuth } from './contexts/AuthContext';
import './styles/VideoChat.css';

const WATCH_REACTIONS = ['❤️', '😂', '🔥', '😮'];

function formatChatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const MEDIA_MODE_LABELS = {
  initializing: 'Requesting camera…',
  'video+audio': 'Video + microphone',
  'video-only': 'Video only (no microphone)',
  'no-media': 'No media (tap Enable Camera)',
};

/** Browsers only expose getUserMedia reliably on secure contexts (https, localhost, 127.0.0.1). */
function isSecureContextForMedia() {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

async function pickFirstVideoinputDeviceId() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'videoinput');
    console.log('[media] videoinput count:', inputs.length);
    const withId = inputs.find((d) => d.deviceId && d.deviceId.length > 0);
    return withId?.deviceId ?? null;
  } catch (err) {
    console.error(err.name, err.message);
    return null;
  }
}

async function pickFirstAudioinputDeviceId() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === 'audioinput');
    console.log('[media] audioinput count:', mics.length);
    const withId = mics.find((d) => d.deviceId && d.deviceId.length > 0);
    return withId?.deviceId ?? null;
  } catch (err) {
    console.error(err.name, err.message);
    return null;
  }
}

/** Permissions API — not supported in all browsers; never throws to caller */
async function logMicrophonePermissionState() {
  try {
    if (!navigator.permissions?.query) return;
    const permission = await navigator.permissions.query({ name: 'microphone' });
    console.log('Mic permission:', permission.state);
  } catch {
    /* Safari / Firefox may reject unknown descriptor */
  }
}

function buildAudioConstraints(exactDeviceId) {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (exactDeviceId) {
    audio.deviceId = { exact: exactDeviceId };
  }
  return audio;
}

const MIC_UNAVAILABLE_WARNING =
  'Microphone not detected or blocked. You can continue in video-only mode.';

function buildSafeVideoConstraints(deviceId) {
  const video = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
  };
  if (deviceId) {
    video.deviceId = { exact: deviceId };
  }
  return video;
}

/**
 * One user gesture: request explicit audio processing + optional mic device, then video-only if needed.
 * Relaxes video deviceId if the first video constraint set fails.
 */
async function getUserMediaSafeWithFallback(videoDeviceId, options = {}) {
  const includeAudio = options.includeAudio !== false;
  let audioDeviceId = options.audioDeviceId;
  if (includeAudio && audioDeviceId === undefined) {
    audioDeviceId = await pickFirstAudioinputDeviceId();
    if (audioDeviceId) {
      console.log('[media] using explicit audioinput deviceId');
    }
  }

  const videoExact = buildSafeVideoConstraints(videoDeviceId);
  const videoRelaxed = buildSafeVideoConstraints(null);

  const tryVideoWithAudio = async (video) => {
    if (!includeAudio) {
      return navigator.mediaDevices.getUserMedia({ video, audio: false });
    }
    try {
      const audio = buildAudioConstraints(audioDeviceId || null);
      return await navigator.mediaDevices.getUserMedia({ video, audio });
    } catch (err) {
      console.error('Full media failed:', err?.name, err?.message);
      if (audioDeviceId) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video,
            audio: buildAudioConstraints(null),
          });
        } catch (err2) {
          console.error('Audio without deviceId failed:', err2?.name, err2?.message);
        }
      }
      return navigator.mediaDevices.getUserMedia({ video, audio: false });
    }
  };

  try {
    return await tryVideoWithAudio(videoExact);
  } catch (err) {
    console.error(err.name, err.message);
    if (!videoDeviceId) {
      throw err;
    }
    try {
      return await tryVideoWithAudio(videoRelaxed);
    } catch (err4) {
      console.error(err4.name, err4.message);
      throw err4;
    }
  }
}

function messageFromMediaError(err) {
  if (!err?.name) {
    return 'Unable to access camera/microphone due to unknown error.';
  }
  switch (err.name) {
    case 'NotAllowedError':
      return 'Camera/Microphone access denied. Please allow permission in browser or system settings.';
    case 'NotFoundError':
      return 'No camera or microphone device found.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is being used by another application (Zoom, Meet, etc.).';
    case 'OverconstrainedError':
      return 'Camera does not support required settings.';
    default:
      return 'Unable to access camera/microphone due to unknown error.';
  }
}

const VideoChat = () => {
  const { profile } = useAuth();
  const profileRef = useRef(null);
  const wasJoinedRef = useRef(false);
  const rejoinPayloadRef = useRef(null);
  const isJoinedRef = useRef(false); // mirror isJoined for socket connect handler
  const typingStopTimerRef = useRef(null);
  const messageBoxRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // My refs for video elements and connections
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const mediaAcquireInProgressRef = useRef(false);
  /** ICE can arrive before setRemoteDescription; queue by remote socket id */
  const pendingIceCandidatesRef = useRef({});
  /** Reconnection calls latest initiateCall (defined later in the component) */
  const initiateCallRef = useRef(async () => {});

  // States to manage my video chat
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Need these for room management
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [reactionTrigger, setReactionTrigger] = useState(null);
  const [typingPeers, setTypingPeers] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [mediaWarning, setMediaWarning] = useState('');
  /** User-facing explanation of the last getUserMedia failure (cleared on success). */
  const [mediaError, setMediaError] = useState('');
  const [localStream, setLocalStream] = useState(null);
  /** Set when tab is hidden and we release camera/mic to avoid multi-tab hardware conflicts */
  const [mediaReleasedHiddenTab, setMediaReleasedHiddenTab] = useState(false);
  /** 'initializing' | 'video+audio' | 'video-only' | 'no-media' — camera only after explicit "Enable Camera" click */
  const [mediaMode, setMediaMode] = useState('no-media');

  // Chat States
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");

  // Add this state
  const [videoError, setVideoError] = useState(false);

  // Add these new states with your existing states
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [showParticipants, setShowParticipants] = useState(true);
  /** Host-shared direct video URL from signaling server (late join + live updates). */
  const [syncedWatchVideoUrl, setSyncedWatchVideoUrl] = useState(null);

  useEffect(() => {
    isJoinedRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => {
    const onWatchVideoUrl = ({ videoUrl }) => {
      setSyncedWatchVideoUrl(videoUrl === undefined ? null : videoUrl);
    };
    socket.on('watchVideoUrl', onWatchVideoUrl);
    return () => socket.off('watchVideoUrl', onWatchVideoUrl);
  }, []);

  const roomIdForTypingRef = useRef(roomId);
  useEffect(() => {
    roomIdForTypingRef.current = roomId;
  }, [roomId]);

  const scheduleTypingStop = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = setTimeout(() => {
      typingStopTimerRef.current = null;
      const rid = roomIdForTypingRef.current;
      if (rid && socket.connected) {
        socket.emit('chatTyping', { roomId: rid, isTyping: false });
      }
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const teardownPeers = () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
      });
      peerConnectionsRef.current = {};
      pendingIceCandidatesRef.current = {};
      setRemoteStreams([]);
      setRemoteVideoStates({});
    };

    const onDisconnect = () => {
      if (wasJoinedRef.current) setSocketReconnecting(true);
      teardownPeers();
    };

    const onConnect = () => {
      setSocketReconnecting(false);
      const payload = rejoinPayloadRef.current;
      if (wasJoinedRef.current && payload && isJoinedRef.current) {
        socket.emit('joinRoom', payload);
        setConnectionStatus('connecting');
      }
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, []);

  useEffect(() => {
    const el = messageBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  /** UI-only: manual pin overrides auto focus (screen share). */
  const [manualPinTileId, setManualPinTileId] = useState(null);
  /** UI-only: fullscreen-style overlay for one tile. */
  const [maximizedTileId, setMaximizedTileId] = useState(null);

  // First, add a new state to track remote video states
  const [remoteVideoStates, setRemoteVideoStates] = useState({});

  const autoFocusTileId = useMemo(() => {
    if (isScreenSharing && localStream) return LOCAL_TILE_ID;
    for (const r of remoteStreams) {
      if (r?.stream && streamHasScreenShareVideo(r.stream)) return r.userId;
    }
    return null;
  }, [isScreenSharing, localStream, remoteStreams]);

  const focusTileId =
    manualPinTileId ?? autoFocusTileId ?? LOCAL_TILE_ID;

  const handlePinTile = useCallback((tileId) => {
    setManualPinTileId((prev) => (prev === tileId ? null : tileId));
  }, []);

  const handleMaximizeTile = useCallback((tileId) => {
    setMaximizedTileId(tileId);
  }, []);

  const handleMinimizeTile = useCallback(() => {
    setMaximizedTileId(null);
  }, []);

  useEffect(() => {
    if (
      manualPinTileId &&
      manualPinTileId !== LOCAL_TILE_ID &&
      !remoteStreams.some((s) => s.userId === manualPinTileId)
    ) {
      setManualPinTileId(null);
    }
  }, [remoteStreams, manualPinTileId]);

  useEffect(() => {
    if (
      maximizedTileId &&
      maximizedTileId !== LOCAL_TILE_ID &&
      !remoteStreams.some((s) => s.userId === maximizedTileId)
    ) {
      setMaximizedTileId(null);
    }
  }, [remoteStreams, maximizedTileId]);

  const renegotiateAfterLocalStreamAttached = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || !roomId) return;
    const peers = peerConnectionsRef.current;
    const userIds = Object.keys(peers);
    if (userIds.length === 0) return;

    for (const userId of userIds) {
      const pc = peers[userId];
      if (!pc || pc.signalingState === 'closed') continue;
      try {
        let added = false;
        stream.getTracks().forEach((track) => {
          const already = pc.getSenders().some((s) => s.track?.kind === track.kind);
          if (!already) {
            console.log('[renegotiate] addTrack', track.kind, '→ peer', userId);
            pc.addTrack(track, stream);
            added = true;
          }
        });
        if (added) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: userId, offer, roomId });
          console.log('[renegotiate] offer sent to', userId);
        }
      } catch (e) {
        console.error('[renegotiate] failed for peer', userId, e);
      }
    }
  }, [roomId]);

  const handleEnableCameraClick = async () => {
    if (!isSecureContextForMedia()) {
      const msg =
        'Camera and microphone require a secure page. Open the app over https or http://localhost (or 127.0.0.1).';
      setMediaError(msg);
      console.error('[Enable Camera] blocked: not a secure context', window.location?.href);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser does not support camera/microphone access.');
      console.error('[Enable Camera] getUserMedia not available');
      return;
    }
    if (localStreamRef.current) {
      console.log('[Enable Camera] stream already active, reusing');
      return;
    }
    if (mediaAcquireInProgressRef.current) {
      console.log('[Enable Camera] request already in progress, ignoring duplicate click');
      return;
    }

    mediaAcquireInProgressRef.current = true;
    setMediaError('');
    setMediaWarning('');
    setMediaMode('initializing');
    console.log('[Enable Camera] user gesture → permissions + enumerateDevices + getUserMedia');

    try {
      await logMicrophonePermissionState();

      const deviceId = await pickFirstVideoinputDeviceId();
      const micDeviceId = await pickFirstAudioinputDeviceId();
      if (deviceId) {
        console.log('[Enable Camera] using explicit videoinput deviceId');
      } else {
        console.log('[Enable Camera] no labeled video deviceId; using facingMode + ideal size');
      }

      const stream = await getUserMediaSafeWithFallback(deviceId, {
        audioDeviceId: micDeviceId,
      });
      console.log('Tracks:', stream.getTracks());
      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('No microphone detected');
      } else {
        console.log('Microphone working:', audioTracks[0].label || '(unnamed device)');
      }

      setMediaReleasedHiddenTab(false);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setVideoError(false);
      setError(null);
      setMediaError('');
      const hasAudio = audioTracks.length > 0;
      setMediaMode(hasAudio ? 'video+audio' : 'video-only');
      setMediaWarning(hasAudio ? '' : MIC_UNAVAILABLE_WARNING);
      console.log('[Enable Camera] success', {
        streamId: stream.id,
        tracks: stream.getTracks().map((t) => ({ kind: t.kind, readyState: t.readyState })),
      });
      // Ref may be null until after join (video mounts only in-room); useLayoutEffect also binds when isJoined flips.
      queueMicrotask(async () => {
        const el = localVideoRef.current;
        if (!el) return;
        el.srcObject = null;
        el.srcObject = stream;
        try {
          await el.play();
        } catch (e) {
          console.warn('[Enable Camera] local video play()', e?.name, e?.message);
        }
      });
      if (isJoined && roomId && Object.keys(peerConnectionsRef.current).length > 0) {
        await renegotiateAfterLocalStreamAttached();
      }
    } catch (err) {
      console.error('Media error:', err?.name, err?.message);
      console.error('[Enable Camera] failed', err);
      setMediaError(messageFromMediaError(err));
      setMediaMode('no-media');
    } finally {
      mediaAcquireInProgressRef.current = false;
    }
  };

  // Setup connection with another user
  const createPeerConnection = useCallback((userId, iceRoomId) => {
    const signalingRoomId = iceRoomId ?? roomId;
    try {
      console.log('Creating peer connection for:', userId);
      
      const configuration = getRtcConfiguration();

      const peerConnection = new RTCPeerConnection(configuration);

      // Improved track handling
      peerConnection.ontrack = (event) => {
        console.log('Received track:', event.track.kind, 'from:', userId);

        const newStream =
          event.streams?.[0] ?? new MediaStream([event.track]);
        
        // Ensure we're not duplicating streams
        setRemoteStreams(prevStreams => {
          const existingStreamIndex = prevStreams.findIndex(s => s.userId === userId);
          
          if (existingStreamIndex >= 0) {
            // Update existing stream
            const updatedStreams = [...prevStreams];
            updatedStreams[existingStreamIndex] = {
              ...updatedStreams[existingStreamIndex],
              stream: newStream
            };
            return updatedStreams;
          }
          
          // Add new stream
          return [...prevStreams, {
            stream: newStream,
            userId,
            id: newStream.id
          }];
        });

        // Monitor track status
        event.track.onended = () => {
          console.log('Track ended:', userId, event.track.kind);
          handleTrackEnded(userId, event.track);
        };
      };

      // Enhanced ICE handling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate to:', userId);
          if (!signalingRoomId) {
            console.warn('[ICE] skip candidate emit: no roomId');
            return;
          }
          socket.emit("candidate", {
            to: userId,
            candidate: event.candidate,
            roomId: signalingRoomId,
          });
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state (${userId}):`, peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
          console.log('ICE connection failed, attempting restart...');
          peerConnection.restartIce();
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state (${userId}):`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed') {
          handleConnectionFailure(userId);
        }
      };

      // Store the connection
      peerConnectionsRef.current[userId] = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      throw error;
    }
  }, [roomId]);

  const enqueueIceCandidate = useCallback((remoteUserId, candidate) => {
    if (!remoteUserId || !candidate) return;
    const q = pendingIceCandidatesRef.current[remoteUserId] || [];
    q.push(candidate);
    pendingIceCandidatesRef.current[remoteUserId] = q;
  }, []);

  const flushPendingIceCandidates = useCallback(async (remoteUserId) => {
    const pc = peerConnectionsRef.current[remoteUserId];
    const list = pendingIceCandidatesRef.current[remoteUserId];
    if (!list?.length) return;
    delete pendingIceCandidatesRef.current[remoteUserId];
    for (const c of list) {
      try {
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } else {
          enqueueIceCandidate(remoteUserId, c);
        }
      } catch (e) {
        console.warn('[ICE] flush add failed', remoteUserId, e?.name, e?.message);
        enqueueIceCandidate(remoteUserId, c);
      }
    }
  }, [enqueueIceCandidate]);

  // Add connection failure handler
  const handleConnectionFailure = useCallback((userId) => {
    console.log('Handling connection failure for:', userId);
    
    // Clean up failed connection
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].close();
      delete peerConnectionsRef.current[userId];
    }

    // Remove failed streams
    setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
    delete pendingIceCandidatesRef.current[userId];

    // Attempt reconnection
    setTimeout(() => {
      if (isHost) {
        console.log('Attempting reconnection...');
        void initiateCallRef.current(userId);
      }
    }, 2000);
  }, [isHost]);

  // Add track ended handler
  const handleTrackEnded = useCallback((userId, track) => {
    console.log(`Track ${track.kind} ended for user ${userId}`);
    if (track.kind === 'video') {
      setRemoteVideoStates(prev => ({...prev, [userId]: true}));
    }
  }, []);

  const buildJoinPayload = useCallback((rid) => {
    const p = profileRef.current;
    if (!p?.uid) return null;
    return {
      roomId: rid,
      username: p.displayName,
      displayName: p.displayName,
      photoURL: p.photoURL || '',
      firebaseUid: p.uid,
    };
  }, []);

  // Handle room creation (profile from Firebase auth)
  const createRoom = async () => {
    try {
      const p = profileRef.current;
      if (!p?.uid) {
        setError('You must be signed in to create a room.');
        return;
      }
      socket.emit('createRoom', {
        username: p.displayName,
        displayName: p.displayName,
        photoURL: p.photoURL || '',
        firebaseUid: p.uid,
      });
    } catch (error) {
      setError(`Failed to create room: ${error.message}`);
    }
  };

  // Add this function to check permissions
  const checkMediaPermissions = async () => {
    return true;
  };

  const joinRoom = async (joinRoomId) => {
    try {
      const p = profileRef.current;
      if (!p?.uid) {
        setError('You must be signed in to join a room.');
        return;
      }
      const rid = (joinRoomId || '').trim();
      if (!rid) {
        setError('Enter a room ID.');
        return;
      }
      const payload = buildJoinPayload(rid);
      console.log('Attempting to join room:', { roomId: rid });
      socket.emit('joinRoom', payload);
      setConnectionStatus('connecting');
    } catch (error) {
      console.error('Join room error:', error);
      setError(`Failed to join room: ${error.message}`);
    }
  };

  // Initialize WebRTC call (joining user offers to each existing participant; they answer)
  const initiateCall = useCallback(async (userId, signalingRoomId) => {
    const rid = signalingRoomId ?? roomId;
    if (!rid) {
      console.warn('[initiateCall] skipped: no roomId yet');
      return;
    }
    try {
      console.log('Initiating call with:', userId);
      let peerConnection = peerConnectionsRef.current[userId];
      if (!peerConnection) {
        peerConnection = createPeerConnection(userId, rid);
      }

      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks().filter((t) => t.readyState === 'live');
        console.log(`Adding up to ${tracks.length} live tracks to peer connection`);
        tracks.forEach((track) => {
          const already = peerConnection.getSenders().some((s) => s.track?.kind === track.kind);
          if (!already) {
            console.log('Adding track:', track.kind);
            peerConnection.addTrack(track, localStreamRef.current);
          }
        });
      } else {
        console.log('No local stream available; creating receive-only peer connection');
      }

      console.log('Creating offer for:', userId);
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      console.log('Sending offer to:', userId, 'roomId:', rid);
      socket.emit('offer', {
        to: userId,
        offer,
        roomId: rid,
      });
    } catch (error) {
      console.error('Failed to initiate call:', error);
      handleConnectionFailure(userId);
    }
  }, [roomId, createPeerConnection, handleConnectionFailure]);

  useEffect(() => {
    initiateCallRef.current = initiateCall;
  }, [initiateCall]);

  // Socket event handlers
  useEffect(() => {
    socket.on('roomCreated', ({ roomId }) => {
      if (!roomId) {
        console.error('No roomId received');
        return;
      }
      setRoomId(roomId);
      setIsHost(true);
      setConnectionStatus('connected');
      setIsJoined(true);
      wasJoinedRef.current = true;
      const payload = buildJoinPayload(roomId);
      if (payload) rejoinPayloadRef.current = payload;
      clearChat();
      navigator.clipboard.writeText(roomId);
      alert(`Room created! Room ID: ${roomId} (copied to clipboard)`);
    });

    socket.on('roomJoined', ({ roomId, users, isHost, chatHistory, watchVideoUrl: sharedWatchUrl }) => {
      console.log('Room joined event received:', { roomId, users, isHost });
      
      if (!roomId || !Array.isArray(users)) {
        console.error('Invalid room data received:', { roomId, users });
        return;
      }

      setRoomId(roomId);
      setIsHost(isHost);
      setParticipants(users.filter(user => user && user.id));
      setConnectionStatus('connected');
      setIsJoined(true);
      wasJoinedRef.current = true;
      const payload = buildJoinPayload(roomId);
      if (payload) rejoinPayloadRef.current = payload;
      setChatMessages(Array.isArray(chatHistory) ? chatHistory : []);
      setSyncedWatchVideoUrl(
        sharedWatchUrl === undefined || sharedWatchUrl === null ? null : sharedWatchUrl
      );

      // Joiner offers to everyone already in the room (use event roomId — state may not have updated yet)
      users.forEach((user) => {
        if (user && user.id && user.id !== socket.id) {
          console.log('Initializing connection with existing user:', user.id);
          if (!peerConnectionsRef.current[user.id]) {
            initiateCall(user.id, roomId);
          }
        }
      });
    });

    socket.on('offer', async ({ from, offer }) => {
      try {
        if (!roomId) {
          console.error('[offer] missing roomId in handler');
          return;
        }
        let peerConnection = peerConnectionsRef.current[from];
        if (!peerConnection) {
          peerConnection = createPeerConnection(from, roomId);
        }
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates(from);

        if (localStreamRef.current) {
          const liveTracks = localStreamRef.current.getTracks().filter((t) => t.readyState === 'live');
          liveTracks.forEach((track) => {
            const already = peerConnection.getSenders().some((s) => s.track?.kind === track.kind);
            if (!already) {
              peerConnection.addTrack(track, localStreamRef.current);
            }
          });
        }

        const answer = await peerConnection.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer, roomId });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      const peerConnection = peerConnectionsRef.current[from];
      if (!peerConnection) return;
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingIceCandidates(from);
      } catch (e) {
        console.error('Error handling answer:', e);
      }
    });

    socket.on('candidate', async ({ from, candidate }) => {
      const peerConnection = peerConnectionsRef.current[from];
      if (!candidate) return;
      if (!peerConnection) {
        enqueueIceCandidate(from, candidate);
        return;
      }
      if (!peerConnection.remoteDescription) {
        enqueueIceCandidate(from, candidate);
        return;
      }
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[ICE] addCandidate failed, queueing', from, e?.name);
        enqueueIceCandidate(from, candidate);
      }
    });

    socket.on('chatMessage', (messageData) => {
      if (!messageData || !messageData.userId) {
        console.error('Invalid message data:', messageData);
        return;
      }
      setChatMessages(prev => [...prev, messageData]);
    });

    socket.on('peerTyping', ({ userId, username, isTyping }) => {
      setTypingPeers((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = username || 'Someone';
        else delete next[userId];
        return next;
      });
    });

    socket.on('watchReaction', (data) => {
      if (!data?.emoji) return;
      setReactionTrigger({ ...data, _t: Date.now() });
    });

    socket.on('hostChanged', ({ hostFirebaseUid }) => {
      if (!hostFirebaseUid) return;
      const me = profileRef.current;
      setIsHost(!!(me?.uid && hostFirebaseUid === me.uid));
      setParticipants((prev) =>
        prev.map((p) => (p && p.firebaseUid ? { ...p, isHost: p.firebaseUid === hostFirebaseUid } : p))
      );
    });

    socket.on('userLeft', (user) => {
      if (!user || !user.id) {
        console.error('Invalid user data for disconnect:', user);
        return;
      }
      handleUserDisconnected(user.id);
    });

    socket.on('callEnded', () => {
      alert('Call has been ended by the host');
      leaveCall();
    });

    socket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      setError(message);
      setConnectionStatus('disconnected');
    });

    socket.on('userSpeaking', ({ userId, speaking }) => {
      handleSpeakingStateChange(userId, speaking);
    });

    socket.on('videoStateChanged', ({ userId, isVideoOff }) => {
      console.log('Remote video state changed:', userId, isVideoOff);
      setRemoteVideoStates(prev => ({
        ...prev,
        [userId]: isVideoOff
      }));
    });

    socket.on('userJoined', ({ user }) => {
      console.log('New user joined:', user);
      
      if (!user || !user.id) {
        console.error('Invalid user data received:', user);
        return;
      }

      // Update participants list first
      setParticipants(prev => {
        const exists = prev.some(p => p.id === user.id);
        if (exists) return prev;
        return [...prev, user];
      });

      // Initialize video state for new user
      setRemoteVideoStates(prev => ({
        ...prev,
        [user.id]: false
      }));

      // New joiner sends offers from roomJoined; host only answers — no duplicate offer here
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('offer');
      socket.off('answer');
      socket.off('candidate');
      socket.off('chatMessage');
      socket.off('userLeft');
      socket.off('callEnded');
      socket.off('error');
      socket.off('userSpeaking');
      socket.off('videoStateChanged');
      socket.off('userJoined');
      socket.off('peerTyping');
      socket.off('watchReaction');
      socket.off('hostChanged');
    };
  }, [roomId, initiateCall, createPeerConnection, flushPendingIceCandidates, enqueueIceCandidate, buildJoinPayload]);

  // Clean up when I leave or someone else leaves
  const handleUserDisconnected = (userId) => {
    if (!userId) {
      console.error('Invalid userId for disconnection');
      return;
    }

    cleanupPeerConnection(userId);
    
    setRemoteStreams(prev => prev.filter(streamInfo => 
      streamInfo && streamInfo.userId && streamInfo.userId !== userId
    ));
    
    setParticipants(prev => prev.filter(p => 
      p && p.id && p.id !== userId
    ));
    
    setRemoteVideoStates(prev => {
      if (!prev) return {};
      const newStates = { ...prev };
      delete newStates[userId];
      return newStates;
    });
  };

  // My controls for video/audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = async () => {
    const stream = localStreamRef.current;

    if (!isVideoOff) {
      if (!stream) return;
      stream.getVideoTracks().forEach((track) => {
        track.stop();
        try {
          stream.removeTrack(track);
        } catch (_) {
          /* ignore */
        }
      });
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(null).catch(() => {});
        }
      });
      const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
      if (audioTracks.length === 0) {
        localStreamRef.current = null;
        setLocalStream(null);
        setMediaMode('no-media');
        setIsVideoOff(false);
      } else {
        const next = new MediaStream(audioTracks);
        localStreamRef.current = next;
        setLocalStream(next);
        setIsVideoOff(true);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      socket.emit('videoStateChange', { roomId, isVideoOff: true });
      return;
    }

    if (!stream) return;
    if (mediaAcquireInProgressRef.current) return;
    if (!isSecureContextForMedia()) {
      setMediaError(
        'Camera and microphone require a secure page. Open the app over https or http://localhost (or 127.0.0.1).'
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser does not support camera/microphone access.');
      return;
    }

    mediaAcquireInProgressRef.current = true;
    setMediaError('');
    try {
      const deviceId = await pickFirstVideoinputDeviceId();
      const hadLiveAudio = stream.getAudioTracks().some((t) => t.readyState === 'live');
      if (!hadLiveAudio) {
        await logMicrophonePermissionState();
      }
      const micDeviceId = hadLiveAudio ? undefined : await pickFirstAudioinputDeviceId();
      const fresh = await getUserMediaSafeWithFallback(deviceId, {
        includeAudio: !hadLiveAudio,
        audioDeviceId: micDeviceId,
      });
      const vTrack = fresh.getVideoTracks()[0];
      if (!vTrack) {
        throw new Error('No video track from camera');
      }

      console.log('Tracks:', fresh.getTracks());
      console.log('Video tracks:', fresh.getVideoTracks());
      console.log('Audio tracks:', fresh.getAudioTracks());

      if (hadLiveAudio) {
        fresh.getAudioTracks().forEach((t) => t.stop());
      }

      const keptAudio = hadLiveAudio
        ? stream.getAudioTracks().filter((t) => t.readyState === 'live')
        : fresh.getAudioTracks().filter((t) => t.readyState === 'live');

      const merged = new MediaStream();
      keptAudio.forEach((t) => merged.addTrack(t));
      merged.addTrack(vTrack);

      localStreamRef.current = merged;
      setLocalStream(merged);
      setVideoError(false);

      const hasAudio = merged.getAudioTracks().length > 0;
      setMediaMode(hasAudio ? 'video+audio' : 'video-only');
      setMediaWarning(hasAudio ? '' : MIC_UNAVAILABLE_WARNING);

      const at = merged.getAudioTracks();
      if (at.length === 0) {
        console.warn('No microphone detected');
      } else {
        console.log('Microphone working:', at[0].label || '(unnamed device)');
      }

      Object.values(peerConnectionsRef.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(vTrack);
        } else {
          pc.addTrack(vTrack, merged);
        }
      });

      if (isJoined && roomId && Object.keys(peerConnectionsRef.current).length > 0) {
        await renegotiateAfterLocalStreamAttached();
      }

      queueMicrotask(async () => {
        const el = localVideoRef.current;
        if (!el) return;
        el.srcObject = null;
        el.srcObject = merged;
        try {
          await el.play();
        } catch (e) {
          console.warn('[toggleVideo ON] play()', e?.name, e?.message);
        }
      });

      setIsVideoOff(false);
      socket.emit('videoStateChange', { roomId, isVideoOff: false });
    } catch (err) {
      console.error('[toggleVideo] camera on failed', err?.name, err?.message);
      setMediaError(messageFromMediaError(err));
    } finally {
      mediaAcquireInProgressRef.current = false;
    }
  };

  // Let me share my screen
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        setError('No display video track from getDisplayMedia');
        return;
      }

      let addedNewVideoSender = false;
      for (const peerConnection of Object.values(peerConnectionsRef.current)) {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        } else {
          peerConnection.addTrack(videoTrack, screenStream);
          addedNewVideoSender = true;
        }
      }

      if (addedNewVideoSender && roomId) {
        for (const userId of Object.keys(peerConnectionsRef.current)) {
          const pc = peerConnectionsRef.current[userId];
          if (!pc || pc.signalingState === 'closed') continue;
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { to: userId, offer, roomId });
          } catch (e) {
            console.error('[screen share] renegotiate offer failed', userId, e);
          }
        }
      }

      videoTrack.onended = stopScreenShare;
      setIsScreenSharing(true);
    } catch (error) {
      console.error("Error starting screen share:", error);
      setError("Failed to start screen sharing");
    }
  };

  const stopScreenShare = async () => {
    try {
      const videoTrack = localStreamRef.current
        ?.getVideoTracks()
        .find((t) => t.readyState === 'live');
      if (!videoTrack) {
        setIsScreenSharing(false);
        return;
      }
      Object.values(peerConnectionsRef.current).forEach(peerConnection => {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      setIsScreenSharing(false);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const handleChatInputChange = (e) => {
    const v = e.target.value;
    setMessage(v);
    const rid = roomIdForTypingRef.current;
    if (!rid || !socket.connected) return;
    socket.emit('chatTyping', { roomId: rid, isTyping: true });
    scheduleTypingStop();
  };

  const sendWatchReaction = (emoji) => {
    if (!roomId || !WATCH_REACTIONS.includes(emoji)) return;
    socket.emit('watchReaction', { roomId, emoji });
  };

  // Chat function
  const sendMessage = () => {
    if (message.trim() && roomId) {
      try {
        if (typingStopTimerRef.current) {
          clearTimeout(typingStopTimerRef.current);
          typingStopTimerRef.current = null;
        }
        if (socket.connected) {
          socket.emit('chatTyping', { roomId, isTyping: false });
        }
        const messageToSend = message.trim();
        console.log('Sending message:', { roomId, message: messageToSend });
        socket.emit('chatMessage', {
          roomId,
          message: messageToSend,
        });
        setMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        setError('Failed to send message');
      }
    }
  };

  // Add these functions to your VideoChat component
  const leaveCall = () => {
    console.log('Leaving call...');
    try {
      wasJoinedRef.current = false;
      rejoinPayloadRef.current = null;
      setSyncedWatchVideoUrl(null);
      setSocketReconnecting(false);
      setTypingPeers({});
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      if (roomId && socket.connected) {
        socket.emit('chatTyping', { roomId, isTyping: false });
      }

      // Close and cleanup peer connections
      Object.entries(peerConnectionsRef.current).forEach(([userId, pc]) => {
        console.log(`Closing connection with ${userId}`);
        pc.close();
      });
      peerConnectionsRef.current = {};
      
      // Stop all local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped track: ${track.kind}`);
        });
      }
      localStreamRef.current = null;
      setLocalStream(null);
      setMediaMode('no-media');
      setMediaError('');
      setMediaWarning('');
      setMediaReleasedHiddenTab(false);

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      // Reset states
      setRemoteStreams([]);
      setIsCallStarted(false);
      setIsJoined(false);
      clearChat();
      
      // Notify server
      socket.emit('leaveRoom', { roomId });
      console.log('Left room:', roomId);
    } catch (error) {
      console.error('Error during call cleanup:', error);
      setError('Failed to properly clean up call');
    }
  };

  const endCall = () => {
    if (isHost) {
      socket.emit('endCall', { roomId });
      leaveCall();
      clearChat();
    }
  };

  // Add clearChat function
  const clearChat = () => {
    setChatMessages([]);
  };

  // Add connection state logging
  useEffect(() => {
    const logConnectionState = () => {
      Object.entries(peerConnectionsRef.current).forEach(([userId, pc]) => {
        console.log(`Connection state with ${userId}:`, {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState
        });
      });
    };

    const interval = setInterval(logConnectionState, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log('[media] page context', {
      href: window.location.href,
      isSecureContext: window.isSecureContext,
    });
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden || !localStreamRef.current) return;
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setIsVideoOff(false);
      setIsScreenSharing(false);
      setMediaMode('no-media');
      setMediaReleasedHiddenTab(true);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.replaceTrack(null).catch(() => {});
          }
        });
      });
      if (roomId) {
        socket.emit('videoStateChange', { roomId, isVideoOff: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [roomId]);

  // Bind local preview after mount / join: video element is absent on join screen until isJoined.
  useLayoutEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (!localStream) {
      el.srcObject = null;
      return;
    }
    const hasLiveVideo = localStream.getVideoTracks().some((t) => t.readyState === 'live');
    if (!hasLiveVideo) {
      el.srcObject = null;
      return;
    }
    el.srcObject = null;
    el.srcObject = localStream;
    console.log('[local video] stream.getTracks()', localStream.getTracks());
    console.log('Video tracks:', localStream.getVideoTracks());
    console.log('Audio tracks:', localStream.getAudioTracks());
    const p = el.play();
    if (p && typeof p.then === 'function') {
      p.catch((err) => {
        console.warn('[local video] play()', err?.name, err?.message);
      });
    }
  }, [localStream, isJoined, isVideoOff, focusTileId, maximizedTileId]);

  // Add this useEffect to monitor video element and stream
  useEffect(() => {
    if (localVideoRef.current) {
      console.log('Local video element:', {
        srcObject: localVideoRef.current.srcObject,
        readyState: localVideoRef.current.readyState,
        videoWidth: localVideoRef.current.videoWidth,
        videoHeight: localVideoRef.current.videoHeight,
        paused: localVideoRef.current.paused
      });
    }
    
    if (localStreamRef.current) {
      console.log('Local stream:', {
        active: localStreamRef.current.active,
        tracks: localStreamRef.current.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted
        }))
      });
    }
  }, [localVideoRef.current?.srcObject]);

  // Add this useEffect to monitor video track status
  useEffect(() => {
    const checkVideoTrack = () => {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          console.log('Video track status:', {
            enabled: videoTrack.enabled,
            muted: videoTrack.muted,
            readyState: videoTrack.readyState,
            constraints: videoTrack.getConstraints(),
            settings: videoTrack.getSettings()
          });
        } else {
          console.error('No video track found');
        }
      }
    };

    checkVideoTrack();
    const interval = setInterval(checkVideoTrack, 2000);
    return () => clearInterval(interval);
  }, []);

  // Add a retry button to the error container
  const ErrorContainer = ({ error, onRetry, onDismiss }) => (
    <div className="error-container">
      <h2>Error</h2>
      <p>{error}</p>
      <div className="error-buttons">
        <button onClick={onRetry}>Try Again</button>
        <button onClick={onDismiss}>Continue Without Camera</button>
      </div>
    </div>
  );

  // Add this function to detect active speaker
  const handleSpeakingStateChange = useCallback((userId, speaking) => {
    if (speaking) {
      setActiveSpeaker(userId);
      // Reset active speaker after 2 seconds of silence
      setTimeout(() => {
        setActiveSpeaker(prev => prev === userId ? null : prev);
      }, 2000);
    }
  }, []);

  // Optional local speaking indicator — only when the stream includes an audio track
  useEffect(() => {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('No audio track available, skipping audio processing');
      return;
    }

    const audioContext = new AudioContext();
    let audioSource;
    try {
      audioSource = audioContext.createMediaStreamSource(localStream);
    } catch (e) {
      console.warn('Could not create MediaStreamSource:', e?.name, e?.message);
      audioContext.close();
      return;
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.minDecibels = -70;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.4;

    audioSource.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speakingTimeout;
    let rafId;

    const checkAudioLevel = () => {
      if (audioContext.state === 'closed') return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      if (average > 20) {
        handleSpeakingStateChange(socket.id, true);
      }

      rafId = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      clearTimeout(speakingTimeout);
      audioContext.close();
    };
  }, [localStream, handleSpeakingStateChange]);

  // Update ParticipantList rendering with null checks
  const renderParticipantList = () => {
    if (!Array.isArray(participants)) return null;

    const remote = participants.filter((p) => p && p.id);
    const listWithSelf =
      profile && socket?.id
        ? [
            {
              id: socket.id,
              username: profile.displayName,
              displayName: profile.displayName,
              photoURL: profile.photoURL || '',
              isHost,
              firebaseUid: profile.uid,
            },
            ...remote.filter((p) => p.id !== socket.id),
          ]
        : remote;

    return (
      <ParticipantList
        participants={listWithSelf}
        activeParticipant={activeSpeaker}
        localUser={socket?.id ? { id: socket.id, firebaseUid: profile?.uid, isHost } : null}
        showParticipants={showParticipants}
      />
    );
  };

  // Add socket connection status check
  useEffect(() => {
    const checkSocketConnection = () => {
      if (!socket || !socket.connected) {
        console.error('Socket disconnected');
        setError('Connection lost. Please refresh the page.');
        setConnectionStatus('disconnected');
      }
    };

    const interval = setInterval(checkSocketConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Add cleanup for streams when component unmounts
  useEffect(() => {
    if (!localStream) {
      console.log('Local stream status: no active local stream');
      return;
    }

    console.log('Local stream status: active', {
      streamId: localStream.id,
      tracks: localStream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
      }))
    });
  }, [localStream]);

  // Add cleanup for streams when component unmounts
  useEffect(() => {
    return () => {
      // Stop all tracks in local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Stop all remote streams
      remoteStreams.forEach(streamInfo => {
        if (streamInfo.stream) {
          streamInfo.stream.getTracks().forEach(track => track.stop());
        }
      });
    };
  }, []);

  // Add a useEffect to handle automatic video playing
  useEffect(() => {
    const handleUserInteraction = () => {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        if (video.paused) {
          video.play().catch(err => {
            console.warn('Play after user interaction failed:', err);
          });
        }
      });
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Update cleanup function
  const cleanupPeerConnection = (userId) => {
    console.log('Cleaning up peer connection for:', userId);
    
    const peerConnection = peerConnectionsRef.current[userId];
    if (peerConnection) {
      // Close the connection
      peerConnection.close();
      delete peerConnectionsRef.current[userId];
      delete pendingIceCandidatesRef.current[userId];

      // Remove from remote streams
      setRemoteStreams(prev => prev.filter(s => s.userId !== userId));
      
      // Reset video state
      setRemoteVideoStates(prev => {
        const newStates = { ...prev };
        delete newStates[userId];
        return newStates;
      });
    }
  };

  const renderEnableCameraButton = () => {
    if (localStream) return null;
    if (!isSecureContextForMedia()) {
      return (
        <div className="media-insecure-notice" role="note">
          Camera and microphone require a secure page. Use <strong>https</strong> or{' '}
          <strong>http://localhost</strong> / <strong>127.0.0.1</strong>.
        </div>
      );
    }
    return (
      <button
        type="button"
        className="enable-camera-btn"
        onClick={() => handleEnableCameraClick()}
        disabled={mediaMode === 'initializing'}
      >
        {mediaMode === 'initializing' ? 'Requesting…' : 'Enable Camera'}
      </button>
    );
  };

  const renderMediaErrorBanner = () => {
    if (!mediaError) return null;
    return (
      <div className="error-banner" role="alert">
        <p className="error-banner-text">{mediaError}</p>
        <div className="error-banner-actions">
          <button
            type="button"
            className="error-banner-retry"
            onClick={() => handleEnableCameraClick()}
            disabled={mediaMode === 'initializing' || !isSecureContextForMedia()}
          >
            Retry Camera
          </button>
        </div>
      </div>
    );
  };

  const renderMediaModeBadge = () => (
    <div
      className="media-mode-badge"
      data-mode={mediaMode}
      role="status"
      aria-live="polite"
      aria-label={`Media mode: ${MEDIA_MODE_LABELS[mediaMode]}`}
    >
      <span className="media-mode-dot" aria-hidden />
      <span className="media-mode-text">{MEDIA_MODE_LABELS[mediaMode]}</span>
    </div>
  );

  const typingIndicatorText = useMemo(() => {
    const names = Object.values(typingPeers);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }, [typingPeers]);

  // Render functions
  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full">
      <ErrorContainer 
        error={error}
        onRetry={async () => {
          setError(null);
          setVideoError(false);
          setMediaWarning('Continuing without camera');
          setMediaError('');
        }}
        onDismiss={() => {
          setError(null);
          setVideoError(true);
          setMediaWarning('Continuing without camera');
          setMediaError('');
        }}
      />
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-auto video-chat-root video-chat-root--join">
        {renderMediaErrorBanner()}
        {mediaWarning ? <div className="status-error">{mediaWarning}</div> : null}
        <div className="media-mode-row media-mode-row--join">{renderMediaModeBadge()}</div>
        <div className="enable-camera-row enable-camera-row--join">{renderEnableCameraButton()}</div>
        <RoomJoin onJoinRoom={joinRoom} onCreateRoom={createRoom} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden video-chat-root">
      <ReactionFloatLayer trigger={reactionTrigger} />
      <ConnectionStatus
        status={connectionStatus}
        roomId={roomId}
        isHost={isHost}
        reconnecting={socketReconnecting}
      />
      <div className="reaction-quick-bar" role="toolbar" aria-label="Send reaction">
        {WATCH_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="reaction-quick-bar__btn"
            onClick={() => sendWatchReaction(emoji)}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 w-full overflow-x-hidden overflow-y-auto video-chat-body">
      <Room
        roomId={roomId}
        isHost={isHost}
        syncedWatchVideoUrl={syncedWatchVideoUrl}
        mediaWarning={mediaWarning}
        videoCall={
          <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-1 md:px-2">
            <div className="media-mode-row media-mode-row--room shrink-0">
              {renderMediaModeBadge()}
            </div>
            {renderMediaErrorBanner()}
            {mediaReleasedHiddenTab ? (
              <div className="status-error tab-media-notice shrink-0" role="status">
                Camera and microphone were released because this tab was in the background. Another tab may be using
                the camera. Use <strong>Enable Camera</strong> to start again.
              </div>
            ) : null}
            <div className="video-wrapper video-wrapper--call min-h-0 min-w-0 flex-1">
              <VideoCallStage
                participants={participants}
                remoteStreams={remoteStreams}
                remoteVideoStates={remoteVideoStates}
                localStream={localStream}
                localVideoRef={localVideoRef}
                isVideoOff={isVideoOff}
                videoError={videoError}
                isScreenSharing={isScreenSharing}
                focusTileId={focusTileId}
                manualPinTileId={manualPinTileId}
                onPinTile={handlePinTile}
                maximizedTileId={maximizedTileId}
                onMaximizeTile={handleMaximizeTile}
                onMinimizeTile={handleMinimizeTile}
                renderEnableCameraButton={renderEnableCameraButton}
                onLocalVideoError={() => setVideoError(true)}
              />
              <div className="controls shrink-0">
                <button type="button" onClick={toggleAudio}>
                  {isAudioMuted ? (
                    <span className="material-symbols-outlined">mic_off</span>
                  ) : (
                    <span className="material-symbols-outlined">mic</span>
                  )}
                </button>
                <button type="button" onClick={toggleVideo}>
                  {isVideoOff ? (
                    <span className="material-symbols-outlined">videocam_off</span>
                  ) : (
                    <span className="material-symbols-outlined">videocam</span>
                  )}
                </button>
                <button type="button" onClick={toggleScreenShare}>
                  {isScreenSharing ? (
                    <span className="material-symbols-outlined">stop_screen_share</span>
                  ) : (
                    <span className="material-symbols-outlined">screen_share</span>
                  )}
                </button>
                <div className="control-separator" />
                {isHost ? (
                  <button type="button" onClick={endCall} className="end-call">
                    <span className="material-symbols-outlined">call_end</span>
                  </button>
                ) : (
                  <button type="button" onClick={leaveCall} className="leave-call">
                    <span className="material-symbols-outlined">logout</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowParticipants(!showParticipants)}
                  className="participant-toggle"
                >
                  <span className="material-symbols-outlined">
                    {showParticipants ? 'person_off' : 'people'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        }
        chat={
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="message-wrapper min-h-0 min-w-0 flex-1">
              <div className="message-box" ref={messageBoxRef}>
                {chatMessages.map((msg) => {
                  const isSelf =
                    (profile?.uid && msg.firebaseUid && msg.firebaseUid === profile.uid) ||
                    (!msg.firebaseUid && msg.userId === socket.id);
                  const label = isSelf ? 'You' : msg.displayName || msg.username || 'Guest';
                  const key = msg.id || `${msg.timestamp}-${msg.userId}`;
                  return (
                    <div key={key} className={`message ${isSelf ? 'self' : 'other'}`}>
                      <div className="message__row">
                        {msg.photoURL ? (
                          <img
                            src={msg.photoURL}
                            alt=""
                            className="message__avatar"
                            width={28}
                            height={28}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="message__avatar message__avatar--placeholder" aria-hidden />
                        )}
                        <div className="message__body">
                          <span className="username">
                            {label}
                            {msg.isHost ? ' (Host)' : ''}
                          </span>
                          <p className="message__text">{msg.text}</p>
                          <span className="timestamp">{formatChatTimestamp(msg.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {typingIndicatorText ? (
                <div className="chat-typing-indicator" role="status" aria-live="polite">
                  {typingIndicatorText}
                </div>
              ) : null}
              <div className="message-input">
                <input
                  type="text"
                  value={message}
                  onChange={handleChatInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                />
                <button type="button" onClick={sendMessage}>
                  Send
                </button>
              </div>
            </div>
          </div>
        }
        participants={
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-900/25">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 py-2">
              {showParticipants ? (
                renderParticipantList()
              ) : (
                <p className="m-0 px-2 text-xs leading-relaxed text-zinc-500">
                  List hidden. Use the people button in the call bar to show it.
                </p>
              )}
            </div>
          </div>
        }
      />
      </div>
    </div>
  );
};

export default VideoChat;
