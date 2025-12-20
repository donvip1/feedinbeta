import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { limit = 20, offset = 0 } = await req.json();

    // Get user's interests
    const { data: userInterests } = await supabase
      .from('user_interests')
      .select('hashtag_id, interest_score, hashtags(name)')
      .eq('user_id', user.id)
      .order('interest_score', { ascending: false })
      .limit(10);

    // Get user's recent engagement patterns
    const { data: recentEngagement } = await supabase
      .from('user_engagement_signals')
      .select('post_id, engagement_type, watch_duration_seconds')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Use database function for personalized feed
    const { data: personalizedPosts, error: feedError } = await supabase
      .rpc('get_personalized_feed', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset
      });

    if (feedError) {
      console.error('Feed error:', feedError);
      throw feedError;
    }

    // If we have Lovable AI and user interests, enhance ranking
    if (lovableApiKey && userInterests && userInterests.length > 0 && personalizedPosts && personalizedPosts.length > 0) {
      try {
        const interestTags = userInterests.map((i: any) => i.hashtags?.name).filter(Boolean);
        
        // Use AI to re-rank top posts based on user preferences
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a feed ranking AI. Given user interests and posts, return post IDs in order of relevance. User interests: ${interestTags.join(', ')}. Consider engagement patterns and content freshness.`
              },
              {
                role: 'user',
                content: `Rank these posts by relevance (return only the IDs as JSON array): ${JSON.stringify(personalizedPosts.slice(0, 10).map((p: any) => ({ id: p.id, content: p.content?.substring(0, 100), likes: p.likes_count })))}`
              }
            ],
            max_tokens: 500,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiContent = aiData.choices?.[0]?.message?.content;
          
          // Try to parse AI ranking
          try {
            const rankedIds = JSON.parse(aiContent.match(/\[.*\]/s)?.[0] || '[]');
            if (Array.isArray(rankedIds) && rankedIds.length > 0) {
              // Reorder posts based on AI ranking
              const idToPost = new Map(personalizedPosts.map((p: any) => [p.id, p]));
              const rerankedPosts = [
                ...rankedIds.map((id: string) => idToPost.get(id)).filter(Boolean),
                ...personalizedPosts.filter((p: any) => !rankedIds.includes(p.id))
              ];
              
              return new Response(JSON.stringify({ 
                posts: rerankedPosts,
                aiEnhanced: true 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } catch (parseErr) {
            console.log('AI ranking parse error, using default ranking');
          }
        }
      } catch (aiErr) {
        console.log('AI enhancement failed, using default ranking:', aiErr);
      }
    }

    return new Response(JSON.stringify({ 
      posts: personalizedPosts || [],
      aiEnhanced: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-feed-ranking:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
