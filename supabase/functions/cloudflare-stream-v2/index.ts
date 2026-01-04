import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN')!;
const CF_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

// Types for actions
interface CreateStreamRequest {
  action: 'create-stream';
  streamId: string;
  title: string;
  enableRecording?: boolean;
}

interface CheckHealthRequest {
  action: 'check-health';
  streamId: string;
  liveInputId: string;
}

interface CheckManifestRequest {
  action: 'check-manifest';
  hlsUrl: string;
}

interface UpdateStateRequest {
  action: 'update-state';
  streamId: string;
  connectionState: 'idle' | 'initializing' | 'publishing' | 'live' | 'reconnecting' | 'ended';
  streamReady?: boolean;
}

interface EndStreamRequest {
  action: 'end-stream';
  streamId: string;
  liveInputId?: string;
}

interface GetStreamInfoRequest {
  action: 'get-stream-info';
  liveInputId: string;
}

interface VerifyStreamPlayableRequest {
  action: 'verify-stream-playable';
  streamId: string;
  liveInputId: string;
  maxWaitSeconds?: number;
}

type RequestBody = 
  | CreateStreamRequest 
  | CheckHealthRequest 
  | CheckManifestRequest 
  | UpdateStateRequest 
  | EndStreamRequest
  | GetStreamInfoRequest
  | VerifyStreamPlayableRequest;

// Helper to check if HLS manifest is accessible
async function checkHlsManifest(hlsUrl: string): Promise<{ accessible: boolean; error?: string }> {
  try {
    console.log('[CF-Stream-V2] Checking HLS manifest:', hlsUrl);
    const response = await fetch(hlsUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      console.log('[CF-Stream-V2] Manifest accessible');
      return { accessible: true };
    }
    
    // 404 means stream not publishing yet
    if (response.status === 404) {
      console.log('[CF-Stream-V2] Manifest not ready (404)');
      return { accessible: false, error: 'Stream not publishing yet' };
    }
    
    console.log('[CF-Stream-V2] Manifest check failed:', response.status);
    return { accessible: false, error: `HTTP ${response.status}` };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.log('[CF-Stream-V2] Manifest check error:', msg);
    return { accessible: false, error: msg };
  }
}

