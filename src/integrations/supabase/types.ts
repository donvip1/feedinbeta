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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      call_invites: {
        Row: {
          call_id: string | null
          call_type: string | null
          created_at: string
          id: string
          invited_user_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          call_id?: string | null
          call_type?: string | null
          created_at?: string
          id?: string
          invited_user_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          call_id?: string | null
          call_type?: string | null
          created_at?: string
          id?: string
          invited_user_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_invites_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string
          credits_deducted: number
          duration_seconds: number
          ended_at: string | null
          id: string
          receiver_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_type: string
          caller_id: string
          created_at?: string
          credits_deducted?: number
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          created_at?: string
          credits_deducted?: number
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
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
            foreignKeyName: "call_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
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
          {
            foreignKeyName: "call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          id: string
          payload: Json
          recipient_id: string | null
          sender_id: string
          signal_type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          sender_id: string
          signal_type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          sender_id?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_posts: {
        Row: {
          author_id: string
          channel_id: string
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          view_count: number
        }
        Insert: {
          author_id: string
          channel_id: string
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          view_count?: number
        }
        Update: {
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_subscribers: {
        Row: {
          channel_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_subscribers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_subscribers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_subscribers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          group_conversation_id: string | null
          id: string
          is_verified: boolean
          name: string
          owner_id: string
          slug: string | null
          subscriber_count: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          group_conversation_id?: string | null
          id?: string
          is_verified?: boolean
          name: string
          owner_id: string
          slug?: string | null
          subscriber_count?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          group_conversation_id?: string | null
          id?: string
          is_verified?: boolean
          name?: string
          owner_id?: string
          slug?: string | null
          subscriber_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_group_conversation_id_fkey"
            columns: ["group_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          created_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
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
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          disappearing_seconds: number
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disappearing_seconds?: number
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disappearing_seconds?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_incentive_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_earnings: number | null
          min_earnings: number
          name: string
          payout_percentage: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_earnings?: number | null
          min_earnings?: number
          name: string
          payout_percentage?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_earnings?: number | null
          min_earnings?: number
          name?: string
          payout_percentage?: number
        }
        Relationships: []
      }
      creator_monetization: {
        Row: {
          available_balance: number
          is_monetized: boolean
          last_payout_at: string | null
          monetized_at: string | null
          next_eligible_payout: string | null
          total_earnings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          is_monetized?: boolean
          last_payout_at?: string | null
          monetized_at?: string | null
          next_eligible_payout?: string | null
          total_earnings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          is_monetized?: boolean
          last_payout_at?: string | null
          monetized_at?: string | null
          next_eligible_payout?: string | null
          total_earnings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_monetization_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_monetization_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_destination_secrets: {
        Row: {
          created_at: string
          destination_id: string
          metadata: Json
          provider_reference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_id: string
          metadata?: Json
          provider_reference: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_id?: string
          metadata?: Json
          provider_reference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_destination_secrets_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: true
            referencedRelation: "creator_payout_destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_destinations: {
        Row: {
          account_last4: string | null
          country_code: string | null
          created_at: string
          currency: string
          display_label: string
          id: string
          is_default: boolean
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_last4?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string
          display_label: string
          id?: string
          is_default?: boolean
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_last4?: string | null
          country_code?: string | null
          created_at?: string
          currency?: string
          display_label?: string
          id?: string
          is_default?: boolean
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payout_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          amount_minor: number | null
          currency: string
          failure_reason: string | null
          funds_released_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          payout_destination_id: string | null
          payout_method: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          amount_minor?: number | null
          currency?: string
          failure_reason?: string | null
          funds_released_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payout_destination_id?: string | null
          payout_method?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          amount_minor?: number | null
          currency?: string
          failure_reason?: string | null
          funds_released_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payout_destination_id?: string | null
          payout_method?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payout_requests_payout_destination_id_fkey"
            columns: ["payout_destination_id"]
            isOneToOne: false
            referencedRelation: "creator_payout_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payout_request_id: string | null
          provider_reference: string | null
          status: string
          tier_id: string | null
          total_earnings: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_request_id?: string | null
          provider_reference?: string | null
          status?: string
          tier_id?: string | null
          total_earnings?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_request_id?: string | null
          provider_reference?: string | null
          status?: string
          tier_id?: string | null
          total_earnings?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payouts_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "creator_payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payouts_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "creator_incentive_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          currency: string
          id: string
          is_active: boolean
          name: string
          paystack_plan_code: string | null
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits: number
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          paystack_plan_code?: string | null
          price_cents: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          paystack_plan_code?: string | null
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json
          p2p_transaction_id: string | null
          payment_provider: string | null
          payment_reference: string | null
          stripe_payment_intent_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          p2p_transaction_id?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          stripe_payment_intent_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          p2p_transaction_id?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          stripe_payment_intent_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_p2p_transaction_id_fkey"
            columns: ["p2p_transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_earnings: {
        Row: {
          created_at: string
          earning_date: string
          gift_fees: number
          id: string
          p2p_fees: number
          post_earnings: number
          subscription_fees: number
          user_id: string
        }
        Insert: {
          created_at?: string
          earning_date?: string
          gift_fees?: number
          id?: string
          p2p_fees?: number
          post_earnings?: number
          subscription_fees?: number
          user_id: string
        }
        Update: {
          created_at?: string
          earning_date?: string
          gift_fees?: number
          id?: string
          p2p_fees?: number
          post_earnings?: number
          subscription_fees?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_credit_buyback_audit: {
        Row: {
          actor_role: string
          actor_user_id: string
          created_at: string
          credit_transaction_id: string | null
          credits_amount: number
          event_type: string
          external_payment_reference: string | null
          from_status: string | null
          id: number
          notes: string | null
          platform_wallet_balance_after: number | null
          request_id: string
          to_status: string
          usd_amount_cents: number | null
          user_balance_after: number | null
        }
        Insert: {
          actor_role: string
          actor_user_id: string
          created_at?: string
          credit_transaction_id?: string | null
          credits_amount: number
          event_type: string
          external_payment_reference?: string | null
          from_status?: string | null
          id?: never
          notes?: string | null
          platform_wallet_balance_after?: number | null
          request_id: string
          to_status: string
          usd_amount_cents?: number | null
          user_balance_after?: number | null
        }
        Update: {
          actor_role?: string
          actor_user_id?: string
          created_at?: string
          credit_transaction_id?: string | null
          credits_amount?: number
          event_type?: string
          external_payment_reference?: string | null
          from_status?: string | null
          id?: never
          notes?: string | null
          platform_wallet_balance_after?: number | null
          request_id?: string
          to_status?: string
          usd_amount_cents?: number | null
          user_balance_after?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_credit_buyback_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_audit_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_audit_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "finance_credit_buyback_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_credit_buyback_requests: {
        Row: {
          canceled_at: string | null
          completed_at: string | null
          credits_amount: number
          external_payment_reference: string | null
          hold_transaction_id: string
          id: string
          idempotency_key: string
          notes: string | null
          platform_wallet_balance_after: number | null
          refund_transaction_id: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_currency: string | null
          status: string
          updated_at: string
          usd_amount_cents: number | null
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          completed_at?: string | null
          credits_amount: number
          external_payment_reference?: string | null
          hold_transaction_id: string
          id?: string
          idempotency_key: string
          notes?: string | null
          platform_wallet_balance_after?: number | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          rejected_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_currency?: string | null
          status?: string
          updated_at?: string
          usd_amount_cents?: number | null
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          completed_at?: string | null
          credits_amount?: number
          external_payment_reference?: string | null
          hold_transaction_id?: string
          id?: string
          idempotency_key?: string
          notes?: string | null
          platform_wallet_balance_after?: number | null
          refund_transaction_id?: string | null
          refunded_at?: string | null
          rejected_at?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_currency?: string | null
          status?: string
          updated_at?: string
          usd_amount_cents?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_credit_buyback_requests_hold_transaction_id_fkey"
            columns: ["hold_transaction_id"]
            isOneToOne: true
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_requests_refund_transaction_id_fkey"
            columns: ["refund_transaction_id"]
            isOneToOne: true
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_credit_buyback_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_analytics: {
        Row: {
          created_at: string
          credit_value: number
          gift_type: string
          id: string
          receiver_id: string | null
          sender_id: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          created_at?: string
          credit_value?: number
          gift_type: string
          id?: string
          receiver_id?: string | null
          sender_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          created_at?: string
          credit_value?: number
          gift_type?: string
          id?: string
          receiver_id?: string | null
          sender_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_analytics_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_analytics_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_analytics_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_analytics_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_appreciation_options: {
        Row: {
          created_at: string
          credit_value: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          credit_value?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          credit_value?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      group_call_participants: {
        Row: {
          call_id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          call_id: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          call_id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "group_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_calls: {
        Row: {
          call_type: string
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          status: string
          title: string | null
        }
        Insert: {
          call_type?: string
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          status?: string
          title?: string | null
        }
        Update: {
          call_type?: string
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_calls_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_calls_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          status?: string
          updated_at?: string
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
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_by: string | null
          can_send_messages: boolean
          group_id: string
          id: string
          joined_at: string
          muted_until: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          can_send_messages?: boolean
          group_id: string
          id?: string
          joined_at?: string
          muted_until?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          can_send_messages?: boolean
          group_id?: string
          id?: string
          joined_at?: string
          muted_until?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          file_name: string | null
          file_size: number | null
          group_id: string
          id: string
          is_pinned: boolean
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          group_id: string
          id?: string
          is_pinned?: boolean
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          file_name?: string | null
          file_size?: number | null
          group_id?: string
          id?: string
          is_pinned?: boolean
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          group_id: string
          id: string
          likes_count: number
          media_type: string | null
          media_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content?: string
          created_at?: string
          group_id: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          likes_count?: number
          media_type?: string | null
          media_url?: string | null
          status?: string
          updated_at?: string
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
          {
            foreignKeyName: "group_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          invite_code: string
          is_premium: boolean
          is_private: boolean
          member_count: number
          name: string
          post_count: number
          requires_subscription: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          invite_code?: string
          is_premium?: boolean
          is_private?: boolean
          member_count?: number
          name: string
          post_count?: number
          requires_subscription?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          invite_code?: string
          is_premium?: boolean
          is_private?: boolean
          member_count?: number
          name?: string
          post_count?: number
          requires_subscription?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_gifts: {
        Row: {
          created_at: string
          credit_value: number
          gift_type: string
          id: string
          receiver_id: string | null
          sender_id: string
          space_id: string | null
        }
        Insert: {
          created_at?: string
          credit_value?: number
          gift_type: string
          id?: string
          receiver_id?: string | null
          sender_id: string
          space_id?: string | null
        }
        Update: {
          created_at?: string
          credit_value?: number
          gift_type?: string
          id?: string
          receiver_id?: string | null
          sender_id?: string
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_space_gifts_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_gifts_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_gifts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_gifts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_gifts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_invitations: {
        Row: {
          created_at: string
          id: string
          invited_user_id: string
          inviter_id: string
          responded_at: string | null
          space_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_user_id: string
          inviter_id: string
          responded_at?: string | null
          space_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_user_id?: string
          inviter_id?: string
          responded_at?: string | null
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_space_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_invitations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_message_likes: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_space_message_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "live_space_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_message_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_message_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_to_id: string | null
          space_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          space_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_space_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "live_space_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_messages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_space_reactions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_speakers: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          muted: boolean
          role: string
          space_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          muted?: boolean
          role?: string
          space_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          muted?: boolean
          role?: string
          space_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_space_speakers_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_speakers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_space_speakers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_spaces: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          id: string
          is_recording_enabled: boolean
          recording_url: string | null
          started_at: string | null
          status: string
          title: string
          topic_category: string | null
          updated_at: string
          user_id: string
          viewer_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_recording_enabled?: boolean
          recording_url?: string | null
          started_at?: string | null
          status?: string
          title?: string
          topic_category?: string | null
          updated_at?: string
          user_id: string
          viewer_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          is_recording_enabled?: boolean
          recording_url?: string | null
          started_at?: string | null
          status?: string
          title?: string
          topic_category?: string | null
          updated_at?: string
          user_id?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_spaces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_spaces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_analytics: {
        Row: {
          comments_count: number
          created_at: string
          duration_seconds: number
          gifts_count: number
          id: string
          peak_viewer_count: number
          stream_id: string
          viewer_count: number
        }
        Insert: {
          comments_count?: number
          created_at?: string
          duration_seconds?: number
          gifts_count?: number
          id?: string
          peak_viewer_count?: number
          stream_id: string
          viewer_count?: number
        }
        Update: {
          comments_count?: number
          created_at?: string
          duration_seconds?: number
          gifts_count?: number
          id?: string
          peak_viewer_count?: number
          stream_id?: string
          viewer_count?: number
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
      live_stream_chat_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_chat_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "live_stream_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
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
          {
            foreignKeyName: "live_stream_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_gifts: {
        Row: {
          created_at: string
          credit_value: number
          gift_type: string
          id: string
          receiver_id: string | null
          sender_id: string
          stream_id: string | null
        }
        Insert: {
          created_at?: string
          credit_value?: number
          gift_type: string
          id?: string
          receiver_id?: string | null
          sender_id: string
          stream_id?: string | null
        }
        Update: {
          created_at?: string
          credit_value?: number
          gift_type?: string
          id?: string
          receiver_id?: string | null
          sender_id?: string
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_gifts_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_gifts_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_gifts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_gifts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_gifts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_invites: {
        Row: {
          created_at: string
          id: string
          invited_user_id: string
          inviter_id: string
          responded_at: string | null
          status: string
          stream_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_user_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
          stream_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_user_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          {
            foreignKeyName: "live_stream_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_viewers: {
        Row: {
          joined_at: string
          left_at: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          left_at?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          left_at?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_viewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_viewers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          group_conversation_id: string | null
          id: string
          is_recording_enabled: boolean
          playback_url: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          stream_features: Json
          stream_key: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          viewer_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          group_conversation_id?: string | null
          id?: string
          is_recording_enabled?: boolean
          playback_url?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          stream_features?: Json
          stream_key?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          viewer_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          group_conversation_id?: string | null
          id?: string
          is_recording_enabled?: boolean
          playback_url?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          stream_features?: Json
          stream_key?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_group_conversation_id_fkey"
            columns: ["group_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_streams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          conversation_id: string
          created_at: string
          deleted_at: string | null
          downloaded_at: string | null
          duration_ms: number | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          media_type: string
          message_id: string
          mime_type: string | null
          public_url: string | null
          sender_id: string
          storage_bucket: string
          storage_path: string
          thumbnail_url: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          downloaded_at?: string | null
          duration_ms?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          media_type?: string
          message_id: string
          mime_type?: string | null
          public_url?: string | null
          sender_id: string
          storage_bucket?: string
          storage_path: string
          thumbnail_url?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          downloaded_at?: string | null
          duration_ms?: number | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          media_type?: string
          message_id?: string
          mime_type?: string | null
          public_url?: string | null
          sender_id?: string
          storage_bucket?: string
          storage_path?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          conversation_id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_stars: {
        Row: {
          conversation_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_stars_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_stars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          delivered_at: string | null
          expires_at: string | null
          id: string
          is_read: boolean
          message_type: string
          metadata: Json
          read_at: string | null
          sender_id: string
          status: string
          updated_at: string
          view_once: boolean
          view_once_seen_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json
          read_at?: string | null
          sender_id: string
          status?: string
          updated_at?: string
          view_once?: boolean
          view_once_seen_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message_type?: string
          metadata?: Json
          read_at?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
          view_once?: boolean
          view_once_seen_at?: string | null
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
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          badges_enabled: boolean
          comments_enabled: boolean
          created_at: string
          email_enabled: boolean
          follows_enabled: boolean
          friend_requests_enabled: boolean
          likes_enabled: boolean
          mentions_enabled: boolean
          messages_enabled: boolean
          push_enabled: boolean
          replies_enabled: boolean
          stories_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          badges_enabled?: boolean
          comments_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          follows_enabled?: boolean
          friend_requests_enabled?: boolean
          likes_enabled?: boolean
          mentions_enabled?: boolean
          messages_enabled?: boolean
          push_enabled?: boolean
          replies_enabled?: boolean
          stories_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          badges_enabled?: boolean
          comments_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          follows_enabled?: boolean
          friend_requests_enabled?: boolean
          likes_enabled?: boolean
          mentions_enabled?: boolean
          messages_enabled?: boolean
          push_enabled?: boolean
          replies_enabled?: boolean
          stories_enabled?: boolean
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
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_type: string | null
          action_url: string | null
          created_at: string
          data: Json
          fcm_payload: Json
          from_user_id: string | null
          id: string
          is_read: boolean
          message: string | null
          read_at: string | null
          related_id: string | null
          related_type: string | null
          route: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_type?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json
          fcm_payload?: Json
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          route?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_type?: string | null
          action_url?: string | null
          created_at?: string
          data?: Json
          fcm_payload?: Json
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          route?: string | null
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
            foreignKeyName: "notifications_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_chat_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_disputes: {
        Row: {
          award_to: string | null
          created_at: string
          id: string
          initiated_by: string
          moderator_id: string | null
          reason: string | null
          resolution: string | null
          resolved_at: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          award_to?: string | null
          created_at?: string
          id?: string
          initiated_by: string
          moderator_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          award_to?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          moderator_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_disputes_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_escrow: {
        Row: {
          buyer_id: string
          credits_amount: number
          dispute_id: string | null
          id: string
          locked_at: string
          refunded_at: string | null
          released_at: string | null
          seller_id: string
          settled_by: string | null
          settlement_reason: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          buyer_id: string
          credits_amount: number
          dispute_id?: string | null
          id?: string
          locked_at?: string
          refunded_at?: string | null
          released_at?: string | null
          seller_id: string
          settled_by?: string | null
          settlement_reason?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          buyer_id?: string
          credits_amount?: number
          dispute_id?: string | null
          id?: string
          locked_at?: string
          refunded_at?: string | null
          released_at?: string | null
          seller_id?: string
          settled_by?: string | null
          settlement_reason?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_escrow_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "p2p_disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_escrow_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
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
          currency: string
          id: string
          payment_method_id: string | null
          payment_window_minutes: number | null
          price_cents: number
          reservation_expires_at: string | null
          reserved_at: string | null
          reserved_transaction_id: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_amount: number
          currency?: string
          id?: string
          payment_method_id?: string | null
          payment_window_minutes?: number | null
          price_cents: number
          reservation_expires_at?: string | null
          reserved_at?: string | null
          reserved_transaction_id?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_amount?: number
          currency?: string
          id?: string
          payment_method_id?: string | null
          payment_window_minutes?: number | null
          price_cents?: number
          reservation_expires_at?: string | null
          reserved_at?: string | null
          reserved_transaction_id?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_listings_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "p2p_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_listings_reserved_transaction_id_fkey"
            columns: ["reserved_transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_payment_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          method_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          method_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          method_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_payment_proofs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          proof_type: string
          proof_url: string | null
          transaction_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          proof_type?: string
          proof_url?: string | null
          transaction_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          proof_type?: string
          proof_url?: string | null
          transaction_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_payment_proofs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_payment_proofs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_payment_proofs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_trade_events: {
        Row: {
          actor_id: string
          created_at: string
          credit_transaction_id: string | null
          credits_amount: number
          details: Json
          event_type: string
          from_status: string | null
          id: number
          listing_id: string | null
          to_status: string
          transaction_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          credit_transaction_id?: string | null
          credits_amount: number
          details?: Json
          event_type: string
          from_status?: string | null
          id?: never
          listing_id?: string | null
          to_status: string
          transaction_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          credit_transaction_id?: string | null
          credits_amount?: number
          details?: Json
          event_type?: string
          from_status?: string | null
          id?: never
          listing_id?: string | null
          to_status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_trade_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_trade_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_trade_events_credit_transaction_id_fkey"
            columns: ["credit_transaction_id"]
            isOneToOne: false
            referencedRelation: "credit_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_trade_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "p2p_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_trade_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_transactions: {
        Row: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          credits_amount: number
          currency?: string
          dispute_id?: string | null
          escrow_locked?: boolean
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          listing_id?: string | null
          price_cents: number
          proof_notes?: string | null
          proof_submitted_at?: string | null
          proof_url?: string | null
          seller_id: string
          settled_at?: string | null
          settled_to?: string | null
          settlement_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          credits_amount?: number
          currency?: string
          dispute_id?: string | null
          escrow_locked?: boolean
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          listing_id?: string | null
          price_cents?: number
          proof_notes?: string | null
          proof_submitted_at?: string | null
          proof_url?: string | null
          seller_id?: string
          settled_at?: string | null
          settled_to?: string | null
          settlement_reason?: string | null
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
            foreignKeyName: "p2p_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_transactions_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "p2p_disputes"
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
          {
            foreignKeyName: "p2p_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_user_eligibility: {
        Row: {
          can_buy: boolean
          can_sell: boolean
          completed_trades: number
          dispute_count: number
          first_p2p_trade_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_buy?: boolean
          can_sell?: boolean
          completed_trades?: number
          dispute_count?: number
          first_p2p_trade_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_buy?: boolean
          can_sell?: boolean
          completed_trades?: number
          dispute_count?: number
          first_p2p_trade_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p2p_user_eligibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_user_eligibility_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_cents: number
          created_at: string
          credit_package_id: string | null
          currency: string
          description: string | null
          id: string
          metadata: Json
          payment_intent_id: string | null
          provider: string
          provider_reference: string | null
          purchase_type: string | null
          status: string
          subscription_tier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credit_package_id?: string | null
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          payment_intent_id?: string | null
          provider: string
          provider_reference?: string | null
          purchase_type?: string | null
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credit_package_id?: string | null
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json
          payment_intent_id?: string | null
          provider?: string
          provider_reference?: string | null
          purchase_type?: string | null
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_credit_package_id_fkey"
            columns: ["credit_package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "wallet_payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_subscription_tier_id_fkey"
            columns: ["subscription_tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      platform_wallet: {
        Row: {
          balance: number
          id: number
          lifetime_issued: number
          lifetime_supplied: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: number
          lifetime_issued?: number
          lifetime_supplied?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: number
          lifetime_issued?: number
          lifetime_supplied?: number
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
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
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_view_history: {
        Row: {
          id: string
          post_id: string
          user_id: string
          view_count: number
          viewed_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          view_count?: number
          viewed_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          view_count?: number
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_view_history_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_view_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_view_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          id: string
          likes_count: number
          location: string | null
          media_type: string | null
          media_types: string[]
          media_url: string | null
          media_urls: string[]
          original_post_id: string | null
          post_type: string
          privacy: string
          refeeds_count: number
          status: string
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          location?: string | null
          media_type?: string | null
          media_types?: string[]
          media_url?: string | null
          media_urls?: string[]
          original_post_id?: string | null
          post_type?: string
          privacy?: string
          refeeds_count?: number
          status?: string
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          comments_count?: number
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number
          location?: string | null
          media_type?: string | null
          media_types?: string[]
          media_url?: string | null
          media_urls?: string[]
          original_post_id?: string | null
          post_type?: string
          privacy?: string
          refeeds_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          views_count?: number
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
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          facebook_url: string | null
          followers_count: number
          following_count: number
          id: string
          instagram_url: string | null
          is_premium: boolean
          linkedin_url: string | null
          location: string | null
          phone_hash: string | null
          plan_tier: string | null
          privacy_about: string
          privacy_last_seen: string
          privacy_photo: string
          privacy_status: string
          role: string | null
          tiktok_url: string | null
          total_views: number
          twitter_url: string | null
          updated_at: string
          username: string | null
          username_changed_at: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number
          following_count?: number
          id: string
          instagram_url?: string | null
          is_premium?: boolean
          linkedin_url?: string | null
          location?: string | null
          phone_hash?: string | null
          plan_tier?: string | null
          privacy_about?: string
          privacy_last_seen?: string
          privacy_photo?: string
          privacy_status?: string
          role?: string | null
          tiktok_url?: string | null
          total_views?: number
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number
          following_count?: number
          id?: string
          instagram_url?: string | null
          is_premium?: boolean
          linkedin_url?: string | null
          location?: string | null
          phone_hash?: string | null
          plan_tier?: string | null
          privacy_about?: string
          privacy_last_seen?: string
          privacy_photo?: string
          privacy_status?: string
          role?: string | null
          tiktok_url?: string | null
          total_views?: number
          twitter_url?: string | null
          updated_at?: string
          username?: string | null
          username_changed_at?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          app_version: string | null
          auth: string | null
          created_at: string
          device_id: string | null
          device_token: string | null
          endpoint: string | null
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh: string | null
          platform: string
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device_id?: string | null
          device_token?: string | null
          endpoint?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string | null
          platform?: string
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device_id?: string | null
          device_token?: string | null
          endpoint?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string | null
          platform?: string
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          music_artist: string | null
          music_title: string | null
          music_url: string | null
          user_id: string
          views_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url: string
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          user_id: string
          views_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "story_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          billing_interval: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          paystack_plan_code: string | null
          price_cents: number
          stripe_price_id: string | null
          subscription_credits: number
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          paystack_plan_code?: string | null
          price_cents?: number
          stripe_price_id?: string | null
          subscription_credits?: number
        }
        Update: {
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          paystack_plan_code?: string | null
          price_cents?: number
          stripe_price_id?: string | null
          subscription_credits?: number
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          activity: string
          conversation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity?: string
          conversation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          conversation_id?: string
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
          {
            foreignKeyName: "typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          last_seen_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          last_payment_reference: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          tier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_reference?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          last_payment_reference?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tier_id?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_payment_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          payload_hash: string | null
          payment_intent_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          payload_hash?: string | null
          payment_intent_id?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          status?: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          payload_hash?: string | null
          payment_intent_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_payment_events_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "wallet_payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_payment_intents: {
        Row: {
          amount_minor: number
          billing_interval: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          credit_package_id: string | null
          credits_amount: number
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          initialization_token: string | null
          metadata: Json
          provider: string
          provider_checkout_id: string | null
          provider_payment_reference: string | null
          provider_reference: string | null
          provider_subscription_id: string | null
          purchase_type: string
          status: string
          subscription_tier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          billing_interval?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_amount?: number
          currency: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key: string
          initialization_token?: string | null
          metadata?: Json
          provider: string
          provider_checkout_id?: string | null
          provider_payment_reference?: string | null
          provider_reference?: string | null
          provider_subscription_id?: string | null
          purchase_type: string
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          billing_interval?: string | null
          checkout_url?: string | null
          completed_at?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_amount?: number
          currency?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          initialization_token?: string | null
          metadata?: Json
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_reference?: string | null
          provider_reference?: string | null
          provider_subscription_id?: string | null
          purchase_type?: string
          status?: string
          subscription_tier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_payment_intents_credit_package_id_fkey"
            columns: ["credit_package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_payment_intents_subscription_tier_id_fkey"
            columns: ["subscription_tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_payment_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_payment_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_stories: {
        Row: {
          caption: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          media_type: string | null
          media_url: string | null
          music_artist: string | null
          music_title: string | null
          music_url: string | null
          user_id: string | null
          views_count: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          media_type?: string | null
          media_url?: string | null
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string | null
          views_count?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          media_type?: string | null
          media_url?: string | null
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          user_id?: string | null
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
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          facebook_url: string | null
          followers_count: number | null
          following_count: number | null
          id: string | null
          instagram_url: string | null
          is_premium: boolean | null
          linkedin_url: string | null
          plan_tier: string | null
          role: string | null
          tiktok_url: string | null
          total_views: number | null
          twitter_url: string | null
          username: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string | null
          instagram_url?: string | null
          is_premium?: boolean | null
          linkedin_url?: string | null
          plan_tier?: string | null
          role?: string | null
          tiktok_url?: string | null
          total_views?: number | null
          twitter_url?: string | null
          username?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string | null
          instagram_url?: string | null
          is_premium?: boolean | null
          linkedin_url?: string | null
          plan_tier?: string | null
          role?: string | null
          tiktok_url?: string | null
          total_views?: number | null
          twitter_url?: string | null
          username?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_credits_from_purchase:
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_reference?: string
              p_user_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_amount: number
              p_description: string
              p_provider: string
              p_reference: string
              p_user_id: string
            }
            Returns: number
          }
      admin_complete_finance_buyback: {
        Args: {
          p_external_payment_reference: string
          p_notes?: string
          p_request_id: string
          p_usd_amount_cents: number
        }
        Returns: {
          canceled_at: string | null
          completed_at: string | null
          credits_amount: number
          external_payment_reference: string | null
          hold_transaction_id: string
          id: string
          idempotency_key: string
          notes: string | null
          platform_wallet_balance_after: number | null
          refund_transaction_id: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_currency: string | null
          status: string
          updated_at: string
          usd_amount_cents: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_credit_buyback_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reject_finance_buyback: {
        Args: { p_notes?: string; p_request_id: string }
        Returns: {
          canceled_at: string | null
          completed_at: string | null
          credits_amount: number
          external_payment_reference: string | null
          hold_transaction_id: string
          id: string
          idempotency_key: string
          notes: string | null
          platform_wallet_balance_after: number | null
          refund_transaction_id: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_currency: string | null
          status: string
          updated_at: string
          usd_amount_cents: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_credit_buyback_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      are_friends: { Args: { p_a: string; p_b: string }; Returns: boolean }
      can_view_admin_wallet: { Args: never; Returns: boolean }
      can_view_profile_field: {
        Args: { p_field: string; p_owner: string; p_viewer: string }
        Returns: boolean
      }
      cancel_finance_buyback: {
        Args: { p_request_id: string }
        Returns: {
          canceled_at: string | null
          completed_at: string | null
          credits_amount: number
          external_payment_reference: string | null
          hold_transaction_id: string
          id: string
          idempotency_key: string
          notes: string | null
          platform_wallet_balance_after: number | null
          refund_transaction_id: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_currency: string | null
          status: string
          updated_at: string
          usd_amount_cents: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_credit_buyback_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_username: { Args: { p_username: string }; Returns: Json }
      clear_post_view_history: { Args: never; Returns: undefined }
      create_conversation: { Args: { other_user_id: string }; Returns: string }
      create_group_channel: {
        Args: {
          p_description?: string
          p_group_conversation_id: string
          p_name: string
        }
        Returns: {
          avatar_url: string | null
          created_at: string
          description: string | null
          group_conversation_id: string | null
          id: string
          is_verified: boolean
          name: string
          owner_id: string
          slug: string | null
          subscriber_count: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "channels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_expired_stories: { Args: never; Returns: undefined }
      delete_message: { Args: { p_message_id: string }; Returns: undefined }
      get_conversations_with_details: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          disappearing_seconds: number
          last_message_content: string
          last_message_created_at: string
          other_user_avatar_url: string
          other_user_display_name: string
          other_user_id: string
          other_user_last_seen_at: string
          other_user_presence: string
          other_user_username: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_starred_message_ids: {
        Args: { p_conversation_id: string }
        Returns: {
          message_id: string
        }[]
      }
      get_view_history: {
        Args: { p_limit?: number }
        Returns: {
          author_avatar_url: string
          author_id: string
          author_name: string
          author_username: string
          content: string
          media_url: string
          post_id: string
          viewed_at: string
        }[]
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { p_group_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_user_premium: { Args: { p_user: string }; Returns: boolean }
      join_group: { Args: { p_group_id: string }; Returns: string }
      join_group_via_invite: {
        Args: { p_invite_code: string }
        Returns: string
      }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      mark_view_once_seen: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      match_contacts: {
        Args: { p_hashes: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          username: string
        }[]
      }
      p2p_cancel_transaction: {
        Args: { p_transaction_id: string }
        Returns: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_open_dispute: {
        Args: { p_reason: string; p_transaction_id: string }
        Returns: {
          award_to: string | null
          created_at: string
          id: string
          initiated_by: string
          moderator_id: string | null
          reason: string | null
          resolution: string | null
          resolved_at: string | null
          status: string
          transaction_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_disputes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_release_credits: {
        Args: { p_transaction_id: string }
        Returns: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_resolve_dispute: {
        Args: {
          p_award_to: string
          p_resolution: string
          p_transaction_id: string
        }
        Returns: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_start_transaction: {
        Args: { p_idempotency_key: string; p_listing_id: string }
        Returns: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      p2p_submit_payment_proof: {
        Args: {
          p_notes?: string
          p_proof_url?: string
          p_transaction_id: string
        }
        Returns: {
          buyer_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          credits_amount: number
          currency: string
          dispute_id: string | null
          escrow_locked: boolean
          expires_at: string | null
          id: string
          idempotency_key: string | null
          listing_id: string | null
          price_cents: number
          proof_notes: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          seller_id: string
          settled_at: string | null
          settled_to: string | null
          settlement_reason: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "p2p_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_expired_messages: { Args: never; Returns: number }
      record_post_view: { Args: { p_post_id: string }; Returns: undefined }
      register_push_subscription: {
        Args: {
          p_app_version?: string
          p_device_id?: string
          p_device_token: string
          p_platform: string
        }
        Returns: string
      }
      report_message: {
        Args: { p_description?: string; p_message_id: string; p_reason: string }
        Returns: string
      }
      request_creator_payout:
        | { Args: { p_amount: number }; Returns: Json }
        | {
            Args: { p_amount: number; p_idempotency_key: string }
            Returns: Json
          }
      request_finance_buyback: {
        Args: { p_credits_amount: number; p_idempotency_key: string }
        Returns: {
          canceled_at: string | null
          completed_at: string | null
          credits_amount: number
          external_payment_reference: string | null
          hold_transaction_id: string
          id: string
          idempotency_key: string
          notes: string | null
          platform_wallet_balance_after: number | null
          refund_transaction_id: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_currency: string | null
          status: string
          updated_at: string
          usd_amount_cents: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "finance_credit_buyback_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_disappearing_timer: {
        Args: { p_conversation_id: string; p_seconds: number }
        Returns: undefined
      }
      set_my_phone_hash: { Args: { p_hash: string }; Returns: undefined }
      set_typing_indicator: {
        Args: { p_activity?: string; p_conversation_id: string }
        Returns: undefined
      }
      start_group_live_stream: {
        Args: {
          p_description?: string
          p_group_conversation_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          description: string | null
          ended_at: string | null
          group_conversation_id: string | null
          id: string
          is_recording_enabled: boolean
          playback_url: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          stream_features: Json
          stream_key: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          viewer_count: number
        }
        SetofOptions: {
          from: "*"
          to: "live_streams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      supply_project_wallet: { Args: { p_amount: number }; Returns: number }
      toggle_message_reaction: {
        Args: { p_emoji: string; p_message_id: string }
        Returns: boolean
      }
      toggle_message_star: { Args: { p_message_id: string }; Returns: boolean }
      update_presence: { Args: { p_status?: string }; Returns: undefined }
      username_change_status: { Args: never; Returns: Json }
      wallet_claim_checkout_initialization: {
        Args: { p_initialization_token: string; p_intent_id: string }
        Returns: {
          amount_minor: number
          billing_interval: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          credit_package_id: string | null
          credits_amount: number
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          initialization_token: string | null
          metadata: Json
          provider: string
          provider_checkout_id: string | null
          provider_payment_reference: string | null
          provider_reference: string | null
          provider_subscription_id: string | null
          purchase_type: string
          status: string
          subscription_tier_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_payment_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_claim_creator_payout: {
        Args: {
          p_provider_reference: string
          p_request_id: string
          p_user_id: string
        }
        Returns: {
          admin_notes: string | null
          amount: number
          amount_minor: number | null
          currency: string
          failure_reason: string | null
          funds_released_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          payout_destination_id: string | null
          payout_method: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_complete_payment: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_intent_id: string
          p_period_end?: string
          p_period_start?: string
          p_provider: string
          p_provider_customer_id: string
          p_provider_payment_reference: string
          p_provider_reference: string
          p_provider_subscription_id: string
        }
        Returns: Json
      }
      wallet_complete_subscription_renewal: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_period_end?: string
          p_period_start?: string
          p_provider: string
          p_provider_payment_reference: string
          p_provider_subscription_id: string
        }
        Returns: Json
      }
      wallet_configure_paystack_plan: {
        Args: { p_plan_code: string; p_tier_id: string }
        Returns: string
      }
      wallet_mark_checkout_failed: {
        Args: {
          p_failure_code: string
          p_failure_message: string
          p_initialization_token: string
          p_intent_id: string
        }
        Returns: undefined
      }
      wallet_mark_checkout_initialized: {
        Args: {
          p_checkout_url: string
          p_expires_at?: string
          p_initialization_token: string
          p_intent_id: string
          p_provider_checkout_id: string
          p_provider_reference: string
        }
        Returns: {
          amount_minor: number
          billing_interval: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          credit_package_id: string | null
          credits_amount: number
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          initialization_token: string | null
          metadata: Json
          provider: string
          provider_checkout_id: string | null
          provider_payment_reference: string | null
          provider_reference: string | null
          provider_subscription_id: string | null
          purchase_type: string
          status: string
          subscription_tier_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_payment_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_register_payment_intent: {
        Args: {
          p_amount_minor: number
          p_billing_interval?: string
          p_credits_amount?: number
          p_currency: string
          p_idempotency_key: string
          p_item_id: string
          p_metadata?: Json
          p_provider: string
          p_purchase_type: string
          p_user_id: string
        }
        Returns: {
          amount_minor: number
          billing_interval: string | null
          checkout_url: string | null
          completed_at: string | null
          created_at: string
          credit_package_id: string | null
          credits_amount: number
          currency: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string
          initialization_token: string | null
          metadata: Json
          provider: string
          provider_checkout_id: string | null
          provider_payment_reference: string | null
          provider_reference: string | null
          provider_subscription_id: string | null
          purchase_type: string
          status: string
          subscription_tier_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_payment_intents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_request_creator_payout: {
        Args: {
          p_amount_minor: number
          p_currency: string
          p_destination_id: string
          p_idempotency_key: string
          p_provider: string
          p_user_id: string
        }
        Returns: {
          admin_notes: string | null
          amount: number
          amount_minor: number | null
          currency: string
          failure_reason: string | null
          funds_released_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          payout_destination_id: string | null
          payout_method: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_save_creator_payout_destination: {
        Args: {
          p_account_last4: string
          p_country_code: string
          p_currency: string
          p_display_label: string
          p_metadata?: Json
          p_provider_reference: string
          p_user_id: string
        }
        Returns: {
          account_last4: string | null
          country_code: string | null
          created_at: string
          currency: string
          display_label: string
          id: string
          is_default: boolean
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_payout_destinations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_update_creator_payout_status: {
        Args: {
          p_failure_reason?: string
          p_provider_reference?: string
          p_request_id: string
          p_status: string
        }
        Returns: {
          admin_notes: string | null
          amount: number
          amount_minor: number | null
          currency: string
          failure_reason: string | null
          funds_released_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          payout_destination_id: string | null
          payout_method: string | null
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "creator_payout_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
