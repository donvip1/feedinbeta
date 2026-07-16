import { z } from "zod";

export const messageContentTypes = [
  "text",
  "image",
  "video",
  "voice",
  "file",
  "sticker",
  "gift",
  "call",
  "system",
] as const;

export const messageStatuses = [
  "sending",
  "sent",
  "delivered",
  "read",
] as const;

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });

export const canonicalMediaSchema = z
  .object({
    bucket: z.string().min(1),
    path: z.string().min(1),
    mime_type: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    duration_ms: z.number().int().nonnegative().nullable().optional(),
    thumbnail_path: z.string().nullable().optional(),
    blur_hash: z.string().nullable().optional(),
    file_name: z.string().nullable().optional(),
  })
  .strict();

const textPayloadSchema = z.object({ text: z.string().min(1).max(10_000) }).passthrough();
const visualPayloadSchema = z
  .object({ caption: z.string().max(2_000).nullable().optional(), media: canonicalMediaSchema })
  .passthrough();
const voicePayloadSchema = z
  .object({
    media: canonicalMediaSchema,
    waveform: z.array(z.number().min(0).max(1)).max(256),
  })
  .passthrough();
const stickerPayloadSchema = z
  .object({ asset_key: z.string().min(1), media: canonicalMediaSchema.nullable().optional() })
  .passthrough();
const giftPayloadSchema = z
  .object({
    gift_id: uuidSchema,
    catalog_item_id: uuidSchema,
    name: z.string().min(1),
    asset_key: z.string().min(1),
    credit_cost: z.number().int().positive(),
    recipient_credit_value: z.number().int().nonnegative(),
    platform_fee_credits: z.number().int().nonnegative(),
    recipient_id: uuidSchema,
    state: z.enum(["sent", "converted", "refunded"]),
  })
  .strict();
const callPayloadSchema = z
  .object({
    call_id: uuidSchema,
    call_kind: z.enum(["audio", "video"]),
    room_name: z.string().min(1),
    state: z.enum(["scheduled", "ringing", "active", "ended", "cancelled"]),
    host_id: uuidSchema,
    started_at: timestampSchema.nullable(),
    ended_at: timestampSchema.nullable(),
    participant_count: z.number().int().nonnegative(),
    joinable: z.boolean(),
  })
  .strict();
const systemPayloadSchema = z
  .object({ event: z.string().min(1), text: z.string().min(1) })
  .passthrough();

export const canonicalMessageMetadataSchema = z
  .object({
    schema_version: z.literal(1),
    revision: z.number().int().positive(),
    reactions: z.array(
      z
        .object({
          emoji: z.string().min(1).max(64),
          count: z.number().int().positive(),
          reacted_by_me: z.boolean(),
        })
        .strict(),
    ),
    pin: z
      .object({
        is_pinned: z.boolean(),
        pinned_by: uuidSchema.nullable(),
        pinned_at: timestampSchema.nullable(),
      })
      .strict(),
    is_starred_by_me: z.boolean(),
    forwarded: z
      .object({
        original_message_id: uuidSchema.nullable(),
        original_sender_id: uuidSchema.nullable(),
        original_sender_name: z.string().nullable(),
        original_created_at: timestampSchema.nullable(),
      })
      .strict(),
    receipts: z
      .object({
        delivered_count: z.number().int().nonnegative(),
        read_count: z.number().int().nonnegative(),
        read_by_me_at: timestampSchema.nullable(),
      })
      .strict(),
    ephemeral: z
      .object({
        view_once: z.boolean(),
        viewed_at: timestampSchema.nullable(),
        expires_at: timestampSchema.nullable(),
      })
      .strict(),
    edited_at: timestampSchema.nullable(),
    deleted_at: timestampSchema.nullable(),
  })
  .passthrough();

export const canonicalMessageSchema = z
  .object({
    id: uuidSchema,
    conversation_id: uuidSchema,
    sender_id: uuidSchema,
    content_type: z.enum(messageContentTypes),
    payload: z.record(z.string(), z.unknown()),
    reply_to_id: uuidSchema.nullable(),
    status: z.enum(messageStatuses),
    metadata: canonicalMessageMetadataSchema,
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict()
  .superRefine((message, context) => {
    const schemas: Record<(typeof messageContentTypes)[number], z.ZodTypeAny> = {
      text: textPayloadSchema,
      image: visualPayloadSchema,
      video: visualPayloadSchema,
      voice: voicePayloadSchema,
      file: visualPayloadSchema,
      sticker: stickerPayloadSchema,
      gift: giftPayloadSchema,
      call: callPayloadSchema,
      system: systemPayloadSchema,
    };
    const result = schemas[message.content_type].safeParse(message.payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          path: ["payload", ...issue.path],
          message: issue.message,
        });
      }
    }
  });

export type MessageContentType = (typeof messageContentTypes)[number];
export type MessageStatus = (typeof messageStatuses)[number];
export type CanonicalMedia = z.infer<typeof canonicalMediaSchema>;
export type CanonicalMessageMetadata = z.infer<typeof canonicalMessageMetadataSchema>;
export type CanonicalMessage = z.infer<typeof canonicalMessageSchema>;

export function isMine(message: Pick<CanonicalMessage, "sender_id">, currentUserId: string): boolean {
  return message.sender_id === currentUserId;
}

export function parseCanonicalMessage(value: unknown): CanonicalMessage {
  return canonicalMessageSchema.parse(value);
}
