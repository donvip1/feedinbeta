// Shared Firebase Cloud Messaging helpers for the native push edge functions
// (send-call-push, send-message-push).
//
// This is the DATA-ONLY counterpart to `send-fcm-push`: it deliberately sends
// FCM messages WITHOUT a `notification` block so that, on Android, the message
// is always delivered to the Flutter app's background isolate
// (`feedinFirebaseBackgroundHandler`) — which is what lets us present the native
// CallKit incoming-call screen and build rich, grouped message notifications.
// A message WITH a `notification` block would instead be shown by the OS tray
// and the Dart handler would not run while the app is killed.
//
// The OAuth2 / JWT-signing logic mirrors `send-fcm-push/index.ts` exactly.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

// --- Access-token minting (cached per warm instance) -------------------------

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function createSignedJWT(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };
  const signatureInput = `${base64UrlEncodeString(JSON.stringify(header))}.${
    base64UrlEncodeString(JSON.stringify(payload))
  }`;
  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signatureInput),
  );
  return `${signatureInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Mint (or reuse) a Google OAuth2 access token for FCM. */
export async function getFcmAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }
  const jwt = await createSignedJWT(serviceAccount);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth2 token request failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  cachedAccessToken = data.access_token as string;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedAccessToken!;
}

/** Parse the GOOGLE_SERVICE_ACCOUNT secret, or null if missing/invalid. */
export function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

// --- Sending -----------------------------------------------------------------

export interface SendResult {
  token: string;
  success: boolean;
  error?: string;
}

/**
 * Send a DATA-ONLY, high-priority FCM v1 message to a single device token.
 * All values in [data] must be strings (FCM data payloads are string maps).
 */
export async function sendDataMessage(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  data: Record<string, string>,
): Promise<SendResult> {
  const fcmPayload = {
    message: {
      token: deviceToken,
      // NOTE: no `notification` block — data-only so the app's background
      // isolate handles presentation (CallKit / flutter_local_notifications).
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high' as const },
      // iOS is deferred (no apns tokens registered yet). A background push (for
      // when iOS lands) must use apns-priority 5; calls will ultimately need a
      // dedicated VoIP/PushKit push, not this one.
      apns: {
        headers: { 'apns-priority': '5', 'apns-push-type': 'background' },
        payload: { aps: { 'content-available': 1 } },
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
    },
  );
  const responseData = await response.json();
  if (response.ok) {
    return { token: deviceToken, success: true };
  }
  const errorCode = responseData.error?.details?.[0]?.errorCode ??
    responseData.error?.status ?? 'UNKNOWN';
  return { token: deviceToken, success: false, error: errorCode };
}

/**
 * Fan a data-only message out to every active native device token of [userIds],
 * pruning tokens FCM reports as permanently invalid. Returns per-token results.
 */
export async function pushToUsers(
  supabase: SupabaseClient,
  serviceAccount: ServiceAccount,
  userIds: string[],
  data: Record<string, string>,
): Promise<SendResult[]> {
  if (userIds.length === 0) return [];

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('device_token')
    .in('user_id', userIds)
    .in('platform', ['android', 'ios'])
    .eq('is_active', true)
    .not('device_token', 'is', null);
  if (error) throw error;
  if (!subscriptions?.length) return [];

  const accessToken = await getFcmAccessToken(serviceAccount);
  const results: SendResult[] = [];
  const invalidTokens: string[] = [];

  for (const sub of subscriptions) {
    const token = sub.device_token as string | null;
    if (!token) continue;
    try {
      const result = await sendDataMessage(
        accessToken,
        serviceAccount.project_id,
        token,
        data,
      );
      results.push(result);
      if (!result.success && (result.error === 'UNREGISTERED' || result.error === 'INVALID_ARGUMENT')) {
        invalidTokens.push(token);
      }
    } catch (err) {
      results.push({ token, success: false, error: String(err) });
    }
  }

  if (invalidTokens.length > 0) {
    await supabase.from('push_subscriptions').delete().in('device_token', invalidTokens);
  }
  return results;
}

/** Service-role Supabase client (bypasses RLS) for server-owned reads/writes. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
