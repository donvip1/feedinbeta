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
      ad_impressions: {
        Row: {
          ad_id: string | null
          clicked: boolean | null
          created_at: string | null
          id: string
          impression_date: string | null
          impressions_count: number | null
          user_id: string | null
        }
        Insert: {
          ad_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          id?: string
          impression_date?: string | null
          impressions_count?: number | null
          user_id?: string | null
        }
        Update: {
          ad_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          id?: string
          impression_date?: string | null
          impressions_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "feed_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_action_logs: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
          target_username: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
          target_username?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
          target_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_action_logs_admin_id_profiles_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_action_logs_admin_id_profiles_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_conversations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string | null
          message_count: number | null
          system_prompt: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          system_prompt?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          system_prompt?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "ai_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_results: {
        Row: {
          created_at: string
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          result_data: Json | null
          result_type: string
          result_url: string | null
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          result_data?: Json | null
          result_type: string
          result_url?: string | null
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          result_data?: Json | null
          result_type?: string
          result_url?: string | null
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_usage: {
        Row: {
          created_at: string
          credits_used: number | null
          id: string
          input_type: string | null
          metadata: Json | null
          output_type: string | null
          processing_time_ms: number | null
          status: string | null
          tool_category: string
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number | null
          id?: string
          input_type?: string | null
          metadata?: Json | null
          output_type?: string | null
          processing_time_ms?: number | null
          status?: string | null
          tool_category: string
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number | null
          id?: string
          input_type?: string | null
          metadata?: Json | null
          output_type?: string | null
          processing_time_ms?: number | null
          status?: string | null
          tool_category?: string
          tool_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_test_questions: {
        Row: {
          correct_option_id: string | null
          created_at: string | null
          difficulty: string | null
          display_order: number | null
          explanation: string | null
          id: string
          options: Json
          points: number | null
          question_image_url: string | null
          question_text: string
          test_id: string
        }
        Insert: {
          correct_option_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          display_order?: number | null
          explanation?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_image_url?: string | null
          question_text: string
          test_id: string
        }
        Update: {
          correct_option_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          display_order?: number | null
          explanation?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_image_url?: string | null
          question_text?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "aptitude_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_test_results: {
        Row: {
          answers: Json | null
          completed_at: string | null
          correct_answers: number | null
          id: string
          passed: boolean | null
          recommendations: Json | null
          score_percent: number | null
          started_at: string | null
          test_id: string
          time_taken_seconds: number | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          correct_answers?: number | null
          id?: string
          passed?: boolean | null
          recommendations?: Json | null
          score_percent?: number | null
          started_at?: string | null
          test_id: string
          time_taken_seconds?: number | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          correct_answers?: number | null
          id?: string
          passed?: boolean | null
          recommendations?: Json | null
          score_percent?: number | null
          started_at?: string | null
          test_id?: string
          time_taken_seconds?: number | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aptitude_test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "aptitude_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aptitude_test_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aptitude_test_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aptitude_tests: {
        Row: {
          created_at: string | null
          credit_cost: number | null
          description: string | null
          duration_minutes: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          passing_score: number | null
          slug: string
          test_type: string | null
          title: string
          total_questions: number | null
        }
        Insert: {
          created_at?: string | null
          credit_cost?: number | null
          description?: string | null
          duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          passing_score?: number | null
          slug: string
          test_type?: string | null
          title: string
          total_questions?: number | null
        }
        Update: {
          created_at?: string | null
          credit_cost?: number | null
          description?: string | null
          duration_minutes?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          passing_score?: number | null
          slug?: string
          test_type?: string | null
          title?: string
          total_questions?: number | null
        }
        Relationships: []
      }
      assessment_attempts: {
        Row: {
          answers: Json | null
          assessment_id: string
          completed_at: string | null
          correct_answers: number | null
          id: string
          passed: boolean | null
          score_percent: number | null
          started_at: string | null
          time_taken_seconds: number | null
          total_questions: number | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          assessment_id: string
          completed_at?: string | null
          correct_answers?: number | null
          id?: string
          passed?: boolean | null
          score_percent?: number | null
          started_at?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          assessment_id?: string
          completed_at?: string | null
          correct_answers?: number | null
          id?: string
          passed?: boolean | null
          score_percent?: number | null
          started_at?: string | null
          time_taken_seconds?: number | null
          total_questions?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "course_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string | null
          display_order: number | null
          explanation: string | null
          id: string
          options: Json
          points: number | null
          question_text: string
          question_type: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string | null
          display_order?: number | null
          explanation?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_text: string
          question_type?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string | null
          display_order?: number | null
          explanation?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_text?: string
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "course_assessments"
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
      call_invites: {
        Row: {
          call_id: string | null
          call_type: string | null
          created_at: string | null
          created_by: string
          expires_at: string
          id: string
          invite_code: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          created_by: string
          expires_at?: string
          id?: string
          invite_code: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          invite_code?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_invites_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string | null
          credits_deducted: number | null
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
          credits_deducted?: number | null
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
          credits_deducted?: number | null
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
      career_path_courses: {
        Row: {
          career_path_id: string
          course_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
        }
        Insert: {
          career_path_id: string
          course_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
        }
        Update: {
          career_path_id?: string
          course_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "career_path_courses_career_path_id_fkey"
            columns: ["career_path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_path_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          education_required: string | null
          experience_level: string | null
          growth_rate: string | null
          icon: string | null
          id: string
          is_featured: boolean | null
          is_trending: boolean | null
          job_outlook: string | null
          salary_currency: string | null
          salary_range_max: number | null
          salary_range_min: number | null
          skills_required: string[] | null
          slug: string
          title: string
          total_courses: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          education_required?: string | null
          experience_level?: string | null
          growth_rate?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_trending?: boolean | null
          job_outlook?: string | null
          salary_currency?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          skills_required?: string[] | null
          slug: string
          title: string
          total_courses?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          education_required?: string | null
          experience_level?: string | null
          growth_rate?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          is_trending?: boolean | null
          job_outlook?: string | null
          salary_currency?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          skills_required?: string[] | null
          slug?: string
          title?: string
          total_courses?: number | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_type: string | null
          certificate_url: string | null
          course_id: string
          created_at: string | null
          enrollment_id: string | null
          id: string
          is_verified: boolean | null
          issue_date: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          certificate_number: string
          certificate_type?: string | null
          certificate_url?: string | null
          course_id: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_verified?: boolean | null
          issue_date?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          certificate_number?: string
          certificate_type?: string | null
          certificate_url?: string | null
          course_id?: string
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_verified?: boolean | null
          issue_date?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          is_archived: boolean | null
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          muted_until: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          muted_until?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_archived?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          muted_until?: string | null
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
      course_assessments: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_final_assessment: boolean | null
          max_attempts: number | null
          module_id: string | null
          pass_percentage: number | null
          time_limit_minutes: number | null
          title: string
          total_questions: number | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_final_assessment?: boolean | null
          max_attempts?: number | null
          module_id?: string | null
          pass_percentage?: number | null
          time_limit_minutes?: number | null
          title: string
          total_questions?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_final_assessment?: boolean | null
          max_attempts?: number | null
          module_id?: string | null
          pass_percentage?: number | null
          time_limit_minutes?: number | null
          title?: string
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_categories: {
        Row: {
          course_count: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_featured: boolean | null
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          course_count?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          course_count?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_featured?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          certificate_id: string | null
          completed_at: string | null
          completed_lessons: number | null
          course_id: string
          credits_paid: number | null
          enrolled_at: string | null
          id: string
          is_completed: boolean | null
          is_trial: boolean | null
          last_accessed_at: string | null
          last_lesson_id: string | null
          progress_percent: number | null
          total_lessons: number | null
          user_id: string
        }
        Insert: {
          certificate_id?: string | null
          completed_at?: string | null
          completed_lessons?: number | null
          course_id: string
          credits_paid?: number | null
          enrolled_at?: string | null
          id?: string
          is_completed?: boolean | null
          is_trial?: boolean | null
          last_accessed_at?: string | null
          last_lesson_id?: string | null
          progress_percent?: number | null
          total_lessons?: number | null
          user_id: string
        }
        Update: {
          certificate_id?: string | null
          completed_at?: string | null
          completed_lessons?: number | null
          course_id?: string
          credits_paid?: number | null
          enrolled_at?: string | null
          id?: string
          is_completed?: boolean | null
          is_trial?: boolean | null
          last_accessed_at?: string | null
          last_lesson_id?: string | null
          progress_percent?: number | null
          total_lessons?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content_text: string | null
          content_type: string | null
          content_url: string | null
          created_at: string | null
          description: string | null
          display_order: number
          duration_minutes: number | null
          id: string
          is_preview: boolean | null
          module_id: string
          title: string
          youtube_video_id: string | null
        }
        Insert: {
          content_text?: string | null
          content_type?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          module_id: string
          title: string
          youtube_video_id?: string | null
        }
        Update: {
          content_text?: string | null
          content_type?: string | null
          content_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_preview?: boolean | null
          module_id?: string
          title?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          display_order: number
          duration_minutes: number | null
          id: string
          is_trial: boolean | null
          title: string
          total_lessons: number | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_trial?: boolean | null
          title: string
          total_lessons?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_trial?: boolean | null
          title?: string
          total_lessons?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_notes: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          lesson_id: string | null
          note_text: string
          timestamp_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          note_text: string
          timestamp_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          note_text?: string
          timestamp_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          course_id: string
          created_at: string | null
          helpful_count: number | null
          id: string
          instructor_replied_at: string | null
          instructor_reply: string | null
          is_verified_purchase: boolean | null
          rating: number
          review_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          instructor_replied_at?: string | null
          instructor_reply?: string | null
          is_verified_purchase?: boolean | null
          rating: number
          review_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          instructor_replied_at?: string | null
          instructor_reply?: string | null
          is_verified_purchase?: boolean | null
          rating?: number
          review_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          average_rating: number | null
          category_id: string | null
          course_type: string | null
          created_at: string | null
          credit_cost: number
          description: string | null
          duration_hours: number | null
          id: string
          instructor_id: string
          is_bestseller: boolean | null
          is_featured: boolean | null
          is_new: boolean | null
          is_published: boolean | null
          language: string | null
          last_updated: string | null
          learning_outcomes: string[] | null
          level: string | null
          preview_video_url: string | null
          requirements: string[] | null
          short_description: string | null
          slug: string
          subject_id: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          total_enrolled: number | null
          total_lessons: number | null
          total_modules: number | null
          total_reviews: number | null
          trial_modules: number | null
          updated_at: string | null
        }
        Insert: {
          average_rating?: number | null
          category_id?: string | null
          course_type?: string | null
          created_at?: string | null
          credit_cost?: number
          description?: string | null
          duration_hours?: number | null
          id?: string
          instructor_id: string
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean | null
          is_published?: boolean | null
          language?: string | null
          last_updated?: string | null
          learning_outcomes?: string[] | null
          level?: string | null
          preview_video_url?: string | null
          requirements?: string[] | null
          short_description?: string | null
          slug: string
          subject_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          total_enrolled?: number | null
          total_lessons?: number | null
          total_modules?: number | null
          total_reviews?: number | null
          trial_modules?: number | null
          updated_at?: string | null
        }
        Update: {
          average_rating?: number | null
          category_id?: string | null
          course_type?: string | null
          created_at?: string | null
          credit_cost?: number
          description?: string | null
          duration_hours?: number | null
          id?: string
          instructor_id?: string
          is_bestseller?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean | null
          is_published?: boolean | null
          language?: string | null
          last_updated?: string | null
          learning_outcomes?: string[] | null
          level?: string | null
          preview_video_url?: string | null
          requirements?: string[] | null
          short_description?: string | null
          slug?: string
          subject_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          total_enrolled?: number | null
          total_lessons?: number | null
          total_modules?: number | null
          total_reviews?: number | null
          trial_modules?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_incentive_tiers: {
        Row: {
          bonus_percentage: number
          created_at: string | null
          id: string
          is_active: boolean | null
          max_earnings: number | null
          min_earnings: number
          period_type: string
          tier_name: string
          updated_at: string | null
        }
        Insert: {
          bonus_percentage?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_earnings?: number | null
          min_earnings?: number
          period_type?: string
          tier_name: string
          updated_at?: string | null
        }
        Update: {
          bonus_percentage?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_earnings?: number | null
          min_earnings?: number
          period_type?: string
          tier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_monetization: {
        Row: {
          created_at: string | null
          id: string
          is_monetized: boolean | null
          last_payout_at: string | null
          minimum_balance_threshold: number | null
          monetized_at: string | null
          next_eligible_payout: string | null
          total_earnings: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_monetized?: boolean | null
          last_payout_at?: string | null
          minimum_balance_threshold?: number | null
          monetized_at?: string | null
          next_eligible_payout?: string | null
          total_earnings?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_monetized?: boolean | null
          last_payout_at?: string | null
          minimum_balance_threshold?: number | null
          monetized_at?: string | null
          next_eligible_payout?: string | null
          total_earnings?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_payout_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_payouts: {
        Row: {
          bonus_amount: number
          created_at: string | null
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          tier_id: string | null
          total_earnings: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          tier_id?: string | null
          total_earnings?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string | null
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          tier_id?: string | null
          total_earnings?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_payouts_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "creator_incentive_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string | null
          credits: number
          currency: string
          discount_percentage: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          promotion_active: boolean | null
          promotion_end: string | null
          promotion_label: string | null
          promotion_start: string | null
          stripe_price_id: string
          tier_level: number | null
          updated_at: string | null
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string | null
          credits: number
          currency?: string
          discount_percentage?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          promotion_active?: boolean | null
          promotion_end?: string | null
          promotion_label?: string | null
          promotion_start?: string | null
          stripe_price_id: string
          tier_level?: number | null
          updated_at?: string | null
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string | null
          credits?: number
          currency?: string
          discount_percentage?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          promotion_active?: boolean | null
          promotion_end?: string | null
          promotion_label?: string | null
          promotion_start?: string | null
          stripe_price_id?: string
          tier_level?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_supply: {
        Row: {
          circulating_supply: number
          created_at: string | null
          id: string
          last_mint_amount: number | null
          last_mint_at: string | null
          last_mint_by: string | null
          max_circulating: number
          total_supply: number
          updated_at: string | null
        }
        Insert: {
          circulating_supply?: number
          created_at?: string | null
          id?: string
          last_mint_amount?: number | null
          last_mint_at?: string | null
          last_mint_by?: string | null
          max_circulating?: number
          total_supply?: number
          updated_at?: string | null
        }
        Update: {
          circulating_supply?: number
          created_at?: string | null
          id?: string
          last_mint_amount?: number | null
          last_mint_at?: string | null
          last_mint_by?: string | null
          max_circulating?: number
          total_supply?: number
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
      currency_rates: {
        Row: {
          country_codes: string[] | null
          created_at: string | null
          currency_code: string
          currency_name: string
          currency_symbol: string
          id: string
          is_active: boolean | null
          rate_to_usd: number
          updated_at: string | null
        }
        Insert: {
          country_codes?: string[] | null
          created_at?: string | null
          currency_code: string
          currency_name: string
          currency_symbol: string
          id?: string
          is_active?: boolean | null
          rate_to_usd?: number
          updated_at?: string | null
        }
        Update: {
          country_codes?: string[] | null
          created_at?: string | null
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          is_active?: boolean | null
          rate_to_usd?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_earnings: {
        Row: {
          created_at: string | null
          date: string
          gift_fees: number | null
          id: string
          other_fees: number | null
          promotion_fees: number | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          gift_fees?: number | null
          id?: string
          other_fees?: number | null
          promotion_fees?: number | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          gift_fees?: number | null
          id?: string
          other_fees?: number | null
          promotion_fees?: number | null
          total?: number | null
        }
        Relationships: []
      }
      encrypted_user_data: {
        Row: {
          address_encrypted: string | null
          created_at: string | null
          date_of_birth_encrypted: string | null
          government_id_encrypted: string | null
          id: string
          phone_number_encrypted: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_encrypted?: string | null
          created_at?: string | null
          date_of_birth_encrypted?: string | null
          government_id_encrypted?: string | null
          id?: string
          phone_number_encrypted?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_encrypted?: string | null
          created_at?: string | null
          date_of_birth_encrypted?: string | null
          government_id_encrypted?: string | null
          id?: string
          phone_number_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_ads: {
        Row: {
          advertiser_id: string | null
          approval_status: string | null
          click_url: string | null
          clicks: number | null
          cost_per_impression: number | null
          created_at: string | null
          ctr: number | null
          daily_budget_credits: number | null
          description: string | null
          expires_at: string | null
          id: string
          impressions: number | null
          is_active: boolean | null
          media_type: string | null
          media_url: string
          spent_credits: number | null
          started_at: string | null
          target_age_max: number | null
          target_age_min: number | null
          target_cities: string[] | null
          target_countries: string[] | null
          target_genders: string[] | null
          target_interests: string[] | null
          target_occupations: string[] | null
          title: string
          total_budget_credits: number | null
          updated_at: string | null
        }
        Insert: {
          advertiser_id?: string | null
          approval_status?: string | null
          click_url?: string | null
          clicks?: number | null
          cost_per_impression?: number | null
          created_at?: string | null
          ctr?: number | null
          daily_budget_credits?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          media_type?: string | null
          media_url: string
          spent_credits?: number | null
          started_at?: string | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_cities?: string[] | null
          target_countries?: string[] | null
          target_genders?: string[] | null
          target_interests?: string[] | null
          target_occupations?: string[] | null
          title: string
          total_budget_credits?: number | null
          updated_at?: string | null
        }
        Update: {
          advertiser_id?: string | null
          approval_status?: string | null
          click_url?: string | null
          clicks?: number | null
          cost_per_impression?: number | null
          created_at?: string | null
          ctr?: number | null
          daily_budget_credits?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string
          spent_credits?: number | null
          started_at?: string | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_cities?: string[] | null
          target_countries?: string[] | null
          target_genders?: string[] | null
          target_interests?: string[] | null
          target_occupations?: string[] | null
          title?: string
          total_budget_credits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_ads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_ads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_cycle_status: {
        Row: {
          cycle_reset_count: number | null
          cycle_started_at: string | null
          id: string
          last_post_position: number | null
          last_reset_at: string | null
          last_session_id: string | null
          posts_viewed_in_cycle: number | null
          total_posts_available: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cycle_reset_count?: number | null
          cycle_started_at?: string | null
          id?: string
          last_post_position?: number | null
          last_reset_at?: string | null
          last_session_id?: string | null
          posts_viewed_in_cycle?: number | null
          total_posts_available?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cycle_reset_count?: number | null
          cycle_started_at?: string | null
          id?: string
          last_post_position?: number | null
          last_reset_at?: string | null
          last_session_id?: string | null
          posts_viewed_in_cycle?: number | null
          total_posts_available?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_cycle_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_cycle_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_analytics: {
        Row: {
          converted_at: string | null
          created_at: string | null
          credit_value: number
          feedback_timestamp: string | null
          gift_type: string
          id: string
          is_converted: boolean | null
          platform_fee: number | null
          receiver_feedback: string | null
          receiver_id: string
          sender_feedback: string | null
          sender_id: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          credit_value: number
          feedback_timestamp?: string | null
          gift_type: string
          id?: string
          is_converted?: boolean | null
          platform_fee?: number | null
          receiver_feedback?: string | null
          receiver_id: string
          sender_feedback?: string | null
          sender_id?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          credit_value?: number
          feedback_timestamp?: string | null
          gift_type?: string
          id?: string
          is_converted?: boolean | null
          platform_fee?: number | null
          receiver_feedback?: string | null
          receiver_id?: string
          sender_feedback?: string | null
          sender_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
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
          category: string | null
          created_at: string | null
          emoji: string
          id: string
          message: string
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          emoji: string
          id?: string
          message: string
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
          message?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      group_call_participants: {
        Row: {
          call_id: string
          id: string
          is_muted: boolean | null
          is_speaking: boolean | null
          is_video_off: boolean | null
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          is_muted?: boolean | null
          is_speaking?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          is_muted?: boolean | null
          is_speaking?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
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
        ]
      }
      group_calls: {
        Row: {
          call_type: string
          created_at: string | null
          ended_at: string | null
          group_id: string
          id: string
          initiated_by: string
          livekit_room_name: string
          started_at: string | null
          status: string
        }
        Insert: {
          call_type?: string
          created_at?: string | null
          ended_at?: string | null
          group_id: string
          id?: string
          initiated_by: string
          livekit_room_name: string
          started_at?: string | null
          status?: string
        }
        Update: {
          call_type?: string
          created_at?: string | null
          ended_at?: string | null
          group_id?: string
          id?: string
          initiated_by?: string
          livekit_room_name?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_calls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invite_links: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          invite_code: string
          is_revoked: boolean | null
          link_type: string | null
          max_uses: number | null
          use_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          invite_code: string
          is_revoked?: boolean | null
          link_type?: string | null
          max_uses?: number | null
          use_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          invite_code?: string
          is_revoked?: boolean | null
          link_type?: string | null
          max_uses?: number | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invite_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invite_uses: {
        Row: {
          id: string
          invite_link_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          invite_link_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          invite_link_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invite_uses_invite_link_id_fkey"
            columns: ["invite_link_id"]
            isOneToOne: false
            referencedRelation: "group_invite_links"
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
          added_by: string | null
          can_send_messages: boolean | null
          group_id: string
          id: string
          joined_at: string | null
          muted_until: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          can_send_messages?: boolean | null
          group_id: string
          id?: string
          joined_at?: string | null
          muted_until?: string | null
          role?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          can_send_messages?: boolean | null
          group_id?: string
          id?: string
          joined_at?: string | null
          muted_until?: string | null
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
      group_message_reactions: {
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
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_read_status: {
        Row: {
          group_id: string
          id: string
          last_read_at: string | null
          last_read_message_id: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_read_status_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_read_status_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          file_size: number | null
          forwarded_from: Json | null
          group_id: string
          id: string
          is_pinned: boolean | null
          media_type: string | null
          media_url: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          file_size?: number | null
          forwarded_from?: Json | null
          group_id: string
          id?: string
          is_pinned?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          file_size?: number | null
          forwarded_from?: Json | null
          group_id?: string
          id?: string
          is_pinned?: boolean | null
          media_type?: string | null
          media_url?: string | null
          reply_to_id?: string | null
          sender_id?: string
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
        ]
      }
      group_poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      group_polls: {
        Row: {
          created_at: string | null
          creator_id: string
          ends_at: string | null
          group_id: string
          id: string
          is_anonymous: boolean | null
          is_multiple_choice: boolean | null
          message_id: string | null
          options: Json
          question: string
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          ends_at?: string | null
          group_id: string
          id?: string
          is_anonymous?: boolean | null
          is_multiple_choice?: boolean | null
          message_id?: string | null
          options?: Json
          question: string
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          ends_at?: string | null
          group_id?: string
          id?: string
          is_anonymous?: boolean | null
          is_multiple_choice?: boolean | null
          message_id?: string | null
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
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
      group_typing_indicators: {
        Row: {
          activity_type: string | null
          group_id: string
          id: string
          is_typing: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          group_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string | null
          group_id?: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_typing_indicators_group_id_fkey"
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
          invite_code: string | null
          invite_link_enabled: boolean | null
          is_premium: boolean | null
          is_private: boolean | null
          member_count: number | null
          name: string
          post_count: number | null
          requires_subscription: boolean | null
          settings: Json | null
          slow_mode_seconds: number | null
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
          invite_code?: string | null
          invite_link_enabled?: boolean | null
          is_premium?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name: string
          post_count?: number | null
          requires_subscription?: boolean | null
          settings?: Json | null
          slow_mode_seconds?: number | null
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
          invite_code?: string | null
          invite_link_enabled?: boolean | null
          is_premium?: boolean | null
          is_private?: boolean | null
          member_count?: number | null
          name?: string
          post_count?: number | null
          requires_subscription?: boolean | null
          settings?: Json | null
          slow_mode_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          is_trending: boolean | null
          name: string
          posts_count: number | null
          trending_score: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_trending?: boolean | null
          name: string
          posts_count?: number | null
          trending_score?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_trending?: boolean | null
          name?: string
          posts_count?: number | null
          trending_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instructor_payouts: {
        Row: {
          amount_credits: number
          created_at: string | null
          id: string
          instructor_id: string
          payout_type: string | null
          source_course_id: string | null
          source_subscription_id: string | null
          source_user_id: string | null
          status: string | null
        }
        Insert: {
          amount_credits: number
          created_at?: string | null
          id?: string
          instructor_id: string
          payout_type?: string | null
          source_course_id?: string | null
          source_subscription_id?: string | null
          source_user_id?: string | null
          status?: string | null
        }
        Update: {
          amount_credits?: number
          created_at?: string | null
          id?: string
          instructor_id?: string
          payout_type?: string | null
          source_course_id?: string | null
          source_subscription_id?: string | null
          source_user_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_payouts_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_source_subscription_id_fkey"
            columns: ["source_subscription_id"]
            isOneToOne: false
            referencedRelation: "instructor_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_payouts_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          credits_paid: number | null
          expires_at: string | null
          id: string
          instructor_id: string
          is_active: boolean | null
          started_at: string | null
          subscription_type: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          credits_paid?: number | null
          expires_at?: string | null
          id?: string
          instructor_id: string
          is_active?: boolean | null
          started_at?: string | null
          subscription_type?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          credits_paid?: number | null
          expires_at?: string | null
          id?: string
          instructor_id?: string
          is_active?: boolean | null
          started_at?: string | null
          subscription_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_subscriptions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio: string | null
          created_at: string | null
          expertise: string[] | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          payout_percentage: number | null
          qualifications: string[] | null
          rating: number | null
          review_count: number | null
          total_courses: number | null
          total_earnings_credits: number | null
          total_students: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          expertise?: string[] | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          payout_percentage?: number | null
          qualifications?: string[] | null
          rating?: number | null
          review_count?: number | null
          total_courses?: number | null
          total_earnings_credits?: number | null
          total_students?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          expertise?: string[] | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          payout_percentage?: number | null
          qualifications?: string[] | null
          rating?: number | null
          review_count?: number | null
          total_courses?: number | null
          total_earnings_credits?: number | null
          total_students?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_streaks: {
        Row: {
          current_streak: number | null
          id: string
          last_learning_date: string | null
          longest_streak: number | null
          total_learning_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          id?: string
          last_learning_date?: string | null
          longest_streak?: number | null
          total_learning_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          id?: string
          last_learning_date?: string | null
          longest_streak?: number | null
          total_learning_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          is_completed: boolean | null
          last_watched_at: string | null
          lesson_id: string
          progress_seconds: number | null
          total_seconds: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_completed?: boolean | null
          last_watched_at?: string | null
          lesson_id: string
          progress_seconds?: number | null
          total_seconds?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          is_completed?: boolean | null
          last_watched_at?: string | null
          lesson_id?: string
          progress_seconds?: number | null
          total_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string | null
          download_count: number | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          is_premium_only: boolean | null
          lesson_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          download_count?: number | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_premium_only?: boolean | null
          lesson_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          download_count?: number | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_premium_only?: boolean | null
          lesson_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_gifts: {
        Row: {
          created_at: string | null
          credit_value: number
          gift_type: string
          id: string
          receiver_id: string
          sender_id: string
          space_id: string | null
        }
        Insert: {
          created_at?: string | null
          credit_value?: number
          gift_type: string
          id?: string
          receiver_id: string
          sender_id: string
          space_id?: string | null
        }
        Update: {
          created_at?: string | null
          credit_value?: number
          gift_type?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          space_id?: string | null
        }
        Relationships: [
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
          created_at: string | null
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          space_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          space_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          space_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_space_invitations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_space_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          reply_to_id: string | null
          space_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          reply_to_id?: string | null
          space_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          reply_to_id?: string | null
          space_id?: string | null
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
        ]
      }
      live_space_reactions: {
        Row: {
          created_at: string | null
          id: string
          reaction_type: string
          space_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reaction_type: string
          space_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reaction_type?: string
          space_id?: string | null
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
        ]
      }
      live_space_speakers: {
        Row: {
          cloudflare_session_id: string | null
          cloudflare_track_id: string | null
          hand_raised_at: string | null
          has_raised_hand: boolean | null
          host_muted: boolean | null
          id: string
          is_muted: boolean | null
          joined_at: string | null
          left_at: string | null
          mic_allowed: boolean | null
          role: string | null
          space_id: string | null
          user_id: string
        }
        Insert: {
          cloudflare_session_id?: string | null
          cloudflare_track_id?: string | null
          hand_raised_at?: string | null
          has_raised_hand?: boolean | null
          host_muted?: boolean | null
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          mic_allowed?: boolean | null
          role?: string | null
          space_id?: string | null
          user_id: string
        }
        Update: {
          cloudflare_session_id?: string | null
          cloudflare_track_id?: string | null
          hand_raised_at?: string | null
          has_raised_hand?: boolean | null
          host_muted?: boolean | null
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          mic_allowed?: boolean | null
          role?: string | null
          space_id?: string | null
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
        ]
      }
      live_spaces: {
        Row: {
          allow_mic_for_all: boolean | null
          cloudflare_session_id: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          ended_at: string | null
          hashtags: string[] | null
          id: string
          is_private: boolean | null
          is_recording_enabled: boolean | null
          peak_viewers: number | null
          recording_url: string | null
          scheduled_start: string | null
          share_link: string | null
          started_at: string | null
          status: string | null
          title: string
          topic_category: string | null
          updated_at: string | null
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          allow_mic_for_all?: boolean | null
          cloudflare_session_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          hashtags?: string[] | null
          id?: string
          is_private?: boolean | null
          is_recording_enabled?: boolean | null
          peak_viewers?: number | null
          recording_url?: string | null
          scheduled_start?: string | null
          share_link?: string | null
          started_at?: string | null
          status?: string | null
          title: string
          topic_category?: string | null
          updated_at?: string | null
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          allow_mic_for_all?: boolean | null
          cloudflare_session_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          hashtags?: string[] | null
          id?: string
          is_private?: boolean | null
          is_recording_enabled?: boolean | null
          peak_viewers?: number | null
          recording_url?: string | null
          scheduled_start?: string | null
          share_link?: string | null
          started_at?: string | null
          status?: string | null
          title?: string
          topic_category?: string | null
          updated_at?: string | null
          user_id?: string
          viewer_count?: number | null
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
          {
            foreignKeyName: "live_stream_analytics_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_chat_reactions: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
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
          {
            foreignKeyName: "live_stream_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
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
          receiver_id: string
          sender_id: string
          stream_id: string
        }
        Insert: {
          created_at?: string
          credit_value?: number
          gift_type: string
          id?: string
          receiver_id: string
          sender_id: string
          stream_id: string
        }
        Update: {
          created_at?: string
          credit_value?: number
          gift_type?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          stream_id?: string
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
          {
            foreignKeyName: "live_stream_gifts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_invites: {
        Row: {
          created_at: string
          host_id: string
          id: string
          invited_user_id: string
          responded_at: string | null
          status: string
          stream_id: string
        }
        Insert: {
          created_at?: string
          host_id: string
          id?: string
          invited_user_id: string
          responded_at?: string | null
          status?: string
          stream_id: string
        }
        Update: {
          created_at?: string
          host_id?: string
          id?: string
          invited_user_id?: string
          responded_at?: string | null
          status?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_invites_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "live_stream_invites_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_stream_invites_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
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
          {
            foreignKeyName: "live_stream_reactions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_viewers: {
        Row: {
          hand_raised_at: string | null
          has_raised_hand: boolean | null
          host_muted: boolean | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          stream_id: string
          user_id: string | null
          watch_duration: number | null
        }
        Insert: {
          hand_raised_at?: string | null
          has_raised_hand?: boolean | null
          host_muted?: boolean | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          stream_id: string
          user_id?: string | null
          watch_duration?: number | null
        }
        Update: {
          hand_raised_at?: string | null
          has_raised_hand?: boolean | null
          host_muted?: boolean | null
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
          {
            foreignKeyName: "live_stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          banned_users: string[] | null
          category: string | null
          cf_hls_url: string | null
          cf_live_input_id: string | null
          cf_recording_uid: string | null
          cf_webrtc_url: string | null
          cloudflare_session_id: string | null
          connection_state: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          duration: number | null
          ended_at: string | null
          hashtags: string[] | null
          id: string
          is_chat_locked: boolean | null
          is_premium: boolean | null
          is_private: boolean | null
          last_health_check: string | null
          peak_viewers: number | null
          room_type: string | null
          scheduled_start: string | null
          sfu_track_name: string | null
          share_link: string | null
          started_at: string | null
          status: string
          stream_key: string
          stream_ready: boolean | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          viewer_count: number | null
        }
        Insert: {
          banned_users?: string[] | null
          category?: string | null
          cf_hls_url?: string | null
          cf_live_input_id?: string | null
          cf_recording_uid?: string | null
          cf_webrtc_url?: string | null
          cloudflare_session_id?: string | null
          connection_state?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          hashtags?: string[] | null
          id?: string
          is_chat_locked?: boolean | null
          is_premium?: boolean | null
          is_private?: boolean | null
          last_health_check?: string | null
          peak_viewers?: number | null
          room_type?: string | null
          scheduled_start?: string | null
          sfu_track_name?: string | null
          share_link?: string | null
          started_at?: string | null
          status?: string
          stream_key: string
          stream_ready?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          viewer_count?: number | null
        }
        Update: {
          banned_users?: string[] | null
          category?: string | null
          cf_hls_url?: string | null
          cf_live_input_id?: string | null
          cf_recording_uid?: string | null
          cf_webrtc_url?: string | null
          cloudflare_session_id?: string | null
          connection_state?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          hashtags?: string[] | null
          id?: string
          is_chat_locked?: boolean | null
          is_premium?: boolean | null
          is_private?: boolean | null
          last_health_check?: string | null
          peak_viewers?: number | null
          room_type?: string | null
          scheduled_start?: string | null
          sfu_track_name?: string | null
          share_link?: string | null
          started_at?: string | null
          status?: string
          stream_key?: string
          stream_ready?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          viewer_count?: number | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_at: string | null
          failure_reason: string | null
          id: string
          identifier: string
          ip_address: string | null
          success: boolean | null
        }
        Insert: {
          attempt_at?: string | null
          failure_reason?: string | null
          id?: string
          identifier: string
          ip_address?: string | null
          success?: boolean | null
        }
        Update: {
          attempt_at?: string | null
          failure_reason?: string | null
          id?: string
          identifier?: string
          ip_address?: string | null
          success?: boolean | null
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
          encrypted_content: Json | null
          expires_at: string | null
          forwarded_from: Json | null
          id: string
          is_encrypted: boolean | null
          is_pinned: boolean | null
          is_read: boolean | null
          is_secret: boolean | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          read_by_receiver_at: string | null
          reply_metadata: Json | null
          reply_to_id: string | null
          sender_id: string
          sender_public_key_version: number | null
          status: string | null
          updated_at: string
          view_once_timer: number | null
          viewed_by: string[] | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          edited_at?: string | null
          encrypted_content?: Json | null
          expires_at?: string | null
          forwarded_from?: Json | null
          id?: string
          is_encrypted?: boolean | null
          is_pinned?: boolean | null
          is_read?: boolean | null
          is_secret?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          read_by_receiver_at?: string | null
          reply_metadata?: Json | null
          reply_to_id?: string | null
          sender_id: string
          sender_public_key_version?: number | null
          status?: string | null
          updated_at?: string
          view_once_timer?: number | null
          viewed_by?: string[] | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for_receiver?: boolean | null
          deleted_for_sender?: boolean | null
          edited_at?: string | null
          encrypted_content?: Json | null
          expires_at?: string | null
          forwarded_from?: Json | null
          id?: string
          is_encrypted?: boolean | null
          is_pinned?: boolean | null
          is_read?: boolean | null
          is_secret?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          read_by_receiver_at?: string | null
          reply_metadata?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          sender_public_key_version?: number | null
          status?: string | null
          updated_at?: string
          view_once_timer?: number | null
          viewed_by?: string[] | null
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
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      music_tracks: {
        Row: {
          artist: string | null
          audio_url: string
          cover_image_url: string | null
          created_at: string | null
          duration_seconds: number | null
          genre: string | null
          id: string
          is_copyright_free: boolean | null
          is_trending: boolean | null
          original_creator_id: string | null
          original_post_id: string | null
          play_count: number | null
          preview_url: string | null
          source: string | null
          title: string
          trim_end: number | null
          trim_start: number | null
          updated_at: string | null
          uploader_id: string | null
          usage_count: number | null
        }
        Insert: {
          artist?: string | null
          audio_url: string
          cover_image_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          is_copyright_free?: boolean | null
          is_trending?: boolean | null
          original_creator_id?: string | null
          original_post_id?: string | null
          play_count?: number | null
          preview_url?: string | null
          source?: string | null
          title: string
          trim_end?: number | null
          trim_start?: number | null
          updated_at?: string | null
          uploader_id?: string | null
          usage_count?: number | null
        }
        Update: {
          artist?: string | null
          audio_url?: string
          cover_image_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          genre?: string | null
          id?: string
          is_copyright_free?: boolean | null
          is_trending?: boolean | null
          original_creator_id?: string | null
          original_post_id?: string | null
          play_count?: number | null
          preview_url?: string | null
          source?: string | null
          title?: string
          trim_end?: number | null
          trim_start?: number | null
          updated_at?: string | null
          uploader_id?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "music_tracks_original_creator_id_fkey"
            columns: ["original_creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_tracks_original_creator_id_fkey"
            columns: ["original_creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_tracks_original_post_id_fkey"
            columns: ["original_post_id"]
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
          follows_enabled: boolean | null
          friend_requests_enabled: boolean | null
          gifts_enabled: boolean | null
          id: string
          likes_enabled: boolean | null
          live_enabled: boolean | null
          messages_enabled: boolean | null
          push_enabled: boolean | null
          stories_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          follows_enabled?: boolean | null
          friend_requests_enabled?: boolean | null
          gifts_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_enabled?: boolean | null
          messages_enabled?: boolean | null
          push_enabled?: boolean | null
          stories_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_enabled?: boolean | null
          created_at?: string
          email_enabled?: boolean | null
          follows_enabled?: boolean | null
          friend_requests_enabled?: boolean | null
          gifts_enabled?: boolean | null
          id?: string
          likes_enabled?: boolean | null
          live_enabled?: boolean | null
          messages_enabled?: boolean | null
          push_enabled?: boolean | null
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
      p2p_chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          media_url: string | null
          message_type: string | null
          sender_id: string
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type?: string | null
          sender_id: string
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type?: string | null
          sender_id?: string
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      p2p_disputes: {
        Row: {
          assigned_at: string | null
          buyer_evidence_urls: string[] | null
          created_at: string | null
          description: string | null
          id: string
          initiated_by: string
          moderator_id: string | null
          reason: string
          resolution: string | null
          resolution_notes: string | null
          resolved_at: string | null
          seller_evidence_urls: string[] | null
          status: string | null
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          buyer_evidence_urls?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          initiated_by: string
          moderator_id?: string | null
          reason: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_evidence_urls?: string[] | null
          status?: string | null
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          buyer_evidence_urls?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          initiated_by?: string
          moderator_id?: string | null
          reason?: string
          resolution?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          seller_evidence_urls?: string[] | null
          status?: string | null
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p2p_disputes_initiated_by_profiles_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_initiated_by_profiles_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_moderator_id_profiles_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_moderator_id_profiles_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "p2p_disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "p2p_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_escrow: {
        Row: {
          credits_amount: number
          dispute_id: string | null
          id: string
          locked_at: string
          locked_by: string | null
          platform_fee: number | null
          released_at: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          credits_amount: number
          dispute_id?: string | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          platform_fee?: number | null
          released_at?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          credits_amount?: number
          dispute_id?: string | null
          id?: string
          locked_at?: string
          locked_by?: string | null
          platform_fee?: number | null
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
          auto_reply: string | null
          country_code: string | null
          created_at: string
          credits_amount: number
          credits_per_dollar: number | null
          currency_code: string | null
          id: string
          is_international: boolean | null
          max_amount: number | null
          min_amount: number | null
          payment_method_id: string | null
          payment_window_minutes: number | null
          price_usd: number
          seller_id: string
          status: string
          terms: string | null
          updated_at: string
        }
        Insert: {
          auto_reply?: string | null
          country_code?: string | null
          created_at?: string
          credits_amount: number
          credits_per_dollar?: number | null
          currency_code?: string | null
          id?: string
          is_international?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          payment_method_id?: string | null
          payment_window_minutes?: number | null
          price_usd: number
          seller_id: string
          status?: string
          terms?: string | null
          updated_at?: string
        }
        Update: {
          auto_reply?: string | null
          country_code?: string | null
          created_at?: string
          credits_amount?: number
          credits_per_dollar?: number | null
          currency_code?: string | null
          id?: string
          is_international?: boolean | null
          max_amount?: number | null
          min_amount?: number | null
          payment_method_id?: string | null
          payment_window_minutes?: number | null
          price_usd?: number
          seller_id?: string
          status?: string
          terms?: string | null
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
          {
            foreignKeyName: "p2p_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      p2p_moderators: {
        Row: {
          avg_resolution_time_hours: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          rating: number | null
          total_disputes_handled: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_resolution_time_hours?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rating?: number | null
          total_disputes_handled?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_resolution_time_hours?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          rating?: number | null
          total_disputes_handled?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      p2p_payment_methods: {
        Row: {
          account_details: Json
          country_code: string | null
          created_at: string | null
          currency_code: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_verified: boolean | null
          method_name: string
          method_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_details: Json
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          method_name: string
          method_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_details?: Json
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          method_name?: string
          method_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      p2p_payment_proofs: {
        Row: {
          created_at: string | null
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          proof_type: string | null
          transaction_id: string
          uploaded_by: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          proof_type?: string | null
          transaction_id: string
          uploaded_by: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          proof_type?: string | null
          transaction_id?: string
          uploaded_by?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      p2p_transactions: {
        Row: {
          buyer_confirmed_at: string | null
          buyer_id: string
          cancellation_reason: string | null
          cancelled_by: string | null
          chat_enabled: boolean | null
          created_at: string
          credits_amount: number
          dispute_id: string | null
          escrow_locked: boolean | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          listing_id: string
          price_usd: number
          proof_url: string | null
          seller_confirmed_at: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_confirmed_at?: string | null
          buyer_id: string
          cancellation_reason?: string | null
          cancelled_by?: string | null
          chat_enabled?: boolean | null
          created_at?: string
          credits_amount: number
          dispute_id?: string | null
          escrow_locked?: boolean | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          listing_id: string
          price_usd: number
          proof_url?: string | null
          seller_confirmed_at?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_confirmed_at?: string | null
          buyer_id?: string
          cancellation_reason?: string | null
          cancelled_by?: string | null
          chat_enabled?: boolean | null
          created_at?: string
          credits_amount?: number
          dispute_id?: string | null
          escrow_locked?: boolean | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          listing_id?: string
          price_usd?: number
          proof_url?: string | null
          seller_confirmed_at?: string | null
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
            foreignKeyName: "p2p_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          buyer_ban_until: string | null
          buyer_cancellation_count: number | null
          created_at: string | null
          first_p2p_trade_completed: boolean | null
          has_purchased_pack: boolean | null
          id: string
          is_reseller: boolean | null
          last_cancellation_at: string | null
          min_trade_amount: number | null
          total_trades: number | null
          total_volume_usd: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          buyer_ban_until?: string | null
          buyer_cancellation_count?: number | null
          created_at?: string | null
          first_p2p_trade_completed?: boolean | null
          has_purchased_pack?: boolean | null
          id?: string
          is_reseller?: boolean | null
          last_cancellation_at?: string | null
          min_trade_amount?: number | null
          total_trades?: number | null
          total_volume_usd?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          buyer_ban_until?: string | null
          buyer_cancellation_count?: number | null
          created_at?: string | null
          first_p2p_trade_completed?: boolean | null
          has_purchased_pack?: boolean | null
          id?: string
          is_reseller?: boolean | null
          last_cancellation_at?: string | null
          min_trade_amount?: number | null
          total_trades?: number | null
          total_volume_usd?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      pk_battles: {
        Row: {
          challenger_id: string | null
          challenger_score: number | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          host_id: string
          host_score: number | null
          id: string
          started_at: string | null
          status: string | null
          stream_id: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          challenger_id?: string | null
          challenger_score?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          host_id: string
          host_score?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          stream_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string | null
          challenger_score?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          host_id?: string
          host_score?: number | null
          id?: string
          started_at?: string | null
          status?: string | null
          stream_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pk_battles_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pk_battles_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams_public"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          from_user_id: string | null
          id: string
          performed_by: string | null
          to_user_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          from_user_id?: string | null
          id?: string
          performed_by?: string | null
          to_user_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          from_user_id?: string | null
          id?: string
          performed_by?: string | null
          to_user_id?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      platform_wallet: {
        Row: {
          ai_feature_revenue: number | null
          balance: number
          created_at: string | null
          creator_payouts_total: number | null
          gift_revenue: number | null
          id: string
          p2p_fee_revenue: number | null
          platform_profit: number | null
          promotion_revenue: number | null
          subscription_revenue: number | null
          total_earned: number
          updated_at: string | null
          withdrawal_revenue: number | null
        }
        Insert: {
          ai_feature_revenue?: number | null
          balance?: number
          created_at?: string | null
          creator_payouts_total?: number | null
          gift_revenue?: number | null
          id?: string
          p2p_fee_revenue?: number | null
          platform_profit?: number | null
          promotion_revenue?: number | null
          subscription_revenue?: number | null
          total_earned?: number
          updated_at?: string | null
          withdrawal_revenue?: number | null
        }
        Update: {
          ai_feature_revenue?: number | null
          balance?: number
          created_at?: string | null
          creator_payouts_total?: number | null
          gift_revenue?: number | null
          id?: string
          p2p_fee_revenue?: number | null
          platform_profit?: number | null
          promotion_revenue?: number | null
          subscription_revenue?: number | null
          total_earned?: number
          updated_at?: string | null
          withdrawal_revenue?: number | null
        }
        Relationships: []
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
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
            foreignKeyName: "post_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      post_promotions: {
        Row: {
          boost_level: string
          clicks: number | null
          created_at: string | null
          credits_spent: number
          expires_at: string
          id: string
          impressions: number | null
          is_active: boolean | null
          post_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          boost_level?: string
          clicks?: number | null
          created_at?: string | null
          credits_spent?: number
          expires_at: string
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          post_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          boost_level?: string
          clicks?: number | null
          created_at?: string | null
          credits_spent?: number
          expires_at?: string
          id?: string
          impressions?: number | null
          is_active?: boolean | null
          post_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_promotions_post_id_fkey"
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
      post_view_history: {
        Row: {
          id: string
          post_id: string
          session_id: string | null
          user_id: string
          view_count: number | null
          view_date: string
          viewed_at: string
        }
        Insert: {
          id?: string
          post_id: string
          session_id?: string | null
          user_id: string
          view_count?: number | null
          view_date?: string
          viewed_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          session_id?: string | null
          user_id?: string
          view_count?: number | null
          view_date?: string
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
          {
            foreignKeyName: "post_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          deleted_at: string | null
          deleted_by: string | null
          feed_id: string | null
          gifts_count: number | null
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
          music_trim_end: number | null
          music_trim_start: number | null
          music_url: string | null
          original_audio_track_id: string | null
          original_post_id: string | null
          post_type: string | null
          privacy: string | null
          refeeds_count: number | null
          scheduled_at: string | null
          shares_count: number | null
          status: string | null
          trending_score: number | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          feed_id?: string | null
          gifts_count?: number | null
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
          music_trim_end?: number | null
          music_trim_start?: number | null
          music_url?: string | null
          original_audio_track_id?: string | null
          original_post_id?: string | null
          post_type?: string | null
          privacy?: string | null
          refeeds_count?: number | null
          scheduled_at?: string | null
          shares_count?: number | null
          status?: string | null
          trending_score?: number | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          feed_id?: string | null
          gifts_count?: number | null
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
          music_trim_end?: number | null
          music_trim_start?: number | null
          music_url?: string | null
          original_audio_track_id?: string | null
          original_post_id?: string | null
          post_type?: string | null
          privacy?: string | null
          refeeds_count?: number | null
          scheduled_at?: string | null
          shares_count?: number | null
          status?: string | null
          trending_score?: number | null
          updated_at?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_audio_track_id_fkey"
            columns: ["original_audio_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
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
      privacy_settings: {
        Row: {
          allow_friend_requests: boolean | null
          allow_messages_from_strangers: boolean | null
          created_at: string | null
          id: string
          profile_visible: boolean | null
          show_activity_status: boolean | null
          show_date_of_birth: boolean | null
          show_email: boolean | null
          show_location: boolean | null
          show_marital_status: boolean | null
          show_occupation: boolean | null
          show_online_status: boolean | null
          show_phone_number: boolean | null
          show_read_receipts: boolean | null
          show_social_links: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_friend_requests?: boolean | null
          allow_messages_from_strangers?: boolean | null
          created_at?: string | null
          id?: string
          profile_visible?: boolean | null
          show_activity_status?: boolean | null
          show_date_of_birth?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_marital_status?: boolean | null
          show_occupation?: boolean | null
          show_online_status?: boolean | null
          show_phone_number?: boolean | null
          show_read_receipts?: boolean | null
          show_social_links?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_friend_requests?: boolean | null
          allow_messages_from_strangers?: boolean | null
          created_at?: string | null
          id?: string
          profile_visible?: boolean | null
          show_activity_status?: boolean | null
          show_date_of_birth?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_marital_status?: boolean | null
          show_occupation?: boolean | null
          show_online_status?: boolean | null
          show_phone_number?: boolean | null
          show_read_receipts?: boolean | null
          show_social_links?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_sensitive_data: {
        Row: {
          created_at: string | null
          phone_number_encrypted: string | null
          stripe_customer_id_encrypted: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          phone_number_encrypted?: string | null
          stripe_customer_id_encrypted?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          phone_number_encrypted?: string | null
          stripe_customer_id_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about: string | null
          about_updated_at: string | null
          about_visibility: string | null
          account_status: string | null
          age: number | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          daily_ai_chat_count: number | null
          daily_ai_eduqa_count: number | null
          daily_ai_image_count: number | null
          daily_ai_thesis_count: number | null
          daily_ai_video_count: number | null
          daily_enhancement_count: number | null
          date_of_birth: string | null
          detected_country_code: string | null
          display_name: string | null
          facebook_url: string | null
          followers_count: number | null
          following_count: number | null
          gender: string | null
          id: string
          instagram_url: string | null
          interests: string[] | null
          is_duplicate_flagged: boolean | null
          is_premium: boolean | null
          last_ai_reset: string | null
          last_ai_reset_date: string | null
          last_display_name_change: string | null
          last_enhancement_reset: string | null
          last_free_enhancement: string | null
          last_username_change: string | null
          linkedin_url: string | null
          location: string | null
          marital_status: string | null
          max_friends: number | null
          occupation: string | null
          phone_number: string | null
          phone_verified: boolean | null
          preferred_currency: string | null
          preferred_language: string | null
          profile_completed: boolean | null
          purpose: string[] | null
          purpose_updated_at: string | null
          referral_code: string | null
          referral_count: number | null
          referred_by: string | null
          registration_ip: unknown
          signup_fingerprint: string | null
          status: string | null
          status_updated_at: string | null
          status_visibility: string | null
          tiktok_url: string | null
          timezone: string | null
          total_views: number | null
          twitter_url: string | null
          updated_at: string
          username: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about?: string | null
          about_updated_at?: string | null
          about_visibility?: string | null
          account_status?: string | null
          age?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          daily_ai_chat_count?: number | null
          daily_ai_eduqa_count?: number | null
          daily_ai_image_count?: number | null
          daily_ai_thesis_count?: number | null
          daily_ai_video_count?: number | null
          daily_enhancement_count?: number | null
          date_of_birth?: string | null
          detected_country_code?: string | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          gender?: string | null
          id: string
          instagram_url?: string | null
          interests?: string[] | null
          is_duplicate_flagged?: boolean | null
          is_premium?: boolean | null
          last_ai_reset?: string | null
          last_ai_reset_date?: string | null
          last_display_name_change?: string | null
          last_enhancement_reset?: string | null
          last_free_enhancement?: string | null
          last_username_change?: string | null
          linkedin_url?: string | null
          location?: string | null
          marital_status?: string | null
          max_friends?: number | null
          occupation?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          preferred_currency?: string | null
          preferred_language?: string | null
          profile_completed?: boolean | null
          purpose?: string[] | null
          purpose_updated_at?: string | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by?: string | null
          registration_ip?: unknown
          signup_fingerprint?: string | null
          status?: string | null
          status_updated_at?: string | null
          status_visibility?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          total_views?: number | null
          twitter_url?: string | null
          updated_at?: string
          username: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about?: string | null
          about_updated_at?: string | null
          about_visibility?: string | null
          account_status?: string | null
          age?: number | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          daily_ai_chat_count?: number | null
          daily_ai_eduqa_count?: number | null
          daily_ai_image_count?: number | null
          daily_ai_thesis_count?: number | null
          daily_ai_video_count?: number | null
          daily_enhancement_count?: number | null
          date_of_birth?: string | null
          detected_country_code?: string | null
          display_name?: string | null
          facebook_url?: string | null
          followers_count?: number | null
          following_count?: number | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          interests?: string[] | null
          is_duplicate_flagged?: boolean | null
          is_premium?: boolean | null
          last_ai_reset?: string | null
          last_ai_reset_date?: string | null
          last_display_name_change?: string | null
          last_enhancement_reset?: string | null
          last_free_enhancement?: string | null
          last_username_change?: string | null
          linkedin_url?: string | null
          location?: string | null
          marital_status?: string | null
          max_friends?: number | null
          occupation?: string | null
          phone_number?: string | null
          phone_verified?: boolean | null
          preferred_currency?: string | null
          preferred_language?: string | null
          profile_completed?: boolean | null
          purpose?: string[] | null
          purpose_updated_at?: string | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by?: string | null
          registration_ip?: unknown
          signup_fingerprint?: string | null
          status?: string | null
          status_updated_at?: string | null
          status_visibility?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          total_views?: number | null
          twitter_url?: string | null
          updated_at?: string
          username?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profits_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          source_id: string | null
          source_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          transaction_type?: string
        }
        Relationships: []
      }
      profits_wallet: {
        Row: {
          balance: number | null
          created_at: string | null
          gift_fees: number | null
          id: string
          other_fees: number | null
          promotion_fees: number | null
          total_collected: number | null
          total_withdrawn: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          gift_fees?: number | null
          id?: string
          other_fees?: number | null
          promotion_fees?: number | null
          total_collected?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          gift_fees?: number | null
          id?: string
          other_fees?: number | null
          promotion_fees?: number | null
          total_collected?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_token: string | null
          endpoint: string
          id: string
          p256dh: string
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_token?: string | null
          endpoint: string
          id?: string
          p256dh: string
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_token?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      saved_courses: {
        Row: {
          course_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      scheduled_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          error_message: string | null
          group_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          group_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          group_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      space_feedback: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          rating: number
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          rating: number
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          rating?: number
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_feedback_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "live_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          group_id: string | null
          group_message_id: string | null
          id: string
          message_id: string | null
          message_type: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          group_id?: string | null
          group_message_id?: string | null
          id?: string
          message_id?: string | null
          message_type: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          group_id?: string | null
          group_message_id?: string | null
          id?: string
          message_id?: string | null
          message_type?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          music_artist: string | null
          music_title: string | null
          music_url: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type: string
          media_url: string
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          music_artist?: string | null
          music_title?: string | null
          music_url?: string | null
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
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
      subjects: {
        Row: {
          category_id: string | null
          course_count: number | null
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          category_id?: string | null
          course_count?: number | null
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          category_id?: string | null
          course_count?: number | null
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "course_categories"
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
          subscription_credits: number | null
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
          subscription_credits?: number | null
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
          subscription_credits?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_wallets: {
        Row: {
          balance: number
          can_mint: boolean | null
          can_transfer: boolean | null
          can_withdraw: boolean | null
          created_at: string | null
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string | null
          user_id: string
          wallet_name: string
        }
        Insert: {
          balance?: number
          can_mint?: boolean | null
          can_transfer?: boolean | null
          can_withdraw?: boolean | null
          created_at?: string | null
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
          user_id: string
          wallet_name?: string
        }
        Update: {
          balance?: number
          can_mint?: boolean | null
          can_transfer?: boolean | null
          can_withdraw?: boolean | null
          created_at?: string | null
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
          user_id?: string
          wallet_name?: string
        }
        Relationships: []
      }
      trending_searches: {
        Row: {
          id: string
          last_searched_at: string | null
          query: string
          search_count: number | null
        }
        Insert: {
          id?: string
          last_searched_at?: string | null
          query: string
          search_count?: number | null
        }
        Update: {
          id?: string
          last_searched_at?: string | null
          query?: string
          search_count?: number | null
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          activity_type: string | null
          conversation_id: string
          id: string
          is_typing: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          conversation_id: string
          id?: string
          is_typing?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
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
      user_ad_impressions: {
        Row: {
          ad_id: string
          clicked: boolean | null
          id: string
          impression_date: string
          impressions_count: number | null
          user_id: string
        }
        Insert: {
          ad_id: string
          clicked?: boolean | null
          id?: string
          impression_date?: string
          impressions_count?: number | null
          user_id: string
        }
        Update: {
          ad_id?: string
          clicked?: boolean | null
          id?: string
          impression_date?: string
          impressions_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ad_impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "feed_ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ad_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ad_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_analytics: {
        Row: {
          created_at: string | null
          id: string
          last_active: string | null
          last_purchase_at: string | null
          total_credits_purchased: number | null
          total_credits_spent: number | null
          total_promotions: number | null
          total_subscriptions: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_active?: string | null
          last_purchase_at?: string | null
          total_credits_purchased?: number | null
          total_credits_spent?: number | null
          total_promotions?: number | null
          total_subscriptions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_active?: string | null
          last_purchase_at?: string | null
          total_credits_purchased?: number | null
          total_credits_spent?: number | null
          total_promotions?: number | null
          total_subscriptions?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          is_verified: boolean
          recipient_code: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          recipient_code?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          recipient_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string
          created_at: string | null
          expires_at: string | null
          id: string
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          ban_type?: string
          banned_by: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string | null
          highest_tier_level: number | null
          id: string
          is_admin_minted: boolean | null
          last_gift_sent_at: string | null
          total_earned: number
          total_spent: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          highest_tier_level?: number | null
          id?: string
          is_admin_minted?: boolean | null
          last_gift_sent_at?: string | null
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          highest_tier_level?: number | null
          id?: string
          is_admin_minted?: boolean | null
          last_gift_sent_at?: string | null
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_engagement_signals: {
        Row: {
          created_at: string | null
          engagement_type: string
          full_watch: boolean | null
          id: string
          media_type: string | null
          post_id: string | null
          user_id: string
          watch_duration_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          engagement_type: string
          full_watch?: boolean | null
          id?: string
          media_type?: string | null
          post_id?: string | null
          user_id: string
          watch_duration_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          engagement_type?: string
          full_watch?: boolean | null
          id?: string
          media_type?: string | null
          post_id?: string | null
          user_id?: string
          watch_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_engagement_signals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feed_sessions: {
        Row: {
          created_at: string | null
          feed_type: string | null
          id: string
          last_position: number | null
          last_post_id: string | null
          posts_viewed_this_session: number | null
          session_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feed_type?: string | null
          id?: string
          last_position?: number | null
          last_post_id?: string | null
          posts_viewed_this_session?: number | null
          session_start?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feed_type?: string | null
          id?: string
          last_position?: number | null
          last_post_id?: string | null
          posts_viewed_this_session?: number | null
          session_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feed_sessions_last_post_id_fkey"
            columns: ["last_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feed_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feed_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_identifiers: {
        Row: {
          created_at: string | null
          first_seen_at: string | null
          flag_reason: string | null
          id: string
          identifier_type: string
          identifier_value: string
          is_flagged: boolean | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          first_seen_at?: string | null
          flag_reason?: string | null
          id?: string
          identifier_type: string
          identifier_value: string
          is_flagged?: boolean | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          first_seen_at?: string | null
          flag_reason?: string | null
          id?: string
          identifier_type?: string
          identifier_value?: string
          is_flagged?: boolean | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_identifiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_identifiers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string | null
          decay_factor: number | null
          id: string
          interest_type: string
          interest_value: string
          last_interaction: string | null
          source: string | null
          updated_at: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          decay_factor?: number | null
          id?: string
          interest_type: string
          interest_value: string
          last_interaction?: string | null
          source?: string | null
          updated_at?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          decay_factor?: number | null
          id?: string
          interest_type?: string
          interest_value?: string
          last_interaction?: string | null
          source?: string | null
          updated_at?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      user_media_preferences: {
        Row: {
          id: string
          photo_view_count: number | null
          preferred_media_type: string | null
          text_view_count: number | null
          updated_at: string | null
          user_id: string
          video_completion_rate: number | null
          video_count: number | null
          video_watch_seconds: number | null
        }
        Insert: {
          id?: string
          photo_view_count?: number | null
          preferred_media_type?: string | null
          text_view_count?: number | null
          updated_at?: string | null
          user_id: string
          video_completion_rate?: number | null
          video_count?: number | null
          video_watch_seconds?: number | null
        }
        Update: {
          id?: string
          photo_view_count?: number | null
          preferred_media_type?: string | null
          text_view_count?: number | null
          updated_at?: string | null
          user_id?: string
          video_completion_rate?: number | null
          video_count?: number | null
          video_watch_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_media_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_public_keys: {
        Row: {
          created_at: string | null
          id: string
          key_version: number | null
          public_key_jwk: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_version?: number | null
          public_key_jwk: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_version?: number | null
          public_key_jwk?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_resumes: {
        Row: {
          awards: Json | null
          certifications: Json | null
          created_at: string | null
          custom_sections: Json | null
          download_count: number | null
          education: Json | null
          experience: Json | null
          id: string
          is_primary: boolean | null
          is_public: boolean | null
          languages: Json | null
          last_updated: string | null
          personal_info: Json | null
          projects: Json | null
          skills: string[] | null
          summary: string | null
          template_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          awards?: Json | null
          certifications?: Json | null
          created_at?: string | null
          custom_sections?: Json | null
          download_count?: number | null
          education?: Json | null
          experience?: Json | null
          id?: string
          is_primary?: boolean | null
          is_public?: boolean | null
          languages?: Json | null
          last_updated?: string | null
          personal_info?: Json | null
          projects?: Json | null
          skills?: string[] | null
          summary?: string | null
          template_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          awards?: Json | null
          certifications?: Json | null
          created_at?: string | null
          custom_sections?: Json | null
          download_count?: number | null
          education?: Json | null
          experience?: Json | null
          id?: string
          is_primary?: boolean | null
          is_public?: boolean | null
          languages?: Json | null
          last_updated?: string | null
          personal_info?: Json | null
          projects?: Json | null
          skills?: string[] | null
          summary?: string | null
          template_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          can_manage_content: boolean | null
          can_manage_disputes: boolean | null
          can_manage_p2p: boolean | null
          can_manage_roles: boolean | null
          can_manage_users: boolean | null
          can_view_analytics: boolean | null
          created_at: string | null
          id: string
          notes: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          can_manage_content?: boolean | null
          can_manage_disputes?: boolean | null
          can_manage_p2p?: boolean | null
          can_manage_roles?: boolean | null
          can_manage_users?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          can_manage_content?: boolean | null
          can_manage_disputes?: boolean | null
          can_manage_p2p?: boolean | null
          can_manage_roles?: boolean | null
          can_manage_users?: boolean | null
          can_view_analytics?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_profiles_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_assigned_by_profiles_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_seen_posts: {
        Row: {
          id: string
          media_type: string | null
          post_id: string
          seen_at: string
          seen_date: string
          user_id: string
          watch_time_seconds: number | null
        }
        Insert: {
          id?: string
          media_type?: string | null
          post_id: string
          seen_at?: string
          seen_date?: string
          user_id: string
          watch_time_seconds?: number | null
        }
        Update: {
          id?: string
          media_type?: string | null
          post_id?: string
          seen_at?: string
          seen_date?: string
          user_id?: string
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_seen_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_seen_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_seen_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          device_info: Json | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          is_trusted: boolean | null
          last_active_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint?: string | null
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_trusted?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string | null
          device_info?: Json | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_trusted?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
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
          payment_provider: string | null
          paystack_reference: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
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
          payment_provider?: string | null
          paystack_reference?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          payment_provider?: string | null
          paystack_reference?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
      user_wallet_notifications: {
        Row: {
          created_at: string | null
          id: string
          last_viewed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_viewed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_viewed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_ngn: number
          bank_account_id: string | null
          credit_amount: number
          exchange_rate_used: number
          failure_reason: string | null
          id: string
          net_credits: number
          paystack_reference: string | null
          paystack_transfer_code: string | null
          platform_fee_credits: number
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount_ngn?: number
          bank_account_id?: string | null
          credit_amount: number
          exchange_rate_used?: number
          failure_reason?: string | null
          id?: string
          net_credits?: number
          paystack_reference?: string | null
          paystack_transfer_code?: string | null
          platform_fee_credits?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_ngn?: number
          bank_account_id?: string | null
          credit_amount?: number
          exchange_rate_used?: number
          failure_reason?: string | null
          id?: string
          net_credits?: number
          paystack_reference?: string | null
          paystack_transfer_code?: string | null
          platform_fee_credits?: number
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "user_bank_accounts"
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
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams_public: {
        Row: {
          category: string | null
          cf_hls_url: string | null
          cf_webrtc_url: string | null
          connection_state: string | null
          created_at: string | null
          description: string | null
          ended_at: string | null
          id: string | null
          is_premium: boolean | null
          peak_viewers: number | null
          scheduled_start: string | null
          started_at: string | null
          status: string | null
          stream_ready: boolean | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          user_id: string | null
          viewer_count: number | null
        }
        Insert: {
          category?: string | null
          cf_hls_url?: string | null
          cf_webrtc_url?: string | null
          connection_state?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          is_premium?: boolean | null
          peak_viewers?: number | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string | null
          stream_ready?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          viewer_count?: number | null
        }
        Update: {
          category?: string | null
          cf_hls_url?: string | null
          cf_webrtc_url?: string | null
          connection_state?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string | null
          is_premium?: boolean | null
          peak_viewers?: number | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string | null
          stream_ready?: boolean | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          viewer_count?: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          about: string | null
          about_visibility: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          facebook_url: string | null
          followers_count: number | null
          following_count: number | null
          id: string | null
          instagram_url: string | null
          interests: string[] | null
          is_premium: boolean | null
          linkedin_url: string | null
          location: string | null
          marital_status: string | null
          phone_number: string | null
          purpose: string[] | null
          referral_code: string | null
          status: string | null
          status_visibility: string | null
          tiktok_url: string | null
          total_views: number | null
          twitter_url: string | null
          username: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Relationships: []
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
      add_credits_from_purchase: {
        Args: {
          p_amount: number
          p_description: string
          p_reference: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_grant_credits: {
        Args: { credit_amount: number; reason?: string; target_user_id: string }
        Returns: Json
      }
      admin_mint_credits: {
        Args: { p_amount: number; p_reason?: string }
        Returns: Json
      }
      admin_transfer_to_user: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      admin_withdraw_from_profits:
        | { Args: { p_amount: number; p_reason?: string }; Returns: boolean }
        | { Args: { p_amount: number; p_reason?: string }; Returns: Json }
      admin_withdraw_to_team_wallet: {
        Args: { p_amount: number; p_reason?: string }
        Returns: Json
      }
      apply_interest_decay: { Args: never; Returns: number }
      are_mutual_friends: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
      calculate_trending_posts: { Args: never; Returns: undefined }
      calculate_trending_scores: { Args: never; Returns: undefined }
      can_appoint_roles: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      can_change_username: { Args: { user_id: string }; Returns: boolean }
      can_delete_for_everyone: {
        Args: { message_id: string; user_id: string }
        Returns: boolean
      }
      can_manage_credits: { Args: never; Returns: boolean }
      can_manage_group: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      can_message_stranger: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_mint_credits: { Args: never; Returns: boolean }
      can_request_payout: { Args: { p_user_id: string }; Returns: Json }
      can_send_friend_request: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_update_purpose: { Args: { user_id: string }; Returns: boolean }
      can_view_activity_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_view_admin_wallet: { Args: never; Returns: boolean }
      can_view_online_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      can_view_profile: { Args: { target_user_id: string }; Returns: boolean }
      can_view_profile_field: {
        Args: { field_name: string; target_user_id: string }
        Returns: boolean
      }
      can_withdraw_from_wallet: { Args: never; Returns: boolean }
      check_all_posts_viewed: { Args: never; Returns: boolean }
      cleanup_expired_stories: { Args: never; Returns: undefined }
      cleanup_old_view_history: { Args: never; Returns: undefined }
      convert_all_gifts: { Args: never; Returns: Json }
      convert_gift: { Args: { p_gift_id: string }; Returns: Json }
      create_conversation: { Args: { other_user_id: string }; Returns: string }
      decrement_viewer_count: {
        Args: { p_stream_id: string }
        Returns: undefined
      }
      deduct_credits_for_withdrawal: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      deduct_credits_safe: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: boolean
      }
      delete_expired_stories: { Args: never; Returns: undefined }
      filter_seen_posts: {
        Args: { p_post_ids: string[]; p_user_id: string }
        Returns: string[]
      }
      generate_feed_id: { Args: never; Returns: string }
      generate_stream_key: { Args: never; Returns: string }
      generate_unique_invite_code: { Args: never; Returns: string }
      get_active_sessions_count: { Args: never; Returns: number }
      get_conversations_with_details: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_content: string
          last_message_created_at: string
          last_message_sender_id: string
          other_user_avatar_url: string
          other_user_display_name: string
          other_user_id: string
          other_user_username: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_credit_statistics: { Args: never; Returns: Json }
      get_daily_earnings_stats:
        | { Args: never; Returns: Json }
        | { Args: { p_days?: number }; Returns: Json }
      get_deleted_posts_by_username: {
        Args: { target_username: string }
        Returns: {
          content: string
          created_at: string
          deleted_at: string
          deleted_by: string
          feed_id: string
          id: string
          media_type: string
          media_url: string
          user_id: string
        }[]
      }
      get_expired_attachments: {
        Args: never
        Returns: {
          file_path: string
          id: string
          message_id: string
        }[]
      }
      get_explore_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          discovery_score: number
          is_promoted: boolean
          likes_count: number
          location: string
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          original_post_id: string
          post_id: string
          post_type: string
          refeeds_count: number
          user_id: string
          views_count: number
        }[]
      }
      get_feed: {
        Args: {
          p_include_trending?: boolean
          p_limit?: number
          p_media_filter?: string
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          id: string
          is_new_post: boolean
          is_promoted: boolean
          is_trending: boolean
          likes_count: number
          location: string
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          original_post_id: string
          post_type: string
          post_user_id: string
          refeeds_count: number
          relevance_score: number
          views_count: number
        }[]
      }
      get_feed_status: {
        Args: { p_user_id: string }
        Returns: {
          cycle_reset_count: number
          last_reset_at: string
          needs_cycle_reset: boolean
          posts_viewed_today: number
          total_posts_available: number
          viewing_progress_percent: number
        }[]
      }
      get_feed_with_ads: {
        Args: {
          p_ad_frequency?: number
          p_limit?: number
          p_media_filter?: string
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          advertiser_name: string
          click_url: string
          comments_count: number
          content: string
          created_at: string
          display_order: number
          is_new_post: boolean
          is_promoted: boolean
          item_id: string
          item_type: string
          likes_count: number
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          post_user_id: string
          relevance_score: number
          views_count: number
        }[]
      }
      get_feed_with_rotation:
        | {
            Args: {
              p_feed_type: string
              p_limit: number
              p_media_filter: string
              p_offset: number
              p_session_id: string
              p_user_id: string
            }
            Returns: {
              comments_count: number
              content: string
              created_at: string
              is_new_post: boolean
              is_own_post: boolean
              is_promoted: boolean
              likes_count: number
              location: string
              media_type: string
              media_types: string[]
              media_url: string
              media_urls: string[]
              original_post_id: string
              post_id: string
              post_type: string
              refeeds_count: number
              relevance_score: number
              user_id: string
              views_count: number
            }[]
          }
        | {
            Args: {
              p_feed_type?: string
              p_limit?: number
              p_media_filter?: string
              p_offset?: number
              p_session_seed?: string
              p_user_id: string
            }
            Returns: {
              boost_level: string
              comments_count: number
              content: string
              created_at: string
              id: string
              is_new_post: boolean
              is_promoted: boolean
              likes_count: number
              location: string
              media_type: string
              media_types: string[]
              media_url: string
              media_urls: string[]
              original_post_id: string
              post_type: string
              promoter_id: string
              refeeds_count: number
              relevance_score: number
              user_id: string
              views_count: number
            }[]
          }
      get_following_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          boost_level: string
          is_promoted: boolean
          post_id: string
        }[]
      }
      get_gift_analytics_summary: { Args: never; Returns: Json }
      get_gift_statistics: { Args: never; Returns: Json }
      get_group_role: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: string
      }
      get_group_unread_count: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: number
      }
      get_live_stream_statistics: { Args: never; Returns: Json }
      get_message_read_receipts: {
        Args: { message_ids: string[] }
        Returns: {
          message_id: string
          read_at: string
          user_id: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          about: string
          age: number
          avatar_url: string
          banner_url: string
          bio: string
          country: string
          cover_url: string
          created_at: string
          display_name: string
          facebook_url: string
          followers_count: number
          following_count: number
          id: string
          instagram_url: string
          interests: string[]
          is_premium: boolean
          linkedin_url: string
          location: string
          marital_status: string
          phone_number: string
          purpose: string[]
          tiktok_url: string
          total_views: number
          twitter_url: string
          username: string
          website_url: string
          youtube_url: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_sensitive_data: {
        Args: never
        Returns: {
          phone_number: string
          stripe_customer_id: string
          user_id: string
        }[]
      }
      get_my_stream_key: { Args: { stream_id_param: string }; Returns: string }
      get_payout_statistics: { Args: never; Returns: Json }
      get_personalized_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          location: string
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          original_post_id: string
          post_type: string
          refeeds_count: number
          relevance_score: number
          user_id: string
          views_count: number
        }[]
      }
      get_personalized_feed_v2: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          post_id: string
          relevance_score: number
        }[]
      }
      get_personalized_for_you_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          boost_level: string
          is_promoted: boolean
          post_id: string
          relevance_score: number
        }[]
      }
      get_post_view_count: { Args: { post_id_param: string }; Returns: number }
      get_prioritized_feed: {
        Args: {
          p_feed_type?: string
          p_limit?: number
          p_user_id: string
          p_viewed_post_ids?: string[]
        }
        Returns: {
          allow_comments: boolean
          allow_refeed: boolean
          comments_count: number
          content: string
          created_at: string
          feed_id: string
          id: string
          is_promoted: boolean
          likes_count: number
          location: string
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          original_post_id: string
          post_type: string
          privacy: string
          promotion_boost_level: string
          refeeds_count: number
          shares_count: number
          status: string
          updated_at: string
          user_id: string
          views_count: number
        }[]
      }
      get_profits_wallet_summary: { Args: never; Returns: Json }
      get_randomized_feed_cycle: {
        Args: { p_limit?: number; p_media_filter?: string; p_user_id: string }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          id: string
          is_promoted: boolean
          likes_count: number
          location: string
          media_type: string
          media_types: string[]
          media_url: string
          media_urls: string[]
          original_post_id: string
          post_type: string
          refeeds_count: number
          user_id: string
          views_count: number
        }[]
      }
      get_recent_gift_transactions: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          credit_value: number
          gift_type: string
          id: string
          platform_fee: number
          receiver_id: string
          receiver_username: string
          sender_id: string
          sender_username: string
          source_id: string
          source_type: string
        }[]
      }
      get_recent_live_gifts: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          credit_value: number
          gift_type: string
          id: string
          receiver_id: string
          receiver_username: string
          sender_id: string
          sender_username: string
          stream_id: string
          stream_title: string
        }[]
      }
      get_recent_profits_transactions: {
        Args: { p_limit?: number }
        Returns: Json
      }
      get_smart_feed_posts: {
        Args: { p_limit?: number; p_tab?: string }
        Returns: {
          boost_level: string
          is_promoted: boolean
          is_viewed: boolean
          post_id: string
        }[]
      }
      get_subscription_statistics: { Args: never; Returns: Json }
      get_targeted_ads: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          ad_id: string
          click_url: string
          description: string
          media_type: string
          media_url: string
          relevance_score: number
          title: string
        }[]
      }
      get_targeted_ads_v2: {
        Args: {
          p_limit?: number
          p_user_id: string
          p_user_interests?: string[]
        }
        Returns: {
          ad_id: string
          advertiser_name: string
          click_url: string
          description: string
          media_type: string
          media_url: string
          priority: number
          title: string
        }[]
      }
      get_today_viewed_posts: {
        Args: never
        Returns: {
          post_id: string
        }[]
      }
      get_unread_message_count: {
        Args: { conv_id: string; uid: string }
        Returns: number
      }
      get_user_by_username: { Args: { p_username: string }; Returns: string }
      get_user_credits: { Args: { p_user_id: string }; Returns: number }
      get_user_email_by_username: {
        Args: { p_username: string }
        Returns: string
      }
      get_user_post_count: { Args: { user_uuid: string }; Returns: number }
      get_user_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          followers_count: number
          following_count: number
          id: string
          is_premium: boolean
          username: string
        }[]
      }
      get_user_total_likes: { Args: { user_uuid: string }; Returns: number }
      get_view_history: {
        Args: { p_limit?: number }
        Returns: {
          author_avatar: string
          author_name: string
          author_username: string
          content: string
          media_url: string
          post_id: string
          viewed_at: string
        }[]
      }
      get_visible_profiles: {
        Args: { requesting_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          cover_url: string
          display_name: string
          followers_count: number
          following_count: number
          id: string
          is_premium: boolean
          username: string
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      has_unlimited_access: { Args: never; Returns: boolean }
      increment_music_track_play: {
        Args: { track_id: string }
        Returns: undefined
      }
      increment_music_track_usage: {
        Args: { track_id: string }
        Returns: undefined
      }
      increment_platform_wallet: {
        Args: { amount: number; column_name: string }
        Returns: undefined
      }
      increment_post_comments_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_referral_count: {
        Args: { referrer_id: string }
        Returns: undefined
      }
      increment_viewer_count: {
        Args: { p_stream_id: string }
        Returns: undefined
      }
      insert_ads: {
        Args: {
          p_ad_count?: number
          p_user_id: string
          p_user_interests?: string[]
        }
        Returns: {
          ad_id: string
          advertiser_name: string
          click_url: string
          description: string
          is_ad: boolean
          media_type: string
          media_url: string
          priority: number
          title: string
        }[]
      }
      invalidate_all_sessions: { Args: never; Returns: undefined }
      invalidate_session: { Args: { p_session_id: string }; Returns: boolean }
      is_account_locked: { Args: { p_identifier: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member_simple: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_user_blocked: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_user_muted: {
        Args: { muted: string; muter: string }
        Returns: boolean
      }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      join_group_via_invite: { Args: { p_invite_code: string }; Returns: Json }
      log_gift_analytics: {
        Args: {
          p_credit_value: number
          p_gift_type: string
          p_platform_fee?: number
          p_receiver_id: string
          p_sender_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      log_login_attempt: {
        Args: {
          p_failure_reason?: string
          p_identifier: string
          p_ip_address?: string
          p_success?: boolean
        }
        Returns: undefined
      }
      log_security_event: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      mark_attachment_downloaded: {
        Args: { attachment_id: string }
        Returns: undefined
      }
      mark_conversation_read: { Args: { conv_id: string }; Returns: undefined }
      mark_group_messages_read: {
        Args: { p_group_id: string; p_message_id: string }
        Returns: undefined
      }
      prioritize_new_posts: {
        Args: { p_post_ids: string[] }
        Returns: {
          age_hours: number
          is_new: boolean
          post_id: string
        }[]
      }
      process_payout_request: {
        Args: { p_action: string; p_notes?: string; p_request_id: string }
        Returns: Json
      }
      promote_post:
        | {
            Args: {
              p_boost_type?: string
              p_credits: number
              p_original_author_id?: string
              p_post_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cost: number
              p_original_author_id?: string
              p_plan_name: string
              p_post_id: string
            }
            Returns: Json
          }
      randomize_feed_order: {
        Args: { p_post_ids: string[] }
        Returns: string[]
      }
      record_ad_impression: {
        Args: { p_ad_id: string; p_clicked?: boolean; p_user_id: string }
        Returns: undefined
      }
      record_platform_revenue: {
        Args: {
          p_amount: number
          p_description?: string
          p_from_user_id?: string
          p_revenue_type: string
        }
        Returns: undefined
      }
      record_post_view:
        | { Args: { p_post_id: string }; Returns: undefined }
        | {
            Args: {
              p_media_type?: string
              p_post_id: string
              p_user_id: string
              p_watch_time?: number
            }
            Returns: undefined
          }
      record_profit: {
        Args: {
          p_amount: number
          p_description?: string
          p_source_id?: string
          p_type: string
        }
        Returns: undefined
      }
      refund_failed_withdrawal: {
        Args: { p_amount: number; p_user_id: string; p_withdrawal_id: string }
        Returns: undefined
      }
      request_creator_payout: { Args: { p_amount: number }; Returns: Json }
      reset_viewed_posts_cycle: {
        Args: { p_user_id: string }
        Returns: {
          coverage_percent: number
          total_posts: number
          viewed_posts: number
          was_reset: boolean
        }[]
      }
      restore_deleted_post: { Args: { post_id: string }; Returns: boolean }
      rotate_feed_session: {
        Args: { p_feed_type?: string; p_user_id: string }
        Returns: number
      }
      search_messages: {
        Args: {
          p_conversation_id?: string
          p_end_date?: string
          p_group_id?: string
          p_limit?: number
          p_media_type?: string
          p_offset?: number
          p_query?: string
          p_sender_id?: string
          p_start_date?: string
          p_user_id: string
        }
        Returns: {
          content: string
          context_type: string
          created_at: string
          id: string
          media_type: string
          media_url: string
          sender_avatar: string
          sender_id: string
          sender_name: string
        }[]
      }
      send_direct_gift:
        | {
            Args: {
              p_credit_value: number
              p_gift_type: string
              p_recipient_identifier: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_credit_value: number
              p_gift_type: string
              p_recipient_identifier: string
            }
            Returns: string
          }
      send_gift:
        | {
            Args: {
              p_credit_value: number
              p_gift_type: string
              p_post_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_credit_value: number
              p_gift_type: string
              p_post_id: string
              p_recipient_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_conversation_id?: string
              p_credit_value: number
              p_gift_type: string
              p_recipient_id: string
            }
            Returns: string
          }
      send_live_gift: {
        Args: {
          p_credit_value: number
          p_gift_type: string
          p_stream_id: string
        }
        Returns: Json
      }
      sync_credit_supply: { Args: never; Returns: undefined }
      toggle_creator_monetization: {
        Args: { p_monetize: boolean; p_user_id: string }
        Returns: Json
      }
      track_media_preference: {
        Args: {
          p_completed?: boolean
          p_media_type: string
          p_user_id: string
          p_watch_duration?: number
        }
        Returns: undefined
      }
      transfer_credits: {
        Args: { p_amount: number; p_recipient_username: string }
        Returns: Json
      }
      update_feed_session: {
        Args: {
          p_feed_type: string
          p_last_post_id: string
          p_position: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_my_phone_number: { Args: { new_phone: string }; Returns: boolean }
      update_user_interests_from_engagement: {
        Args: {
          p_engagement_type: string
          p_post_id: string
          p_user_id: string
          p_watch_duration?: number
        }
        Returns: undefined
      }
      upsert_user_session: {
        Args: {
          p_device_fingerprint: string
          p_device_info?: Json
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: string
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
