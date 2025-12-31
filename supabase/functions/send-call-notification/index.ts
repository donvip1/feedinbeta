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

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Create unsigned VAPID authorization header (simpler approach)
function createVapidAuth(endpoint: string, vapidPublicKey: string): string {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  // Create a simple JWT-like structure for VAPID
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:support@feedin.app',
  }));
  
  return `vapid t=${header}.${payload}., k=${vapidPublicKey}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload);
    
    console.log('[send-call-notification] Sending push to:', subscription.endpoint.slice(0, 60) + '...');

    // For FCM (Firebase Cloud Messaging) endpoints, we need different headers
    const isFCM = subscription.endpoint.includes('fcm.googleapis.com') || 
                  subscription.endpoint.includes('firebase');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'TTL': '60',
      'Urgency': 'high',
    };

    if (!isFCM) {
      // Add VAPID headers for non-FCM push services
      headers['Authorization'] = createVapidAuth(subscription.endpoint, vapidPublicKey);
      headers['Crypto-Key'] = `p256ecdsa=${vapidPublicKey}`;
    }

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: payloadString,
    });

    if (response.ok || response.status === 201) {
      console.log('[send-call-notification] ✅ Push sent successfully, status:', response.status);
      return { success: true, status: response.status };
    } else {
      const errorText = await response.text();
      console.error('[send-call-notification] ❌ Push failed:', response.status, errorText);
      
      // If subscription is invalid, we should remove it
      if (response.status === 404 || response.status === 410) {
        console.log('[send-call-notification] Subscription expired or invalid');
      }
      
      return { success: false, status: response.status, error: errorText };
    }
  } catch (error) {
    console.error('[send-call-notification] Error sending push:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CallNotificationPayload = await req.json();
    const { callId, callerId, receiverId, callType, callerName, callerAvatar } = payload;

    console.log('[send-call-notification] 📞 Processing call notification:', {
      callId: callId.slice(0, 8),
      callerId: callerId.slice(0, 8),
      receiverId: receiverId.slice(0, 8),
      callType,
    });

    // Get receiver's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', receiverId);

    if (subError) {
      console.error('[send-call-notification] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log('[send-call-notification] Found', subscriptions?.length || 0, 'push subscriptions for receiver');

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
      console.log('[send-call-notification] Fetched caller profile:', name);
    }

    // Prepare notification payload for push
    const notificationPayload = {
      title: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
      body: `${name} is calling you`,
      icon: avatar || '/favicon.png',
      badge: '/favicon.png',
      tag: `incoming-call-${callId}`,
      requireInteraction: true,
      renotify: true,
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      type: 'incoming_call',
      data: {
        type: 'incoming_call',
        callId,
        callerId,
        callType,
        callerName: name,
        callerAvatar: avatar,
        url: `/call?callId=${callId}`,
      },
    };

    let pushResults: Array<{ success: boolean; status?: number; error?: string }> = [];

    // Send push notifications if we have VAPID key and subscriptions
    if (vapidPublicKey && subscriptions && subscriptions.length > 0) {
      console.log('[send-call-notification] Sending web push notifications with VAPID...');
      
      pushResults = await Promise.all(
        subscriptions.map(async (subscription) => {
          return sendWebPush(
            {
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
            notificationPayload,
            vapidPublicKey
          );
        })
      );
    } else if (!vapidPublicKey) {
      console.log('[send-call-notification] ⚠️ VAPID_PUBLIC_KEY not configured');
    } else {
      console.log('[send-call-notification] No push subscriptions found for receiver');
    }

    // Always create an in-app notification as fallback
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: receiverId,
      type: 'incoming_call',
      actor_id: callerId,
      related_id: callId,
      related_type: 'call',
      title: `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
      body: `${name} is calling you`,
    });

    if (notifError) {
      console.error('[send-call-notification] Error creating in-app notification:', notifError);
    } else {
      console.log('[send-call-notification] ✅ In-app notification created');
    }

    const successCount = pushResults.filter(r => r.success).length;
    console.log('[send-call-notification] 📊 Results: Sent', successCount, 'of', subscriptions?.length || 0, 'push notifications');

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        total: subscriptions?.length || 0,
        hasVapidKey: !!vapidPublicKey,
        inAppNotificationCreated: !notifError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-call-notification] ❌ Error:', error);
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
