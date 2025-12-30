import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_API_BASE = 'https://rtc.live.cloudflare.com/v1';

interface SessionRequest {
  action: 'create-session' | 'push-track' | 'pull-tracks' | 'renegotiate' | 'close-track' | 'get-session';
  sessionId?: string;
  sdp?: string;
  trackName?: string;
  mid?: string; // Media line ID from SDP - required for push-track
  remoteTracks?: Array<{ location: string; trackName: string; sessionId: string }>;
  trackId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('CLOUDFLARE_SFU_APP_ID');
    const appSecret = Deno.env.get('CLOUDFLARE_SFU_APP_SECRET');

    if (!appId || !appSecret) {
      console.error('[Cloudflare-SFU] Missing credentials - APP_ID:', !!appId, 'APP_SECRET:', !!appSecret);
      return new Response(
        JSON.stringify({ error: 'Cloudflare SFU credentials not configured', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = `Bearer ${appSecret}`;
    const body: SessionRequest = await req.json();
    console.log('[Cloudflare-SFU] Request:', body.action, 'sessionId:', body.sessionId?.slice(0, 8) || 'none');

    switch (body.action) {
      case 'create-session': {
        console.log('[Cloudflare-SFU] Creating new session...');
        
        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/new`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Create session failed:', response.status, errorText);
          throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Cloudflare-SFU] ✅ Session created:', data.sessionId?.slice(0, 8));
        
        return new Response(
          JSON.stringify({ success: true, sessionId: data.sessionId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'push-track': {
        if (!body.sessionId || !body.trackName) {
          throw new Error('Missing sessionId or trackName for push-track');
        }

        console.log('[Cloudflare-SFU] 🎤 Pushing track:', body.trackName, 'to session:', body.sessionId.slice(0, 8));
        
        // Parse SDP to extract mid values if not provided
        let mids: string[] = [];
        if (body.sdp) {
          // Extract all m= lines and their corresponding a=mid values
          const sdpLines = body.sdp.split('\n');
          let currentMid: string | null = null;
          
          for (const line of sdpLines) {
            if (line.startsWith('a=mid:')) {
              currentMid = line.replace('a=mid:', '').trim();
              if (currentMid) {
                mids.push(currentMid);
              }
            }
          }
          console.log('[Cloudflare-SFU] Extracted mids from SDP:', mids);
        }
        
        // If explicit mid provided, use it; otherwise use first extracted mid
        const mid = body.mid || mids[0] || '0';
        
        // Build request body with the local track we want to publish
        const requestBody: any = {
          tracks: [{
            location: 'local',
            trackName: body.trackName,
            mid: mid, // Required by Cloudflare
          }],
        };

        // Include SDP offer if provided
        if (body.sdp) {
          requestBody.sessionDescription = {
            type: 'offer',
            sdp: body.sdp,
          };
        }
        
        console.log('[Cloudflare-SFU] Push track request body:', JSON.stringify({
          tracks: requestBody.tracks,
          hasSessionDescription: !!requestBody.sessionDescription,
        }));

        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/${body.sessionId}/tracks/new`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Push track failed:', response.status, errorText);
          throw new Error(`Failed to push track: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Cloudflare-SFU] ✅ Track pushed, response:', {
          hasSessionDescription: !!data.sessionDescription,
          sessionDescriptionType: data.sessionDescription?.type,
          tracksCount: data.tracks?.length,
          requiresRenegotiation: data.requiresImmediateRenegotiation,
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionDescription: data.sessionDescription,
            tracks: data.tracks,
            requiresImmediateRenegotiation: data.requiresImmediateRenegotiation,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'pull-tracks': {
        if (!body.sessionId || !body.remoteTracks || body.remoteTracks.length === 0) {
          throw new Error('Missing sessionId or remoteTracks for pull-tracks');
        }

        console.log('[Cloudflare-SFU] 🎧 Pulling', body.remoteTracks.length, 'tracks to session:', body.sessionId.slice(0, 8));
        console.log('[Cloudflare-SFU] Remote tracks:', JSON.stringify(body.remoteTracks));
        
        // Build request to pull remote tracks
        // Each remote track needs: location, sessionId (of the publisher), trackName (from the publisher)
        const tracksToRequest = body.remoteTracks.map(t => ({
          location: 'remote',
          sessionId: t.sessionId,
          trackName: t.trackName,
        }));

        console.log('[Cloudflare-SFU] Requesting tracks:', JSON.stringify(tracksToRequest));

        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/${body.sessionId}/tracks/new`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracks: tracksToRequest,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Pull tracks failed:', response.status, errorText);
          throw new Error(`Failed to pull tracks: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Cloudflare-SFU] ✅ Tracks pulled, response:', {
          hasSessionDescription: !!data.sessionDescription,
          sessionDescriptionType: data.sessionDescription?.type,
          tracksCount: data.tracks?.length,
          requiresRenegotiation: data.requiresImmediateRenegotiation,
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            sessionDescription: data.sessionDescription,
            tracks: data.tracks,
            requiresImmediateRenegotiation: data.requiresImmediateRenegotiation,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'renegotiate': {
        if (!body.sessionId || !body.sdp) {
          throw new Error('Missing sessionId or sdp for renegotiate');
        }

        console.log('[Cloudflare-SFU] 🔄 Renegotiating session:', body.sessionId.slice(0, 8));
        
        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/${body.sessionId}/renegotiate`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionDescription: {
              type: 'answer',
              sdp: body.sdp,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Renegotiate failed:', response.status, errorText);
          throw new Error(`Failed to renegotiate: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Cloudflare-SFU] ✅ Renegotiation complete');
        
        return new Response(
          JSON.stringify({ success: true, sessionDescription: data.sessionDescription }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'close-track': {
        if (!body.sessionId || !body.trackName) {
          throw new Error('Missing sessionId or trackName for close-track');
        }

        console.log('[Cloudflare-SFU] Closing track:', body.trackName, 'in session:', body.sessionId.slice(0, 8));
        
        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/${body.sessionId}/tracks/close`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracks: [{ mid: body.trackName }],
            force: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Close track failed:', response.status, errorText);
          throw new Error(`Failed to close track: ${response.status} - ${errorText}`);
        }

        console.log('[Cloudflare-SFU] ✅ Track closed successfully');
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-session': {
        if (!body.sessionId) {
          throw new Error('Missing sessionId for get-session');
        }

        console.log('[Cloudflare-SFU] Getting session info:', body.sessionId.slice(0, 8));
        
        const response = await fetch(`${CLOUDFLARE_API_BASE}/apps/${appId}/sessions/${body.sessionId}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Cloudflare-SFU] Get session failed:', response.status, errorText);
          throw new Error(`Failed to get session: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Cloudflare-SFU] ✅ Session info retrieved');
        
        return new Response(
          JSON.stringify({ success: true, session: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

  } catch (error: unknown) {
    console.error('[Cloudflare-SFU] ❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
