import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RecordingRequest {
  action: 'start' | 'stop';
  roomId: string;
  roomType: 'live_streams' | 'live_spaces';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[Recording][${requestId}] ========================================`);

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error(`[Recording][${requestId}] Missing LiveKit credentials!`);
      return new Response(
        JSON.stringify({ error: "LiveKit not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[Recording][${requestId}] Missing Supabase credentials!`);
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get authorization from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RecordingRequest = await req.json();
    const { action, roomId, roomType } = body;

    console.log(`[Recording][${requestId}] Action: ${action}, Room: ${roomId}, Type: ${roomType}`);

    // Verify user is the host
    const table = roomType === 'live_spaces' ? 'live_spaces' : 'live_streams';
    const { data: room, error: roomError } = await supabase
      .from(table)
      .select('id, user_id, title, status')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (room.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the host can control recording" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build LiveKit API URL - extract host from ws URL
    let livekitHost = LIVEKIT_URL;
    if (livekitHost.startsWith('wss://')) {
      livekitHost = livekitHost.replace('wss://', '');
    } else if (livekitHost.startsWith('ws://')) {
      livekitHost = livekitHost.replace('ws://', '');
    }
    const livekitApiUrl = `https://${livekitHost}`;

    // Generate a simple auth token for LiveKit API
    const now = Math.floor(Date.now() / 1000);
    const encoder = new TextEncoder();
    
    // Create a basic token for API access (not room access)
    const tokenPayload = {
      iss: LIVEKIT_API_KEY,
      sub: user.id,
      iat: now,
      nbf: now - 10,
      exp: now + 3600, // 1 hour
      video: {
        roomRecord: true,
      },
    };

    // Sign the token
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(LIVEKIT_API_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const header = { alg: "HS256", typ: "JWT" };
    const base64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const base64Payload = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${base64Header}.${base64Payload}`;
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureInput));
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const apiToken = `${base64Header}.${base64Payload}.${base64Signature}`;

    if (action === 'start') {
      // Start room composite recording using LiveKit Egress API
      // Room name must match the prefix used when creating the LiveKit room
      const roomName = roomType === 'live_spaces' ? `space-${roomId}` : `stream-${roomId}`;
      
      console.log(`[Recording][${requestId}] Starting recording for room: ${roomName}`);

      // Create egress request - Room Composite (records entire room)
      const egressRequest = {
        room_name: roomName,
        file: {
          filepath: `recordings/${roomId}/${Date.now()}.mp4`,
          disable_manifest: true,
        },
        // For audio spaces, we'll use audio-only output
        ...(roomType === 'live_spaces' ? {
          audio_only: true,
          file: {
            filepath: `recordings/${roomId}/${Date.now()}.ogg`,
            disable_manifest: true,
          },
        } : {}),
      };

      try {
        const egressResponse = await fetch(`${livekitApiUrl}/twirp/livekit.Egress/StartRoomCompositeEgress`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(egressRequest),
        });

        if (!egressResponse.ok) {
          const errorText = await egressResponse.text();
          console.error(`[Recording][${requestId}] Egress API error:`, errorText);
          
          // If egress not available, fall back to marking as recording
          // Some LiveKit Cloud plans don't include egress
          await supabase
            .from(table)
            .update({ 
              is_recording_enabled: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', roomId);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Recording marked as enabled (egress may not be available on your plan)",
              egressId: null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const egressData = await egressResponse.json();
        console.log(`[Recording][${requestId}] Egress started:`, egressData);

        // Update database with egress ID
        await supabase
          .from(table)
          .update({ 
            is_recording_enabled: true,
            cf_recording_uid: egressData.egress_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            egressId: egressData.egress_id,
            message: "Recording started",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (egressError: any) {
        console.error(`[Recording][${requestId}] Egress request failed:`, egressError);
        
        // Mark as recording anyway for client-side indicator
        await supabase
          .from(table)
          .update({ 
            is_recording_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', roomId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Recording marked (cloud egress unavailable)",
            fallback: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    } else if (action === 'stop') {
      console.log(`[Recording][${requestId}] Stopping recording for room: ${roomId}`);

      // Get the egress ID from database
      const { data: roomData } = await supabase
        .from(table)
        .select('cf_recording_uid')
        .eq('id', roomId)
        .single();

      if (roomData?.cf_recording_uid) {
        try {
          // Stop the egress
          const stopResponse = await fetch(`${livekitApiUrl}/twirp/livekit.Egress/StopEgress`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ egress_id: roomData.cf_recording_uid }),
          });

          if (stopResponse.ok) {
            const stopData = await stopResponse.json();
            console.log(`[Recording][${requestId}] Egress stopped:`, stopData);

            // Update with recording URL if available
            const recordingUrl = stopData.file?.location || stopData.file_results?.[0]?.filename;
            
            await supabase
              .from(table)
              .update({ 
                is_recording_enabled: false,
                recording_url: recordingUrl || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', roomId);

            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Recording stopped",
                recordingUrl,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (stopError) {
          console.error(`[Recording][${requestId}] Stop egress failed:`, stopError);
        }
      }

      // Just mark as not recording
      await supabase
        .from(table)
        .update({ 
          is_recording_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roomId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Recording stopped",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[Recording][${requestId}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
