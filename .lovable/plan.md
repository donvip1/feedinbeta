

# Plan: Upgrade to FCM HTTP v1 API

## Background

Firebase has fully deprecated the Legacy FCM API for new projects. The current `send-fcm-push` edge function uses the legacy endpoint (`https://fcm.googleapis.com/fcm/send`) which won't work with new Firebase projects.

**FCM HTTP v1** requires:
- A **service account JSON** file (not a simple server key)
- **OAuth2 authentication** to get a short-lived access token
- A different API endpoint and payload structure

## Changes Required

### 1. Update Edge Function for FCM v1

Replace the legacy API calls with FCM HTTP v1:

| Aspect | Legacy (Current) | HTTP v1 (New) |
|--------|------------------|---------------|
| **Auth** | `key=SERVER_KEY` header | OAuth2 Bearer token from service account |
| **Endpoint** | `fcm.googleapis.com/fcm/send` | `fcm.googleapis.com/v1/projects/{project}/messages:send` |
| **Payload** | `to: device_token` | `message.token: device_token` |
| **Secret** | `FCM_SERVER_KEY` (string) | `GOOGLE_SERVICE_ACCOUNT` (JSON) |

### 2. Implementation Details

The updated edge function will:

1. **Parse the service account JSON** from environment variable
2. **Generate a JWT** signed with the service account private key
3. **Exchange JWT for access token** via Google OAuth2
4. **Call FCM v1 API** with the access token

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FCM v1 Authentication Flow                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Service Account JSON (stored as secret)                     │
│     └── Contains: project_id, private_key, client_email         │
│                                                                 │
│  2. Create JWT                                                  │
│     └── Sign with private_key, include scope for FCM            │
│                                                                 │
│  3. Exchange JWT → Access Token                                 │
│     └── POST to oauth2.googleapis.com/token                     │
│                                                                 │
│  4. Send Push via FCM v1                                        │
│     └── POST to fcm.googleapis.com/v1/projects/{id}/messages    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. New FCM v1 Payload Structure

```typescript
// FCM v1 format (per device)
{
  message: {
    token: "device_fcm_token",
    notification: {
      title: "New message",
      body: "You have a new notification"
    },
    data: {
      // Custom data
    },
    android: {
      priority: "high",
      notification: {
        channel_id: "feedin_default",
        sound: "default"
      }
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1
        }
      }
    }
  }
}
```

## Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/send-fcm-push/index.ts` | Complete rewrite for FCM v1 API |

## What You Need to Provide

### Getting the Service Account JSON:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file

### Adding as a Secret:

Once you have the JSON file, I'll help you add it as a secret called `GOOGLE_SERVICE_ACCOUNT`. The entire JSON content will be stored securely and used by the edge function to authenticate with Google.

## Technical Implementation

The edge function will include:

1. **JWT generation** using Deno's crypto APIs to sign with RS256
2. **Token caching** - Access tokens are valid for 1 hour, so we can cache them
3. **Error handling** for token expiration, invalid tokens, and API errors
4. **Automatic cleanup** of unregistered device tokens

## Summary

This upgrade ensures compatibility with new Firebase projects while maintaining all existing functionality. The only difference from the user's perspective is providing a service account JSON file instead of a server key.

