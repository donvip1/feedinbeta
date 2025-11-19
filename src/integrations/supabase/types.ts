export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_credits: number | null
          created_at: string | null
          feature: string
          id: string
          metadata: Json | null
          model: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string | null
          feature: string
          id?: string
          metadata?: Json | null
          model: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string | null
          feature?: string
          id?: string
          metadata?: Json | null
          model?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string | null
          duration: number | null
          ended_at: string | null
          id: string
          receiver_id: string
          room_url: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          call_type: string
          caller_id: string
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          receiver_id: string
          room_url?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          created_at?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string
          room_url?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user_id: string
          id: string
          signal_data: Json
          to_user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user_id: string
          id?: string
          signal_data: Json
          to_user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          signal_data?: Json
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_emoji_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_emoji_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_flags: {
        Row: {
          auto_action_taken: string | null
          content_id: string
          content_type: string
          created_at: string | null
          flag_type: string
          id: string
          metadata: Json | null
          reviewed: boolean | null
          severity: string
        }
        Insert: {
          auto_action_taken?: string | null
          content_id: string
          content_type: string
          created_at?: string | null
          flag_type: string
          id?: string
          metadata?: Json | null
          reviewed?: boolean | null
          severity: string
        }
        Update: {
          auto_action_taken?: string | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          flag_type?: string
          id?: string
          metadata?: Json | null
          reviewed?: boolean | null
          severity?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string | null
          credits: number
          currency: string
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          promotion_active: boolean | null
          promotion_end: string | null
          promotion_label: string | null
          promotion_start: string | null
          stripe_price_id: string
          updated_at: string | null
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string | null
          credits: number
          currency?: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          promotion_active?: boolean | null
          promotion_end?: string | null
          promotion_label?: string | null
          promotion_start?: string | null
          stripe_price_id: string
          updated_at?: string | null
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string | null
          credits?: number
          currency?: string
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          promotion_active?: boolean | null
          promotion_end?: string | null
          promotion_label?: string | null
          promotion_start?: string | null
          stripe_price_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          related_id: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_id?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_id?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          comments_count: number | null
          content: string | null
          created_at: string | null
          group_id: string
          id: string
          likes_count: number | null
          media_type: string | null
          media_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          group_id: string
          id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          group_id?: string
          id?: string
          likes_count?: number | null
          media_type?: string | null
          media_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          category: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_premium: boolean | null
          is_private: boolean | null
          member_count: number | null
          name: string
          post_count: number | null
          requires_subscription: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_premium?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name: string
          post_count?: number | null
          requires_subscription?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_premium?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name?: string
          post_count?: number | null
          requires_subscription?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          posts_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          posts_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          posts_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      live_stream_analytics: {
        Row: {
          average_watch_time: number | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          peak_concurrent_viewers: number | null
          stream_id: string
          total_comments: number | null
          total_reactions: number | null
          total_views: number | null
          unique_viewers: number | null
        }
        Insert: {
          average_watch_time?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          peak_concurrent_viewers?: number | null
          stream_id: string
          total_comments?: number | null
          total_reactions?: number | null
          total_views?: number | null
          unique_viewers?: number | null
        }
        Update: {
          average_watch_time?: number | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          peak_concurrent_viewers?: number | null
          stream_id?: string
          total_comments?: number | null
          total_reactions?: number | null
          total_views?: number | null
          unique_viewers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_analytics_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_viewers: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          stream_id: string
          user_id: string | null
          watch_duration: number | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          stream_id: string
          user_id?: string | null
          watch_duration?: number | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          stream_id?: string
          user_id?: string | null
          watch_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          duration: number | null
          ended_at: string | null
          id: string
          is_premium: boolean | null
          peak_viewers: number | null
          scheduled_start: string | null
          started_at: string | null
          status: string
          stream_key: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_premium?: boolean | null
          peak_viewers?: number | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
          stream_key: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          is_premium?: boolean | null
          peak_viewers?: number | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
          stream_key?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          downloaded_at: string | null
          file_path: string
          file_size: number
          file_type: string
          id: string
          message_id: string | null
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          downloaded_at?: string | null
          file_path: string
          file_size: number
          file_type: string
          id?: string
          message_id?: string | null
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          downloaded_at?: string | null
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          message_id?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_edit_history: {
        Row: {
          edited_at: string | null
          id: string
          message_id: string
          old_content: string
        }
        Insert: {
          edited_at?: string | null
          id?: string
          message_id: string
          old_content: string
        }
        Update: {
          edited_at?: string | null
          id?: string
          message_id?: string
          old_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_for_receiver: boolean | null
          deleted_for_sender: boolean | null
          edited_at: string | null
          id: string
          is_pinned: boolean | null
          is_read: boolean | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          read_by_receiver_at: string | null
          reply_metadata: Json | null
          reply_to_id: string | null
          sender_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          read_by_receiver_at?: string | null
          reply_metadata?: Json | null
          reply_to_id?: string | null
          sender_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean | null
          is_read?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          read_by_receiver_at?: string | null
          reply_metadata?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          created_at: string | null
          duration: number | null
          expires_at: string | null
          id: string
          moderator_id: string
          notes: string | null
          reason: string
          target_content_id: string | null
          target_content_type: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          moderator_id: string
          notes?: string | null
          reason: string
          target_content_id?: string | null
          target_content_type?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          moderator_id?: string
          notes?: string | null
          reason?: string
          target_content_id?: string | null
          target_content_type?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      moderation_appeals: {
        Row: {
          appeal_text: string
          attachments: Json | null
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          moderation_event_id: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appeal_text: string
          attachments?: Json | null
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          moderation_event_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appeal_text?: string
          attachments?: Json | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          moderation_event_id?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_moderation_event_id_fkey"
            columns: ["moderation_event_id"]
            isOneToOne: false
            referencedRelation: "moderation_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue: {
        Row: {
          auto_labels: Json | null
          confidence_scores: Json | null
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          moderator_notes: string | null
          post_id: string | null
          priority: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_action: string | null
          updated_at: string | null
        }
        Insert: {
          auto_labels?: Json | null
          confidence_scores?: Json | null
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          moderator_notes?: string | null
          post_id?: string | null
          priority?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_action?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_labels?: Json | null
          confidence_scores?: Json | null
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          moderator_notes?: string | null
          post_id?: string | null
          priority?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_action?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_queue_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_users: {
        Row: {
          created_at: string | null
          duration: number | null
          expires_at: string | null
          id: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: []
      }
      notification_badges: {
        Row: {
          last_checked: string | null
          unread_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          last_checked?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          last_checked?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          comments_enabled: boolean | null
          created_at: string
          email_enabled: boolean | null
          id: string
          likes_enabled: boolean | null
          messages_enabled: boolean | null
          stories_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          messages_enabled?: boolean | null
          stories_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          messages_enabled?: boolean | null
          stories_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          from_user_id: string | null
          id: string
          is_read: boolean | null
          message: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offline_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          synced: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          synced?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          synced?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      p2p_escrow: {
        Row: {
          credits_amount: number
          id: string
          locked_at: string
          released_at: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          credits_amount: number
          id?: string
          locked_at?: string
          released_at?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          credits_amount?: number
          id?: string
          locked_at?: string
          released_at?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_escrow_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_listings: {
        Row: {
          created_at: string
          credits_amount: number
          id: string
          price_usd: number
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          id?: string
          price_usd: number
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          id?: string
          price_usd?: number
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_transactions: {
        Row: {
          buyer_id: string
          created_at: string
          credits_amount: number
          escrow_locked: boolean | null
          id: string
          listing_id: string
          price_usd: number
          proof_url: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          credits_amount: number
          escrow_locked?: boolean | null
          id?: string
          listing_id: string
          price_usd: number
          proof_url?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          credits_amount?: number
          escrow_locked?: boolean | null
          id?: string
          listing_id?: string
          price_usd?: number
          proof_url?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "p2p_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          id: string
          status: string
          stripe_payment_intent_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency: string
          description?: string | null
          id?: string
          status: string
          stripe_payment_intent_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      post_analytics: {
        Row: {
          hourly_comments: number | null
          hourly_likes: number | null
          hourly_shares: number | null
          hourly_views: number | null
          id: string
          last_calculated: string | null
          post_id: string | null
        }
        Insert: {
          hourly_comments?: number | null
          hourly_likes?: number | null
          hourly_shares?: number | null
          hourly_views?: number | null
          id?: string
          last_calculated?: string | null
          post_id?: string | null
        }
        Update: {
          hourly_comments?: number | null
          hourly_likes?: number | null
          hourly_shares?: number | null
          hourly_views?: number | null
          id?: string
          last_calculated?: string | null
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string
          replies_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id: string
          replies_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string
          replies_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string | null
          hashtag_id: string | null
          id: string
          post_id: string | null
        }
        Insert: {
          created_at?: string | null
          hashtag_id?: string | null
          id?: string
          post_id?: string | null
        }
        Update: {
          created_at?: string | null
          hashtag_id?: string | null
          id?: string
          post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          share_type: string
          shared_to_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          share_type: string
          shared_to_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          share_type?: string
          shared_to_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          allow_comments: boolean | null
          allow_refeed: boolean | null
          aspect_ratio: string | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          feed_id: string
          has_blur_background: boolean | null
          id: string
          is_original_audio: boolean | null
          likes_count: number | null
          location: string | null
          media_type: string | null
          media_types: string[] | null
          media_url: string | null
          media_urls: string[] | null
          moderation_status: string | null
          music_artist: string | null
          music_title: string | null
          music_url: string | null
          original_post_id: string | null
          post_type: string | null
          privacy: string | null
          refeeds_count: number | null
          scheduled_at: string | null
          shares_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          allow_comments?: boolean | null
          allow_refeed?: boolean | null
          aspect_ratio?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          feed_id: string
          has_blur_background?: boolean | null
          id?: string
          is_original_audio?: boolean | null
          likes_count?: number | null
          location?: string | null
          media_type?: string | null
          media_types?: string[] | null
          media_url?: string | null
          media_urls?: string[] | null
          moderation_status?: string | null
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          original_post_id?: string | null
          post_type?: string | null
          privacy?: string | null
          refeeds_count?: number | null
          scheduled_at?: string | null
          shares_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          allow_comments?: boolean | null
          allow_refeed?: boolean | null
          aspect_ratio?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          feed_id?: string
          has_blur_background?: boolean | null
          id?: string
          is_original_audio?: boolean | null
          likes_count?: number | null
          location?: string | null
          media_type?: string | null
          media_types?: string[] | null
          media_url?: string | null
          media_urls?: string[] | null
          moderation_status?: string | null
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          original_post_id?: string | null
          post_type?: string | null
          privacy?: string | null
          refeeds_count?: number | null
          scheduled_at?: string | null
          shares_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          about_updated_at: string | null
          about_visibility: string | null
          age: number | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          daily_ai_chat_count: number | null
          daily_ai_eduqa_count: number | null
          daily_ai_image_count: number | null
          daily_ai_thesis_count: number | null
          daily_ai_video_count: number | null
          daily_enhancement_count: number | null
          display_name: string | null
          facebook_url: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          instagram_url: string | null
          interests: string[] | null
          is_premium: boolean | null
          last_ai_reset: string | null
          last_ai_reset_date: string | null
          last_enhancement_reset: string | null
          last_free_enhancement: string | null
          last_username_change: string | null
          linkedin_url: string | null
          location: string | null
          marital_status: string | null
          max_friends: number | null
          phone_number: string | null
          purpose: string[] | null
          purpose_updated_at: string | null
          status: string | null
          status_updated_at: string | null
          status_visibility: string | null
          stripe_customer_id: string | null
          tiktok_url: string | null
          total_views: number | null
          twitter_url: string | null
          updated_at: string
          username: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about?: string | null
          about_updated_at?: string | null
          about_visibility?: string | null
          age?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          daily_ai_chat_count?: number | null
          daily_ai_eduqa_count?: number | null
          daily_ai_image_count?: number | null
          daily_ai_thesis_count?: number | null
          daily_ai_video_count?: number | null
          daily_enhancement_count?: number | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          id: string
          instagram_url?: string | null
          interests?: string[] | null
          is_premium?: boolean | null
          last_ai_reset?: string | null
          last_ai_reset_date?: string | null
          last_enhancement_reset?: string | null
          last_free_enhancement?: string | null
          last_username_change?: string | null
          linkedin_url?: string | null
          location?: string | null
          marital_status?: string | null
          max_friends?: number | null
          phone_number?: string | null
          purpose?: string[] | null
          purpose_updated_at?: string | null
          status?: string | null
          status_updated_at?: string | null
          status_visibility?: string | null
          stripe_customer_id?: string | null
          tiktok_url?: string | null
          total_views?: number | null
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about?: string | null
          about_updated_at?: string | null
          about_visibility?: string | null
          age?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          daily_ai_chat_count?: number | null
          daily_ai_eduqa_count?: number | null
          daily_ai_image_count?: number | null
          daily_ai_thesis_count?: number | null
          daily_ai_video_count?: number | null
          daily_enhancement_count?: number | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          instagram_url?: string | null
          interests?: string[] | null
          is_premium?: boolean | null
          last_ai_reset?: string | null
          last_ai_reset_date?: string | null
          last_enhancement_reset?: string | null
          last_free_enhancement?: string | null
          last_username_change?: string | null
          linkedin_url?: string | null
          location?: string | null
          marital_status?: string | null
          max_friends?: number | null
          phone_number?: string | null
          purpose?: string[] | null
          purpose_updated_at?: string | null
          status?: string | null
          status_updated_at?: string | null
          status_visibility?: string | null
          stripe_customer_id?: string | null
          tiktok_url?: string | null
          total_views?: number | null
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      refeeds: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          refed_by_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          refed_by_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          refed_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refeeds_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_awarded: boolean
          code: string
          created_at: string
          id: string
          purchased_at: string | null
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          bonus_awarded?: boolean
          code: string
          created_at?: string
          id?: string
          purchased_at?: string | null
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          bonus_awarded?: boolean
          code?: string
          created_at?: string
          id?: string
          purchased_at?: string | null
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          collection_name: string | null
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          collection_name?: string | null
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
          views_count: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url: string
          user_id: string
          views_count?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          story_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          story_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          story_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "active_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "active_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "active_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          created_at: string | null
          currency: string
          features: Json
          id: string
          interval: string
          is_active: boolean | null
          name: string
          price: number
          stripe_price_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string
          features?: Json
          id?: string
          interval: string
          is_active?: boolean | null
          name: string
          price: number
          stripe_price_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean | null
          name?: string
          price?: number
          stripe_price_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trending_posts: {
        Row: {
          calculated_at: string | null
          engagement_score: number | null
          id: string
          post_id: string | null
          trending_rank: number | null
        }
        Insert: {
          calculated_at?: string | null
          engagement_score?: number | null
          id?: string
          post_id?: string | null
          trending_rank?: number | null
        }
        Update: {
          calculated_at?: string | null
          engagement_score?: number | null
          id?: string
          post_id?: string | null
          trending_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trending_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          is_typing: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_analytics: {
        Row: {
          created_at: string | null
          id: string
          last_purchase_at: string | null
          total_credits_purchased: number | null
          total_credits_spent: number | null
          total_subscriptions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_purchase_at?: string | null
          total_credits_purchased?: number | null
          total_credits_spent?: number | null
          total_subscriptions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_purchase_at?: string | null
          total_credits_purchased?: number | null
          total_credits_spent?: number | null
          total_subscriptions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          total_earned: number
          total_spent: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_mfa_settings: {
        Row: {
          created_at: string | null
          id: string
          mfa_enabled: boolean | null
          mfa_required: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mfa_enabled?: boolean | null
          mfa_required?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mfa_enabled?: boolean | null
          mfa_required?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_strikes: {
        Row: {
          expires_at: string | null
          id: string
          is_active: boolean | null
          issued_at: string | null
          issued_by: string
          notes: string | null
          reason: string
          related_content_id: string | null
          related_content_type: string | null
          severity: string
          strike_type: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          issued_by: string
          notes?: string | null
          reason: string
          related_content_id?: string | null
          related_content_type?: string | null
          severity?: string
          strike_type: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          issued_at?: string | null
          issued_by?: string
          notes?: string | null
          reason?: string
          related_content_id?: string | null
          related_content_type?: string | null
          severity?: string
          strike_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tier_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tier_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_stories: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          expires_at: string | null
          id: string | null
          media_type: string | null
          media_url: string | null
          user_id: string | null
          username: string | null
          view_count: number | null
          views_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_strike_summary: {
        Row: {
          active_strikes: number | null
          high_severity_strikes: number | null
          last_strike_date: string | null
          total_strikes: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_grant_credits: {
        Args: { credit_amount: number; reason?: string; target_user_id: string }
        Returns: Json
      }
      are_mutual_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      calculate_trending_posts: { Args: never; Returns: undefined }
      can_change_username: { Args: { user_id: string }; Returns: boolean }
      can_delete_for_everyone: {
        Args: { message_id: string; user_id: string }
        Returns: boolean
      }
      can_update_purpose: { Args: { user_id: string }; Returns: boolean }
      cleanup_expired_stories: { Args: never; Returns: undefined }
      create_conversation: { Args: { other_user_id: string }; Returns: string }
      delete_expired_stories: { Args: never; Returns: undefined }
      generate_feed_id: { Args: never; Returns: string }
      generate_stream_key: { Args: never; Returns: string }
      get_expired_attachments: {
        Args: never
        Returns: {
          file_path: string
          id: string
          message_id: string
        }[]
      }
      get_message_read_receipts: {
        Args: { message_ids: string[] }
        Returns: {
          message_id: string
          read_at: string
          user_id: string
        }[]
      }
      get_personalized_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          feed_id: string
          id: string
          likes_count: number
          media_type: string
          media_url: string
          relevance_score: number
          user_id: string
          views_count: number
        }[]
      }
      get_post_view_count: { Args: { post_id_param: string }; Returns: number }
      get_unread_message_count: {
        Args: { conv_id: string; uid: string }
        Returns: number
      }
      get_user_post_count: { Args: { user_uuid: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member_simple: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_blocked: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_user_muted: {
        Args: { muted: string; muter: string }
        Returns: boolean
      }
      mark_attachment_downloaded: {
        Args: { attachment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
