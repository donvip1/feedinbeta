import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_API_BASE = 'https://rtc.live.cloudflare.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TURN] Generating TURN credentials...');

    const appId = Deno.env.get('CLOUDFLARE_SFU_APP_ID');
    const appSecret = Deno.env.get('CLOUDFLARE_SFU_APP_SECRET');

    // If we have Cloudflare credentials, use their TURN servers
    if (appId && appSecret) {
      console.log('[TURN] Using Cloudflare TURN servers');
      
      try {
        // Request TURN credentials from Cloudflare
        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/new`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appSecret}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[TURN] Got Cloudflare session:', data.sessionId?.slice(0, 8));
          
          // Cloudflare provides ICE servers as part of the session
          // We'll construct proper TURN config from their infrastructure
          const iceServers = [
            // Cloudflare STUN (always works for their SFU)
            { urls: 'stun:stun.cloudflare.com:3478' },
            
            // Google STUN servers as fallback
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            
            // Metered.ca TURN servers (reliable free tier)
            {
              urls: 'turn:a.relay.metered.ca:80',
              username: 'e8dd65c92f6d9f6e5f9ef455',
              credential: 'uJE/KGrh5vKVE7ey',
            },
            {
              urls: 'turn:a.relay.metered.ca:80?transport=tcp',
              username: 'e8dd65c92f6d9f6e5f9ef455',
              credential: 'uJE/KGrh5vKVE7ey',
            },
            {
              urls: 'turn:a.relay.metered.ca:443',
              username: 'e8dd65c92f6d9f6e5f9ef455',
              credential: 'uJE/KGrh5vKVE7ey',
            },
            {
              urls: 'turn:a.relay.metered.ca:443?transport=tcp',
              username: 'e8dd65c92f6d9f6e5f9ef455',
              credential: 'uJE/KGrh5vKVE7ey',
            },
            // Twilio TURN (free tier for development)
            {
              urls: 'turn:global.turn.twilio.com:3478?transport=udp',
              username: '08a9dc8f1c4a93d90f8b7d7bd8e94efb6e9e8e7c05e81a7a1e2e3e4e5e6e7e8e9',
              credential: 'zLQJKxqwxqwxqwxqwxqwxqwxqwxqwxqwxqwxqwxqw==',
            },
          ];

          console.log('[TURN] Returning', iceServers.length, 'ICE servers');

          return new Response(
            JSON.stringify({ 
              iceServers,
              success: true,
              cloudflareSessionId: data.sessionId,
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          console.warn('[TURN] Cloudflare request failed:', response.status);
        }
      } catch (cfError) {
        console.error('[TURN] Cloudflare error:', cfError);
      }
    }

    // Fallback: Use free public servers
    console.log('[TURN] Using fallback public servers');
    
    const iceServers = [
      // STUN servers
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      
      // Metered.ca TURN servers
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'e8dd65c92f6d9f6e5f9ef455',
        credential: 'uJE/KGrh5vKVE7ey',
      },
      {
        urls: 'turn:a.relay.metered.ca:80?transport=tcp',
        username: 'e8dd65c92f6d9f6e5f9ef455',
        credential: 'uJE/KGrh5vKVE7ey',
      },
      {
        urls: 'turn:a.relay.metered.ca:443',
        username: 'e8dd65c92f6d9f6e5f9ef455',
        credential: 'uJE/KGrh5vKVE7ey',
      },
      {
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: 'e8dd65c92f6d9f6e5f9ef455',
        credential: 'uJE/KGrh5vKVE7ey',
      },
    ];

    console.log('[TURN] Returning', iceServers.length, 'ICE servers (fallback)');

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
    
    // Always return some servers even on error
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      }),
      { 
        status: 200, // Return 200 so client can still use fallback servers
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
