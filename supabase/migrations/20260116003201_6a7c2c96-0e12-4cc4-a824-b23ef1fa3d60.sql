-- Create AI tool usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_tool_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tool_id TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  input_type TEXT,
  output_type TEXT,
  credits_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create AI tool results table for storing generated content
CREATE TABLE IF NOT EXISTS public.ai_tool_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tool_id TEXT NOT NULL,
  result_type TEXT NOT NULL,
  result_url TEXT,
  result_data JSONB,
  file_size_bytes BIGINT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create AI agent conversations table for persistent memory
CREATE TABLE IF NOT EXISTS public.ai_agent_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create AI agent messages table
CREATE TABLE IF NOT EXISTS public.ai_agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.ai_agent_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_tool_usage
CREATE POLICY "Users can view own tool usage" ON public.ai_tool_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tool usage" ON public.ai_tool_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_tool_results
CREATE POLICY "Users can view own tool results" ON public.ai_tool_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tool results" ON public.ai_tool_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tool results" ON public.ai_tool_results
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_agent_conversations
CREATE POLICY "Users can view own conversations" ON public.ai_agent_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.ai_agent_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_agent_conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.ai_agent_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_agent_messages
CREATE POLICY "Users can view own messages" ON public.ai_agent_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.ai_agent_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.ai_agent_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_tool_usage_user ON public.ai_tool_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tool_results_user ON public.ai_tool_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_conversations_user ON public.ai_agent_conversations(user_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_conversation ON public.ai_agent_messages(conversation_id, created_at ASC);