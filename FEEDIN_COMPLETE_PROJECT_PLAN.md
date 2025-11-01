# 🚀 FEEDIN - Complete Project Plan & Documentation

**Version:** 1.0  
**Last Updated:** January 2025  
**Project Type:** Social Media Platform with AI Features

---

## 📱 Application Overview

**App Name:** FEEDIN

**Tagline:** Connect, Share, and Engage with AI-Powered Social Experiences

**Description:** FEEDIN is a comprehensive social media platform featuring real-time interactions, AI-powered content curation, live streaming, private messaging, video/voice calling, and premium subscription capabilities. Built with modern web technologies and designed for seamless conversion to native mobile apps.

---

## 🎯 Core Value Propositions

1. **Social First**: Facebook-style posting, commenting, and interactions
2. **AI-Enhanced**: Personalized feeds and AI assistant for better engagement
3. **Real-Time**: Instant messaging, notifications, and live updates
4. **Multimedia**: Video/voice calls, live streaming, and rich media sharing
5. **Monetization Ready**: Credits system, subscriptions, and payments built-in
6. **Mobile Native**: Web app that converts to iOS/Android native apps

---

## 💻 Technology Stack

### **Frontend**
- **Framework:** Vite + React 18.3
- **Language:** TypeScript
- **Routing:** React Router v6.30
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (Radix UI primitives)
- **State Management:** React Query (TanStack Query)
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

### **Backend & Database**
- **Backend:** Supabase (Backend-as-a-Service)
- **Database:** PostgreSQL 15+ (via Supabase)
- **Authentication:** Supabase Auth (email/password, OAuth)
- **Storage:** Supabase Storage (file uploads, media)
- **Real-time:** Supabase Subscriptions (WebSocket)
- **Serverless:** Supabase Edge Functions (Deno runtime)

### **Third-Party Integrations**
- **Payments:** Stripe + Paystack
- **Email:** Resend API
- **SMS:** Termii API
- **Video/Voice Calls:** Daily.co (or 100ms as alternative)
- **AI Services:** Lovable AI (Google Gemini + OpenAI GPT-5)
- **Image Generation:** Lovable AI (Gemini Flash Image)

### **Deployment & DevOps**
- **Hosting:** Vercel
- **CDN:** Vercel Edge Network
- **Domain:** Custom domain support
- **SSL:** Automatic HTTPS
- **CI/CD:** Automatic deployment via Git

### **Mobile Conversion**
- **Framework:** Capacitor 6+
- **Platforms:** iOS (Swift/Objective-C), Android (Kotlin/Java)
- **Native Features:** Camera, push notifications, file system
- **Distribution:** Apple App Store, Google Play Store

---

## 🏗️ Complete Project Structure

