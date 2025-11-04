import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mediaUrl, mediaType } = await req.json();
    
    // Simplified mood detection - in production, use AI vision API
    const moods = ['nature', 'urban', 'happy', 'chill', 'energetic', 'romantic', 'dramatic'];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];

    return new Response(
      JSON.stringify({ mood: randomMood }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
