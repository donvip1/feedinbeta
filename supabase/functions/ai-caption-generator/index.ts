import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { description, style = 'casual', count = 3 } = await req.json();

    if (!description || typeof description !== 'string') {
      return new Response(
        JSON.stringify({ error: "Description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a social media expert specializing in creating engaging captions. You understand what makes content viral and know how to craft captions that drive engagement.

Your task is to generate ${count} different caption options based on the user's description.

IMPORTANT: Respond ONLY with a valid JSON object in this exact format:
{
  "captions": [
    {
      "caption": "The main caption text",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "style": "${style}"
    }
  ]
}

Style guidelines for "${style}":
- professional: Business-appropriate, polished, value-focused
- casual: Friendly, relatable, conversational
- funny: Humorous, witty, entertaining
- inspiring: Motivational, uplifting, empowering

Rules:
- Keep captions concise but impactful (2-4 sentences max)
- Include relevant emojis naturally
- Generate 5-8 relevant hashtags per caption
- Make each caption unique in approach
- Ensure hashtags are popular but relevant`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate ${count} engaging captions for this post: ${description}` }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error("AI service error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    // Log AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature: 'caption_generator',
      model: 'google/gemini-2.5-flash',
      cost_credits: 10,
    });

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Caption generator error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate captions" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});