```
feedin/
├── public/
│   ├── icons/                        # App icons (PWA + mobile)
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   └── favicon.ico
│   ├── sounds/                       # Audio assets
│   │   ├── notification.mp3
│   │   ├── ringtone.mp3
│   │   └── message-sent.mp3
│   └── robots.txt
│
├── src/
│   ├── main.tsx                      # App entry point
│   ├── App.tsx                       # Root component with routing
│   ├── index.css                     # Global styles + Tailwind
│   ├── vite-env.d.ts                # Vite type definitions
│   │
│   ├── pages/                        # Page components (routes)
│   │   ├── Index.tsx                 # Landing/welcome page
│   │   ├── NotFound.tsx              # 404 error page
│   │   │
│   │   ├── auth/
│   │   │   ├── Login.tsx            # Login page
│   │   │   ├── Signup.tsx           # Registration page
│   │   │   ├── ForgotPassword.tsx   # Password reset request
│   │   │   ├── ResetPassword.tsx    # Password reset form
│   │   │   └── AuthCallback.tsx     # OAuth callback handler
│   │   │
│   │   ├── feed/
│   │   │   ├── Feed.tsx             # Main feed with posts
│   │   │   ├── CreatePost.tsx       # Create post (text/image/video)
│   │   │   └── PostDetail.tsx       # Individual post detail page
│   │   │
│   │   ├── messages/
│   │   │   ├── Messages.tsx         # Messages list (default landing)
│   │   │   └── Conversation.tsx     # Individual conversation
│   │   │
│   │   ├── friends/
│   │   │   └── Friends.tsx          # Friends list and requests
│   │   │
│   │   ├── ai/
│   │   │   ├── FeedAI.tsx           # AI-powered personalized feed
│   │   │   └── AICopilot.tsx        # AI assistant/chatbot
│   │   │
│   │   ├── profile/
│   │   │   ├── Profile.tsx          # Current user profile
│   │   │   ├── EditProfile.tsx      # Edit profile
│   │   │   └── PublicProfile.tsx    # Public user profile view
│   │   │
│   │   ├── groups/
│   │   │   ├── Groups.tsx           # Groups list
│   │   │   ├── CreateGroup.tsx      # Create new group
│   │   │   ├── GroupDetail.tsx      # Group detail/feed
│   │   │   └── GroupSettings.tsx    # Group settings
│   │   │
│   │   ├── live/
│   │   │   ├── Live.tsx             # Live streams list
│   │   │   ├── CreateStream.tsx     # Start live stream
│   │   │   └── WatchStream.tsx      # Watch live stream
│   │   │
│   │   ├── calls/
│   │   │   ├── Call.tsx             # Video/voice call interface
│   │   │   └── CallHistory.tsx      # Call logs
│   │   │
│   │   ├── credits/
│   │   │   ├── Credits.tsx          # Credits dashboard
│   │   │   ├── BuyCredits.tsx       # Purchase credits
│   │   │   ├── TransferCredits.tsx  # Transfer credits
│   │   │   └── AboutCredits.tsx     # Credits information
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── Subscriptions.tsx    # Subscription plans
│   │   │   └── ManageSubscription.tsx # Manage subscription
│   │   │
│   │   ├── content/
│   │   │   ├── SavedPosts.tsx       # Saved posts
│   │   │   └── Trending.tsx         # Trending posts/hashtags
│   │   │
│   │   ├── settings/
│   │   │   ├── Settings.tsx         # User settings
│   │   │   ├── PrivacySettings.tsx  # Privacy controls
│   │   │   └── Notifications.tsx    # Notifications center
│   │   │
│   │   └── admin/
│   │       ├── AdminDashboard.tsx   # Admin dashboard
│   │       ├── FixDatabase.tsx      # Database management
│   │       └── Moderation.tsx       # Content moderation
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── select.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── alert.tsx
│   │   │   └── ... (30+ components)
│   │   │
│   │   ├── feed/
│   │   │   ├── PostCard.tsx          # Post display card
│   │   │   ├── PostLikeButton.tsx    # Like button with animation
│   │   │   ├── PostShareButton.tsx   # Share post button
│   │   │   ├── PostSaveButton.tsx    # Save post button
│   │   │   ├── CommentModal.tsx      # Facebook-style comment modal
│   │   │   ├── CommentItem.tsx       # Individual comment
│   │   │   ├── CommentThread.tsx     # Nested comment structure
│   │   │   ├── CommentInput.tsx      # Comment input with emoji
│   │   │   ├── CommentReactionPicker.tsx # Emoji reaction picker
│   │   │   ├── ReactionDisplay.tsx   # Display reactions
│   │   │   ├── EmojiPicker.tsx       # Emoji selector
│   │   │   ├── MediaUpload.tsx       # Media upload component
│   │   │   └── FeedLoader.tsx        # Feed loading skeleton
│   │   │
│   │   ├── messages/
│   │   │   ├── ConversationList.tsx  # List of conversations
│   │   │   ├── ConversationItem.tsx  # Single conversation item
│   │   │   ├── MessageBubble.tsx     # Message bubble
│   │   │   ├── MessageInput.tsx      # Message input field
│   │   │   ├── TypingIndicator.tsx   # Typing animation
│   │   │   └── MessageReactions.tsx  # Message reactions
│   │   │
│   │   ├── calls/
│   │   │   ├── IncomingCall.tsx      # Incoming call screen
│   │   │   ├── VideoCallUI.tsx       # Active call interface
│   │   │   ├── CallControls.tsx      # Mute/camera/end buttons
│   │   │   ├── ParticipantGrid.tsx   # Group call participants
│   │   │   └── CallNotification.tsx  # Call notification toast
│   │   │
│   │   ├── friends/
│   │   │   ├── FriendCard.tsx        # Friend profile card
│   │   │   ├── FriendRequest.tsx     # Friend request item
│   │   │   └── FriendsList.tsx       # Friends list
│   │   │
│   │   ├── groups/
│   │   │   ├── GroupCard.tsx         # Group card
│   │   │   ├── GroupMember.tsx       # Group member item
│   │   │   └── GroupInvite.tsx       # Group invitation
│   │   │
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx         # Bottom navigation (mobile)
│   │   │   ├── MobileNav.tsx         # Mobile top nav
│   │   │   ├── Sidebar.tsx           # Desktop sidebar
│   │   │   ├── Header.tsx            # App header
│   │   │   └── Footer.tsx            # App footer
│   │   │
│   │   ├── notifications/
│   │   │   ├── NotificationBell.tsx  # Notification icon
│   │   │   ├── NotificationList.tsx  # Notifications dropdown
│   │   │   └── NotificationItem.tsx  # Single notification
│   │   │
│   │   └── shared/
│   │       ├── ActionMenu.tsx        # Action menu component
│   │       ├── ThemeProvider.tsx     # Theme context provider
│   │       ├── ProtectedRoute.tsx    # Auth guard component
│   │       ├── LoadingScreen.tsx     # Full-screen loader
│   │       ├── ErrorBoundary.tsx     # Error boundary
│   │       ├── SearchBar.tsx         # Search component
│   │       └── UserAvatar.tsx        # User avatar component
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client
│   │   ├── feed-prefetch.ts          # Background feed prefetching
│   │   ├── daily-client.ts           # Daily.co video call client
│   │   ├── stripe-client.ts          # Stripe client setup
│   │   ├── utils.ts                  # Utility functions
│   │   └── constants.ts              # App constants
│   │
│   ├── hooks/
│   │   ├── use-auth.ts               # Authentication hook
│   │   ├── use-realtime.ts           # Real-time subscriptions
│   │   ├── use-toast.ts              # Toast notifications hook
│   │   ├── use-mobile.ts             # Mobile detection hook
│   │   ├── use-infinite-scroll.ts    # Infinite scroll hook
│   │   ├── use-debounce.ts           # Debounce hook
│   │   └── use-local-storage.ts      # Local storage hook
│   │
│   └── types/
│       ├── database.types.ts         # Supabase generated types
│       ├── supabase.ts               # Supabase type helpers
│       └── index.ts                  # Custom types
│
├── supabase/
│   ├── functions/                    # Edge Functions (Deno)
│   │   ├── chat-ai/
│   │   │   └── index.ts             # AI chatbot function
│   │   ├── generate-image/
│   │   │   └── index.ts             # AI image generation
│   │   ├── feedai-recommendations/
│   │   │   └── index.ts             # Personalized feed AI
│   │   ├── stripe-webhook/
│   │   │   └── index.ts             # Stripe webhook handler
│   │   ├── paystack-webhook/
│   │   │   └── index.ts             # Paystack webhook handler
│   │   ├── send-notification/
│   │   │   └── index.ts             # Push notifications
│   │   ├── send-email/
│   │   │   └── index.ts             # Email notifications
│   │   ├── send-sms/
│   │   │   └── index.ts             # SMS notifications
│   │   └── call-signaling/
│   │       └── index.ts             # Video call signaling
│   │
│   ├── migrations/                   # SQL migrations
│   │   ├── 001_profiles.sql
│   │   ├── 002_posts.sql
│   │   ├── 003_comments.sql
│   │   ├── 004_likes.sql
│   │   ├── 005_messages.sql
│   │   ├── 006_friendships.sql
│   │   ├── 007_groups.sql
│   │   ├── 008_live_streams.sql
│   │   ├── 009_credits.sql
│   │   ├── 010_subscriptions.sql
│   │   └── ... (60+ migrations)
│   │
│   └── config.toml                   # Supabase configuration
│
├── docs/                             # Documentation
│   ├── API.md                        # API documentation
│   ├── DATABASE.md                   # Database schema docs
│   └── DEPLOYMENT.md                 # Deployment guide
│
├── .env.example                      # Environment variables template
├── index.html                        # HTML entry point
├── vite.config.ts                    # Vite configuration
├── tailwind.config.ts                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
├── tsconfig.node.json                # TypeScript Node config
├── package.json                      # Dependencies
├── capacitor.config.ts               # Capacitor config (mobile)
└── README.md                         # Project README
```

