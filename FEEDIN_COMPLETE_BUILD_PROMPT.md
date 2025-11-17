# 🚀 FEEDIN - Complete Application Build Prompt

## 📋 Executive Summary

Build a comprehensive social media platform called **FEEDIN** with real-time interactions, AI-powered features, live streaming, private messaging, video/voice calling, and premium subscription capabilities. The app should be a Progressive Web App (PWA) ready for mobile conversion.

---

## 🎯 Application Overview

**Name:** FEEDIN  
**Tagline:** Connect, Share, and Engage with AI-Powered Social Experiences  
**Type:** Social Media Platform

### Core Features
1. **Social Feed** - Post text, images, videos with nested comments
2. **Stories** - 24-hour ephemeral content with view tracking
3. **Real-time Messaging** - Private chats with typing indicators
4. **Video/Voice Calls** - Crystal-clear 1-on-1 calls
5. **Live Streaming** - Broadcast live with real-time comments
6. **Friends System** - Send/accept requests, manage friendships
7. **Groups** - Create and join communities
8. **AI Features** - Copilot assistant, image generation
9. **Credits System** - Virtual currency for premium features
10. **Premium Subscriptions** - Multiple tiers with benefits

---

## 💻 Technology Stack

### Frontend
- **Framework:** React 18.3 with Vite
- **Language:** TypeScript
- **Routing:** React Router v6.30
- **Styling:** Tailwind CSS with semantic tokens
- **UI Components:** shadcn/ui (Radix UI primitives)
- **State Management:** React Query (TanStack Query)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

### Backend (Lovable Cloud / Supabase)
- **Database:** PostgreSQL 15+
- **Authentication:** Email/password, OAuth
- **Storage:** File uploads for media
- **Real-time:** WebSocket subscriptions
- **Serverless:** Edge Functions (Deno runtime)

### Third-Party Integrations
- **Payments:** Stripe
- **Video Calls:** Daily.co
- **AI:** Lovable AI (Google Gemini + OpenAI GPT-5)

---

## 🎨 Design System

### Color Scheme
Use HSL color tokens defined in `index.css`:

**Light Mode:**
- `--background: 220 25% 98%` - Main background
- `--foreground: 220 15% 10%` - Text color
- `--primary: 230 85% 60%` - Primary brand color (blue)
- `--primary-glow: 245 75% 70%` - Lighter primary variant
- `--accent: 280 70% 65%` - Accent color (purple)
- `--card: 0 0% 100%` - Card backgrounds
- `--muted: 220 15% 92%` - Muted surfaces
- `--border: 220 15% 88%` - Border color

**Dark Mode:**
- `--background: 220 20% 8%` - Dark background
- `--foreground: 220 15% 98%` - Light text
- `--card: 220 18% 12%` - Dark card backgrounds
- `--muted: 220 15% 18%` - Dark muted surfaces
- `--border: 220 15% 20%` - Dark borders

### Gradients
```css
--gradient-primary: linear-gradient(135deg, hsl(230, 85%, 60%), hsl(245, 75%, 70%))
--gradient-accent: linear-gradient(135deg, hsl(230, 85%, 60%), hsl(280, 70%, 65%))
--gradient-subtle: linear-gradient(180deg, hsl(220, 25%, 98%), hsl(220, 20%, 96%))
```

### Shadows
```css
--shadow-elegant: 0 10px 30px -10px hsl(230 85% 60% / 0.25)
--shadow-glow: 0 0 40px hsl(245 75% 70% / 0.3)
```

### Typography
- Use Tailwind's built-in font system
- Antialiased text rendering
- Responsive font sizes with Tailwind utilities

### Component Styling Rules
- **NEVER use direct colors** like `text-white`, `bg-black`, `text-blue-500`
- **ALWAYS use semantic tokens** from the design system
- Use `bg-background`, `text-foreground`, `bg-card`, etc.
- Ensure proper contrast in both light and dark modes

---

## 🗂️ Project Structure

