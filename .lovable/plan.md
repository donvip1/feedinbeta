

# Messaging UI Redesign Plan

## Overview
Redesign the Messages page (`Messages.tsx`) and chat interface (`ModernChatInterface.tsx`) to adopt the premium visual style from the provided reference code — rounded-[28px] conversation cards, gradient branding, glassmorphic headers, slide-in chat transitions, and a modern MediaDock attachment picker — while preserving all existing Supabase integration, realtime, caching, and feature logic.

## What Changes

### 1. Messages.tsx — Inbox Redesign
**Header**: Replace current header with the reference style — large "FeedIn" gradient text, Bell + Settings icon buttons in rounded-2xl containers, full-width search with rounded-2xl + left icon + inner shadow styling.

**Tabs**: Replace `MessagingTabs` with bold text tabs ("All", "Unread", "Groups", "Live") using thick bottom borders, matching the reference `activeTab` pattern. Keep existing tab logic for filtering.

**Conversation List**: Replace `TikTokConversationItem` rendering with the reference card style — `rounded-[28px]` containers with `p-4`, larger `w-14 h-14 rounded-[20px]` avatars, green online dots with thick border, bouncing LIVE badges, and blue unread count pills. Keep all existing data binding (Supabase conversations, presence, typing indicators, archive swipe).

**FAB**: Replace the simple Plus button with the reference expandable FAB — rotates 45° when open, shows "Create Space" and "New Contact" actions with slide-in animation. Wire to existing `setShowNewConversation` and `setShowCreateGroup`.

**Transition**: When a conversation is selected, apply the reference `scale-[0.92] blur-md grayscale-[0.2]` effect to the inbox, and slide the chat in from right.

### 2. ModernChatInterface.tsx — Chat View Redesign
**Header**: Adopt the reference style — avatar with LIVE badge, "Tap to join Live" status text (when user is streaming), rounded icon buttons for Video/Phone/Info. Keep existing call initiation logic, presence display, and dropdown menu.

**Message Bubbles**: Update bubble styling to match reference — `rounded-2xl` with `rounded-tr-none` for sent (blue-600 bg) and `rounded-tl-none` for received (white/zinc-800 bg with border + shadow). Keep existing `ModernMessageBubble` component but pass updated className props.

**Input Area**: Replace `AttachmentPicker` popover with the reference MediaDock — horizontal scrollable row of colored icon buttons (Camera blue, Gallery purple, Document orange, Location green, Audio pink) triggered by a Plus toggle button. Keep existing file handling logic. Update send button to match reference (blue-600 when text present, zinc-100 when empty).

**Footer Layout**: Adopt the reference pattern — Plus toggle on left, flex-1 input with rounded-2xl border that highlights blue on focus, Send button on right. Keep emoji popover, voice recorder toggle, AI suggestions, and schedule message features.

### 3. TikTokConversationItem.tsx — Restyle
Update the conversation item component to use the reference card style with rounded-[28px], larger avatars, and the new visual language. Keep swipe-to-archive, typing indicators, and verified badge logic.

### 4. AttachmentPicker.tsx — MediaDock Upgrade  
Replace the popover-based picker with an inline MediaDock component that slides up from bottom when toggled. Add "Audio" option (pink) for music files. Keep existing file validation (150MB limit) and input refs.

## What Stays Unchanged
- All Supabase queries, RPC calls, realtime subscriptions
- Message caching (`useMessageCache`, `useConversationCache`)
- Presence tracking (`usePresence`, `realtimeManager`)
- All modals (Delete, Forward, Schedule, Mute, Media Upload, New Conversation, Create Group)
- Voice recorder, AI suggestions, call initiation logic
- Secret mode, stories bar, inbox activity section
- All hooks and context providers

## Files to Edit
1. `src/pages/Messages.tsx` — Header, tabs, conversation list, FAB, transition effect
2. `src/components/messages/ModernChatInterface.tsx` — Header, input area, message area styling
3. `src/components/messages/TikTokConversationItem.tsx` — Card style update
4. `src/components/messages/AttachmentPicker.tsx` — MediaDock replacement
5. `src/components/messages/MessagingTabs.tsx` — Bold text tab style

