import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  
  // Current time for token timing
  const now = Math.floor(Date.now() / 1000);
  
  // Build the claims matching LiveKit's expected format exactly
  // https://docs.livekit.io/realtime/concepts/authentication/
  const claims = {
    jti: generateJti(), // JWT ID is required by LiveKit
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true, // Both caller and receiver need to publish
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
      roomRecord: isHost,
    },
    metadata: JSON.stringify({ userId: participantIdentity }), // Add user context
    sha256: "", // Empty sha256
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
    .setNotBefore(now - 10) // Allow 10 seconds clock skew
    .setExpirationTime(now + 21600) // 6 hours
    .sign(secretKey);

  return jwt;
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Detailed credential logging
    console.log(`[LiveKit][${requestId}] Credential check:`, {
      hasApiKey: !!LIVEKIT_API_KEY,
      apiKeyPrefix: LIVEKIT_API_KEY?.substring(0, 8) || 'NOT_SET',
      hasApiSecret: !!LIVEKIT_API_SECRET,
      secretLength: LIVEKIT_API_SECRET?.length || 0,
      hasUrl: !!LIVEKIT_URL,
      url: LIVEKIT_URL || 'NOT_SET',
    });

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error(`[LiveKit][${requestId}] Missing LiveKit credentials!`);
      return new Response(
        JSON.stringify({ 
          error: "LiveKit not configured",
          details: {
            hasApiKey: !!LIVEKIT_API_KEY,
            hasApiSecret: !!LIVEKIT_API_SECRET,
            hasUrl: !!LIVEKIT_URL,
          }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure URL has wss:// prefix for WebSocket connection
    let wsUrl = LIVEKIT_URL;
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = `wss://${wsUrl}`;
    }
    
    console.log(`[LiveKit][${requestId}] WebSocket URL: ${wsUrl}`);

    const body = await req.json();
    const { roomName, participantName, participantIdentity, isHost } = body;

    console.log(`[LiveKit][${requestId}] Request params:`, {
      roomName,
      participantName,
      participantIdentity: participantIdentity?.slice(0, 8) + '...',
      isHost,
    });

    if (!roomName || !participantName || !participantIdentity) {
      console.error(`[LiveKit][${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ error: "Missing required fields: roomName, participantName, participantIdentity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LiveKit][${requestId}] Generating token for ${participantName} in room ${roomName}`);

    const token = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      participantIdentity,
      participantName,
      isHost === true
    );

    console.log(`[LiveKit][${requestId}] ✅ Token generated successfully`);
    console.log(`[LiveKit][${requestId}] Token length: ${token.length}`);
    console.log(`[LiveKit][${requestId}] ========================================`);

    return new Response(
      JSON.stringify({ 
        token, 
        url: wsUrl,
        roomName,
        requestId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error(`[LiveKit][${requestId}] ❌ Error generating token:`, error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate token";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[LiveKit][${requestId}] Error stack:`, errorStack);
    console.log(`[LiveKit][${requestId}] ========================================`);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});