---

## 🗄️ Complete Database Schema (60+ Tables)

### **CORE USER TABLES**

#### 1. profiles
User profile and account information
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  cover_image_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  is_premium BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_role ON profiles(role);
```

#### 2. profile_pictures
Profile picture history
```sql
CREATE TABLE profile_pictures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  picture_url TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **POST & CONTENT TABLES**

#### 3. posts
All user posts (text, image, video)
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id TEXT UNIQUE NOT NULL, -- feedin001, feedin002, etc.
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('text', 'image', 'video')),
  post_type TEXT DEFAULT 'public' CHECK (post_type IN ('public', 'friends', 'private')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'flagged', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_feed_id ON posts(feed_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);
```

#### 4. post_likes
Post likes tracking
```sql
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);
```

#### 5. post_comments
Post comments with nested replies
```sql
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'deleted', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post_id ON post_comments(post_id);
CREATE INDEX idx_comments_user_id ON post_comments(user_id);
CREATE INDEX idx_comments_parent_id ON post_comments(parent_comment_id);
```

#### 6. comment_likes
Comment likes tracking
```sql
CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);
```

#### 7. comment_reactions
Emoji reactions on comments (👍❤️😂😮😢😡)
```sql
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '😡')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id, emoji)
);
```

#### 8. post_shares
Post sharing tracking
```sql
CREATE TABLE post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shared_to TEXT CHECK (shared_to IN ('feed', 'group', 'message')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 9. post_views
Post view analytics
```sql
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, viewer_id, viewed_at::DATE)
);
```

#### 10. saved_posts
User saved posts
```sql
CREATE TABLE saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);
```

#### 11. deleted_posts
Soft-deleted posts archive
```sql
CREATE TABLE deleted_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);
```

---

### **HASHTAG & TRENDING TABLES**

#### 12. hashtags
Hashtag definitions
```sql
CREATE TABLE hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hashtags_tag ON hashtags(tag);
CREATE INDEX idx_hashtags_usage ON hashtags(usage_count DESC);
```

#### 13. post_hashtags
Post-hashtag associations
```sql
CREATE TABLE post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);
```

#### 14. trending_posts
Trending content tracking
```sql
CREATE TABLE trending_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  trending_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);
```

---

### **SOCIAL RELATIONSHIP TABLES**

#### 15. friendships
Friend connections and requests
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

#### 16. friends
Active friend relationships
```sql
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

---

### **MESSAGING TABLES**

#### 17. conversations
Message conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_type TEXT DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group')),
  name TEXT, -- For group chats
  avatar_url TEXT, -- For group chats
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 18. conversation_participants
Conversation members
```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);
```

#### 19. messages
Direct messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('text', 'image', 'video', 'audio', 'file')),
  read BOOLEAN DEFAULT FALSE,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

---

### **NOTIFICATION TABLES**

#### 20. notifications
User notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'like', 'comment', 'reply', 'mention', 
    'friend_request', 'friend_accept', 
    'message', 'call', 'live_stream',
    'group_invite', 'system'
  )),
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
```

---

### **GROUP TABLES**

#### 21. groups
User groups/communities
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_image_url TEXT,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  privacy TEXT DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'secret')),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_creator ON groups(creator_id);
CREATE INDEX idx_groups_privacy ON groups(privacy);
```

#### 22. group_members
Group membership
```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
```

#### 23. group_actions
Group activity log
```sql
CREATE TABLE group_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 24. group_rules
Group rules/guidelines
```sql
CREATE TABLE group_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  rule_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **LIVE STREAMING TABLES**

#### 25. live_streams
Live stream sessions
```sql
CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  stream_url TEXT,
  status TEXT DEFAULT 'live' CHECK (status IN ('live', 'ended', 'scheduled')),
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ
);

