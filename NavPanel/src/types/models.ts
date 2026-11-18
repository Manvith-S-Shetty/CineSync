export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
}

export interface RoomUser {
  id: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  firebaseUid?: string;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  firebaseUid?: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  text: string;
  timestamp: string;
  isHost?: boolean;
}

export interface RemoteStreamInfo {
  stream: MediaStream;
  userId: string;
  id: string;
}

export type SharedVideoSource = 'local' | 'remote';

export interface SharedVideoDescriptor {
  source: SharedVideoSource;
  sessionId: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  fingerprint?: string | null;
  url?: string | null;
}

import type { ChangeEvent } from 'react';

export interface VideoPlayerHandle {
  loadLocalFile: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  loadUrl: (raw: string) => { ok: boolean; error?: string } | undefined;
  resetToSample: () => void;
}

export interface ReactionPayload {
  emoji: string;
  userId?: string;
  username?: string;
  photoURL?: string;
  _t?: number;
}

export type ConnectionStatusValue = 'connected' | 'connecting' | 'disconnected';
