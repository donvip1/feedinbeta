import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const validateInput = (data: any) => {
  if (!data.appealId || !isValidUUID(data.appealId)) {
    throw new Error('Invalid appeal ID format');
  }
  
  if (!data.action || !['accept', 'reject'].includes(data.action)) {
    throw new Error('Invalid action: must be "accept" or "reject"');
  }
  
  if (data.resolution_notes) {
    if (typeof data.resolution_notes !== 'string') {
      throw new Error('Resolution notes must be a string');
    }
    if (data.resolution_notes.length > 1000) {
      throw new Error('Resolution notes must be under 1000 characters');
    }
  }
  
  return data;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is moderator or admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['moderator', 'admin'])
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions: Moderator role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const requestData = await req.json();
    const { appealId, action, resolution_notes } = validateInput(requestData);

    // Update appeal
    const { data: appeal, error: appealError } = await supabase
      .from('moderation_appeals')
      .update({
        status: action === 'accept' ? 'accepted' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        resolution_notes
      })
      .eq('id', appealId)
      .select('*, moderation_events:moderation_event_id(*)')
      .single();

    if (appealError) throw appealError;

    // If appeal accepted, restore content
    if (action === 'accept' && appeal.content_type === 'post') {
      await supabase
        .from('posts')
        .update({ 
          status: 'active',
          moderation_status: 'approved'
        })
        .eq('id', appeal.content_id);

      // Update moderation queue
      await supabase
        .from('moderation_queue')
        .update({ status: 'approved' })
        .eq('content_id', appeal.content_id);
    }

    // Notify user
    await supabase
      .from('notifications')
      .insert({
        user_id: appeal.user_id,
        type: 'system',
        title: action === 'accept' ? 'Appeal Approved' : 'Appeal Denied',
        message: action === 'accept' 
          ? 'Your appeal has been approved and your content has been restored.'
          : `Your appeal has been denied. Reason: ${resolution_notes || 'No reason provided'}`,
        related_type: 'appeal',
        related_id: appealId
      });

    return new Response(
      JSON.stringify({ success: true, appeal }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Appeal processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: error.message.includes('Unauthorized') || error.message.includes('permissions') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