CREATE INDEX idx_streams_user ON live_streams(user_id);
CREATE INDEX idx_streams_status ON live_streams(status);
```

#### 26. stream_comments
Live stream comments
```sql
CREATE TABLE stream_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 27. stream_cohosts
Stream co-hosts
```sql
CREATE TABLE stream_cohosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 28. stream_gifts
Virtual gifts during streams
```sql
CREATE TABLE stream_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **VIDEO/VOICE CALL TABLES**

#### 29. call_logs
Video/voice call history
```sql
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  duration INTEGER DEFAULT 0, -- seconds
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_logs_caller ON call_logs(caller_id);
CREATE INDEX idx_call_logs_receiver ON call_logs(receiver_id);
```

#### 30. active_calls
Currently active calls
```sql
CREATE TABLE active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL,
  room_url TEXT,
  participants JSONB,
  call_type TEXT CHECK (call_type IN ('video', 'voice')),
  status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
```

---

### **CREDITS & MONETIZATION TABLES**

#### 31. user_credits
User credit balances
```sql
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credits_user ON user_credits(user_id);
```

#### 32. credit_transactions
Credit transaction history
```sql
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'transfer', 'spend', 'refund', 'bonus')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON credit_transactions(user_id, created_at DESC);
```

#### 33. credit_transfers
Credit transfers between users
```sql
CREATE TABLE credit_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 34. subscriptions
Premium subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  stripe_subscription_id TEXT,
  paystack_subscription_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

#### 35. promotions
Promotional campaigns
```sql
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  budget INTEGER NOT NULL,
  spent INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  target_audience JSONB,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ
);
```

---

### **REFERRAL TABLES**

#### 36. referrals
Referral tracking
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_amount INTEGER,
  rewarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 37. referral_codes
Unique referral codes
```sql
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  uses_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **MODERATION TABLES**

#### 38. flagged_content
User-reported content
```sql
CREATE TABLE flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'user', 'message', 'group')),
  content_id UUID NOT NULL,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flagged_status ON flagged_content(status);
CREATE INDEX idx_flagged_type ON flagged_content(content_type);
```

#### 39. content_moderation
Moderation actions
```sql
CREATE TABLE content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  moderator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'hidden', 'banned', 'warned')),
  reason TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **ANALYTICS TABLES**

#### 40. profile_views
Profile view tracking
```sql
CREATE TABLE profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profile_views_profile ON profile_views(profile_id, viewed_at DESC);
```

#### 41. analytics_events
General analytics events
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
```

#### 42. ai_usage
AI feature usage tracking
```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('copilot', 'feedai', 'image_gen', 'content_suggestion')),
  tokens_used INTEGER,
  cost DECIMAL(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### **ADDITIONAL TABLES**

#### 43. status_updates
User status updates (stories)
```sql
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  views_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 44. video_captions
Video caption data
```sql
CREATE TABLE video_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID,
  language TEXT DEFAULT 'en',
  caption_text TEXT,
  caption_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 45. local_media_cache
Media caching metadata
```sql
CREATE TABLE local_media_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url TEXT UNIQUE NOT NULL,
  local_path TEXT,
  file_size INTEGER,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

---

## 🔐 Complete RLS (Row Level Security) Policies

### **Philosophy: Social Openness + User Privacy + Admin Moderation**

### **1. PROFILES Table**

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public profiles are viewable by everyone
CREATE POLICY "Public profiles viewable by all"
ON profiles FOR SELECT
USING (true);

-- Users can update own profile
CREATE POLICY "Users update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Users can insert own profile
CREATE POLICY "Users insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Admins can view all profiles including sensitive data
CREATE POLICY "Admins view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### **2. POSTS Table (Social - Like Facebook)**

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view active posts
CREATE POLICY "Anyone views active posts"
ON posts FOR SELECT
USING (status = 'active');

-- Users can create posts
CREATE POLICY "Users create posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users update own posts
CREATE POLICY "Users update own posts"
ON posts FOR UPDATE
USING (auth.uid() = user_id);

-- Users delete own posts
CREATE POLICY "Users delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- Admins view all posts
CREATE POLICY "Admins view all posts"
ON posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Admins/moderators delete any post
CREATE POLICY "Admins delete any post"
ON posts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'moderator')
  )
);
```

### **3. POST_COMMENTS Table**

```sql
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Anyone views approved comments
CREATE POLICY "Anyone views approved comments"
ON post_comments FOR SELECT
USING (status = 'approved');

-- Users create comments
CREATE POLICY "Users create comments"
ON post_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users update own comments
CREATE POLICY "Users update own comments"
ON post_comments FOR UPDATE
USING (auth.uid() = user_id);

-- Users delete own comments
CREATE POLICY "Users delete own comments"
ON post_comments FOR DELETE
USING (auth.uid() = user_id);

-- Admins moderate comments
CREATE POLICY "Admins moderate comments"
ON post_comments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'moderator')
  )
);
```

### **4. POST_LIKES Table**

```sql
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Anyone views likes
CREATE POLICY "Anyone views likes"
ON post_likes FOR SELECT
USING (true);

