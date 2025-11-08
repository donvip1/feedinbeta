-- Performance optimization: Add indexes for foreign key columns
-- This improves JOIN performance and referential integrity checks

-- Call signals indexes
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id ON public.call_signals(call_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_from_user_id ON public.call_signals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_to_user_id ON public.call_signals(to_user_id);

-- Content reports indexes
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user_id ON public.content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reviewed_by ON public.content_reports(reviewed_by);

-- Group posts index
CREATE INDEX IF NOT EXISTS idx_group_posts_group_id ON public.group_posts(group_id);

-- Live stream indexes
CREATE INDEX IF NOT EXISTS idx_live_stream_analytics_stream_id ON public.live_stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_comments_user_id ON public.live_stream_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_comments_stream_id ON public.live_stream_comments(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_reactions_user_id ON public.live_stream_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_reactions_stream_id ON public.live_stream_reactions(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_user_id ON public.live_stream_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_stream_id ON public.live_stream_viewers(stream_id);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_message_edit_history_message_id ON public.message_edit_history(message_id);

-- Moderation indexes
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id ON public.moderation_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_user_id ON public.moderation_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_moderation_event_id ON public.moderation_appeals(moderation_event_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_reviewed_by ON public.moderation_appeals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user_id ON public.moderation_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_post_id ON public.moderation_queue(post_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_reviewed_by ON public.moderation_queue(reviewed_by);

-- Notifications index
CREATE INDEX IF NOT EXISTS idx_notifications_from_user_id ON public.notifications(from_user_id);

-- P2P marketplace indexes
CREATE INDEX IF NOT EXISTS idx_p2p_escrow_transaction_id ON public.p2p_escrow(transaction_id);
CREATE INDEX IF NOT EXISTS idx_p2p_listings_seller_id ON public.p2p_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transactions_buyer_id ON public.p2p_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transactions_listing_id ON public.p2p_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_p2p_transactions_seller_id ON public.p2p_transactions(seller_id);

-- Post shares indexes
CREATE INDEX IF NOT EXISTS idx_post_shares_shared_to_user_id ON public.post_shares(shared_to_user_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_user_id ON public.post_shares(user_id);

-- User analytics index
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics(user_id);

-- User subscriptions index
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier_id ON public.user_subscriptions(tier_id);

-- Additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, is_read, created_at DESC);