```
feedin/
├── public/
│   ├── favicon.png
│   ├── manifest.json
│   ├── robots.txt
│   ├── service-worker.js
│   └── offline.html
│
├── src/
│   ├── main.tsx                    # Entry point with service worker
│   ├── App.tsx                     # Root with routing & providers
│   ├── index.css                   # Design system tokens
│   ├── vite-env.d.ts              # Type definitions
│   │
│   ├── assets/
│   │   ├── feedin-logo.png
│   │   └── feedin-watermark.png
│   │
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ... (all shadcn components)
│   │   │
│   │   ├── auth/
│   │   │   ├── SignInForm.tsx
│   │   │   ├── SignUpForm.tsx
│   │   │   └── ForgotPasswordForm.tsx
│   │   │
│   │   ├── feed/
│   │   │   ├── PostCard.tsx
│   │   │   ├── CreatePostModal.tsx
│   │   │   ├── EnhancedCreatePostModal.tsx
│   │   │   ├── PostDetailsModal.tsx
│   │   │   ├── PostEditorModal.tsx
│   │   │   ├── CommentItem.tsx
│   │   │   ├── CommentsModal.tsx
│   │   │   ├── ReactionPicker.tsx
│   │   │   ├── EmojiPicker.tsx
│   │   │   ├── MediaGalleryPicker.tsx
│   │   │   ├── CameraCapture.tsx
│   │   │   ├── ImageCropper.tsx
│   │   │   ├── VoiceOverRecorder.tsx
│   │   │   ├── AIImageGenerator.tsx
│   │   │   ├── AIMusicSuggester.tsx
│   │   │   ├── MusicLibrary.tsx
│   │   │   ├── TextToImageCreator.tsx
│   │   │   ├── UserMentionPicker.tsx
│   │   │   ├── QuickActionsModal.tsx
│   │   │   └── CreatePostMethodSelector.tsx
│   │   │
│   │   ├── stories/
│   │   │   ├── StoriesBar.tsx
│   │   │   ├── StoryCircle.tsx
│   │   │   ├── StoryViewer.tsx
│   │   │   └── CreateStoryModal.tsx
│   │   │
│   │   ├── messages/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── EnhancedChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── EnhancedMessageBubble.tsx
│   │   │   ├── NewConversationModal.tsx
│   │   │   ├── TypingIndicator.tsx
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── WaveformPlayer.tsx
│   │   │   └── UserMentionInput.tsx
│   │   │
│   │   ├── calls/
│   │   │   ├── CallControls.tsx
│   │   │   └── IncomingCall.tsx
│   │   │
│   │   ├── live/
│   │   │   ├── LiveStreamCard.tsx
│   │   │   ├── LiveStreamViewer.tsx
│   │   │   └── CreateLiveStreamModal.tsx
│   │   │
│   │   ├── groups/
│   │   │   └── CreateGroupModal.tsx
│   │   │
│   │   ├── profile/
│   │   │   ├── ProfileSettings.tsx
│   │   │   └── ProfilePreviewModal.tsx
│   │   │
│   │   ├── notifications/
│   │   │   ├── NotificationBell.tsx
│   │   │   ├── NotificationsPanel.tsx
│   │   │   ├── NotificationItem.tsx
│   │   │   └── NotificationPreferences.tsx
│   │   │
│   │   ├── navigation/
│   │   │   └── BottomNav.tsx
│   │   │
│   │   ├── moderation/
│   │   │   └── ReportContentModal.tsx
│   │   │
│   │   ├── settings/
│   │   │   └── CacheSettings.tsx
│   │   │
│   │   └── shared/
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingScreen.tsx
│   │       ├── SkeletonLoader.tsx
│   │       ├── ThemeToggle.tsx
│   │       ├── NetworkError.tsx
│   │       ├── UpdateNotification.tsx
│   │       └── ImageShareModal.tsx
│   │
│   ├── pages/
│   │   ├── Index.tsx              # Landing page
│   │   ├── Auth.tsx               # Sign in/up page
│   │   ├── Feed.tsx               # Main feed
│   │   ├── Messages.tsx           # Chat list
│   │   ├── Friends.tsx            # Friends management
│   │   ├── Profile.tsx            # User profile
│   │   ├── Call.tsx               # Video/voice call
│   │   ├── CallHistory.tsx        # Call logs
│   │   ├── Live.tsx               # Live streams
│   │   ├── AICopilot.tsx          # AI assistant
│   │   ├── ThesisWriter.tsx       # AI thesis writer
│   │   ├── VideoCreation.tsx      # AI video creator
│   │   ├── EducationalQA.tsx      # Educational Q&A
│   │   ├── ProjectWriting.tsx     # Project writing tool
│   │   ├── ImageGeneration.tsx    # AI image generator
│   │   ├── ImageEnhancement.tsx   # Image enhancement
│   │   ├── Groups.tsx             # Groups list
│   │   ├── GroupDetail.tsx        # Group detail page
│   │   ├── Subscription.tsx       # Subscription plans
│   │   ├── Credits.tsx            # Credits purchase
│   │   ├── SavedPosts.tsx         # Saved posts
│   │   ├── Promote.tsx            # Post promotion
│   │   ├── Moderation.tsx         # Moderation dashboard
│   │   ├── Settings.tsx           # Settings hub
│   │   ├── AccountSettings.tsx    # Account settings
│   │   ├── PrivacySettings.tsx    # Privacy settings
│   │   ├── NotificationSettings.tsx # Notification settings
│   │   ├── CacheSettingsPage.tsx  # Cache management
│   │   ├── BlockedUsers.tsx       # Blocked users list
│   │   ├── P2PMarketplace.tsx     # P2P credit marketplace
│   │   ├── InitializeGroups.tsx   # Group initialization
│   │   ├── Trending.tsx           # Trending content
│   │   ├── Wallet.tsx             # Wallet management
│   │   └── NotFound.tsx           # 404 page
│   │
│   ├── hooks/
│   │   ├── use-toast.ts
│   │   ├── use-mobile.tsx
│   │   ├── useAuth.tsx
│   │   ├── usePremiumStatus.tsx
│   │   ├── useNetworkStatus.tsx
│   │   ├── usePreferences.tsx
│   │   └── usePresence.tsx
│   │
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── cache-manager.ts
│   │   ├── cookie-manager.ts
│   │   ├── session-manager.ts
│   │   ├── hashtag-utils.ts
│   │   ├── image-optimizer.ts
│   │   ├── media-processor.ts
│   │   └── performance.ts
│   │
│   ├── utils/
│   │   └── callSounds.ts
│   │
│   ├── context/
│   │   └── AuthContext.tsx
│   │
│   └── integrations/
│       └── supabase/
│           ├── client.ts          # Auto-generated
│           └── types.ts           # Auto-generated
│
├── supabase/
│   ├── config.toml                # Auto-generated
│   ├── functions/
│   │   ├── ai-chat/
│   │   ├── ai-image-gen/
│   │   ├── analyze-media-mood/
│   │   ├── calculate-trending/
│   │   ├── credit-deduction/
│   │   ├── daily-credit-bonus/
│   │   ├── moderation-bot/
│   │   ├── p2p-escrow/
│   │   ├── process-hashtags/
│   │   ├── stripe-checkout/
│   │   └── stripe-webhook/
│   │
│   └── migrations/                # Auto-generated
│
├── .env                           # Auto-generated
├── vite.config.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## 🗄️ Database Schema

### Core Tables

#### 1. **profiles**
User profile information
```sql
- id (uuid, primary key, references auth.users)
- username (text, unique)
- display_name (text)
- avatar_url (text)
- bio (text)
- location (text)
- website (text)
- credits (integer, default 0)
- subscription_tier (text)
- is_verified (boolean)
- is_premium (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 2. **posts**
Social media posts
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- feed_id (text)
- content (text)
- media_url (text)
- media_type (text: 'image' | 'video' | null)
- music_url (text)
- music_title (text)
- music_artist (text)
- is_original_audio (boolean)
- aspect_ratio (text)
- has_blur_background (boolean)
- location (text)
- privacy (text: 'public' | 'friends' | 'private')
- allow_comments (boolean)
- allow_refeed (boolean)
- post_type (text)
- status (text: 'active' | 'deleted')
- moderation_status (text)
- scheduled_at (timestamp)
- likes_count (integer, default 0)
- comments_count (integer, default 0)
- shares_count (integer, default 0)
- views_count (integer, default 0)
- refeeds_count (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 3. **post_comments**
Nested comments on posts
```sql
- id (uuid, primary key)
- post_id (uuid, references posts)
- user_id (uuid, references profiles)
- parent_comment_id (uuid, references post_comments, nullable)
- content (text)
- likes_count (integer, default 0)
- replies_count (integer, default 0)
- status (text: 'active' | 'deleted')
- created_at (timestamp)
- updated_at (timestamp)
```

#### 4. **post_likes**
Post likes
```sql
- id (uuid, primary key)
- post_id (uuid, references posts)
- user_id (uuid, references profiles)
- created_at (timestamp)
- UNIQUE(post_id, user_id)
```

#### 5. **stories**
24-hour ephemeral stories
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- media_url (text)
- media_type (text: 'image' | 'video')
- duration (integer, default 5)
- view_count (integer, default 0)
- created_at (timestamp)
- expires_at (timestamp, default now() + 24 hours)
```

#### 6. **story_views**
Track who viewed stories
```sql
- id (uuid, primary key)
- story_id (uuid, references stories)
- viewer_id (uuid, references profiles)
- viewed_at (timestamp)
```

#### 7. **conversations**
Message conversations
```sql
- id (uuid, primary key)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 8. **conversation_participants**
Participants in conversations
```sql
- id (uuid, primary key)
- conversation_id (uuid, references conversations)
- user_id (uuid, references profiles)
- joined_at (timestamp)
- last_read_at (timestamp)
```

#### 9. **messages**
Chat messages
```sql
- id (uuid, primary key)
- conversation_id (uuid, references conversations)
- sender_id (uuid, references profiles)
- content (text)
- media_url (text)
- media_type (text: 'image' | 'video' | 'voice' | null)
- reply_to_id (uuid, references messages, nullable)
- is_read (boolean, default false)
- read_at (timestamp)
- is_pinned (boolean)
- status (text: 'sent' | 'delivered' | 'read')
- edited_at (timestamp)
- deleted_at (timestamp)
- deleted_for_sender (boolean)
- deleted_for_receiver (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 10. **message_reactions**
Message emoji reactions
```sql
- id (uuid, primary key)
- message_id (uuid, references messages)
- user_id (uuid, references profiles)
- emoji (text)
- created_at (timestamp)
```

#### 11. **message_read_receipts**
Message read receipts
```sql
- id (uuid, primary key)
- message_id (uuid, references messages)
- user_id (uuid, references profiles)
- read_at (timestamp)
```

#### 12. **friend_requests**
Friend requests
```sql
- id (uuid, primary key)
- sender_id (uuid, references profiles)
- receiver_id (uuid, references profiles)
- status (text: 'pending' | 'accepted' | 'rejected')
- created_at (timestamp)
- updated_at (timestamp)
```

#### 13. **follows**
User follows
```sql
- id (uuid, primary key)
- follower_id (uuid, references profiles)
- following_id (uuid, references profiles)
- created_at (timestamp)
- UNIQUE(follower_id, following_id)
```

#### 14. **groups**
Community groups
```sql
- id (uuid, primary key)
- created_by (uuid, references profiles)
- name (text)
- description (text)
- avatar_url (text)
- cover_url (text)
- category (text)
- is_private (boolean)
- is_premium (boolean)
- requires_subscription (boolean)
- member_count (integer, default 0)
- post_count (integer, default 0)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 15. **group_members**
Group membership
```sql
- id (uuid, primary key)
- group_id (uuid, references groups)
- user_id (uuid, references profiles)
- role (text: 'admin' | 'moderator' | 'member')
- joined_at (timestamp)
```

#### 16. **live_streams**
Live streaming sessions
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- title (text)
- description (text)
- stream_key (text)
- thumbnail_url (text)
- category (text)
- tags (text[])
- status (text: 'scheduled' | 'live' | 'ended')
- is_premium (boolean)
- viewer_count (integer, default 0)
- peak_viewers (integer)
- scheduled_start (timestamp)
- started_at (timestamp)
- ended_at (timestamp)
- duration (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 17. **call_logs**
Video/voice call history
```sql
- id (uuid, primary key)
- caller_id (uuid, references profiles)
- receiver_id (uuid, references profiles)
- call_type (text: 'audio' | 'video')
- status (text: 'completed' | 'missed' | 'rejected' | 'cancelled')
- room_url (text)
- started_at (timestamp)
- ended_at (timestamp)
- duration (integer)
- created_at (timestamp)
```

#### 18. **notifications**
User notifications
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- from_user_id (uuid, references profiles)
- type (text)
- title (text)
- message (text)
- related_type (text)
- related_id (uuid)
- is_read (boolean, default false)
- created_at (timestamp)
```

#### 19. **credit_transactions**
Credit transaction history
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- type (text: 'purchase' | 'earned' | 'spent' | 'refund')
- amount (integer)
- description (text)
- related_id (uuid)
- stripe_payment_intent_id (text)
- created_at (timestamp)
```

#### 20. **user_subscriptions**
Premium subscriptions
```sql
- id (uuid, primary key)
- user_id (uuid, references profiles)
- tier_id (uuid, references subscription_tiers)
- status (text: 'active' | 'cancelled' | 'expired')
- stripe_subscription_id (text)
- started_at (timestamp)
- expires_at (timestamp)
- created_at (timestamp)
```

#### 21. **subscription_tiers**
Subscription tier definitions
```sql
- id (uuid, primary key)
- name (text: 'Free' | 'Basic' | 'Pro' | 'Premium')
- price (numeric)
- billing_period (text: 'monthly' | 'yearly')
- features (jsonb)
- is_active (boolean)
- created_at (timestamp)
```

#### 22. **blocked_users**
User blocks
```sql
- id (uuid, primary key)
- blocker_id (uuid, references profiles)
- blocked_id (uuid, references profiles)
- reason (text)
- created_at (timestamp)
```

#### 23. **content_reports**
Content moderation reports
```sql
- id (uuid, primary key)
- reporter_id (uuid, references profiles)
- reported_user_id (uuid, references profiles)
- content_id (uuid)
- content_type (text: 'post' | 'comment' | 'message' | 'profile')
- reason (text)
- description (text)
- status (text: 'pending' | 'reviewed' | 'resolved')
- reviewed_by (uuid, references profiles)
- reviewed_at (timestamp)
- resolution_notes (text)
- created_at (timestamp)
```

---

## 🔐 Authentication Flow

### Sign Up Process
1. User enters email, username, display name, password
2. Validate input with Zod schema
3. Call Supabase `signUp` with email/password
4. Auto-confirm email (configured in Supabase)
5. Create profile record with user details
6. Navigate to Feed page
7. Show welcome toast notification

### Sign In Process
1. User enters email/username and password
2. Validate input
3. Call Supabase `signInWithPassword`
4. Store session in Supabase (automatic)
5. Navigate to Feed page

### Auth Context Setup
```typescript
// src/context/AuthContext.tsx
- Creates AuthContext with user, session, loading, signOut
- Listens to auth state changes with onAuthStateChange
- Provides auth state to entire app
- Wraps all routes in App.tsx
```

### Protected Routes
- Check `user` from `useAuth()` hook
- Redirect to `/auth` if not authenticated
- Show loading state while checking auth

### Auto-Confirm Email
- Enable in Supabase settings: `auto_confirm_email = true`
- Users don't need to verify email to use app

---

## 🧩 Core Features Implementation

### 1. Social Feed (`/feed`)

**Components:**
- `Feed.tsx` - Main feed page
- `PostCard.tsx` - Individual post display
- `EnhancedCreatePostModal.tsx` - Post creation modal
- `PostDetailsModal.tsx` - Full post view
- `CommentsModal.tsx` - Comments section
- `CommentItem.tsx` - Individual comment

**Features:**
- Three tabs: "For You", "Following", "My Posts"
- Search functionality for posts
- Like, comment, share, save posts
- Nested comments (Facebook-style)
- Post types: text, image, video
- Media gallery with music
- Voice-over recording
- AI image generation
- Hashtag support
- Location tagging
- Privacy settings (public, friends, private)

**Feed Algorithm (For You Tab):**
- Show posts from all users
- Order by creation date (newest first)
- Future: AI-powered recommendations

**Following Tab:**
- Show only posts from followed users
- Empty state if not following anyone

**My Posts Tab:**
- Show only current user's posts
- Edit and delete options

**Post Creation Flow:**
1. Click "+" button in BottomNav or header
2. Open QuickActionsModal with options
3. Select post type (text, image, video)
4. Open EnhancedCreatePostModal
5. Add content, media, music, location, privacy
6. Optional: Use AI features (image gen, music suggest)
7. Submit post → insert to `posts` table
8. Show in feed immediately (optimistic update)

### 2. Stories (`StoriesBar.tsx`)

**Components:**
- `StoriesBar.tsx` - Horizontal stories bar
- `StoryCircle.tsx` - Individual story circle
- `StoryViewer.tsx` - Full-screen story viewer
- `CreateStoryModal.tsx` - Story creation

**Features:**
- 24-hour ephemeral content
- Image and video stories
- View count tracking
- Swipe to navigate
- Tap to pause/play
- React to stories
- Delete own stories
- Send message to story owner

**Story Viewing Flow:**
1. Click story circle in StoriesBar
2. Open StoryViewer in fullscreen
3. Show progress bar at top
4. Auto-advance after duration
5. Swipe left/right to switch users
6. Mark as viewed in `story_views` table

**Story Creation Flow:**
1. Click "+" in StoriesBar
2. Open CreateStoryModal
3. Upload image/video or use camera
4. Add text, stickers (optional)
5. Set duration (5-15 seconds)
6. Post → insert to `stories` table
7. Expires after 24 hours (automatic)

### 3. Real-time Messaging (`/messages`)

**Components:**
- `Messages.tsx` - Conversation list
- `EnhancedChatInterface.tsx` - Chat interface
- `EnhancedMessageBubble.tsx` - Message bubbles
- `VoiceRecorder.tsx` - Voice message recorder
- `WaveformPlayer.tsx` - Audio playback
- `TypingIndicator.tsx` - Typing status
- `NewConversationModal.tsx` - Start new chat

**Features:**
- One-on-one conversations
- Text, image, video, voice messages
- Message reactions (emojis)
- Reply to messages
- Edit messages (within 15 minutes)
- Delete for everyone / Delete for me
- Message read receipts (✓✓)
- Typing indicators
- User presence (online/offline)
- Search conversations
- Pin messages
- Media gallery view

**Real-time Features:**
- Listen to new messages with Supabase subscriptions
- Show typing indicator when user is typing
- Update read receipts in real-time
- Show online/offline status

**Conversation Flow:**
1. Click "New Chat" button
2. Select friend from list
3. Check if conversation exists
4. If not, create conversation + add participants
5. Navigate to chat interface
6. Send messages → insert to `messages` table
7. Subscribe to real-time updates

**Read Receipts:**
- Single check (✓): Sent
- Double check (✓✓): Delivered
- Colored double check (✓✓): Read

### 4. Video/Voice Calls (`/call`)

**Components:**
- `Call.tsx` - Call interface
- `CallControls.tsx` - Call controls (mute, video, end)
- `IncomingCall.tsx` - Incoming call notification
- `CallHistory.tsx` - Call history list

**Integration:** Daily.co (or 100ms)

**Features:**
- One-on-one calls (audio/video)
- Toggle video on/off
- Toggle audio on/off
- Switch camera (front/back)
- Loudspeaker option
- Call history with duration
- Missed call notifications
- Ringing for online users
- "User unavailable" for offline users

**Call Flow:**
1. Click phone icon on user profile
2. Create call log entry with status "calling"
3. Create Daily.co room (via Edge Function)
4. Send real-time notification to receiver
5. Receiver sees IncomingCall notification
6. If accepted: Join Daily.co room, update status to "connected"
7. If rejected: Update status to "rejected"
8. On end: Calculate duration, update call log

**Call UI:**
- Video feed for both users
- Floating local video (small)
- Remote video (full screen)
- Control buttons at bottom
- Display name and avatar
- Call duration timer

### 5. Live Streaming (`/live`)

**Components:**
- `Live.tsx` - Live streams list
- `LiveStreamCard.tsx` - Stream preview card
- `LiveStreamViewer.tsx` - Full-screen viewer
- `CreateLiveStreamModal.tsx` - Start stream

**Features:**
- Browse active streams
- Filter by category
- View count display
- Real-time comments
- Reactions (hearts, likes)
- Premium streams (subscription required)
- Stream analytics (views, peak viewers, duration)

**Live Stream Flow:**
1. Click "Go Live" button
2. Enter title, description, category, thumbnail
3. Generate stream key (server-side)
4. Start streaming (external tool like OBS)
5. Insert to `live_streams` with status "live"
6. Users can join and watch
7. Real-time comments via Supabase subscriptions
8. End stream → update status to "ended", save duration

**Viewer Experience:**
- Watch stream in fullscreen
- See live viewer count
- Post comments in real-time
- Send reactions (animated hearts)
- Exit stream anytime

### 6. Friends System (`/friends`)

**Features:**
- Send friend requests
- Accept/reject requests
- View friend list
- Remove friends
- Search friends
- View pending requests (sent/received)
- Friend suggestions (mutual friends)

**Friend Request Flow:**
1. Search for user by username
2. Click "Add Friend" button
3. Insert to `friend_requests` with status "pending"
4. Send notification to receiver
5. Receiver sees in Friends page (Requests tab)
6. Accept → create two `follows` entries (mutual)
7. Reject → update status to "rejected"

**Unfriend Flow:**
1. Click "Unfriend" on friend's profile
2. Delete both `follows` entries
3. Update UI immediately

### 7. Groups (`/groups`)

**Components:**
- `Groups.tsx` - Groups list
- `GroupDetail.tsx` - Group detail page
- `CreateGroupModal.tsx` - Create group

**Features:**
- Create public/private groups
- Browse groups by category
- Join/leave groups
- Post in groups
- Group admin controls (kick, ban, delete posts)
- Group member list
- Join requests for private groups

**Group Flow:**
1. Browse groups or search
2. Click "Join" button
3. If public → add to `group_members` immediately
4. If private → create join request, wait for approval
5. Once member → can view and post in group
6. Posts in group have `group_id` set

### 8. AI Features

#### AI Copilot (`/ai-copilot`)
- Chat with AI assistant
- Get recommendations
- Ask questions
- Lovable AI integration (Gemini/GPT-5)

**Implementation:**
- Edge Function: `ai-chat`
- Streaming responses with SSE
- Chat history stored in `ai_chat_messages`

#### AI Image Generation (`/image-generation`)
- Generate images from text prompts
- Use in posts or save to gallery
- Lovable AI (Gemini Flash Image model)

**Implementation:**
- Edge Function: `ai-image-gen`
- Upload generated image to Supabase Storage
- Return URL to client

#### Other AI Tools
- Thesis Writer (`/thesis-writer`)
- Video Creation (`/video-creation`)
- Educational Q&A (`/educational-qa`)
- Project Writing (`/project-writing`)
- Image Enhancement (`/image-enhancement`)

### 9. Credits System (`/credits`)

**Features:**
- Buy credits with Stripe
- Daily credit bonus (login reward)
- Spend credits on premium features
- Transaction history
- P2P credit marketplace (`/p2p-marketplace`)

**Credit Packages:**
- 100 credits: $4.99
- 500 credits: $19.99
- 1000 credits: $34.99
- 5000 credits: $149.99

**Credit Uses:**
- AI image generation (10 credits)
- Promote posts (50 credits)
- Send gifts (5-100 credits)
- Premium group access (20 credits/month)

**Purchase Flow:**
1. Select package on Credits page
2. Click "Buy Now"
3. Stripe Checkout session (Edge Function)
4. Redirect to Stripe payment page
5. Complete payment
6. Webhook updates credits in database
7. Show success toast

### 10. Premium Subscriptions (`/subscription`)

**Tiers:**
- **Free:** 100 friends, 5 groups, basic features
- **Basic ($4.99/mo):** 500 friends, 20 groups, no ads
- **Pro ($9.99/mo):** 2000 friends, 50 groups, priority support
- **Premium ($19.99/mo):** Unlimited, all features, verified badge

**Premium Features:**
- More friends and groups
- No ads
- Priority support
- Verified badge
- Custom themes
- Advanced analytics
- Exclusive content

**Subscription Flow:**
1. Select tier on Subscription page
2. Stripe Checkout (recurring)
3. Webhook creates `user_subscriptions` entry
4. Update profile `is_premium` flag
5. Enable premium features throughout app

---

## 🔄 Real-time Features

### Supabase Subscriptions Setup

**Enable Realtime on Tables:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_comments;
```

**Subscribe to Changes:**
```typescript
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Handle new message
  })
  .subscribe();
```

### Typing Indicators
- Use Supabase presence (broadcast)
- Send typing status to channel
- Listen to other user's typing status
- Show "User is typing..." indicator

### Online Presence
- Track user online status
- Update on activity
- Show online/offline badge on profiles

---

## 🛡️ Moderation & Safety

**Features:**
- Report content (posts, comments, profiles)
- Auto-moderation with AI (Edge Function)
- Admin moderation dashboard (`/moderation`)
- Block/unblock users
- Content filtering (profanity, spam)
- Appeal system for false positives

**Report Flow:**
1. Click "Report" on content
2. Open ReportContentModal
3. Select reason (spam, harassment, etc.)
4. Add optional description
5. Submit → insert to `content_reports`
6. Notify admins
7. Admin reviews in moderation dashboard
8. Take action (remove, warn, ban)

---

## 🎨 UI/UX Guidelines

### Bottom Navigation
- Home (Feed)
- Search (Trending)
- Create Post (+)
- Messages
- Profile

### Header Components
- Logo on left
- Search icon
- Notification bell with badge
- User avatar (profile menu)

### Dark Mode
- Toggle in Settings → Privacy Settings
- Use ThemeToggle component
- Persist preference in localStorage
- Apply `.dark` class to `<html>` element

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Bottom nav on mobile, sidebar on desktop
- Stack cards on mobile, grid on desktop

### Loading States
- Skeleton loaders for initial load
- Spinner for button actions
- Optimistic updates for instant feedback

### Empty States
- Use EmptyState component
- Show helpful message and call-to-action
- Example: "No posts yet. Start following users to see their posts!"

### Toast Notifications
- Success (green): "Post created successfully"
- Error (red): "Failed to send message"
- Info (blue): "New notification"
- Warning (yellow): "Connection lost"

---

## 🚀 Performance Optimizations

### Image Optimization
- Compress images before upload
- Use WebP format
- Lazy load images (Intersection Observer)
- Placeholder blur while loading

### Caching
- Cache user profiles (5 minutes)
- Cache posts in React Query (staleTime: 5 minutes)
- Service worker cache for static assets

### Code Splitting
- Lazy load routes with React.lazy()
- Split heavy components (video player, image editor)

### Infinite Scroll
- Load 20 posts at a time
- Fetch more on scroll bottom
- Use React Query's infinite queries

### Debouncing
- Search input (300ms delay)
- Typing indicators (500ms delay)

---

## 🧪 Testing Checklist

### Authentication
- [ ] Sign up with email/password
- [ ] Sign in with existing account
- [ ] Sign out
- [ ] Stay signed in (session persistence)
- [ ] Redirect to auth page if not logged in

### Feed
- [ ] View posts in "For You" tab
- [ ] View posts in "Following" tab
- [ ] View posts in "My Posts" tab
- [ ] Search posts
- [ ] Create text post
- [ ] Create image post
- [ ] Create video post
- [ ] Like post
- [ ] Comment on post
- [ ] Reply to comment
- [ ] Share post
- [ ] Save post
- [ ] Delete own post

### Stories
- [ ] View stories bar
- [ ] Create story
- [ ] View story (full screen)
- [ ] Navigate between stories
- [ ] React to story
- [ ] Delete own story

### Messages
- [ ] Start new conversation
- [ ] Send text message
- [ ] Send image message
- [ ] Send voice message
- [ ] React to message
- [ ] Reply to message
- [ ] Edit message
- [ ] Delete message
- [ ] See typing indicator
- [ ] See read receipts
- [ ] Real-time message updates

### Calls
- [ ] Initiate voice call
- [ ] Initiate video call
- [ ] Accept incoming call
- [ ] Reject incoming call
- [ ] Toggle mute
- [ ] Toggle video
- [ ] End call
- [ ] View call history

### Live Streams
- [ ] Browse live streams
- [ ] Watch stream
- [ ] Comment on stream
- [ ] Send reactions
- [ ] Create stream (as broadcaster)

### Friends
- [ ] Send friend request
- [ ] Accept friend request
- [ ] Reject friend request
- [ ] Remove friend
- [ ] View friend list
- [ ] Search friends

### Groups
- [ ] Browse groups
- [ ] Join public group
- [ ] Request to join private group
- [ ] Post in group
- [ ] Leave group
- [ ] Create group (as admin)

### Credits & Subscriptions
- [ ] Buy credits with Stripe
- [ ] View transaction history
- [ ] Subscribe to premium plan
- [ ] Cancel subscription

### Settings
- [ ] Update profile (name, bio, avatar)
- [ ] Change password
- [ ] Toggle dark mode
- [ ] Manage notification preferences
- [ ] Block user
- [ ] View blocked users
- [ ] Clear cache

### Moderation
- [ ] Report post
- [ ] Report comment
- [ ] Report user
- [ ] View reports (as admin)
- [ ] Resolve report (as admin)

---

## 🔧 Edge Functions

### 1. **ai-chat** (`/ai-chat`)
- Lovable AI integration
- Streaming chat responses
- Model: google/gemini-2.5-flash

### 2. **ai-image-gen** (`/ai-image-gen`)
- Generate images from text
- Model: google/gemini-2.5-flash-image
- Upload to Supabase Storage

### 3. **stripe-checkout** (`/stripe-checkout`)
- Create Stripe checkout session
- For credits and subscriptions

### 4. **stripe-webhook** (`/stripe-webhook`)
- Handle Stripe webhooks
- Update credits/subscriptions on payment success

### 5. **credit-deduction** (`/credit-deduction`)
- Deduct credits for actions
- Validate user has enough credits

### 6. **daily-credit-bonus** (`/daily-credit-bonus`)
- Give daily login bonus (10 credits)
- Triggered on first login of the day

### 7. **moderation-bot** (`/moderation-bot`)
- Auto-moderate content with AI
- Flag inappropriate posts/comments

### 8. **calculate-trending** (`/calculate-trending`)
- Calculate trending posts
- Based on engagement rate

### 9. **process-hashtags** (`/process-hashtags`)
- Extract hashtags from posts
- Update hashtag counts

### 10. **analyze-media-mood** (`/analyze-media-mood`)
- Analyze sentiment of images/videos
- Used for content recommendations

### 11. **p2p-escrow** (`/p2p-escrow`)
- Handle P2P credit transactions
- Escrow system for safety

---

## 📱 Progressive Web App (PWA)

### PWA Setup
- **manifest.json** in public folder
- **service-worker.js** for offline support
- Icons: 192x192, 512x512
- Theme color and background color
- Display mode: standalone

### Service Worker Features
- Cache static assets (HTML, CSS, JS)
- Cache images and media
- Offline page fallback
- Update notification when new version available

### Install Prompt
- Show "Install App" button on landing page
- Trigger browser's install prompt
- Works on Android and iOS (Safari)

---

## 🎯 Mobile Conversion with Capacitor

### Capacitor Setup
1. Install dependencies:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install @capacitor/ios @capacitor/android
   ```

2. Initialize Capacitor:
   ```bash
   npx cap init
   ```
   - App ID: `app.feedin.social`
   - App Name: `FEEDIN`

3. Add platforms:
   ```bash
   npx cap add ios
   npx cap add android
   ```

4. Build web app:
   ```bash
   npm run build
   ```

5. Sync to native:
   ```bash
   npx cap sync
   ```

6. Open in IDE:
   ```bash
   npx cap open ios
   npx cap open android
   ```

### Native Features
- Camera access for stories and posts
- Push notifications
- File system access
- Biometric authentication (Face ID, Touch ID)
- App icon and splash screen
- Status bar styling

---

## 🔐 Security & Privacy

### Row-Level Security (RLS)
- Enable RLS on all tables
- Policies for user-specific data
- Public data policies (posts, profiles)
- Admin-only policies (moderation)

**Example RLS Policy:**
```sql
-- Users can only read their own messages
CREATE POLICY "Users can read own messages" ON messages
FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM conversation_participants
    WHERE conversation_id = messages.conversation_id
  )
);
```

### Content Security
- Sanitize user input (prevent XSS)
- Validate file uploads (type, size)
- Rate limiting on API calls
- CORS configuration
- HTTPS enforcement

### Privacy Settings
- Control who can see posts (public, friends, private)
- Control who can send messages
- Control who can call
- Block users
- Mute users

---

## 📊 Analytics & Monitoring

### Track Events
- Post views
- Engagement rate (likes, comments, shares)
- Message delivery rate
- Call quality metrics
- User retention

### Admin Dashboard
- Total users, posts, messages
- Active users (daily, monthly)
- Revenue (credits, subscriptions)
- Content reports
- System health

---

## 🚢 Deployment

### Hosting: Vercel
1. Connect GitHub repository
2. Set environment variables (Supabase URL, keys)
3. Deploy automatically on push to main branch

### Custom Domain
- Configure in Vercel settings
- Update DNS records
- HTTPS automatic with Vercel

### Environment Variables
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=xxxxx
VITE_SUPABASE_PROJECT_ID=xxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
VITE_DAILY_API_KEY=xxxxx (for video calls)
```

---

## 📝 Final Notes

### Development Workflow
1. Set up Lovable Cloud (Supabase)
2. Create database schema with migrations
3. Build authentication flow
4. Implement core features (feed, messages, calls)
5. Add AI features
6. Implement credits and subscriptions
7. Set up moderation and safety
8. Test thoroughly
9. Deploy to Vercel
10. Convert to native app with Capacitor

### Best Practices
- Use TypeScript for type safety
- Follow React best practices (hooks, context)
- Write clean, readable code
- Comment complex logic
- Use semantic HTML
- Optimize images and media
- Test on real devices
- Monitor performance
- Listen to user feedback
- Iterate and improve

### Future Enhancements
- AI-powered feed algorithm
- Video editing tools
- GIF maker
- Polls and quizzes
- Events and calendar
- Shopping marketplace
- Job board
- Dating feature
- Language translation
- Voice notes in feed
- Collaborative playlists

---

## 🎉 Success Criteria

The app is complete when:
- ✅ Users can sign up and sign in
- ✅ Users can create posts, stories, messages
- ✅ Real-time features work smoothly
- ✅ Video/voice calls are clear
- ✅ Live streaming is functional
- ✅ AI features generate quality results
- ✅ Credits and subscriptions work
- ✅ Moderation keeps community safe
- ✅ App is responsive on all devices
- ✅ PWA can be installed
- ✅ Native apps work on iOS and Android
- ✅ Performance is fast (< 3s load time)
- ✅ No critical bugs or security issues

---

## 📚 Resources

### Documentation Links
- React: https://react.dev
- Vite: https://vitejs.dev
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- Supabase: https://supabase.com/docs
- React Router: https://reactrouter.com
- React Query: https://tanstack.com/query
- Daily.co: https://docs.daily.co
- Capacitor: https://capacitorjs.com/docs

### API References
- Supabase JS: https://supabase.com/docs/reference/javascript
- Stripe: https://stripe.com/docs/api
- Lovable AI: (internal documentation)

---

**This document provides a complete blueprint for building the FEEDIN application. Use it as a reference for implementation, ensuring all features, design patterns, and best practices are followed.**
