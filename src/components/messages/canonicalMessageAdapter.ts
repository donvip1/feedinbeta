import {
  CanonicalMessage,
  CanonicalMedia,
  parseCanonicalMessage,
} from '@/contracts/messaging';

export interface ChatMessageProjection {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  file_size?: number | null;
  reply_to_id?: string | null;
  reply_to_message?: {
    content: string;
    sender: { display_name: string };
    media_url?: string | null;
    media_type?: string | null;
  } | null;
  reply_metadata?: {
    type?: string;
    story_id?: string;
    story_media_url?: string;
    story_media_type?: string;
  } | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
  reactions?: Array<{
    emoji: string;
    user_id: string;
    user: { display_name: string; avatar_url?: string | null };
  }>;
  read_receipts?: Array<{ user_id: string; read_at: string }>;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  is_pinned?: boolean;
  edited_at?: string | null;
  forwarded_from?: {
    original_sender_id: string;
    original_sender_name: string;
    original_timestamp: string;
    source_type: 'dm' | 'group';
    source_id: string;
  } | null;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export interface CanonicalMessageProfile {
  display_name: string | null;
  avatar_url: string | null;
}

function mediaDescriptor(payload: Record<string, unknown>): CanonicalMedia | null {
  const media = payload.media;
  if (!media || typeof media !== 'object') return null;
  const candidate = media as Record<string, unknown>;
  if (typeof candidate.bucket !== 'string' || typeof candidate.path !== 'string') {
    return null;
  }
  return candidate as CanonicalMedia;
}

function canonicalMediaUrl(media: CanonicalMedia | null, resolveMediaUrl?: (media: CanonicalMedia) => string) {
  return media && resolveMediaUrl ? resolveMediaUrl(media) : null;
}

export function canonicalMessageToChatMessage(
  value: unknown,
  profile: CanonicalMessageProfile,
  resolveMediaUrl?: (media: CanonicalMedia) => string,
): ChatMessageProjection {
  const message: CanonicalMessage = parseCanonicalMessage(value);
  const payload = message.payload as Record<string, unknown>;
  const media = mediaDescriptor(payload);
  const mediaUrl = canonicalMediaUrl(media, resolveMediaUrl);
  const contentType = message.content_type;
  const content =
    contentType === 'text' || contentType === 'system'
      ? String(payload.text ?? '')
      : contentType === 'gift'
        ? `Sent ${String(payload.name ?? 'a gift')}`
        : contentType === 'call'
          ? `${String(payload.call_kind ?? 'audio')} call`
          : String(payload.caption ?? (contentType === 'voice' ? 'Voice message' : ''));
  const metadata = message.metadata;
  const forwarded = metadata.forwarded;

  return {
    id: message.id,
    content,
    sender_id: message.sender_id,
    created_at: message.created_at,
    media_url: mediaUrl,
    media_type:
      media?.mime_type ??
      (contentType === 'voice' ? 'audio/*' : contentType === 'sticker' ? 'sticker' : null),
    file_size: media?.size_bytes ?? null,
    reply_to_id: message.reply_to_id,
    reply_to_message: null,
    profiles: profile,
    reactions: [],
    read_receipts: [],
    status: message.status,
    is_pinned: metadata.pin.is_pinned,
    edited_at: metadata.edited_at,
    forwarded_from:
      forwarded.original_message_id && forwarded.original_sender_id && forwarded.original_created_at
        ? {
            original_sender_id: forwarded.original_sender_id,
            original_sender_name: forwarded.original_sender_name ?? 'Unknown',
            original_timestamp: forwarded.original_created_at,
            source_type: 'dm',
            source_id: message.conversation_id,
          }
        : null,
  };
}

export function canonicalMessagePayload(
  input: {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    replyToId?: string | null;
    createdAt?: string;
  },
) {
  return {
    id: input.id,
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    content_type: 'text',
    payload: { text: input.text },
    reply_to_id: input.replyToId ?? null,
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}
