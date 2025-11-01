import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { postId, content } = await req.json();

    if (!postId || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing postId or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract hashtags from content
    const hashtagRegex = /#(\w+)/g;
    const matches = content.match(hashtagRegex);
    
    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, hashtags: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique hashtags (lowercase)
    const uniqueHashtags = [...new Set(matches.map((tag: string) => tag.slice(1).toLowerCase()))];
    
    console.log(`Processing ${uniqueHashtags.length} hashtags for post ${postId}`);

    // Process each hashtag
    for (const hashtagName of uniqueHashtags) {
      // Insert or get hashtag
      const { data: hashtag, error: hashtagError } = await supabaseClient
        .from('hashtags')
        .upsert(
          { name: hashtagName },
          { onConflict: 'name', ignoreDuplicates: false }
        )
        .select()
        .single();

      if (hashtagError) {
        console.error(`Error upserting hashtag ${hashtagName}:`, hashtagError);
        continue;
      }

      // Link hashtag to post
      const { error: linkError } = await supabaseClient
        .from('post_hashtags')
        .insert({
          post_id: postId,
          hashtag_id: hashtag.id,
        })
        .select();

      if (linkError && linkError.code !== '23505') { // Ignore duplicate key errors
        console.error(`Error linking hashtag ${hashtagName} to post:`, linkError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        hashtags: uniqueHashtags,
        count: uniqueHashtags.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing hashtags:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
