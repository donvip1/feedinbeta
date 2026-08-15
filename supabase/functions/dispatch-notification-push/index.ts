// Server-owned worker for durable gift/social notification delivery.

import {
  corsHeaders,
  getFcmAccessToken,
  isPermanentlyInvalidFcmToken,
  loadServiceAccount,
  type SendResult,
  sendDataMessage,
  serviceClient,
} from '../_shared/fcm.ts';

export interface NotificationOutboxRow {
  notification_id: string;
  user_id: string;
  event_type: string;
  route: string;
  payload: Record<string, unknown>;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  route: string | null;
  data: Record<string, unknown>;
  fcm_payload: Record<string, unknown>;
}

export type NotificationPreferences = Record<string, boolean | null | undefined>;

export interface NotificationDelivery {
  outbox: NotificationOutboxRow;
  notification: NotificationRow;
  preferences: NotificationPreferences | null;
  tokens: string[];
}

export interface DispatchDependencies {
  send(token: string, data: Record<string, string>): Promise<SendResult>;
  deactivateTokens(tokens: string[]): Promise<void>;
  markDelivered(notificationId: string): Promise<void>;
  markFailed(notificationId: string, error: string): Promise<void>;
}

export interface DispatchResult {
  status: 'delivered' | 'failed';
  sent?: number;
  invalidTokens?: number;
  skipped?: 'preference_disabled' | 'no_tokens';
  error?: string;
}

const preferenceColumns: Record<string, string> = {
  gift: 'gifts_enabled',
  like: 'likes_enabled',
  comment: 'comments_enabled',
  reply: 'replies_enabled',
  mention: 'mentions_enabled',
  tag: 'mentions_enabled',
  follow: 'follows_enabled',
  message: 'messages_enabled',
  friend_request: 'friend_requests_enabled',
  story: 'stories_enabled',
  badge: 'badges_enabled',
};

export function isPushAllowed(
  type: string,
  preferences: NotificationPreferences | null,
): boolean {
  if (!preferences) return true;
  if (preferences.push_enabled === false) return false;
  const column = preferenceColumns[type.toLowerCase()];
  return column ? preferences[column] !== false : true;
}

function addStringValues(
  target: Record<string, string>,
  source: Record<string, unknown> | null | undefined,
): void {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') target[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') {
      target[key] = String(value);
    }
  }
}

export function notificationData(delivery: NotificationDelivery): Record<string, string> {
  const data: Record<string, string> = {};
  addStringValues(data, delivery.notification.data);
  addStringValues(data, delivery.notification.fcm_payload);
  addStringValues(data, delivery.outbox.payload);
  data.type = delivery.outbox.event_type || delivery.notification.type;
  data.notification_id = delivery.notification.id;
  data.title = delivery.notification.title;
  data.body = delivery.notification.message ?? '';
  if (!data.route) data.route = delivery.outbox.route || delivery.notification.route || '';
  if (delivery.notification.related_id && !data.related_id) {
    data.related_id = delivery.notification.related_id;
  }
  return data;
}

