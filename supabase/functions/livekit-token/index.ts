import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Generate a unique JWT ID
function generateJti(): string {
  return crypto.randomUUID();
}

// Generate LiveKit compatible JWT token matching the official SDK format
async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  participantName: string,
  isHost: boolean,
  canPublish: boolean,
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(apiSecret);
  
  const now = Math.floor(Date.now() / 1000);
  
  const claims = {
    jti: generateJti(),
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: canPublish,
      roomAdmin: isHost,
      roomRecord: isHost,
    },
    metadata: JSON.stringify({ userId: participantIdentity }),
    sha256: "",
  };
  
  console.log(`[LiveKit] Building JWT with claims:`, {
    jti: claims.jti.slice(0, 8) + '...',
    name: claims.name,
    room: claims.video.room,
    canPublish,
    canSubscribe: claims.video.canSubscribe,
    isHost,
  });
  
  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(apiKey)
    .setSubject(participantIdentity)
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 21600) // 6 hours
    .sign(secretKey);

  return jwt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[LiveKit][${requestId}] ========================================`);
  console.log(`[LiveKit][${requestId}] Incoming token request`);

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (
      !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL ||
      !SUPABASE_URL || !SUPABASE_ANON_KEY
    ) {
      console.error(`[LiveKit][${requestId}] Missing LiveKit credentials!`);
      return new Response(
        JSON.stringify({ error: "LiveKit not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Authenticate the user via JWT ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    // --- Parse request body ---
    const body = await req.json();
    const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: "Missing required field: roomName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Force identity to authenticated user's ID — never trust client input
    const participantIdentity = userId;
    const requestedName = typeof body.participantName === "string"
      ? body.participantName.trim().slice(0, 80)
      : "";
    const participantName = profile?.display_name || requestedName || "User";

    // Determine host status server-side by checking DB ownership
    let isHost = false;
    let canPublish = false;
    let authorized = false;
    const uuid = "([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})";
    
    // Check if this is a space (space-{id}) or stream (stream-{id})
    const spaceMatch = roomName.match(new RegExp(`^space-${uuid}$`, "i"));
    const streamMatch = roomName.match(new RegExp(`^stream-${uuid}$`, "i"));
    
    if (spaceMatch) {
      const spaceId = spaceMatch[1];
      const { data: space } = await supabase
        .from('live_spaces')
        .select('user_id, status')
        .eq('id', spaceId)
        .maybeSingle();
      authorized = Boolean(space && ['live', 'active'].includes(space.status));
      isHost = space?.user_id === userId;
      if (isHost) {
        canPublish = true;
      } else if (authorized) {
        const { data: speaker } = await supabase
          .from('live_space_speakers')
          .select('role, left_at')
          .eq('space_id', spaceId)
          .eq('user_id', userId)
          .maybeSingle();
        canPublish = speaker?.left_at == null &&
          ['host', 'co_host', 'speaker'].includes(speaker?.role ?? '');
      }
    } else if (streamMatch) {
      const streamId = streamMatch[1];
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id, status')
        .eq('id', streamId)
        .maybeSingle();
      authorized = Boolean(stream && ['live', 'active'].includes(stream.status));
      isHost = stream?.user_id === userId;
      canPublish = isHost;
    } else {
      const callMatch = roomName.match(new RegExp(`^call-${uuid}$`, "i"));
      if (callMatch) {
        const callId = callMatch[1];
        const { data: callLog } = await supabase
          .from('call_logs')
          .select('caller_id, receiver_id, status')
          .eq('id', callId)
          .maybeSingle();
        isHost = callLog?.caller_id === userId;
        authorized = Boolean(
          callLog && ['initiated', 'ringing', 'accepted', 'answered', 'active'].includes(callLog.status) &&
          [callLog.caller_id, callLog.receiver_id].includes(userId)
        );
        canPublish = authorized;
      } else {
        const groupCallMatch = roomName.match(new RegExp(`^group-call-${uuid}$`, "i"));
        if (groupCallMatch) {
          const callId = groupCallMatch[1];
          const { data: groupCall } = await supabase
            .from('group_calls')
            .select('id, host_id, status')
            .eq('id', callId)
            .maybeSingle();
          isHost = groupCall?.host_id === userId;
          if (groupCall && groupCall.status === 'active') {
            const { data: participant } = await supabase
              .from('group_call_participants')
              .select('user_id, left_at')
              .eq('call_id', groupCall.id)
              .eq('user_id', userId)
              .maybeSingle();
            authorized = isHost || Boolean(participant && participant.left_at == null);
          }
          canPublish = authorized;
        }
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "You are not authorized to join this room" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure URL has wss:// prefix
    let wsUrl = LIVEKIT_URL;
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = `wss://${wsUrl}`;
    }

    console.log(`[LiveKit][${requestId}] Generating token for user ${userId.slice(0, 8)}... in room ${roomName}, isHost=${isHost}, canPublish=${canPublish}`);

    const livekitToken = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      participantIdentity,
      participantName,
      isHost,
      canPublish,
    );

    console.log(`[LiveKit][${requestId}] ✅ Token generated successfully`);

    return new Response(
      JSON.stringify({ 
        token: livekitToken, 
        url: wsUrl,
        roomName,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(`[LiveKit][${requestId}] ❌ Error generating token:`, error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate token";
    
    return new Response(
      JSON.stringify({ error: errorMessage, requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
