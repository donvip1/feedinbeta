// Unified Room Types for Live Streaming
export type RoomType = 'video_broadcast' | 'audio_space' | 'pk_battle';
export type LayoutMode = 'single' | 'grid' | 'split_screen' | 'cinema';
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'ended';

export interface UnifiedUser {
  id: string;
  name: string;
  handle?: string;
  avatar?: string;
  level?: number;
}

export interface PKBattleData {
  id: string;
  challenger: UnifiedUser;
  challengerScore: number;
  hostScore: number;
  timeLeft: number;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  durationSeconds: number;
}

export interface UnifiedRoomData {
  id: string;
  host: UnifiedUser;
  type: RoomType;
  title: string;
  description?: string;
  category?: string;
  viewers: number;
  isPremium?: boolean;
  thumbnailUrl?: string;
  pkData?: PKBattleData;
  status: 'scheduled' | 'live' | 'ended';
  streamKey?: string;
  scheduledStart?: string;
  startedAt?: string;
}

export interface UnifiedRoomProps {
  room: UnifiedRoomData;
  isHost: boolean;
  isMinimized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

// Chat message type
export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
  isGift?: boolean;
  giftType?: string;
  giftValue?: number;
}

// Reaction type
export interface Reaction {
  id: string | number;
  type: string;
  emoji: string;
  x: number;
  y: number;
  senderName?: string;
}

// Gift type
export interface GiftAnimation {
  id: string;
  giftType: string;
  senderName: string;
  creditValue: number;
}
