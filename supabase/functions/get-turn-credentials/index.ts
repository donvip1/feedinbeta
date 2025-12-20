import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TURN] Generating TURN credentials...');

    // Use free public TURN servers from Open Relay Project
    // These are free and widely used for WebRTC applications
    const iceServers = [
      // Open Relay TURN servers (free, reliable)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      // Additional STUN servers for better ICE candidates
      {
        urls: 'stun:stun.relay.metered.ca:80',
      },
    ];

    console.log('[TURN] Returning', iceServers.length, 'ICE servers');

    return new Response(
      JSON.stringify({ 
        iceServers,
        success: true,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    console.error('[TURN] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        // Fallback to STUN-only if TURN fails
        iceServers: [],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