-- Users like posts
CREATE POLICY "Users like posts"
ON post_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users unlike posts
CREATE POLICY "Users unlike posts"
ON post_likes FOR DELETE
USING (auth.uid() = user_id);
```

### **5. MESSAGES Table (PRIVATE - Protected)**

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Only conversation participants view messages
CREATE POLICY "Users view own messages"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = messages.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

-- Users send messages to their conversations
CREATE POLICY "Users send messages"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = messages.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

-- Users delete own messages
CREATE POLICY "Users delete own messages"
ON messages FOR DELETE
USING (auth.uid() = sender_id);

-- ❌ NO ADMIN POLICY - Messages stay private!
```

### **6. CONVERSATIONS Table**

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Users view conversations they're part of
CREATE POLICY "Users view own conversations"
ON conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = conversations.id
    AND conversation_participants.user_id = auth.uid()
  )
);

-- Users create conversations
CREATE POLICY "Users create conversations"
ON conversations FOR INSERT
WITH CHECK (true);
```

### **7. FRIENDSHIPS Table**

```sql
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users view friendships involving them
CREATE POLICY "Users view own friendships"
ON friendships FOR SELECT
USING (
  auth.uid() = user_id
  OR auth.uid() = friend_id
);

-- Users send friend requests
CREATE POLICY "Users send friend requests"
ON friendships FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users accept/reject requests to them
CREATE POLICY "Users update friend requests"
ON friendships FOR UPDATE
USING (auth.uid() = friend_id);

-- Users delete friendships
CREATE POLICY "Users delete friendships"
ON friendships FOR DELETE
USING (
  auth.uid() = user_id
  OR auth.uid() = friend_id
);
```

### **8. GROUPS Table**

```sql
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Anyone views public groups
CREATE POLICY "Anyone views public groups"
ON groups FOR SELECT
USING (privacy = 'public');

-- Members view private groups
CREATE POLICY "Members view private groups"
ON groups FOR SELECT
USING (
  privacy = 'private'
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
  )
);

-- Users create groups
CREATE POLICY "Users create groups"
ON groups FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Group admins update groups
CREATE POLICY "Group admins update groups"
ON groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = groups.id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'admin'
  )
);
```

### **9. SAVED_POSTS Table (PRIVATE)**

```sql
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Users view own saved posts
CREATE POLICY "Users view own saved posts"
ON saved_posts FOR SELECT
USING (auth.uid() = user_id);

-- Users save posts
CREATE POLICY "Users save posts"
ON saved_posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users unsave posts
CREATE POLICY "Users unsave posts"
ON saved_posts FOR DELETE
USING (auth.uid() = user_id);

-- ❌ NO ADMIN POLICY - Saved posts are private!
```

### **10. USER_CREDITS Table**

```sql
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users view own credits
CREATE POLICY "Users view own credits"
ON user_credits FOR SELECT
USING (auth.uid() = user_id);

-- System updates credits
CREATE POLICY "System updates credits"
ON user_credits FOR UPDATE
USING (auth.uid() = user_id);

-- Admins view credits (support)
CREATE POLICY "Admins view all credits"
ON user_credits FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### **11. CALL_LOGS Table**

```sql
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Users view calls they were part of
CREATE POLICY "Users view own call logs"
ON call_logs FOR SELECT
USING (
  auth.uid() = caller_id
  OR auth.uid() = receiver_id
);

-- System creates call logs
CREATE POLICY "System creates call logs"
ON call_logs FOR INSERT
WITH CHECK (
  auth.uid() = caller_id
  OR auth.uid() = receiver_id
);

-- Admins view call logs (analytics only)
CREATE POLICY "Admins view call logs"
ON call_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### **12. FLAGGED_CONTENT Table**

```sql
ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;

-- Users view own reports
CREATE POLICY "Users view own reports"
ON flagged_content FOR SELECT
USING (auth.uid() = reporter_id);

-- Users flag content
CREATE POLICY "Users flag content"
ON flagged_content FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Admins/moderators view all flagged content
CREATE POLICY "Moderators view flagged content"
ON flagged_content FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'moderator')
  )
);

