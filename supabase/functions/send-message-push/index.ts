// send-message-push — server-owned FCM sender for new chat messages.
//
// Invoked by the sender's client right after the message row is inserted. Sends
// a DATA-ONLY push to every other conversation participant's native devices so
// the Flutter app posts a rich, grouped message notification with an inline
// reply action — even when the app is backgrounded or killed.
//
// Request:  { "message_id": "<uuid>" }
// Data sent (matches the Dart contract in push_notification_service.dart):
//   { type: "message", conversation_id, sender_name, body, message_id }
//
// Auth: verify_jwt = true. The sender's JWT is verified and must match the
// message's sender_id — a user can only notify for their own messages.

import { corsHeaders, loadServiceAccount, pushToUsers, serviceClient } from '../_shared/fcm.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// A short, notification-safe preview for the message. Text is truncated;
// attachments become a typed placeholder (mirrors WhatsApp-style previews).
function previewFor(content: string | null, messageType: string): string {
  const type = (messageType || 'text').toLowerCase();
  if (type !== 'text') {
    switch (type) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'voice':
      case 'audio':
        return '🎤 Voice message';
      case 'music':
        return '🎵 Audio';
      case 'file':
      case 'document':
        return '📎 Attachment';
      default:
        return '📎 Attachment';
    }
  }
  const text = (content ?? '').trim();
  if (!text) return 'New message';
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) return json({ error: 'FCM not configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) return json({ error: 'Missing required field: message_id' }, 400);

    const supabase = serviceClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Invalid token' }, 401);

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, message_type, deleted_at')
      .eq('id', message_id)
      .maybeSingle();
    if (msgError) return json({ error: 'Database error' }, 500);
    if (!message) return json({ error: 'Message not found' }, 404);

    // Only the sender may notify, and never for a deleted message.
    if (message.sender_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (message.deleted_at) return json({ skipped: 'deleted', sent: 0 }, 200);

    // Everyone in the conversation except the sender.
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', message.conversation_id)
      .neq('user_id', message.sender_id);
    if (partError) return json({ error: 'Database error' }, 500);

    const recipientIds = (participants ?? [])
      .map((p) => p.user_id as string)
      .filter(Boolean);
    if (recipientIds.length === 0) return json({ success: true, sent: 0 }, 200);

    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', message.sender_id)
      .maybeSingle();

    const data: Record<string, string> = {
      type: 'message',
      conversation_id: String(message.conversation_id),
      sender_name: (sender?.display_name as string | null) ?? 'feedIn',
      body: previewFor(message.content as string | null, message.message_type as string),
      message_id: String(message.id),
    };

    const results = await pushToUsers(supabase, serviceAccount, recipientIds, data);
    const sent = results.filter((r) => r.success).length;
    return json({ success: sent > 0, sent, failed: results.length - sent });
  } catch (error) {
    console.error('[send-message-push] Error:', error);
    return json({ error: String(error) }, 500);
  }
});
