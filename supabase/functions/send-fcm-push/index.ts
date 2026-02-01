import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

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

// Token cache
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// Base64URL encode
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

// Parse PEM private key to CryptoKey
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and decode
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

// Create signed JWT for Google OAuth2
async function createSignedJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signatureInput}.${encodedSignature}`;
}

// Get access token from Google OAuth2
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    console.log('[send-fcm-push] Using cached access token');
    return cachedAccessToken;
  }

  console.log('[send-fcm-push] Requesting new access token');
  const jwt = await createSignedJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[send-fcm-push] OAuth2 error:', errorText);
    throw new Error(`OAuth2 token request failed: ${response.status}`);
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  
  console.log('[send-fcm-push] Access token obtained, expires in', data.expires_in, 'seconds');
  return cachedAccessToken!;
}

// Send FCM v1 message
async function sendFCMv1Message(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fcmPayload = {
    message: {
      token: deviceToken,
      notification: {
        title,
        body,
        ...(imageUrl && { image: imageUrl }),
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high' as const,
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
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    }
  );

  const responseData = await response.json();

  if (response.ok) {
    return { success: true, messageId: responseData.name };
  } else {
    const errorCode = responseData.error?.details?.[0]?.errorCode || 
                      responseData.error?.status || 
                      'UNKNOWN';
    return { success: false, error: errorCode };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      console.error('[send-fcm-push] GOOGLE_SERVICE_ACCOUNT not configured');
      return new Response(
        JSON.stringify({ error: 'FCM not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      console.error('[send-fcm-push] Invalid service account JSON');
      return new Response(
        JSON.stringify({ error: 'Invalid service account configuration' }),
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

    // Get access token
    const accessToken = await getAccessToken(serviceAccount);

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
        const result = await sendFCMv1Message(
          accessToken,
          serviceAccount.project_id,
          sub.device_token,
          title,
          body,
          data,
          image_url
        );

        if (result.success) {
          results.push({ success: true, message_id: result.messageId });
          console.log(`[send-fcm-push] Sent to ${sub.platform} device:`, sub.device_token.substring(0, 20) + '...');
        } else {
          results.push({ success: false, error: result.error });
          console.error(`[send-fcm-push] Failed for ${sub.platform}:`, result.error);

          // Remove invalid tokens
          if (result.error === 'UNREGISTERED' || result.error === 'INVALID_ARGUMENT') {
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