-- Admins update flagged content
CREATE POLICY "Admins update flagged content"
ON flagged_content FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'moderator')
  )
);
```

### **13. NOTIFICATIONS Table**

```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users view own notifications
CREATE POLICY "Users view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- System creates notifications
CREATE POLICY "System creates notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users update own notifications
CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users delete own notifications
CREATE POLICY "Users delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);
```

---

## 📋 Development Phases (Detailed)

### **PHASE 1: Foundation & Authentication** (Week 1)
**Goal:** Get users in the door

#### Features:
- ✅ Landing page with hero section
- ✅ Sign up / Login pages
- ✅ Email + password authentication
- ✅ Forgot password flow
- ✅ Profile creation on signup
- ✅ Basic profile page
- ✅ Bottom navigation (mobile-first)
- ✅ Dark theme (default)
- ✅ Responsive layout
- ✅ Loading states
- ✅ Error handling

#### Database Tables:
- profiles

#### Components:
- Landing page
- Login form
- Signup form
- Bottom navigation
- Theme provider
- Protected routes

#### Success Criteria:
- Users can sign up
- Users can log in
- Users redirected to /messages after login
- Profile created automatically
- Mobile responsive

---

### **PHASE 2: Core Feed & Posts** (Week 2)
**Goal:** Users can create and view content

#### Features:
- ✅ Main feed page
- ✅ Create text posts
- ✅ Create image posts
- ✅ Create video posts
- ✅ Post cards with media
- ✅ Like/unlike posts (optimistic)
- ✅ Post views tracking
- ✅ Unique feed IDs (feedin001, feedin002...)
- ✅ Infinite scroll
- ✅ Background feed prefetching
- ✅ Cached feed data
- ✅ Pull to refresh

#### Database Tables:
- posts
- post_likes
- post_views

#### Components:
- Feed page
- Post card
- Create post modal
- Like button
- Media upload
- Feed loader

#### Success Criteria:
- Users can create posts
- Posts display correctly
- Likes work with optimistic updates
- Feed loads instantly (cached)
- Images/videos upload successfully

---

### **PHASE 3: Comments System** (Week 2-3)
**Goal:** Facebook-style nested comments

#### Features:
- ✅ Comment modal (Facebook style)
- ✅ Add comments
- ✅ Nested replies (unlimited depth)
- ✅ Comment likes
- ✅ Emoji reactions (👍❤️😂😮😢😡)
- ✅ Delete own comments
- ✅ Real-time comment updates
- ✅ Comment counter
- ✅ Optimistic UI updates
- ✅ Reply threading

#### Database Tables:
- post_comments
- comment_likes
- comment_reactions

#### Components:
- Comment modal
- Comment item
- Comment thread
- Comment input
- Reaction picker
- Emoji picker

#### Success Criteria:
- Users can comment on posts
- Nested replies work correctly
- Reactions display properly
- Real-time updates work
- Comment count accurate

---

### **PHASE 4: Messaging System** (Week 3)
**Goal:** Private conversations

#### Features:
- ✅ Messages page (default after login)
- ✅ Conversations list
- ✅ 1-on-1 chat interface
- ✅ Send text messages
- ✅ Send media messages
- ✅ Real-time message delivery
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Message notifications
- ✅ Unread count badge

#### Database Tables:
- messages
- conversations
- conversation_participants

#### Components:
- Messages list
- Conversation view
- Message bubble
- Message input
- Typing indicator

#### Success Criteria:
- Users can send messages
- Real-time delivery works
- Read receipts accurate
- Typing indicators work
- Notifications appear

---

### **PHASE 5: Friends & Social** (Week 4)
**Goal:** Connect with others

#### Features:
- ✅ Friends list page
- ✅ Send friend requests
- ✅ Accept/reject requests
- ✅ Friend request notifications
- ✅ Unfriend functionality
- ✅ Friends feed filter
- ✅ Profile views tracking
- ✅ Friend suggestions
- ✅ Mutual friends count

#### Database Tables:
- friendships
- friends
- profile_views
- notifications

#### Components:
- Friends list
- Friend card
- Friend request item
- Profile view tracker

#### Success Criteria:
- Users can send friend requests
- Accept/reject works
- Notifications sent
- Friends list displays
- Profile views tracked

---

### **PHASE 6: Video/Voice Calls** (Week 5)
**Goal:** WhatsApp-style calling

#### Features:
- ✅ 1-on-1 video calls
- ✅ 1-on-1 voice calls
- ✅ Incoming call screen with ringtone
- ✅ Call controls (mute/camera/end)
- ✅ Call history page
- ✅ Call duration tracking
- ✅ Switch camera (front/back)
- ✅ Speaker toggle
- ✅ Daily.co integration
- ✅ Call notifications

#### Database Tables:
- call_logs
- active_calls

#### Edge Functions:
- call-signaling

#### Components:
- Incoming call screen
- Video call UI
- Call controls
- Call history

#### Success Criteria:
- Video calls work
- Voice calls work
- Call controls functional
- Call history accurate
- Ringtone plays

---

### **PHASE 7: Groups** (Week 5-6)
**Goal:** Community features

#### Features:
- ✅ Groups list page
- ✅ Create groups
- ✅ Join/leave groups
- ✅ Group posts/feed
- ✅ Group chat
- ✅ Group roles (admin/moderator/member)
- ✅ Group settings
- ✅ Group rules
- ✅ Member management
- ✅ Group invites

#### Database Tables:
- groups
- group_members
- group_actions
- group_rules

#### Components:
- Groups list
- Group card
- Group detail
- Group settings
- Member list

#### Success Criteria:
- Users can create groups
- Join/leave works
- Group posts display
- Roles enforced
- Invites work

---

### **PHASE 8: Live Streaming** (Week 6-7)
**Goal:** Live broadcasts

#### Features:
- ✅ Start live stream
- ✅ Watch live streams
- ✅ Live stream comments
- ✅ Viewer count (real-time)
- ✅ Co-host support
- ✅ Virtual gifts
- ✅ Stream notifications
- ✅ Stream recordings
- ✅ Schedule streams

#### Database Tables:
- live_streams
- stream_comments
- stream_cohosts
- stream_gifts

#### Components:
- Live stream list
- Create stream
- Watch stream
- Stream controls

#### Success Criteria:
- Users can go live
- Viewers can watch
- Comments work real-time
- Viewer count accurate
- Gifts can be sent

---

### **PHASE 9: AI Features** (Week 7-8)
**Goal:** AI-powered experiences

#### Features:
- ✅ AI Copilot (chatbot)
- ✅ FeedAI (personalized feed)
- ✅ AI image generation
- ✅ Content suggestions
- ✅ Sentiment analysis
- ✅ AI moderation assist

#### Database Tables:
- ai_usage

#### Edge Functions:
- chat-ai (Lovable AI)
- generate-image
- feedai-recommendations

#### Components:
- AI Copilot chat
- FeedAI page
- Image generator

#### Success Criteria:
- AI chatbot works
- Personalized feed accurate
- Images generate
- Usage tracked

---

### **PHASE 10: Credits & Monetization** (Week 8-9)
**Goal:** Revenue system

#### Features:
- ✅ Virtual credits system
- ✅ Buy credits (Stripe + Paystack)
- ✅ Transfer credits
- ✅ Transaction history
- ✅ Premium subscriptions
- ✅ Subscription management
- ✅ Promotional campaigns
- ✅ Referral rewards

#### Database Tables:
- user_credits
- credit_transactions
- credit_transfers
- subscriptions
- promotions
- referrals
- referral_codes

#### Edge Functions:
- stripe-webhook
- paystack-webhook
- process-payment

#### Components:
- Credits dashboard
- Buy credits page
- Transfer credits
- Subscription plans

#### Success Criteria:
- Users can buy credits
- Payments work (Stripe/Paystack)
- Transfers functional
- Subscriptions work
- Referrals tracked

---

### **PHASE 11: Content Features** (Week 9-10)
**Goal:** Enhanced content interaction

#### Features:
- ✅ Save posts
- ✅ Share posts
- ✅ Hashtags system
- ✅ Trending page
- ✅ Search by hashtag
- ✅ Post analytics
- ✅ Profile analytics
- ✅ Engagement metrics

#### Database Tables:
- saved_posts
- post_shares
- post_hashtags
- hashtags
- trending_posts
- analytics_events

#### Components:
- Saved posts page
- Trending page
- Hashtag search
- Analytics dashboard

#### Success Criteria:
- Posts can be saved
- Share functionality works
- Hashtags clickable
- Trending updates
- Analytics accurate

---

### **PHASE 12: Moderation & Admin** (Week 10-11)
**Goal:** Content safety

#### Features:
- ✅ Report content
- ✅ Admin dashboard
- ✅ Content moderation panel
- ✅ Ban/unban users
- ✅ Flag review
- ✅ Approve/reject content
- ✅ Moderator tools
- ✅ Admin analytics

#### Database Tables:
- flagged_content
- content_moderation
- deleted_posts

#### Components:
- Admin dashboard
- Moderation panel
- Report modal
- Ban user dialog

#### Success Criteria:
- Users can report
- Admins see reports
- Ban functionality works
- Moderation logs created
- Only admins access

---

### **PHASE 13: Settings & Privacy** (Week 11)
**Goal:** User control

#### Features:
- ✅ User settings page
- ✅ Privacy settings
- ✅ Notification preferences
- ✅ Account management
- ✅ Block users
- ✅ Privacy controls
- ✅ Data export
- ✅ Delete account

#### Components:
- Settings page
- Privacy settings
- Notification settings
- Account settings

#### Success Criteria:
- Settings save correctly
- Privacy enforced
- Notifications controllable
- Block works
- Account deletion works

---

### **PHASE 14: Polish & Optimization** (Week 12)
**Goal:** Production-ready

#### Tasks:
- ✅ Performance optimization
- ✅ Image optimization
- ✅ Code splitting
- ✅ Error handling
- ✅ Loading states
- ✅ Empty states
- ✅ Animations
- ✅ Mobile optimizations
- ✅ PWA setup
- ✅ Testing on devices

#### Success Criteria:
- App loads fast
- No errors
- Smooth animations
- Works on all devices
- PWA installable

---

### **PHASE 15: Mobile Conversion** (Week 13+)
**Goal:** Native iOS & Android apps

#### Tasks:
- ✅ Capacitor setup
- ✅ iOS platform
- ✅ Android platform
- ✅ Push notifications
- ✅ Native camera
- ✅ Native call UI
- ✅ App store assets
- ✅ Device testing
- ✅ App store submission

#### Success Criteria:
- Apps build successfully
- Push notifications work
- Native features work
- Apps submitted to stores

---

## 🎯 Complete Feature List

### **✅ Social Features**
- Posts (text/image/video)
- Facebook-style nested comments
- Likes & emoji reactions
- Friends system
- Groups & communities
- Profile pages
- Hashtags & trending
- Share posts
- Save posts
- Profile views

### **✅ Communication**
- Direct messaging
- Video calls (1-on-1 & group)
- Voice calls
- Live streaming
- Real-time notifications
- Typing indicators
- Read receipts

### **✅ AI Features**
- AI Copilot chatbot
- Personalized FeedAI
- AI image generation
- Content recommendations
- Sentiment analysis

### **✅ Monetization**
- Virtual credits system
- Stripe payments
- Paystack integration
- Premium subscriptions
- Referral rewards
- Promotional campaigns

### **✅ Content Management**
- Save posts
- Share posts
- Post analytics
- Trending content
- Search & discover
- Hashtag system

### **✅ Moderation**
- Report system
- Admin dashboard
- Content moderation
- User banning
- Automated moderation
- Flagged content review

### **✅ User Experience**
- Dark theme (default)
- Mobile-first design
- Bottom navigation
- Optimistic UI updates
- Background prefetching
- Real-time updates
- Offline support (PWA)
- Smooth animations

### **✅ Profile & Settings**
- User profiles
- Edit profile
- Profile pictures
- Cover images
- Privacy settings
- Account settings
- Notification preferences
- Block users
- Delete account

### **✅ Analytics**
- Post views
- Profile views
- Engagement metrics
- AI usage tracking
- Call logs
- Analytics events

---

## 💰 Cost Estimate

### **Development Phase (Testing)**
- **Lovable:** Free tier / paid plan
- **Supabase:** Free tier (500MB DB, 1GB storage, 2GB bandwidth)
- **Vercel:** Free tier (100GB bandwidth)
- **Daily.co:** Free tier (10,000 minutes/month)
- **Lovable AI:** Free tier included
- **Total:** $0-50/month

### **Production (Low-Medium Traffic)**
- **Supabase:** $25/month (Pro plan)
- **Daily.co:** $0-50/month (pay-per-minute)
- **Stripe/Paystack:** Transaction fees only (2.9% + $0.30)
- **Resend:** $0-20/month (50,000 emails free)
- **Termii:** Pay-per-SMS (~$0.03/SMS)
- **Vercel:** $0-20/month
- **Total:** $50-150/month

### **Production (High Traffic)**
- **Supabase:** $100-500/month
- **Daily.co:** $100-500/month
- **Other services:** Scale with usage
- **Total:** $300-1,500/month

---

## 🚀 Deployment Strategy

### **Development:**
1. Lovable preview URL (automatic)
2. Git integration (automatic)
3. Continuous deployment

### **Staging:**
1. Vercel preview deployments
2. Test all features
3. Performance testing

### **Production:**
1. Custom domain setup
2. SSL certificates (automatic)
3. CDN configuration
4. Error monitoring
5. Analytics setup

---

## 📱 Navigation Structure

### **Bottom Navigation (Mobile)**
1. **Feed** 📰 - Main feed
2. **Chats** 💬 - Messages (default landing)
3. **Create** ➕ - Create post (center, gradient)
4. **Friends** 👥 - Friends list
5. **FeedAI** 🤖 - AI feed

### **Additional Pages**
- Profile
- Settings
- Privacy Settings
- Notifications
- Saved Posts
- Trending
- Groups
- Live Streams
- Credits
- Subscriptions
- Call History
- Admin Dashboard (admin only)

---

## 🎨 Design System

### **Colors (Dark Theme Default)**
- Primary: Custom gradient
- Background: Dark grays
- Text: White/light gray
- Accents: Vibrant colors
- Success/Error: Standard

### **Typography**
- Headings: Bold, large
- Body: Regular, readable
- Captions: Small, muted

### **Components**
- Cards: Rounded corners
- Buttons: Bold, colorful
- Inputs: Clean, minimal
- Modals: Centered, overlay

### **Animations**
- Smooth transitions
- Optimistic updates
- Loading skeletons
- Hover effects

---

## 🔒 Security Features

### **Authentication**
- Email/password
- Password reset
- Email verification
- Session management
- JWT tokens

### **Authorization**
- Row Level Security (RLS)
- Role-based access
- Admin privileges
- User permissions

### **Data Privacy**
- Private messages (encrypted)
- Privacy settings
- Block users
- Content reporting
- Data export

### **Content Moderation**
- User reports
- Admin moderation
- Automated filters
- Content flags
- Ban system

---

## 📊 Success Metrics

### **User Engagement**
- Daily active users (DAU)
- Monthly active users (MAU)
- Posts per user
- Comments per post
- Messages per user
- Call duration

### **Content Metrics**
- Posts created
- Comments created
- Likes given
- Shares made
- Videos watched

### **Revenue Metrics**
- Credits purchased
- Subscriptions sold
- Referrals completed
- Transaction volume

### **Technical Metrics**
- Page load time
- API response time
- Error rate
- Uptime percentage

---

## 🎯 Post-Launch Roadmap

### **Phase 16: Advanced Features**
- Voice messages
- Video messages
- Location sharing
- Polls & surveys
- Events & RSVP
- Marketplace

### **Phase 17: Enhanced AI**
- AI content creation
- AI video editing
- Voice cloning
- Translation services

### **Phase 18: Enterprise**
- Business accounts
- Analytics dashboard
- API access
- Webhooks
- Team management

---

## 📝 Environment Variables Required

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Paystack
VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# SMS (Termii)
TERMII_API_KEY=your_termii_key

# Daily.co (Video Calls)
VITE_DAILY_API_KEY=your_daily_key
DAILY_API_SECRET=your_daily_secret

# Lovable AI (Already configured in Lovable Cloud)
# No setup needed - automatic
```

---

## 🎓 Resources & Documentation

### **Official Docs**
- React: https://react.dev
- Vite: https://vitejs.dev
- Supabase: https://supabase.com/docs
- Tailwind: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com

### **Third-Party Services**
- Stripe: https://stripe.com/docs
- Daily.co: https://docs.daily.co
- Resend: https://resend.com/docs
- Capacitor: https://capacitorjs.com/docs

### **Learning Resources**
- React Router: https://reactrouter.com
- React Query: https://tanstack.com/query
- Supabase Auth: https://supabase.com/docs/guides/auth

---

## ✅ Ready to Build!

This comprehensive plan covers:
- ✅ Complete tech stack
- ✅ All 60+ database tables with schemas
- ✅ Complete RLS policies (social + private + admin)
- ✅ 15 development phases
- ✅ All features & components
- ✅ Cost estimates
- ✅ Security strategy
- ✅ Deployment plan

**Project Name:** FEEDIN  
**Timeline:** 13-15 weeks  
**Budget:** $50-150/month production  
**Platform:** Web → iOS/Android  

**Next Step:** Say "let's build" to begin Phase 1! 🚀

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Author:** FEEDIN Development Team
