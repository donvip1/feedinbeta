import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')!;
const CF_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

interface CreateLiveInputRequest {
  action: 'create-live-input';
  streamId: string;
  title: string;
  enableRecording?: boolean;
}

interface GetLiveInputRequest {
  action: 'get-live-input';
  liveInputId: string;
}

interface DeleteLiveInputRequest {
  action: 'delete-live-input';
  liveInputId: string;
}

interface GetStreamStatusRequest {
  action: 'get-stream-status';
  liveInputId: string;
}

type RequestBody = CreateLiveInputRequest | GetLiveInputRequest | DeleteLiveInputRequest | GetStreamStatusRequest;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: RequestBody = await req.json();
    console.log('[cloudflare-stream] Action:', body.action);

    switch (body.action) {
      case 'create-live-input': {
        const { streamId, title, enableRecording = true } = body as CreateLiveInputRequest;
        
        console.log('[cloudflare-stream] Creating live input for stream:', streamId);
        
        // Create a Live Input in Cloudflare Stream
        const response = await fetch(`${CF_API_BASE}/live_inputs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta: { 
              name: title,
              streamId: streamId,
              createdBy: user.id,
            },
            recording: { 
              mode: enableRecording ? 'automatic' : 'off',
              timeoutSeconds: 0, // Never timeout
            },
            defaultCreator: user.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[cloudflare-stream] CF API error:', errorText);
          throw new Error(`Cloudflare API error: ${response.status}`);
        }

        const result = await response.json();
        console.log('[cloudflare-stream] Live input created:', result.result?.uid);

        if (!result.success || !result.result) {
          throw new Error('Failed to create live input');
        }

        const liveInput = result.result;
        
        console.log('[cloudflare-stream] Full response:', JSON.stringify(liveInput, null, 2));
        
        // Extract the WebRTC URL for WHIP publishing
        const webrtcUrl = liveInput.webRTC?.url;
        // HLS playback URL from Cloudflare
        const hlsUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8`;
        
        // Update the live_streams table with Cloudflare info
        const { error: updateError } = await supabaseClient
          .from('live_streams')
          .update({
            cf_live_input_id: liveInput.uid,
            cf_webrtc_url: webrtcUrl,
            cf_hls_url: hlsUrl,
          })
          .eq('id', streamId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[cloudflare-stream] DB update error:', updateError);
          // Don't throw, the live input was created successfully
        }

        return new Response(
          JSON.stringify({
            success: true,
            liveInputId: liveInput.uid,
            webrtcUrl: webrtcUrl,
            rtmpsUrl: liveInput.rtmps?.url,
            rtmpsStreamKey: liveInput.rtmps?.streamKey,
            srtUrl: liveInput.srt?.url,
            hlsUrl: hlsUrl,
            dashUrl: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${liveInput.uid}/manifest/video.mpd`,
            // Also return raw CF response for debugging
            rawWebRTC: liveInput.webRTC,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-live-input': {
        const { liveInputId } = body as GetLiveInputRequest;
        
        const response = await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}`, {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Cloudflare API error: ${response.status}`);
        }

        const result = await response.json();
        
        return new Response(
          JSON.stringify({
            success: true,
            liveInput: result.result,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-stream-status': {
        const { liveInputId } = body as GetStreamStatusRequest;
        
        // Get the videos associated with this live input to check status
        const response = await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}/videos`, {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Cloudflare API error: ${response.status}`);
        }

        const result = await response.json();
        const videos = result.result || [];
        
        // Check if there's a currently live video
        const liveVideo = videos.find((v: any) => v.status?.state === 'live-inprogress');
        
        return new Response(
          JSON.stringify({
            success: true,
            isLive: !!liveVideo,
            currentVideo: liveVideo || null,
            recentVideos: videos.slice(0, 5),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-live-input': {
        const { liveInputId } = body as DeleteLiveInputRequest;
        
        console.log('[cloudflare-stream] Deleting live input:', liveInputId);
        
        const response = await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        });

        // 404 is fine - already deleted
        if (!response.ok && response.status !== 404) {
          const errorText = await response.text();
          console.error('[cloudflare-stream] Delete error:', errorText);
          throw new Error(`Cloudflare API error: ${response.status}`);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${(body as any).action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cloudflare-stream] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
