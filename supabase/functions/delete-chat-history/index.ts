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

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { user1_username, user2_username } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    console.log(`Deleting chat history between @${user1_username} and @${user2_username}`);

    // 1. Get User IDs from usernames
    const { data: user1, error: user1Error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', user1_username)
      .single();

    const { data: user2, error: user2Error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', user2_username)
      .single();

    if (user1Error || user2Error || !user1 || !user2) {
      console.error('User lookup error:', { user1Error, user2Error });
      throw new Error('Could not find one or both users.');
    }

    const user1_id = user1.id;
    const user2_id = user2.id;

    console.log(`Found users: ${user1_id}, ${user2_id}`);

    // 2. Find the conversation ID they share
    const { data: conversationData, error: convError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .in('user_id', [user1_id, user2_id]);

    if (convError || !conversationData || conversationData.length === 0) {
      console.error('Conversation lookup error:', convError);
      throw new Error('Could not find a conversation between the two users.');
    }

    // Find conversation where both users are participants
    const conversationCounts = conversationData.reduce((acc: Record<string, number>, cp: any) => {
      acc[cp.conversation_id] = (acc[cp.conversation_id] || 0) + 1;
      return acc;
    }, {});

    const conv_id = Object.entries(conversationCounts).find(([_, count]) => count === 2)?.[0];

    if (!conv_id) {
      throw new Error('Could not find a conversation between the two users.');
    }

    console.log(`Found conversation: ${conv_id}`);

    // 3. Delete the messages from that conversation
    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conv_id);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted chat history for conversation ${conv_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Chat history deleted successfully.',
        conversationId: conv_id 
      }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in delete-chat-history:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
