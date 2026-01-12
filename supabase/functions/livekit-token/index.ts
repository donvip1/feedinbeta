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
  
  // Build the claims matching LiveKit's expected format exactly
  // https://docs.livekit.io/realtime/concepts/authentication/
  const claims = {
    jti: generateJti(), // JWT ID is required by LiveKit
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: isHost,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
      roomRecord: isHost,
    },
    metadata: "", // Empty metadata
    sha256: "", // Empty sha256
  };
  
  const jwt = await new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(apiKey)
    .setSubject(participantIdentity)
    .setExpirationTime("6h")
    .setNotBefore(Math.floor(Date.now() / 1000))
    .sign(secretKey);

  return jwt;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error("Missing LiveKit credentials");
      return new Response(
        JSON.stringify({ error: "LiveKit not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure URL has wss:// prefix for WebSocket connection
    let wsUrl = LIVEKIT_URL;
    if (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://')) {
      wsUrl = `wss://${wsUrl}`;
    }
    
    console.log(`[LiveKit] URL: ${wsUrl}, API Key prefix: ${LIVEKIT_API_KEY.substring(0, 8)}...`);

    const { roomName, participantName, participantIdentity, isHost } = await req.json();

    if (!roomName || !participantName || !participantIdentity) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: roomName, participantName, participantIdentity" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LiveKit] Generating token for ${participantName} (${participantIdentity}) in room ${roomName}, isHost: ${isHost}`);

    const token = await generateLiveKitToken(
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
      roomName,
      participantIdentity,
      participantName,
      isHost === true
    );

    console.log(`[LiveKit] Token generated successfully for ${participantIdentity}`);

    return new Response(
      JSON.stringify({ 
        token, 
        url: wsUrl,
        roomName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[LiveKit] Error generating token:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate token";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
