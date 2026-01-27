

# Complete Activity Database Wipe

## Overview
This plan will wipe ALL user activity data from the database while preserving:
- User accounts (auth.users - managed by system)
- User profiles (profiles table)
- Privacy settings
- Push notification subscriptions
- System configuration tables

## Data to be Deleted

### Category 1: Posts & Related Activity (Already partially done)
| Table | Records | Purpose |
|-------|---------|---------|
| post_hashtags | 0 | Hashtag associations |
| post_views | 0 | View records |
| post_view_history | - | View history |
| post_likes | 0 | Likes |
| post_comments | 0 | Comments |
| post_shares | - | Shares |
| post_mentions | - | Mentions |
| post_promotions | - | Promoted posts |
| saved_posts | 0 | Saved bookmarks |
| posts | 0 | Posts (already cleared) |

### Category 2: Stories
| Table | Records | Purpose |
|-------|---------|---------|
| story_views | 222 | Story views |
| story_reactions | 34 | Story reactions |
| story_comments | 23 | Story comments |
| active_stories | - | Active story tracking |
| stories | 113 | Stories |

### Category 3: Messages & Conversations
| Table | Records | Purpose |
|-------|---------|---------|
| message_attachments | - | File attachments |
| message_edit_history | - | Edit history |
| message_reactions | - | Message reactions |
| message_read_receipts | - | Read receipts |
| starred_messages | - | Starred messages |
| scheduled_messages | - | Scheduled messages |
| typing_indicators | - | Typing indicators |
| messages | 608 | Direct messages |
| conversation_participants | - | Conversation members |
| conversations | 12 | Conversations |

### Category 4: Groups
| Table | Records | Purpose |
|-------|---------|---------|
| group_message_reactions | - | Message reactions |
| group_message_read_status | - | Read status |
| group_messages | 8 | Group messages |
| group_poll_votes | - | Poll votes |
| group_polls | - | Polls |
| group_posts | - | Group posts |
| group_typing_indicators | - | Typing indicators |
| group_call_participants | - | Call participants |
| group_calls | - | Group calls |
| group_invite_links | - | Invite links |
| group_invite_uses | - | Invite usage |
| group_join_requests | - | Join requests |
| group_members | - | Group members |
| groups | 3 | Groups |

### Category 5: Calls
| Table | Records | Purpose |
|-------|---------|---------|
| call_invites | - | Call invites |
| call_participants | - | Call participants |
| call_signals | - | Signaling data |
| call_logs | 165 | Call history |

### Category 6: Live Streams & Spaces
| Table | Records | Purpose |
|-------|---------|---------|
| live_stream_analytics | - | Stream analytics |
| live_stream_comments | - | Stream comments |
| live_stream_gifts | - | Stream gifts |
| live_stream_invites | - | Stream invites |
| live_stream_reactions | - | Stream reactions |
| live_stream_viewers | - | Viewer records |
| live_streams | 32 | Live streams |
| live_streams_public | - | Public streams |
| live_space_gifts | - | Space gifts |
| live_space_invitations | - | Space invites |
| live_space_messages | - | Space messages |
| live_space_reactions | - | Space reactions |
| live_space_speakers | - | Space speakers |
| live_spaces | 8 | Audio spaces |

### Category 7: Notifications & Activity
| Table | Records | Purpose |
|-------|---------|---------|
| notifications | 1545 | All notifications |
| notification_badges | - | Badge counts |
| offline_notifications | - | Offline notifications |
| user_wallet_notifications | - | Wallet notification settings |

### Category 8: Social Connections
| Table | Records | Purpose |
|-------|---------|---------|
| follows | 84 | Follow relationships |
| friend_requests | 35 | Friend requests |
| blocked_users | - | Blocked users |
| muted_users | - | Muted users |

### Category 9: Credits & Transactions
| Table | Records | Purpose |
|-------|---------|---------|
| gift_analytics | 44 | Gift records |
| credit_transactions | 218 | Credit transactions |
| user_credits | 20 | User credit balances |
| creator_payouts | - | Payout records |
| creator_payout_requests | - | Payout requests |
| daily_earnings | - | Daily earnings |
| payment_history | - | Payment history |

### Category 10: Analytics & Tracking
| Table | Records | Purpose |
|-------|---------|---------|
| user_analytics | 4 | User analytics |
| user_engagement_signals | 0 | Engagement signals |
| user_feed_sessions | - | Feed sessions |
| user_seen_posts | - | Seen posts |
| user_media_preferences | - | Media preferences |
| trending_searches | 0 | Search trends |
| ad_impressions | - | Ad impressions |
| user_ad_impressions | - | User ad views |
| feed_cycle_status | - | Feed cycle |

### Category 11: AI & Learning
| Table | Records | Purpose |
|-------|---------|---------|
| ai_chat_messages | 21 | AI chat history |
| ai_agent_conversations | - | Agent conversations |
| ai_agent_messages | - | Agent messages |
| ai_tool_results | - | Tool results |
| ai_tool_usage | - | Tool usage |
| ai_usage | - | AI usage stats |

### Category 12: Moderation & Reports
| Table | Records | Purpose |
|-------|---------|---------|
| content_flags | - | Content flags |
| content_reports | - | Reports |
| moderation_actions | - | Mod actions |
| moderation_appeals | - | Appeals |
| moderation_queue | - | Mod queue |
| user_strikes | - | User strikes |
| user_strike_summary | - | Strike summaries |

---

## Tables to PRESERVE (Not Delete)

| Table | Reason |
|-------|--------|
| profiles | User profile data |
| public_profiles | Public profile view |
| privacy_settings | User privacy preferences |
| notification_preferences | Notification settings |
| push_subscriptions | Push notification tokens |
| user_sessions | Login sessions |
| login_attempts | Security logs |
| security_events | Security audit |
| user_identifiers | User identifiers |
| user_mfa_settings | MFA configuration |
| user_roles | User roles |
| profile_sensitive_data | Sensitive profile data |
| credit_packages | System config |
| gift_appreciation_options | System config |
| subscription_tiers | System config |
| creator_incentive_tiers | System config |
| hashtags | Reference data |
| music_tracks | Reference data |
| courses, lessons, modules | Educational content |
| All course-related tables | Educational system |
| All P2P tables | P2P marketplace |

---

## Execution Order

Due to foreign key constraints, tables must be deleted in the correct order (child tables before parent tables):

```text
Phase 1: Post-related (child tables first)
Phase 2: Story-related
Phase 3: Message-related
Phase 4: Group-related
Phase 5: Call-related
Phase 6: Live stream/space related
Phase 7: Notification related
Phase 8: Social connections
Phase 9: Credits & transactions
Phase 10: Analytics & tracking
Phase 11: AI history
Phase 12: Moderation
```

---

## Summary

| Category | Tables | Approx Records |
|----------|--------|----------------|
| Posts & Activity | 10 | ~0 (already cleared) |
| Stories | 5 | ~392 |
| Messages | 10 | ~620+ |
| Groups | 13 | ~11+ |
| Calls | 4 | ~165+ |
| Live Streams/Spaces | 14 | ~40+ |
| Notifications | 4 | ~1545+ |
| Social Connections | 4 | ~119+ |
| Credits & Transactions | 7 | ~282+ |
| Analytics | 9 | ~4+ |
| AI History | 6 | ~21+ |
| Moderation | 7 | Unknown |

**Total: ~90+ tables to clear, ~3200+ records to delete**

After this wipe, the app will appear brand new with all registered users intact but zero activity history.

