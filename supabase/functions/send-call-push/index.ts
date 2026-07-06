// send-call-push — server-owned FCM sender for incoming 1:1 calls.
//
// Invoked by the caller's client right after it inserts the pending `call_logs`
// row. Sends a DATA-ONLY, high-priority push to the receiver's native devices so
// the Flutter app rings a full-screen CallKit incoming-call screen even when the
// app is backgrounded or killed.
//
// Request:  { "call_id": "<uuid>" }
// Data sent (matches the Dart contract in push_notification_service.dart):
//   { type: "call", call_id, caller_name, caller_avatar?, call_type: voice|video }
//
// Auth: verify_jwt = true. The caller's JWT is verified and must match the
// call's caller_id — a user can only ring on behalf of their own call.

import { corsHeaders, loadServiceAccount, pushToUsers, serviceClient } from '../_shared/fcm.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    const { call_id } = await req.json().catch(() => ({}));
    if (!call_id) return json({ error: 'Missing required field: call_id' }, 400);

    const supabase = serviceClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (userError || !user) return json({ error: 'Invalid token' }, 401);

    // Resolve the call server-side (trust the DB, not the client payload).
    const { data: call, error: callError } = await supabase
      .from('call_logs')
      .select('id, caller_id, receiver_id, call_type, status')
      .eq('id', call_id)
      .maybeSingle();
    if (callError) return json({ error: 'Database error' }, 500);
    if (!call) return json({ error: 'Call not found' }, 404);

    // Only the caller may trigger the ring, and only while it's still pending.
    if (call.caller_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (!call.receiver_id) return json({ error: 'No receiver', sent: 0 }, 200);
    if (call.status !== 'pending') return json({ skipped: 'not pending', sent: 0 }, 200);

    const { data: caller } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', call.caller_id)
      .maybeSingle();

    const data: Record<string, string> = {
      type: 'call',
      call_id: String(call.id),
      caller_name: (caller?.display_name as string | null) ?? 'feedIn user',
      call_type: call.call_type === 'video' ? 'video' : 'voice',
    };
    const avatar = caller?.avatar_url as string | null;
    if (avatar) data.caller_avatar = avatar;

    const results = await pushToUsers(supabase, serviceAccount, [call.receiver_id], data);
    const sent = results.filter((r) => r.success).length;
    return json({ success: sent > 0, sent, failed: results.length - sent });
  } catch (error) {
    console.error('[send-call-push] Error:', error);
    return json({ error: String(error) }, 500);
  }
});
