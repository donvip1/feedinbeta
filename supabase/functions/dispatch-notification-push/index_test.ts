import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildDataMessagePayload } from '../_shared/fcm.ts';
import {
  dispatchNotification,
  type DispatchDependencies,
  type NotificationDelivery,
} from './index.ts';

const delivery: NotificationDelivery = {
  outbox: {
    notification_id: 'notification-1',
    user_id: 'user-1',
    event_type: 'gift',
    route: '/posts/post-1',
    payload: {
      type: 'gift',
      route: 'post:post-1',
      gift_record_id: 'gift-1',
    },
  },
  notification: {
    id: 'notification-1',
    user_id: 'user-1',
    type: 'gift',
    title: 'New post gift',
    message: 'Ada sent a Pulse Heart on your post.',
    related_id: 'post-1',
    route: '/posts/post-1',
    data: { gift_key: 'pulse-heart' },
    fcm_payload: {},
  },
  preferences: {
    push_enabled: true,
    gifts_enabled: true,
  },
  tokens: ['token-1'],
};

function dependencies(overrides: Partial<DispatchDependencies> = {}) {
  const calls = {
    sent: [] as Array<{ token: string; data: Record<string, string> }>,
    deactivated: [] as string[],
    delivered: 0,
    failed: [] as string[],
  };
  const deps: DispatchDependencies = {
    send: async (token, data) => {
      calls.sent.push({ token, data });
      return { token, success: true };
    },
    deactivateTokens: async (tokens) => calls.deactivated.push(...tokens),
    markDelivered: async () => {
      calls.delivered += 1;
    },
    markFailed: async (_notificationId, error) => calls.failed.push(error),
    ...overrides,
  };
  return { calls, deps };
}

Deno.test('preference rejection completes without contacting FCM', async () => {
  const { calls, deps } = dependencies();
  const result = await dispatchNotification({
    ...delivery,
    preferences: { push_enabled: true, gifts_enabled: false },
  }, deps);

  assertEquals(result, { status: 'delivered', sent: 0, skipped: 'preference_disabled' });
  assertEquals(calls.sent, []);
  assertEquals(calls.delivered, 1);
});

Deno.test('no active device token is a successful delivery', async () => {
  const { calls, deps } = dependencies();
  const result = await dispatchNotification({ ...delivery, tokens: [] }, deps);

  assertEquals(result, { status: 'delivered', sent: 0, skipped: 'no_tokens' });
  assertEquals(calls.delivered, 1);
  assertEquals(calls.failed, []);
});

Deno.test('permanently invalid tokens are deactivated and do not fail delivery', async () => {
  const { calls, deps } = dependencies({
    send: async (token) => ({ token, success: false, error: 'UNREGISTERED' }),
  });
  const result = await dispatchNotification(delivery, deps);

  assertEquals(result, { status: 'delivered', sent: 0, invalidTokens: 1 });
  assertEquals(calls.deactivated, ['token-1']);
  assertEquals(calls.delivered, 1);
  assertEquals(calls.failed, []);
});

Deno.test('transient FCM failures leave the outbox retryable', async () => {
  const { calls, deps } = dependencies({
    send: async (token) => ({ token, success: false, error: 'UNAVAILABLE' }),
  });
  const result = await dispatchNotification(delivery, deps);

  assertEquals(result.status, 'failed');
  assertEquals(calls.delivered, 0);
  assertEquals(calls.failed.length, 1);
});

Deno.test('FCM envelope is high-priority and data-only', () => {
  const payload = buildDataMessagePayload('device-token', {
    type: 'gift',
    notification_id: 'notification-1',
    route: 'post:post-1',
  });

  assertEquals(payload.message.token, 'device-token');
  assertEquals(payload.message.android.priority, 'high');
  assertEquals(payload.message.data.click_action, 'FLUTTER_NOTIFICATION_CLICK');
  assertEquals('notification' in payload.message, false);
});
