import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize and validate query length to prevent DoS
    const MAX_QUERY_LENGTH = 100;
    const sanitizedQuery = query.trim().substring(0, MAX_QUERY_LENGTH);
    
    // Escape special ILIKE pattern characters
    const sanitizeForIlike = (input: string): string => {
      return input.replace(/[%_\\]/g, '\\$&');
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use AI to understand the search intent
    let searchIntent = 'general';
    let extractedTerms: string[] = [];

    if (lovableApiKey) {
      try {
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
                content: 'You are a search query analyzer. Extract search terms and determine intent (username, hashtag, category, or general content). Return JSON only.'
              },
              {
                role: 'user',
                content: query
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_search',
                description: 'Analyze search query and extract relevant information',
                parameters: {
                  type: 'object',
                  properties: {
                    intent: {
                      type: 'string',
                      enum: ['username', 'hashtag', 'category', 'general']
                    },
                    terms: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  },
                  required: ['intent', 'terms']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_search' } }
          }),
        });

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          const args = JSON.parse(toolCall.function.arguments);
          searchIntent = args.intent || 'general';
          extractedTerms = args.terms || [query];
        }
      } catch (error) {
        console.error('AI analysis failed, using fallback:', error);
        extractedTerms = [query];
      }
    } else {
      // Fallback without AI
      extractedTerms = [query];
      if (query.startsWith('@')) {
        searchIntent = 'username';
        extractedTerms = [query.substring(1)];
      } else if (query.startsWith('#')) {
        searchIntent = 'hashtag';
        extractedTerms = [query.substring(1)];
      }
    }

    // Build search query based on intent
    let postsQuery = supabase
      .from('posts')
      .select(`
        *,
        profiles (
          display_name,
          username,
          avatar_url
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    // Apply filters based on intent with sanitized inputs
    switch (searchIntent) {
      case 'username':
        const userSearchTerm = sanitizeForIlike(extractedTerms[0] || sanitizedQuery);
        postsQuery = postsQuery.or(
          `profiles.username.ilike.%${userSearchTerm}%,profiles.display_name.ilike.%${userSearchTerm}%`
        );
        break;
      
      case 'hashtag':
        const hashtagTerm = sanitizeForIlike(extractedTerms[0] || sanitizedQuery.replace('#', ''));
        postsQuery = postsQuery.ilike('content', `%#${hashtagTerm}%`);
        break;
      
      case 'category':
      case 'general':
      default:
        // Search across content, usernames, and display names with sanitized terms
        const searchTerms = extractedTerms.length > 0 ? extractedTerms : [sanitizedQuery];
        const orConditions = searchTerms.map(term => {
          const safeTerm = sanitizeForIlike(term);
          return `content.ilike.%${safeTerm}%,profiles.username.ilike.%${safeTerm}%,profiles.display_name.ilike.%${safeTerm}%`;
        }).join(',');
        postsQuery = postsQuery.or(orConditions);
        break;
    }

    const { data: posts, error: postsError } = await postsQuery;

    if (postsError) throw postsError;

    return new Response(
      JSON.stringify({ posts, intent: searchIntent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
