# Native push + background calls (Module 2) — server side

Two **data-only** FCM senders power the native app's killed/background
notifications:

| Function | Trigger (client-invoke) | Sends to | Data payload |
|---|---|---|---|
| `send-call-push` | caller's app, right after inserting the pending `call_logs` row (`CallsRemoteDataSource.startCall`) | the call's `receiver_id` | `{ type: call, call_id, caller_name, caller_avatar?, call_type }` |
| `send-message-push` | sender's app, right after the message insert (`SyncService._replayMessage`) | other `conversation_participants` | `{ type: message, conversation_id, sender_name, body, message_id }` |

Both share `_shared/fcm.ts` (OAuth2 token minting + data-only FCM v1 send +
token pruning). They send **data-only** messages (no `notification` block) on
purpose: that's what makes Android deliver them to the Flutter background isolate
(`feedinFirebaseBackgroundHandler`), which presents the CallKit incoming-call UI
and the rich, grouped message notifications. The Dart contract lives in
`native/flutter/lib/src/core/notifications/push_notification_service.dart`.

## Auth model
`verify_jwt = true`. The invoking client's user JWT is verified; each function
re-checks that the caller **owns** the call/message (`caller_id` / `sender_id`
must equal the authenticated user) before sending. DB reads use the service-role
key (bypasses RLS).

## Deploy
Secrets — `GOOGLE_SERVICE_ACCOUNT` is **already set** (used by `send-fcm-push`);
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

```bash
supabase functions deploy send-call-push
supabase functions deploy send-message-push
# _shared/fcm.ts is bundled automatically as a local import.
```

No new migrations or Postgres extensions are required — triggering is
client-side (mirrors how the web app invokes `send-call-notification`).

## Notes / follow-ups
- **Android only** today. iOS needs APNs (calls specifically need VoIP/PushKit —
  a regular background push won't launch CallKit); the client also only
  registers `platform: 'android'` tokens today. The `apns` block in
  `_shared/fcm.ts` is a valid-but-inert placeholder until then.
- **Robustness:** if a client dies between the DB write and the invoke, no push
  is sent. A future hardening is a `pg_net` AFTER INSERT trigger calling these
  same functions server-side (chosen against for now — no `pg_net` precedent in
  this repo and it needs a Vault-stored service key).
