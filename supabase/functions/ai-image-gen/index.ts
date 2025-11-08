import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const validateImageInput = (prompt: string) => {
  if (typeof prompt !== 'string') {
    throw new Error('Prompt must be a string');
  }
  
  if (prompt.length < 3) {
    throw new Error('Prompt too short (min 3 characters)');
  }
  
  if (prompt.length > 1000) {
    throw new Error('Prompt too long (max 1000 characters)');
  }
  
  // Filter inappropriate content (basic check)
  const blockedTerms = [
    'nude', 'naked', 'nsfw', 'porn', 'xxx', 'sex', 'explicit',
    'gore', 'violence', 'blood', 'death', 'kill',
    'racist', 'hate', 'offensive'
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  const foundBlockedTerm = blockedTerms.find(term => lowerPrompt.includes(term));
  
  if (foundBlockedTerm) {
    throw new Error('Inappropriate content detected in prompt');
  }
  
  return prompt;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, imageUrl: inputImageUrl, mode } = await req.json();
    
    // Validate input
    validateImageInput(prompt);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating/Editing image for user", user.id, "with prompt:", prompt, "Mode:", mode);

    // Build the message content based on whether we're editing or generating
    let messageContent;
    if (mode === "edit" && inputImageUrl) {
      // For image editing, send both the image and the prompt
      messageContent = [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: inputImageUrl
          }
        }
      ];
    } else {
      // For pure generation, just send the prompt
      messageContent = prompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: messageContent
          },
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI image generation error:", response.status, errorText);
      
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

    const data = await response.json();
    console.log("AI response received");
    
    // Extract image URL from response - images are returned in the images array
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      console.error("No image in response");
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Image generation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Image generation failed",
        code: "IMAGE_GEN_ERROR"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});