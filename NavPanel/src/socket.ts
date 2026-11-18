import { io, type Socket } from 'socket.io-client';
import { getBackendUrl } from './config/backendUrl';
import type { ChatMessage, RoomUser } from './types/models';
import type {
  ChatTypingPayload,
  MetricsPingPayload,
  MetricsPongPayload,
  RoomJoinedPayload,
  VideoStateChangedPayload,
  VideoSyncPayload,
} from './types/socket';

const backendUrl = getBackendUrl();
const isDev = import.meta.env.DEV;
const devLog = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};
const devError = (...args: unknown[]) => {
  if (isDev) console.error(...args);
};
const canConnect = Boolean(backendUrl);
devLog('[socket] Backend URL:', backendUrl || '(empty — set VITE_BACKEND_URL in production)');

export interface ServerToClientEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  'metrics:pong': (payload: MetricsPongPayload) => void;
  roomCreated: (payload: { roomId: string; user?: RoomUser }) => void;
  roomJoined: (payload: RoomJoinedPayload) => void;
  offer: (payload: { from: string; offer: RTCSessionDescriptionInit; user?: RoomUser; roomId?: string }) => void;
  answer: (payload: { from: string; answer: RTCSessionDescriptionInit; user?: RoomUser; roomId?: string }) => void;
  candidate: (payload: { from: string; candidate: RTCIceCandidateInit; roomId?: string }) => void;
  chatMessage: (messageData: ChatMessage) => void;
  peerTyping: (payload: ChatTypingPayload) => void;
  watchReaction: (payload: { emoji: string; userId?: string; username?: string; photoURL?: string }) => void;
  hostChanged: (payload: { hostFirebaseUid: string; hostDisplayName?: string }) => void;
  userLeft: (user: { id: string; username?: string; isHost?: boolean }) => void;
  userJoined: (payload: { user: RoomUser }) => void;
  callEnded: () => void;
  error: (payload: { message?: string } | string) => void;
  errorMessage: (payload: { message?: string } | string) => void;
  userSpeaking: (payload: { userId: string; speaking: boolean }) => void;
  videoStateChanged: (payload: VideoStateChangedPayload) => void;
  videoPlay: (payload: VideoSyncPayload) => void;
  videoPause: (payload: VideoSyncPayload) => void;
  videoSeek: (payload: VideoSyncPayload) => void;
  videoHostSync: (payload: VideoSyncPayload) => void;
  watchVideoUrl: (payload: { videoUrl?: string | null; descriptor?: import('./types/models').SharedVideoDescriptor | null }) => void;
  videoChange: (payload: { videoUrl?: string | null; descriptor?: import('./types/models').SharedVideoDescriptor | null }) => void;
  authenticated: (payload: { uid: string }) => void;
}

export interface ClientToServerEvents {
  'metrics:ping': (payload: MetricsPingPayload) => void;
  authenticate: (payload: { idToken: string }) => void;
  createRoom: (payload: { idToken: string }) => void;
  joinRoom: (payload: { roomId: string; idToken: string }) => void;
  offer: (payload: { to: string; offer: RTCSessionDescriptionInit; roomId: string }) => void;
  answer: (payload: { to: string; answer: RTCSessionDescriptionInit; roomId: string }) => void;
  candidate: (payload: { to: string; candidate: RTCIceCandidateInit; roomId: string }) => void;
  videoPlay: (payload: { roomId: string; currentTime: number; isPlaying?: boolean; hostSentAt?: number }) => void;
  videoPause: (payload: { roomId: string; currentTime: number; isPlaying?: boolean; hostSentAt?: number }) => void;
  videoSeek: (payload: { roomId: string; currentTime: number; isPlaying?: boolean; hostSentAt?: number }) => void;
  videoHostSync: (payload: { roomId: string; currentTime: number; isPlaying?: boolean; hostSentAt?: number }) => void;
  watchVideoUrl: (payload: { roomId: string; videoUrl?: string | null; idToken: string; descriptor?: import('./types/models').SharedVideoDescriptor | null }) => void;
  videoChange: (payload: { roomId: string; videoUrl?: string | null; idToken: string; descriptor?: import('./types/models').SharedVideoDescriptor | null }) => void;
  chatTyping: (payload: { roomId: string; isTyping: boolean }) => void;
  watchReaction: (payload: { roomId: string; emoji: string }) => void;
  chatMessage: (payload: { roomId: string; message: string }) => void;
  videoStateChange: (payload: { roomId: string; isVideoOff: boolean }) => void;
  leaveRoom: (payload: { roomId: string | null }) => void;
  endCall: (payload: { roomId: string | null; idToken: string }) => void;
  speaking: (payload: { roomId: string; speaking: boolean }) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Dummy origin only when URL missing so the client does not connect until configured. */
const socket: AppSocket = io(backendUrl || 'http://127.0.0.1:1', {
  autoConnect: canConnect,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  timeout: 20000,
});

socket.on('connect_error', (err) => {
  devError('[socket] Connection error:', err?.message || err);
});

export default socket;
