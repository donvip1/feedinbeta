import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TURN] Generating TURN credentials...');

    // Comprehensive ICE server list with reliable providers
    const iceServers = [
      // Google STUN servers (highly reliable)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Metered TURN servers (free tier - reliable)
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'e8dd65c92e9b0a5f1c47f890',
        credential: 'IpV+N4hHwXjzwQKE',
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: 'e8dd65c92e9b0a5f1c47f890',
        credential: 'IpV+N4hHwXjzwQKE',
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'e8dd65c92e9b0a5f1c47f890',
        credential: 'IpV+N4hHwXjzwQKE',
      },
      {
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: 'e8dd65c92e9b0a5f1c47f890',
        credential: 'IpV+N4hHwXjzwQKE',
      },
      {
        urls: 'turns:a.relay.metered.ca:443',
        username: 'e8dd65c92e9b0a5f1c47f890',
        credential: 'IpV+N4hHwXjzwQKE',
      },
      
      // OpenRelay TURN servers (backup)
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
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
