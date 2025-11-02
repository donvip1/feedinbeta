-- Add new AI usage tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_ai_chat_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_ai_thesis_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_ai_video_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_ai_eduqa_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_ai_image_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_ai_reset_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Drop old columns if they exist
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS daily_ai_prompt_count;