// Helper to get stream status from Cloudflare
async function getCloudflareStreamStatus(liveInputId: string): Promise<{ isLive: boolean; hasVideo: boolean }> {
  try {
    const response = await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}/videos`, {
      headers: { 'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.log('[CF-Stream-V2] Failed to get videos:', response.status);
      return { isLive: false, hasVideo: false };
    }
    
    const result = await response.json();
    const videos = result.result || [];
    
    // Check for live video
    const liveVideo = videos.find((v: any) => v.status?.state === 'live-inprogress');
    const hasAnyVideo = videos.length > 0;
    
    console.log('[CF-Stream-V2] Stream status - isLive:', !!liveVideo, 'hasVideo:', hasAnyVideo);
    
    return { isLive: !!liveVideo, hasVideo: hasAnyVideo };
  } catch (error) {
    console.error('[CF-Stream-V2] Error checking stream status:', error);
    return { isLive: false, hasVideo: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    console.log('[CF-Stream-V2] Action:', body.action, 'User:', user.id);

    switch (body.action) {
      case 'create-stream': {
        const { streamId, title, enableRecording = true } = body as CreateStreamRequest;
        
        console.log('[CF-Stream-V2] Creating live input for stream:', streamId);
        
        // Update state to initializing
        await supabaseClient
          .from('live_streams')
          .update({ connection_state: 'initializing', stream_ready: false })
          .eq('id', streamId)
          .eq('user_id', user.id);
        
        // Create Cloudflare Live Input
        const response = await fetch(`${CF_API_BASE}/live_inputs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meta: { name: title, streamId, createdBy: user.id },
            recording: { mode: enableRecording ? 'automatic' : 'off', timeoutSeconds: 0 },
            defaultCreator: user.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[CF-Stream-V2] CF API error:', errorText);
          
          // Update state to failed
          await supabaseClient
            .from('live_streams')
            .update({ connection_state: 'idle' })
            .eq('id', streamId);
            
          throw new Error(`Cloudflare API error: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success || !result.result) {
          throw new Error('Failed to create live input');
        }

        const liveInput = result.result;
        console.log('[CF-Stream-V2] Live input created:', liveInput.uid);
        
        // Extract URLs
        const webrtcPublishUrl = liveInput.webRTC?.url; // WHIP - for host to publish
        const webrtcPlaybackUrl = liveInput.webRTCPlayback?.url; // WHEP - for viewers
        
        // Build HLS URL using customer subdomain
        const customerMatch = webrtcPublishUrl?.match(/customer-([^.]+)/);
        const customerSubdomain = customerMatch ? customerMatch[0] : `customer-${CLOUDFLARE_ACCOUNT_ID}`;
        const hlsUrl = `https://${customerSubdomain}.cloudflarestream.com/${liveInput.uid}/manifest/video.m3u8`;
        
        console.log('[CF-Stream-V2] Publish URL (WHIP):', webrtcPublishUrl);
        console.log('[CF-Stream-V2] Playback URL (WHEP):', webrtcPlaybackUrl);
        console.log('[CF-Stream-V2] HLS URL:', hlsUrl);
        
        // Update database with Cloudflare info
        const { error: updateError } = await supabaseClient
          .from('live_streams')
          .update({
            cf_live_input_id: liveInput.uid,
            cf_webrtc_url: webrtcPlaybackUrl || null,
            cf_hls_url: hlsUrl,
            stream_key: liveInput.rtmps?.streamKey || '',
            connection_state: 'initializing',
            stream_ready: false,
            last_health_check: new Date().toISOString(),
          })
          .eq('id', streamId)
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[CF-Stream-V2] DB update error:', updateError);
        }

        return new Response(
          JSON.stringify({
            success: true,
            liveInputId: liveInput.uid,
            webrtcPublishUrl,
            webrtcPlaybackUrl,
            hlsUrl,
            rtmpsUrl: liveInput.rtmps?.url,
            rtmpsStreamKey: liveInput.rtmps?.streamKey,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-health': {
        const { streamId, liveInputId } = body as CheckHealthRequest;
        
        // Check Cloudflare stream status
        const cfStatus = await getCloudflareStreamStatus(liveInputId);
        
        // Get the stream's HLS URL
        const { data: stream } = await supabaseClient
          .from('live_streams')
          .select('cf_hls_url, connection_state')
          .eq('id', streamId)
          .single();
        
        let manifestAccessible = false;
        if (stream?.cf_hls_url) {
          const manifestCheck = await checkHlsManifest(stream.cf_hls_url);
          manifestAccessible = manifestCheck.accessible;
        }
        
        // Determine stream ready status
        const streamReady = cfStatus.isLive && manifestAccessible;
        
        // Update database
        await supabaseClient
          .from('live_streams')
          .update({
            stream_ready: streamReady,
            last_health_check: new Date().toISOString(),
            connection_state: cfStatus.isLive ? 'live' : stream?.connection_state || 'idle',
          })
          .eq('id', streamId);
        
        return new Response(
          JSON.stringify({
            success: true,
            isLive: cfStatus.isLive,
            hasVideo: cfStatus.hasVideo,
            manifestAccessible,
            streamReady,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check-manifest': {
        const { hlsUrl } = body as CheckManifestRequest;
        const result = await checkHlsManifest(hlsUrl);
        
        return new Response(
          JSON.stringify({
            success: true,
            ...result,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-state': {
        const { streamId, connectionState, streamReady } = body as UpdateStateRequest;
        
        const updateData: any = {
          connection_state: connectionState,
          last_health_check: new Date().toISOString(),
        };
        
        if (streamReady !== undefined) {
          updateData.stream_ready = streamReady;
        }
        
        // Set status based on connection state
        if (connectionState === 'live') {
          updateData.status = 'live';
          if (!updateData.started_at) {
            updateData.started_at = new Date().toISOString();
          }
        } else if (connectionState === 'ended') {
          updateData.status = 'ended';
          updateData.ended_at = new Date().toISOString();
          updateData.stream_ready = false;
        }
        
        const { error } = await supabaseClient
          .from('live_streams')
          .update(updateData)
          .eq('id', streamId)
          .eq('user_id', user.id);
        
        if (error) {
          throw new Error(`Failed to update state: ${error.message}`);
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'end-stream': {
        const { streamId, liveInputId } = body as EndStreamRequest;
        
        // Update database
        await supabaseClient
          .from('live_streams')
          .update({
            status: 'ended',
            connection_state: 'ended',
            stream_ready: false,
            ended_at: new Date().toISOString(),
          })
          .eq('id', streamId)
          .eq('user_id', user.id);
        
        // Optionally delete the Cloudflare live input
        if (liveInputId) {
          try {
            await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` },
            });
            console.log('[CF-Stream-V2] Deleted live input:', liveInputId);
          } catch (e) {
            console.log('[CF-Stream-V2] Failed to delete live input:', e);
          }
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-stream-info': {
        const { liveInputId } = body as GetStreamInfoRequest;
        
        const response = await fetch(`${CF_API_BASE}/live_inputs/${liveInputId}`, {
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` },
        });
        
        if (!response.ok) {
          throw new Error(`Cloudflare API error: ${response.status}`);
        }
        
        const result = await response.json();
        const cfStatus = await getCloudflareStreamStatus(liveInputId);
        
        return new Response(
          JSON.stringify({
            success: true,
            liveInput: result.result,
            ...cfStatus,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify-stream-playable': {
        const { streamId, liveInputId, maxWaitSeconds = 30 } = body as VerifyStreamPlayableRequest;
        
        console.log('[CF-Stream-V2] Verifying stream playability for:', streamId, 'input:', liveInputId);
        
        let attempts = 0;
        const pollInterval = 2000; // 2 seconds
        const maxAttempts = Math.ceil(maxWaitSeconds / 2);
        
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`[CF-Stream-V2] Verification attempt ${attempts}/${maxAttempts}`);
          
          // Get the stream's HLS URL
          const { data: stream } = await supabaseClient
            .from('live_streams')
            .select('cf_hls_url')
            .eq('id', streamId)
            .single();
          
          if (stream?.cf_hls_url) {
            const manifestCheck = await checkHlsManifest(stream.cf_hls_url);
            
            if (manifestCheck.accessible) {
              console.log('[CF-Stream-V2] Manifest is accessible! Setting stream_ready = true');
              
              // Manifest ready! Set stream_ready = true
              await supabaseClient
                .from('live_streams')
                .update({ 
                  stream_ready: true, 
                  status: 'live',
                  connection_state: 'live',
                  last_health_check: new Date().toISOString(),
                })
                .eq('id', streamId);
              
              return new Response(
                JSON.stringify({ success: true, attempts, message: 'Stream is now playable' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
        console.log('[CF-Stream-V2] Verification timed out after', attempts, 'attempts');
        
        return new Response(
          JSON.stringify({ success: false, error: 'Timeout waiting for manifest', attempts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${(body as any).action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CF-Stream-V2] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