export async function dispatchNotification(
  delivery: NotificationDelivery,
  dependencies: DispatchDependencies,
): Promise<DispatchResult> {
  const notificationId = delivery.outbox.notification_id;
  if (!isPushAllowed(delivery.outbox.event_type, delivery.preferences)) {
    await dependencies.markDelivered(notificationId);
    return { status: 'delivered', sent: 0, skipped: 'preference_disabled' };
  }

  const tokens = [...new Set(delivery.tokens.filter(Boolean))];
  if (tokens.length === 0) {
    await dependencies.markDelivered(notificationId);
    return { status: 'delivered', sent: 0, skipped: 'no_tokens' };
  }

  const data = notificationData(delivery);
  const results: SendResult[] = [];
  for (const token of tokens) {
    try {
      results.push(await dependencies.send(token, data));
    } catch (error) {
      results.push({ token, success: false, error: String(error) });
    }
  }

  const invalidTokens = results
    .filter((result) => !result.success && isPermanentlyInvalidFcmToken(result.error))
    .map((result) => result.token);
  if (invalidTokens.length > 0) await dependencies.deactivateTokens(invalidTokens);

  const retryableFailures = results.filter((result) =>
    !result.success && !isPermanentlyInvalidFcmToken(result.error)
  );
  const sent = results.filter((result) => result.success).length;
  if (retryableFailures.length > 0) {
    const error = retryableFailures.map((result) => result.error ?? 'UNKNOWN').join(', ');
    await dependencies.markFailed(notificationId, error);
    return { status: 'failed', sent, invalidTokens: invalidTokens.length, error };
  }

  await dependencies.markDelivered(notificationId);
  return { status: 'delivered', sent, invalidTokens: invalidTokens.length };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

if (import.meta.main) {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
      const body = await request.json().catch(() => ({}));
      const requestedId = typeof body.outbox_id === 'string' ? body.outbox_id : null;
      const supabase = serviceClient();
      const serviceAccount = loadServiceAccount();
      let accessTokenPromise: Promise<string> | null = null;
      const { data: claimed, error: claimError } = await supabase.rpc(
        'claim_notification_delivery_outbox',
        { p_notification_id: requestedId, p_limit: requestedId ? 1 : 20 },
      );
      if (claimError) throw claimError;
      if (!claimed?.length) return json({ success: true, processed: 0, results: [] });

      const results: Array<DispatchResult & { notificationId: string }> = [];

      for (const rawOutbox of claimed as NotificationOutboxRow[]) {
        const notificationId = rawOutbox.notification_id;
        const [{ data: notification, error: notificationError }, preferenceResult, tokenResult] =
          await Promise.all([
            supabase.from('notifications').select(
              'id,user_id,type,title,message,related_id,route,data,fcm_payload',
            ).eq('id', notificationId).maybeSingle(),
            supabase.from('notification_preferences').select('*')
              .eq('user_id', rawOutbox.user_id).maybeSingle(),
            supabase.from('push_subscriptions').select('device_token')
              .eq('user_id', rawOutbox.user_id)
              .in('platform', ['android', 'ios'])
              .eq('is_active', true)
              .not('device_token', 'is', null),
          ]);

        const markFailed = async (id: string, error: string) => {
          const { error: updateError } = await supabase.from('notification_delivery_outbox').update({
            status: 'failed',
            last_error: error.slice(0, 1000),
            available_at: new Date(Date.now() + 60_000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('notification_id', id);
          if (updateError) throw updateError;
        };

        if (notificationError || preferenceResult.error || tokenResult.error || !notification) {
          const error = String(
            notificationError ?? preferenceResult.error ?? tokenResult.error ??
              'Notification row not found',
          );
          await markFailed(notificationId, error);
          results.push({ notificationId, status: 'failed', error });
          continue;
        }

        const dependencies: DispatchDependencies = {
          send: async (token, data) => {
            if (!serviceAccount) throw new Error('FCM not configured');
            accessTokenPromise ??= getFcmAccessToken(serviceAccount);
            return await sendDataMessage(
              await accessTokenPromise,
              serviceAccount.project_id,
              token,
              data,
            );
          },
          deactivateTokens: async (tokens) => {
            const { error } = await supabase.from('push_subscriptions').update({
              is_active: false,
              updated_at: new Date().toISOString(),
            }).in('device_token', tokens);
            if (error) throw error;
          },
          markDelivered: async (id) => {
            const now = new Date().toISOString();
            const { error } = await supabase.from('notification_delivery_outbox').update({
              status: 'delivered',
              delivered_at: now,
              last_error: null,
              updated_at: now,
            }).eq('notification_id', id);
            if (error) throw error;
          },
          markFailed,
        };

        try {
          const result = await dispatchNotification({
            outbox: rawOutbox,
            notification: notification as NotificationRow,
            preferences: preferenceResult.data as NotificationPreferences | null,
            tokens: (tokenResult.data ?? [])
              .map((row) => row.device_token as string | null)
              .filter((token): token is string => Boolean(token)),
          }, dependencies);
          results.push({ notificationId, ...result });
        } catch (error) {
          const message = String(error);
          await markFailed(notificationId, message);
          results.push({ notificationId, status: 'failed', error: message });
        }
      }

      return json({
        success: results.every((result) => result.status === 'delivered'),
        processed: results.length,
        results,
      });
    } catch (error) {
      console.error('[dispatch-notification-push]', error);
      return json({ error: String(error) }, 500);
    }
  });
}
