import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallNotificationPayload {
  callId: string;
  callerId: string;
  receiverId: string;
  callType: 'video' | 'voice';
  callerName?: string;
  callerAvatar?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CallNotificationPayload = await req.json();
    const { callId, callerId, receiverId, callType, callerName, callerAvatar } = payload;

    console.log('[send-call-notification] Sending notification for call:', callId);

    // Get receiver's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', receiverId);

    if (subError) {
      console.error('[send-call-notification] Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-call-notification] No push subscriptions found for receiver');
      return new Response(
        JSON.stringify({ success: false, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get caller profile if not provided
    let name = callerName;
    let avatar = callerAvatar;
    
    if (!name) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', callerId)
        .single();
      
      name = callerProfile?.display_name || 'Someone';
      avatar = callerProfile?.avatar_url;
    }

    // Prepare notification payload
    const notificationPayload = {
      title: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
      body: `${name} is calling you`,
      icon: avatar || '/favicon.png',
      badge: '/favicon.png',
      tag: `incoming-call-${callId}`,
      requireInteraction: true,
      renotify: true,
      vibrate: [200, 100, 200, 100, 200, 100, 200], // Long vibration pattern for calls
      data: {
        type: 'incoming_call',
        callId,
        callerId,
        callType,
        callerName: name,
        callerAvatar: avatar,
        url: `/call?callId=${callId}`,
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' }
        ]
      }
    };

    // Send push notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          };

          // Use web-push library logic
          const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
          const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

          if (!vapidPublicKey || !vapidPrivateKey) {
            console.log('[send-call-notification] VAPID keys not configured, using fallback notification');
            return { success: false, reason: 'VAPID not configured' };
          }

          // Send the push notification
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '60', // 60 seconds TTL for urgent calls
              'Urgency': 'high',
            },
            body: JSON.stringify(notificationPayload),
          });

          if (response.ok) {
            console.log('[send-call-notification] Push sent successfully');
            return { success: true };
          } else {
            console.log('[send-call-notification] Push failed:', response.status);
            return { success: false, status: response.status };
          }
        } catch (error) {
          console.error('[send-call-notification] Error sending push:', error);
          return { success: false, error: String(error) };
        }
      })
    );

    // Also create an in-app notification
    await supabase.from('notifications').insert({
      user_id: receiverId,
      type: 'incoming_call',
      actor_id: callerId,
      related_id: callId,
      related_type: 'call',
      title: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
      body: `${name} is calling you`,
    });

    console.log('[send-call-notification] Notification results:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: results.filter(r => r.status === 'fulfilled').length,
        total: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-call-notification] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
