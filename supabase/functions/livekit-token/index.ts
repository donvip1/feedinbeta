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
  isHost: boolean
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
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
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
    canPublish: claims.video.canPublish,
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

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    // --- Parse request body ---
    const body = await req.json();
    const { roomName } = body;

    if (!roomName) {
      return new Response(
        JSON.stringify({ error: "Missing required field: roomName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Force identity to authenticated user's ID — never trust client input
    const participantIdentity = userId;
    const participantName = profile?.display_name || body.participantName || 'User';

    // Determine host status server-side by checking DB ownership
    let isHost = false;
    
    // Check if this is a space (space-{id}) or stream (stream-{id})
    const spaceMatch = roomName.match(/^space-(.+)$/);
    const streamMatch = roomName.match(/^stream-(.+)$/);
    
    if (spaceMatch) {
      const spaceId = spaceMatch[1];
      const { data: space } = await supabase
        .from('live_spaces')
        .select('user_id')
        .eq('id', spaceId)
        .single();
      isHost = space?.user_id === userId;
    } else if (streamMatch) {
      const streamId = streamMatch[1];
      const { data: stream } = await supabase
        .from('live_streams')
        .select('user_id')
        .eq('id', streamId)
        .single();
      isHost = stream?.user_id === userId;
    } else {
      // For calls or other room types, use client hint but it's less critical
      isHost = body.isHost === true;
    }

    // Ensure URL has wss:// prefix
    let wsUrl = LIVEKIT_URL;
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = `wss://${wsUrl}`;
    }

    console.log(`[LiveKit][${requestId}] Generating token for user ${userId.slice(0, 8)}... in room ${roomName}, isHost=${isHost}`);

    const livekitToken = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      participantIdentity,
      participantName,
      isHost
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
