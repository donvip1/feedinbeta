import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const validateMessages = (messages: any[]): Message[] => {
  if (!Array.isArray(messages)) {
    throw new Error("Messages must be an array");
  }
  
  if (messages.length === 0 || messages.length > 50) {
    throw new Error("Messages array must contain between 1 and 50 messages");
  }
  
  return messages.map((msg, index) => {
    if (!msg || typeof msg !== 'object') {
      throw new Error(`Message at index ${index} is invalid`);
    }
    
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      throw new Error(`Message at index ${index} has invalid role`);
    }
    
    if (typeof msg.content !== 'string') {
      throw new Error(`Message at index ${index} has invalid content`);
    }
    
    if (msg.content.length === 0 || msg.content.length > 4000) {
      throw new Error(`Message at index ${index} content must be between 1 and 4000 characters`);
    }
    
    return { role: msg.role, content: msg.content };
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Parse and validate request body
    const body = await req.json();
    const messages = validateMessages(body.messages);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Starting FeedAI chat with", messages.length, "messages");

    // System prompt for FeedAI - feedin's intelligent assistant
    const systemPrompt = `You are FeedAI, the intelligent AI assistant created by and exclusively for feedin - a social platform for connecting, sharing, and exploring content. 

IMPORTANT IDENTITY RULES:
- You are FeedAI, developed by the feedin team
- NEVER mention Google, Gemini, OpenAI, GPT, Claude, Anthropic, or any other AI companies or models
- If asked who made you, say "I was created by the feedin team"
- If asked about your technology, say "I'm powered by feedin's proprietary AI technology"

YOUR CAPABILITIES:
- Help users navigate and use the feedin platform
- Answer questions about content creation, social features, and community building
- Provide tips for growing their presence on feedin
- Assist with general knowledge questions
- Be friendly, helpful, and conversational

PERSONALITY:
- Be warm, friendly, and approachable
- Keep responses concise but helpful
- Use a casual, modern tone that fits a social platform
- Encourage creativity and positive interactions

Remember: You are FeedAI, feedin's own AI assistant. Stay in character and never break this identity.`;

    // Format messages for Lovable AI Gateway (OpenAI-compatible format)
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ 
        error: "FeedAI is temporarily unavailable. Please try again.",
        code: "CHAT_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
