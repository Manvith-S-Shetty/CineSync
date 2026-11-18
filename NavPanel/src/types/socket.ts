export interface MetricsPingPayload {
  clientTimestamp: number;
}

export interface MetricsPongPayload {
  clientTimestamp?: number;
  serverTimestamp?: number;
}

export interface RoomJoinedPayload {
  roomId: string;
  users: import('./models').RoomUser[];
  isHost: boolean;
  user?: import('./models').RoomUser;
  chatHistory?: import('./models').ChatMessage[];
  watchVideoUrl?: string | null;
  videoUrl?: string | null;
  sharedVideo?: import('./models').SharedVideoDescriptor | null;
}

export interface VideoSyncPayload {
  roomId?: string;
  currentTime: number;
  userId?: string;
  fromHost?: boolean;
  isPlaying?: boolean;
  serverTimestamp?: number;
  hostSentAt?: number;
}

export interface ChatTypingPayload {
  roomId?: string;
  userId?: string;
  username?: string;
  isTyping?: boolean;
}

export interface VideoStateChangedPayload {
  userId: string;
  isVideoOff: boolean;
}
