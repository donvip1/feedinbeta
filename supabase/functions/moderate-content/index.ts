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
    // Get auth token and validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contentType, contentId, content, mediaUrl } = await req.json();

    if (!contentType || !contentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the content or is a moderator
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    if (contentType === 'post') {
      const { data: post, error: postError } = await supabaseAdmin
        .from('posts')
        .select('user_id')
        .eq('id', contentId)
        .single();

      if (postError || !post) {
        return new Response(
          JSON.stringify({ error: 'Content not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user is moderator or admin
      const { data: isModerator } = await supabaseAdmin.rpc('has_role', {
        _user_id: user.id,
        _role: 'moderator'
      });

      const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      // Only allow if user owns content or is moderator/admin
      if (post.user_id !== user.id && !isModerator && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Moderating ${contentType} content:`, contentId);
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build moderation prompt
    let moderationPrompt = `Analyze this ${contentType} content for policy violations. Check for:
- Nudity/sexual content
- Violence or graphic content
- Hate speech or harassment
- Self-harm or suicide content
- Spam or scam content
- Misinformation
- Copyright violations

Content to analyze:`;

    if (content) {
      moderationPrompt += `\nText: "${content.substring(0, 500)}"`;
    }
    if (mediaUrl) {
      moderationPrompt += `\nMedia URL: ${mediaUrl}`;
    }

    // Call Lovable AI for moderation analysis
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
            content: 'You are a content moderation AI. Analyze content and return structured findings about policy violations.'
          },
          {
            role: 'user',
            content: moderationPrompt
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_moderation_findings',
              description: 'Report content moderation analysis results',
              parameters: {
                type: 'object',
                properties: {
                  violations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['nudity', 'violence', 'hate_speech', 'self_harm', 'spam', 'misinformation', 'copyright', 'none']
                        },
                        confidence: { type: 'number', minimum: 0, maximum: 1 },
                        severity: {
                          type: 'string',
                          enum: ['low', 'medium', 'high', 'critical']
                        },
                        description: { type: 'string' }
                      },
                      required: ['type', 'confidence', 'severity']
                    }
                  },
                  recommended_action: {
                    type: 'string',
                    enum: ['allow', 'hold', 'remove', 'mute_audio', 'blur', 'review']
                  },
                  reasoning: { type: 'string' }
                },
                required: ['violations', 'recommended_action', 'reasoning']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'report_moderation_findings' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('AI rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits exhausted. Please add funds.');
      }
      throw new Error(`AI moderation failed: ${aiResponse.statusText}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No moderation result from AI');
    }

    const findings = JSON.parse(toolCall.function.arguments);
    console.log('Moderation findings:', findings);

    // Calculate priority based on violations
    let priority = 'medium';
    const hasHighSeverity = findings.violations.some((v: any) => 
      v.severity === 'high' || v.severity === 'critical'
    );
    const hasSelfHarm = findings.violations.some((v: any) => v.type === 'self_harm');
    
    if (hasSelfHarm) {
      priority = 'urgent';
    } else if (hasHighSeverity) {
      priority = 'high';
    }

    // Store in moderation queue
    const { data: queueEntry, error: queueError } = await supabaseAdmin
      .from('moderation_queue')
      .insert({
        content_type: contentType,
        content_id: contentId,
        post_id: contentType === 'post' ? contentId : null,
        auto_labels: findings.violations.map((v: any) => v.type),
        confidence_scores: findings.violations.reduce((acc: any, v: any) => {
          acc[v.type] = v.confidence;
          return acc;
        }, {}),
        suggested_action: findings.recommended_action,
        priority: priority,
        status: findings.recommended_action === 'allow' ? 'approved' : 'pending'
      })
      .select()
      .single();

    if (queueError) {
      console.error('Queue insert error:', queueError);
      throw queueError;
    }

    // Update content status based on action
    if (contentType === 'post') {
      const moderationStatus = findings.recommended_action === 'allow' ? 'approved' : 
                               findings.recommended_action === 'remove' ? 'removed' : 'held';
      
      await supabaseAdmin
        .from('posts')
        .update({ 
          moderation_status: moderationStatus,
          status: findings.recommended_action === 'remove' ? 'deleted' : 
                 findings.recommended_action === 'hold' ? 'draft' : 'active'
        })
        .eq('id', contentId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        action: findings.recommended_action,
        violations: findings.violations,
        queueId: queueEntry.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Moderation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Moderation failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});