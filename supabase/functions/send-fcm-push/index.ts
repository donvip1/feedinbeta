import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FCMRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  image_url?: string;
}

interface FCMResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
    if (!FCM_SERVER_KEY) {
      console.error('[send-fcm-push] FCM_SERVER_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'FCM not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, title, body, data, image_url }: FCMRequest = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get device tokens for user (native platforms only)
    const { data: subscriptions, error: queryError } = await supabase
      .from('push_subscriptions')
      .select('device_token, platform')
      .eq('user_id', user_id)
      .in('platform', ['android', 'ios'])
      .not('device_token', 'is', null);

    if (queryError) {
      console.error('[send-fcm-push] Database error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions?.length) {
      console.log('[send-fcm-push] No device tokens found for user:', user_id);
      return new Response(
        JSON.stringify({ error: 'No device tokens found', sent: 0 }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-fcm-push] Sending to ${subscriptions.length} devices for user ${user_id}`);

    const results: FCMResponse[] = [];

    // Send to each device
    for (const sub of subscriptions) {
      if (!sub.device_token) continue;

      try {
        const fcmPayload: Record<string, unknown> = {
          to: sub.device_token,
          notification: {
            title,
            body,
            ...(image_url && { image: image_url }),
          },
          data: {
            ...data,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'feedin_default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        };

        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${FCM_SERVER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });

        const responseData = await fcmResponse.json();

        if (fcmResponse.ok && responseData.success === 1) {
          results.push({ success: true, message_id: responseData.results?.[0]?.message_id });
          console.log(`[send-fcm-push] Sent to ${sub.platform} device:`, sub.device_token.substring(0, 20) + '...');
        } else {
          const errorMsg = responseData.results?.[0]?.error || 'Unknown error';
          results.push({ success: false, error: errorMsg });
          console.error(`[send-fcm-push] Failed for ${sub.platform}:`, errorMsg);

          // Remove invalid tokens
          if (errorMsg === 'NotRegistered' || errorMsg === 'InvalidRegistration') {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('device_token', sub.device_token);
            console.log('[send-fcm-push] Removed invalid token');
          }
        }
      } catch (fcmError) {
        console.error('[send-fcm-push] FCM request error:', fcmError);
        results.push({ success: false, error: String(fcmError) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        success: successCount > 0,
        sent: successCount,
        failed: results.length - successCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-fcm-push] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
