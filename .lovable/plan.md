
# Plan: Add Sentry Crash Reporting & FCM Push Notifications for Android

## Overview

This plan implements two critical production features for the Android app:
1. **Sentry** - Real-time crash reporting and error tracking
2. **FCM** - Firebase Cloud Messaging for native push notifications

Both features integrate with the existing Lovable Cloud backend without requiring Firebase as a database.

---

## Part 1: Sentry Integration

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/sentry.ts` | Create | Sentry configuration and initialization |
| `src/App.tsx` | Modify | Initialize Sentry on app startup |
| `src/components/shared/ErrorBoundary.tsx` | Modify | Report caught errors to Sentry |
| `package.json` | Modify | Add @sentry/react dependency |

### Implementation

#### 1.1 Install Sentry SDK
Add to package.json:
```json
"@sentry/react": "^8.0.0"
```

#### 1.2 Create Sentry Configuration (`src/lib/sentry.ts`)
```typescript
import * as Sentry from '@sentry/react';

export function initSentry() {
  // Only initialize in production
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1, // 10% of transactions for performance
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
    });
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  console.error('[Sentry] Capturing exception:', error.message);
  Sentry.captureException(error, { extra: context });
}

export function setUser(userId: string, email?: string, username?: string) {
  Sentry.setUser({ id: userId, email, username });
}

export function clearUser() {
  Sentry.setUser(null);
}
```

#### 1.3 Modify App.tsx
Add Sentry initialization in the useEffect:
```typescript
import { initSentry } from '@/lib/sentry';

// Inside App component, at the start of useEffect:
useEffect(() => {
  // Initialize Sentry for crash reporting
  initSentry();
  
  // ... rest of existing code
}, []);
```

#### 1.4 Update ErrorBoundary
Report caught errors to Sentry:
```typescript
import { captureException } from '@/lib/sentry';

// In componentDidCatch:
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  captureException(error, { componentStack: errorInfo.componentStack });
}
```

#### 1.5 User Needs to Provide
- Sentry DSN (from sentry.io project settings)
- Store as `VITE_SENTRY_DSN` in environment

---

## Part 2: FCM Push Notifications

### Current State
- `@capacitor/push-notifications` already installed
- `NativeAppManager` already registers tokens
- VAPID keys configured for web push
- `push_subscriptions` table exists

### What Needs to Be Added

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/native-app-manager.ts` | Modify | Save FCM tokens to database |
| `supabase/functions/send-fcm-push/index.ts` | Create | Edge function to send FCM notifications |
| Database | Modify | Add `device_token` and `platform` columns to push_subscriptions |

### Implementation

#### 2.1 Database Migration
Add columns for native device tokens:
```sql
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_token TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web';
```

#### 2.2 Modify NativeAppManager Token Saving
Update `savePushToken` to store in database:
```typescript
private async savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    // Store FCM token in push_subscriptions table
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      device_token: token,
      platform: this.platform,
      endpoint: `fcm:${token}`, // Unique identifier
      p256dh: '',
      auth: '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;
    console.log('[NativeAppManager] FCM token saved to database');
  } catch (error) {
    console.warn('[NativeAppManager] Failed to save FCM token:', error);
  }
}
```

#### 2.3 Create FCM Edge Function
```typescript
// supabase/functions/send-fcm-push/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');

Deno.serve(async (req) => {
  const { user_id, title, body, data } = await req.json();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get device tokens for user
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('device_token, platform')
    .eq('user_id', user_id)
    .in('platform', ['android', 'ios']);

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ error: 'No device tokens' }), { status: 404 });
  }

  // Send to each device
  for (const sub of subscriptions) {
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: sub.device_token,
        notification: { title, body },
        data,
      }),
    });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

#### 2.4 User Needs to Provide
- Firebase project `google-services.json` (place in `android/app/`)
- FCM Server Key (store as `FCM_SERVER_KEY` secret in Lovable Cloud)

---

## Part 3: Android Build Configuration

### Files to Modify for Production

| File | Change |
|------|--------|
| `capacitor.config.ts` | Comment out `server` block for production |
| `android/app/google-services.json` | Add Firebase config (after export to GitHub) |

### Production capacitor.config.ts
```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.f7064a339a9346e59524cff96641637c',
  appName: 'feedinbeta',
  webDir: 'dist',
  // PRODUCTION: Comment out server block
  // server: {
  //   url: 'https://f7064a33-9a93-46e5-9524-cff96641637c.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    // ... existing config
  },
};
```

---

## Summary of User Actions Required

### Sentry Setup:
1. Create account at sentry.io (free tier available)
2. Create a React project
3. Copy the DSN from project settings
4. Add `VITE_SENTRY_DSN` to environment (can be public)

### FCM Setup:
1. Create Firebase project at console.firebase.google.com
2. Add Android app with package ID: `app.lovable.f7064a339a9346e59524cff96641637c`
3. Download `google-services.json`
4. After GitHub export, place in `android/app/` folder
5. Get FCM Server Key from Firebase Console
6. Add `FCM_SERVER_KEY` as secret in Lovable Cloud

### Build Commands:
```bash
git pull
npm install
npm run build
npx cap sync android
npx cap open android
# In Android Studio: Build → Generate Signed Bundle/APK
```

---

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FeedIn Production Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │   Android App    │     │     Sentry.io    │                  │
│  │  (Capacitor)     │────▶│  Crash Reports   │                  │
│  │                  │     │  Error Tracking  │                  │
│  └────────┬─────────┘     └──────────────────┘                  │
│           │                                                     │
│           │ FCM Token                                           │
│           ▼                                                     │
│  ┌──────────────────┐                                           │
│  │  Lovable Cloud   │                                           │
│  │  (Supabase)      │                                           │
│  │                  │                                           │
│  │  ┌────────────┐  │     ┌──────────────────┐                  │
│  │  │push_subs   │  │     │   Firebase FCM   │                  │
│  │  │table       │  │────▶│  Push Gateway    │                  │
│  │  └────────────┘  │     │  (HTTP API only) │                  │
│  │                  │     └────────┬─────────┘                  │
│  │  ┌────────────┐  │              │                            │
│  │  │send-fcm-   │  │              │                            │
│  │  │push func   │──┼──────────────┘                            │
│  │  └────────────┘  │                                           │
│  └──────────────────┘              │                            │
│                                    ▼                            │
│                           Push Notification                     │
│                           to Android Device                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Note: Firebase is used ONLY for its push notification gateway (FCM). 
All data, auth, and business logic remain in Lovable Cloud.
